import { BigNumber } from '@ethersproject/bignumber';
import { Protocol } from '@uniswap/router-sdk';
import { TradeType } from '@uniswap/sdk-core';
import JSBI from 'jsbi';
import _ from 'lodash';
import FixedReverseHeap from 'mnemonist/fixed-reverse-heap';
import Queue from 'mnemonist/queue';
import { HAS_L1_FEE, V2_SUPPORTED } from '../../../util';
import { CurrencyAmount } from '../../../util/amounts';
import { log } from '../../../util/log';
import { metric, MetricLoggerUnit } from '../../../util/metric';
import { routeAmountsToString, routeToString } from '../../../util/routes';
import { usdGasTokensByChain } from '../gas-models';
export async function getBestSwapRoute(amount, percents, routesWithValidQuotes, routeType, chainId, routingConfig, portionProvider, v2GasModel, v3GasModel, swapConfig, providerConfig) {
    const now = Date.now();
    const { forceMixedRoutes } = routingConfig;
    /// Like with forceCrossProtocol, we apply that logic here when determining the bestSwapRoute
    if (forceMixedRoutes) {
        log.info({
            forceMixedRoutes: forceMixedRoutes,
        }, 'Forcing mixed routes by filtering out other route types');
        routesWithValidQuotes = _.filter(routesWithValidQuotes, (quotes) => {
            return quotes.protocol === Protocol.MIXED;
        });
        if (!routesWithValidQuotes) {
            return null;
        }
    }
    // Build a map of percentage of the input to list of valid quotes.
    // Quotes can be null for a variety of reasons (not enough liquidity etc), so we drop them here too.
    const percentToQuotes = {};
    for (const routeWithValidQuote of routesWithValidQuotes) {
        if (!percentToQuotes[routeWithValidQuote.percent]) {
            percentToQuotes[routeWithValidQuote.percent] = [];
        }
        percentToQuotes[routeWithValidQuote.percent].push(routeWithValidQuote);
    }
    metric.putMetric('BuildRouteWithValidQuoteObjects', Date.now() - now, MetricLoggerUnit.Milliseconds);
    // Given all the valid quotes for each percentage find the optimal route.
    const swapRoute = await getBestSwapRouteBy(routeType, percentToQuotes, percents, chainId, (rq) => rq.quoteAdjustedForGas, routingConfig, portionProvider, v2GasModel, v3GasModel, swapConfig, providerConfig);
    // It is possible we were unable to find any valid route given the quotes.
    if (!swapRoute) {
        return null;
    }
    // Due to potential loss of precision when taking percentages of the input it is possible that the sum of the amounts of each
    // route of our optimal quote may not add up exactly to exactIn or exactOut.
    //
    // We check this here, and if there is a mismatch
    // add the missing amount to a random route. The missing amount size should be neglible so the quote should still be highly accurate.
    const { routes: routeAmounts } = swapRoute;
    const totalAmount = _.reduce(routeAmounts, (total, routeAmount) => total.add(routeAmount.amount), CurrencyAmount.fromRawAmount(routeAmounts[0].amount.currency, 0));
    const missingAmount = amount.subtract(totalAmount);
    if (missingAmount.greaterThan(0)) {
        log.info({
            missingAmount: missingAmount.quotient.toString(),
        }, `Optimal route's amounts did not equal exactIn/exactOut total. Adding missing amount to last route in array.`);
        routeAmounts[routeAmounts.length - 1].amount =
            routeAmounts[routeAmounts.length - 1].amount.add(missingAmount);
    }
    log.info({
        routes: routeAmountsToString(routeAmounts),
        numSplits: routeAmounts.length,
        amount: amount.toExact(),
        quote: swapRoute.quote.toExact(),
        quoteGasAdjusted: swapRoute.quoteGasAdjusted.toFixed(Math.min(swapRoute.quoteGasAdjusted.currency.decimals, 2)),
        estimatedGasUSD: swapRoute.estimatedGasUsedUSD.toFixed(Math.min(swapRoute.estimatedGasUsedUSD.currency.decimals, 2)),
        estimatedGasToken: swapRoute.estimatedGasUsedQuoteToken.toFixed(Math.min(swapRoute.estimatedGasUsedQuoteToken.currency.decimals, 2)),
    }, `Found best swap route. ${routeAmounts.length} split.`);
    return swapRoute;
}
export async function getBestSwapRouteBy(routeType, percentToQuotes, percents, chainId, by, routingConfig, portionProvider, v2GasModel, v3GasModel, swapConfig, providerConfig) {
    var _a;
    // Build a map of percentage to sorted list of quotes, with the biggest quote being first in the list.
    const percentToSortedQuotes = _.mapValues(percentToQuotes, (routeQuotes) => {
        return routeQuotes.sort((routeQuoteA, routeQuoteB) => {
            if (routeType == TradeType.EXACT_INPUT) {
                return by(routeQuoteA).greaterThan(by(routeQuoteB)) ? -1 : 1;
            }
            else {
                return by(routeQuoteA).lessThan(by(routeQuoteB)) ? -1 : 1;
            }
        });
    });
    const quoteCompFn = routeType == TradeType.EXACT_INPUT
        ? (a, b) => a.greaterThan(b)
        : (a, b) => a.lessThan(b);
    const sumFn = (currencyAmounts) => {
        let sum = currencyAmounts[0];
        for (let i = 1; i < currencyAmounts.length; i++) {
            sum = sum.add(currencyAmounts[i]);
        }
        return sum;
    };
    let bestQuote;
    let bestSwap;
    // Min-heap for tracking the 5 best swaps given some number of splits.
    const bestSwapsPerSplit = new FixedReverseHeap(Array, (a, b) => {
        return quoteCompFn(a.quote, b.quote) ? -1 : 1;
    }, 3);
    const { minSplits, maxSplits, forceCrossProtocol } = routingConfig;
    if (!percentToSortedQuotes[100] || minSplits > 1 || forceCrossProtocol) {
        log.info({
            percentToSortedQuotes: _.mapValues(percentToSortedQuotes, (p) => p.length),
        }, 'Did not find a valid route without any splits. Continuing search anyway.');
    }
    else {
        bestQuote = by(percentToSortedQuotes[100][0]);
        bestSwap = [percentToSortedQuotes[100][0]];
        for (const routeWithQuote of percentToSortedQuotes[100].slice(0, 5)) {
            bestSwapsPerSplit.push({
                quote: by(routeWithQuote),
                routes: [routeWithQuote],
            });
        }
    }
    // We do a BFS. Each additional node in a path represents us adding an additional split to the route.
    const queue = new Queue();
    // First we seed BFS queue with the best quotes for each percentage.
    // i.e. [best quote when sending 10% of amount, best quote when sending 20% of amount, ...]
    // We will explore the various combinations from each node.
    for (let i = percents.length; i >= 0; i--) {
        const percent = percents[i];
        if (!percentToSortedQuotes[percent]) {
            continue;
        }
        queue.enqueue({
            curRoutes: [percentToSortedQuotes[percent][0]],
            percentIndex: i,
            remainingPercent: 100 - percent,
            special: false,
        });
        if (!percentToSortedQuotes[percent] ||
            !percentToSortedQuotes[percent][1]) {
            continue;
        }
        queue.enqueue({
            curRoutes: [percentToSortedQuotes[percent][1]],
            percentIndex: i,
            remainingPercent: 100 - percent,
            special: true,
        });
    }
    let splits = 1;
    let startedSplit = Date.now();
    while (queue.size > 0) {
        metric.putMetric(`Split${splits}Done`, Date.now() - startedSplit, MetricLoggerUnit.Milliseconds);
        startedSplit = Date.now();
        log.info({
            top5: _.map(Array.from(bestSwapsPerSplit.consume()), (q) => `${q.quote.toExact()} (${_(q.routes)
                .map((r) => r.toString())
                .join(', ')})`),
            onQueue: queue.size,
        }, `Top 3 with ${splits} splits`);
        bestSwapsPerSplit.clear();
        // Size of the queue at this point is the number of potential routes we are investigating for the given number of splits.
        let layer = queue.size;
        splits++;
        // If we didn't improve our quote by adding another split, very unlikely to improve it by splitting more after that.
        if (splits >= 3 && bestSwap && bestSwap.length < splits - 1) {
            break;
        }
        if (splits > maxSplits) {
            log.info('Max splits reached. Stopping search.');
            metric.putMetric(`MaxSplitsHitReached`, 1, MetricLoggerUnit.Count);
            break;
        }
        while (layer > 0) {
            layer--;
            const { remainingPercent, curRoutes, percentIndex, special } = queue.dequeue();
            // For all other percentages, add a new potential route.
            // E.g. if our current aggregated route if missing 50%, we will create new nodes and add to the queue for:
            // 50% + new 10% route, 50% + new 20% route, etc.
            for (let i = percentIndex; i >= 0; i--) {
                const percentA = percents[i];
                if (percentA > remainingPercent) {
                    continue;
                }
                // At some point the amount * percentage is so small that the quoter is unable to get
                // a quote. In this case there could be no quotes for that percentage.
                if (!percentToSortedQuotes[percentA]) {
                    continue;
                }
                const candidateRoutesA = percentToSortedQuotes[percentA];
                // Find the best route in the complimentary percentage that doesn't re-use a pool already
                // used in the current route. Re-using pools is not allowed as each swap through a pool changes its liquidity,
                // so it would make the quotes inaccurate.
                const routeWithQuoteA = findFirstRouteNotUsingUsedPools(curRoutes, candidateRoutesA, forceCrossProtocol);
                if (!routeWithQuoteA) {
                    continue;
                }
                const remainingPercentNew = remainingPercent - percentA;
                const curRoutesNew = [...curRoutes, routeWithQuoteA];
                // If we've found a route combination that uses all 100%, and it has at least minSplits, update our best route.
                if (remainingPercentNew == 0 && splits >= minSplits) {
                    const quotesNew = _.map(curRoutesNew, (r) => by(r));
                    const quoteNew = sumFn(quotesNew);
                    let gasCostL1QuoteToken = CurrencyAmount.fromRawAmount(quoteNew.currency, 0);
                    if (HAS_L1_FEE.includes(chainId)) {
                        if (v2GasModel == undefined && v3GasModel == undefined) {
                            throw new Error("Can't compute L1 gas fees.");
                        }
                        else {
                            const v2Routes = curRoutesNew.filter((routes) => routes.protocol === Protocol.V2);
                            if (v2Routes.length > 0 && V2_SUPPORTED.includes(chainId)) {
                                if (v2GasModel) {
                                    const v2GasCostL1 = await v2GasModel.calculateL1GasFees(v2Routes);
                                    gasCostL1QuoteToken = gasCostL1QuoteToken.add(v2GasCostL1.gasCostL1QuoteToken);
                                }
                            }
                            const v3Routes = curRoutesNew.filter((routes) => routes.protocol === Protocol.V3);
                            if (v3Routes.length > 0) {
                                if (v3GasModel) {
                                    const v3GasCostL1 = await v3GasModel.calculateL1GasFees(v3Routes);
                                    gasCostL1QuoteToken = gasCostL1QuoteToken.add(v3GasCostL1.gasCostL1QuoteToken);
                                }
                            }
                        }
                    }
                    const quoteAfterL1Adjust = routeType == TradeType.EXACT_INPUT
                        ? quoteNew.subtract(gasCostL1QuoteToken)
                        : quoteNew.add(gasCostL1QuoteToken);
                    bestSwapsPerSplit.push({
                        quote: quoteAfterL1Adjust,
                        routes: curRoutesNew,
                    });
                    if (!bestQuote || quoteCompFn(quoteAfterL1Adjust, bestQuote)) {
                        bestQuote = quoteAfterL1Adjust;
                        bestSwap = curRoutesNew;
                        // Temporary experiment.
                        if (special) {
                            metric.putMetric(`BestSwapNotPickingBestForPercent`, 1, MetricLoggerUnit.Count);
                        }
                    }
                }
                else {
                    queue.enqueue({
                        curRoutes: curRoutesNew,
                        remainingPercent: remainingPercentNew,
                        percentIndex: i,
                        special,
                    });
                }
            }
        }
    }
    if (!bestSwap) {
        log.info(`Could not find a valid swap`);
        return undefined;
    }
    const postSplitNow = Date.now();
    let quoteGasAdjusted = sumFn(_.map(bestSwap, (routeWithValidQuote) => routeWithValidQuote.quoteAdjustedForGas));
    // this calculates the base gas used
    // if on L1, its the estimated gas used based on hops and ticks across all the routes
    // if on L2, its the gas used on the L2 based on hops and ticks across all the routes
    const estimatedGasUsed = _(bestSwap)
        .map((routeWithValidQuote) => routeWithValidQuote.gasEstimate)
        .reduce((sum, routeWithValidQuote) => sum.add(routeWithValidQuote), BigNumber.from(0));
    if (!usdGasTokensByChain[chainId] || !usdGasTokensByChain[chainId][0]) {
        // Each route can use a different stablecoin to account its gas costs.
        // They should all be pegged, and this is just an estimate, so we do a merge
        // to an arbitrary stable.
        throw new Error(`Could not find a USD token for computing gas costs on ${chainId}`);
    }
    const usdToken = usdGasTokensByChain[chainId][0];
    const usdTokenDecimals = usdToken.decimals;
    // if on L2, calculate the L1 security fee
    const gasCostsL1ToL2 = {
        gasUsedL1: BigNumber.from(0),
        gasUsedL1OnL2: BigNumber.from(0),
        gasCostL1USD: CurrencyAmount.fromRawAmount(usdToken, 0),
        gasCostL1QuoteToken: CurrencyAmount.fromRawAmount(
        // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
        (_a = bestSwap[0]) === null || _a === void 0 ? void 0 : _a.quoteToken, 0),
    };
    // If swapping on an L2 that includes a L1 security fee, calculate the fee and include it in the gas adjusted quotes
    if (HAS_L1_FEE.includes(chainId)) {
        if (v2GasModel == undefined && v3GasModel == undefined) {
            throw new Error("Can't compute L1 gas fees.");
        }
        else {
            // Before v2 deploy everywhere, a quote on L2 can only go through v3 protocol,
            // so a split between v2 and v3 is not possible.
            // After v2 deploy everywhere, a quote on L2 can go through v2 AND v3 protocol.
            // Since a split is possible now, the gas cost will be the summation of both v2 and v3 gas models.
            // So as long as any route contains v2/v3 protocol, we will calculate the gas cost accumulatively.
            const v2Routes = bestSwap.filter((routes) => routes.protocol === Protocol.V2);
            if (v2Routes.length > 0 && V2_SUPPORTED.includes(chainId)) {
                if (v2GasModel) {
                    const v2GasCostL1 = await v2GasModel.calculateL1GasFees(v2Routes);
                    gasCostsL1ToL2.gasUsedL1 = gasCostsL1ToL2.gasUsedL1.add(v2GasCostL1.gasUsedL1);
                    gasCostsL1ToL2.gasUsedL1OnL2 = gasCostsL1ToL2.gasUsedL1OnL2.add(v2GasCostL1.gasUsedL1OnL2);
                    if (gasCostsL1ToL2.gasCostL1USD.currency.equals(v2GasCostL1.gasCostL1USD.currency)) {
                        gasCostsL1ToL2.gasCostL1USD = gasCostsL1ToL2.gasCostL1USD.add(v2GasCostL1.gasCostL1USD);
                    }
                    else {
                        // This is to handle the case where gasCostsL1ToL2.gasCostL1USD and v2GasCostL1.gasCostL1USD have different currencies.
                        //
                        // gasCostsL1ToL2.gasCostL1USD was initially hardcoded to CurrencyAmount.fromRawAmount(usdGasTokensByChain[chainId]![0]!, 0)
                        // (https://github.com/Uniswap/smart-order-router/blob/main/src/routers/alpha-router/functions/best-swap-route.ts#L438)
                        // , where usdGasTokensByChain is coded in the descending order of decimals per chain,
                        // e.g. Arbitrum_one DAI (18 decimals), USDC bridged (6 decimals), USDC native (6 decimals)
                        // so gasCostsL1ToL2.gasCostL1USD will have DAI as currency.
                        //
                        // For v2GasCostL1.gasCostL1USD, it's calculated within getHighestLiquidityUSDPool among usdGasTokensByChain[chainId]!,
                        // (https://github.com/Uniswap/smart-order-router/blob/b970aedfec8a9509f9e22f14cc5c11be54d47b35/src/routers/alpha-router/gas-models/v2/v2-heuristic-gas-model.ts#L220)
                        // , so the code will actually see which USD pool has the highest liquidity, if any.
                        // e.g. Arbitrum_one on v2 only has liquidity on USDC native
                        // so v2GasCostL1.gasCostL1USD will have USDC native as currency.
                        //
                        // We will re-assign gasCostsL1ToL2.gasCostL1USD to v2GasCostL1.gasCostL1USD in this case.
                        gasCostsL1ToL2.gasCostL1USD = v2GasCostL1.gasCostL1USD;
                    }
                    gasCostsL1ToL2.gasCostL1QuoteToken =
                        gasCostsL1ToL2.gasCostL1QuoteToken.add(v2GasCostL1.gasCostL1QuoteToken);
                }
            }
            const v3Routes = bestSwap.filter((routes) => routes.protocol === Protocol.V3);
            if (v3Routes.length > 0) {
                if (v3GasModel) {
                    const v3GasCostL1 = await v3GasModel.calculateL1GasFees(v3Routes);
                    gasCostsL1ToL2.gasUsedL1 = gasCostsL1ToL2.gasUsedL1.add(v3GasCostL1.gasUsedL1);
                    gasCostsL1ToL2.gasUsedL1OnL2 = gasCostsL1ToL2.gasUsedL1OnL2.add(v3GasCostL1.gasUsedL1OnL2);
                    if (gasCostsL1ToL2.gasCostL1USD.currency.equals(v3GasCostL1.gasCostL1USD.currency)) {
                        gasCostsL1ToL2.gasCostL1USD = gasCostsL1ToL2.gasCostL1USD.add(v3GasCostL1.gasCostL1USD);
                    }
                    else {
                        // This is to handle the case where gasCostsL1ToL2.gasCostL1USD and v3GasCostL1.gasCostL1USD have different currencies.
                        //
                        // gasCostsL1ToL2.gasCostL1USD was initially hardcoded to CurrencyAmount.fromRawAmount(usdGasTokensByChain[chainId]![0]!, 0)
                        // (https://github.com/Uniswap/smart-order-router/blob/main/src/routers/alpha-router/functions/best-swap-route.ts#L438)
                        // , where usdGasTokensByChain is coded in the descending order of decimals per chain,
                        // e.g. Arbitrum_one DAI (18 decimals), USDC bridged (6 decimals), USDC native (6 decimals)
                        // so gasCostsL1ToL2.gasCostL1USD will have DAI as currency.
                        //
                        // For v3GasCostL1.gasCostL1USD, it's calculated within getHighestLiquidityV3USDPool among usdGasTokensByChain[chainId]!,
                        // (https://github.com/Uniswap/smart-order-router/blob/1c93e133c46af545f8a3d8af7fca3f1f2dcf597d/src/util/gas-factory-helpers.ts#L110)
                        // , so the code will actually see which USD pool has the highest liquidity, if any.
                        // e.g. Arbitrum_one on v3 has highest liquidity on USDC native
                        // so v3GasCostL1.gasCostL1USD will have USDC native as currency.
                        //
                        // We will re-assign gasCostsL1ToL2.gasCostL1USD to v3GasCostL1.gasCostL1USD in this case.
                        gasCostsL1ToL2.gasCostL1USD = v3GasCostL1.gasCostL1USD;
                    }
                    gasCostsL1ToL2.gasCostL1QuoteToken =
                        gasCostsL1ToL2.gasCostL1QuoteToken.add(v3GasCostL1.gasCostL1QuoteToken);
                }
            }
        }
    }
    const { gasUsedL1OnL2, gasCostL1USD, gasCostL1QuoteToken } = gasCostsL1ToL2;
    // For each gas estimate, normalize decimals to that of the chosen usd token.
    const estimatedGasUsedUSDs = _(bestSwap)
        .map((routeWithValidQuote) => {
        // TODO: will error if gasToken has decimals greater than usdToken
        const decimalsDiff = usdTokenDecimals - routeWithValidQuote.gasCostInUSD.currency.decimals;
        if (decimalsDiff == 0) {
            return CurrencyAmount.fromRawAmount(usdToken, routeWithValidQuote.gasCostInUSD.quotient);
        }
        if (decimalsDiff < 0 && chainId === 324) {
            log.error(`Decimals diff is negative for ZkSync. This should not happen.
          usdTokenDecimals ${usdTokenDecimals} routeWithValidQuote.gasCostInUSD.currency.decimals
          ${routeWithValidQuote.gasCostInUSD.currency.decimals} ${JSON.stringify(routeWithValidQuote)}`);
        }
        return CurrencyAmount.fromRawAmount(usdToken, JSBI.multiply(routeWithValidQuote.gasCostInUSD.quotient, JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimalsDiff))));
    })
        .value();
    let estimatedGasUsedUSD = sumFn(estimatedGasUsedUSDs);
    // if they are different usd pools, convert to the usdToken
    if (estimatedGasUsedUSD.currency != gasCostL1USD.currency) {
        const decimalsDiff = usdTokenDecimals - gasCostL1USD.currency.decimals;
        estimatedGasUsedUSD = estimatedGasUsedUSD.add(CurrencyAmount.fromRawAmount(usdToken, JSBI.multiply(gasCostL1USD.quotient, JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimalsDiff)))));
    }
    else {
        estimatedGasUsedUSD = estimatedGasUsedUSD.add(gasCostL1USD);
    }
    log.info({
        estimatedGasUsedUSD: estimatedGasUsedUSD.toExact(),
        normalizedUsdToken: usdToken,
        routeUSDGasEstimates: _.map(bestSwap, (b) => `${b.percent}% ${routeToString(b.route)} ${b.gasCostInUSD.toExact()}`),
        flatL1GasCostUSD: gasCostL1USD.toExact(),
    }, 'USD gas estimates of best route');
    const estimatedGasUsedQuoteToken = sumFn(_.map(bestSwap, (routeWithValidQuote) => routeWithValidQuote.gasCostInToken)).add(gasCostL1QuoteToken);
    let estimatedGasUsedGasToken;
    if (routingConfig.gasToken) {
        // sum the gas costs in the gas token across all routes
        // if there is a route with undefined gasCostInGasToken, throw an error
        if (bestSwap.some((routeWithValidQuote) => routeWithValidQuote.gasCostInGasToken === undefined)) {
            log.info({
                bestSwap,
                routingConfig,
            }, 'Could not find gasCostInGasToken for a route in bestSwap');
            throw new Error("Can't compute estimatedGasUsedGasToken");
        }
        estimatedGasUsedGasToken = sumFn(_.map(bestSwap, 
        // ok to type cast here because we throw above if any are not defined
        (routeWithValidQuote) => routeWithValidQuote.gasCostInGasToken));
    }
    const quote = sumFn(_.map(bestSwap, (routeWithValidQuote) => routeWithValidQuote.quote));
    // Adjust the quoteGasAdjusted for the l1 fee
    if (routeType == TradeType.EXACT_INPUT) {
        const quoteGasAdjustedForL1 = quoteGasAdjusted.subtract(gasCostL1QuoteToken);
        quoteGasAdjusted = quoteGasAdjustedForL1;
    }
    else {
        const quoteGasAdjustedForL1 = quoteGasAdjusted.add(gasCostL1QuoteToken);
        quoteGasAdjusted = quoteGasAdjustedForL1;
    }
    const routeWithQuotes = bestSwap.sort((routeAmountA, routeAmountB) => routeAmountB.amount.greaterThan(routeAmountA.amount) ? 1 : -1);
    metric.putMetric('PostSplitDone', Date.now() - postSplitNow, MetricLoggerUnit.Milliseconds);
    return {
        quote,
        quoteGasAdjusted,
        estimatedGasUsed: estimatedGasUsed.add(gasUsedL1OnL2),
        estimatedGasUsedUSD,
        estimatedGasUsedQuoteToken,
        estimatedGasUsedGasToken,
        routes: portionProvider.getRouteWithQuotePortionAdjusted(routeType, routeWithQuotes, swapConfig, providerConfig),
    };
}
// We do not allow pools to be re-used across split routes, as swapping through a pool changes the pools state.
// Given a list of used routes, this function finds the first route in the list of candidate routes that does not re-use an already used pool.
const findFirstRouteNotUsingUsedPools = (usedRoutes, candidateRouteQuotes, forceCrossProtocol) => {
    const poolAddressSet = new Set();
    const usedPoolAddresses = _(usedRoutes)
        .flatMap((r) => r.poolAddresses)
        .value();
    for (const poolAddress of usedPoolAddresses) {
        poolAddressSet.add(poolAddress);
    }
    const protocolsSet = new Set();
    const usedProtocols = _(usedRoutes)
        .flatMap((r) => r.protocol)
        .uniq()
        .value();
    for (const protocol of usedProtocols) {
        protocolsSet.add(protocol);
    }
    for (const routeQuote of candidateRouteQuotes) {
        const { poolAddresses, protocol } = routeQuote;
        if (poolAddresses.some((poolAddress) => poolAddressSet.has(poolAddress))) {
            continue;
        }
        // This code is just for debugging. Allows us to force a cross-protocol split route by skipping
        // consideration of routes that come from the same protocol as a used route.
        const needToForce = forceCrossProtocol && protocolsSet.size == 1;
        if (needToForce && protocolsSet.has(protocol)) {
            continue;
        }
        return routeQuote;
    }
    return null;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmVzdC1zd2FwLXJvdXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2Z1bmN0aW9ucy9iZXN0LXN3YXAtcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLDBCQUEwQixDQUFDO0FBQ3JELE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUMvQyxPQUFPLEVBQVcsU0FBUyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDdkQsT0FBTyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQ3hCLE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUN2QixPQUFPLGdCQUFnQixNQUFNLDhCQUE4QixDQUFDO0FBQzVELE9BQU8sS0FBSyxNQUFNLGlCQUFpQixDQUFDO0FBR3BDLE9BQU8sRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3pELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQztBQUN2RCxPQUFPLEVBQUUsR0FBRyxFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFDeEMsT0FBTyxFQUFFLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLHNCQUFzQixDQUFDO0FBQ2hFLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxhQUFhLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUczRSxPQUFPLEVBQTZCLG1CQUFtQixFQUFFLE1BQU0sZUFBZSxDQUFDO0FBbUIvRSxNQUFNLENBQUMsS0FBSyxVQUFVLGdCQUFnQixDQUNwQyxNQUFzQixFQUN0QixRQUFrQixFQUNsQixxQkFBNEMsRUFDNUMsU0FBb0IsRUFDcEIsT0FBZ0IsRUFDaEIsYUFBZ0MsRUFDaEMsZUFBaUMsRUFDakMsVUFBNkMsRUFDN0MsVUFBNkMsRUFDN0MsVUFBd0IsRUFDeEIsY0FBK0I7SUFFL0IsTUFBTSxHQUFHLEdBQUcs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