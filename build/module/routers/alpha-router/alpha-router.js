import { BigNumber } from '@ethersproject/bignumber';
import { JsonRpcProvider } from '@ethersproject/providers';
import DEFAULT_TOKEN_LIST from '@uniswap/default-token-list';
import { Protocol, SwapRouter, ZERO } from '@uniswap/router-sdk';
import { ChainId, Fraction, TradeType, } from '@uniswap/sdk-core';
import { Pool, Position, SqrtPriceMath, TickMath } from '@uniswap/v3-sdk';
import retry from 'async-retry';
import JSBI from 'jsbi';
import _ from 'lodash';
import NodeCache from 'node-cache';
import { CachedRoutes, CacheMode, CachingGasStationProvider, CachingTokenProviderWithFallback, CachingV2PoolProvider, CachingV2SubgraphProvider, CachingV3PoolProvider, CachingV3SubgraphProvider, CachingV4SubgraphProvider, EIP1559GasPriceProvider, ETHGasStationInfoProvider, LegacyGasPriceProvider, NodeJSCache, OnChainGasPriceProvider, OnChainQuoteProvider, StaticV2SubgraphProvider, StaticV3SubgraphProvider, StaticV4SubgraphProvider, SwapRouterProvider, TokenPropertiesProvider, UniswapMulticallProvider, URISubgraphProvider, V2QuoteProvider, V2SubgraphProviderWithFallBacks, V3SubgraphProviderWithFallBacks, V4SubgraphProviderWithFallBacks, } from '../../providers';
import { CachingTokenListProvider, } from '../../providers/caching-token-list-provider';
import { PortionProvider, } from '../../providers/portion-provider';
import { OnChainTokenFeeFetcher } from '../../providers/token-fee-fetcher';
import { TokenProvider } from '../../providers/token-provider';
import { TokenValidatorProvider, } from '../../providers/token-validator-provider';
import { V2PoolProvider, } from '../../providers/v2/pool-provider';
import { ArbitrumGasDataProvider, } from '../../providers/v3/gas-data-provider';
import { V3PoolProvider, } from '../../providers/v3/pool-provider';
import { Erc20__factory } from '../../types/other/factories/Erc20__factory';
import { SWAP_ROUTER_02_ADDRESSES, WRAPPED_NATIVE_CURRENCY } from '../../util';
import { CurrencyAmount } from '../../util/amounts';
import { ID_TO_CHAIN_ID, ID_TO_NETWORK_NAME, V2_SUPPORTED, } from '../../util/chains';
import { getHighestLiquidityV3NativePool, getHighestLiquidityV3USDPool, } from '../../util/gas-factory-helpers';
import { log } from '../../util/log';
import { buildSwapMethodParameters, buildTrade, } from '../../util/methodParameters';
import { metric, MetricLoggerUnit } from '../../util/metric';
import { BATCH_PARAMS, BLOCK_NUMBER_CONFIGS, DEFAULT_BATCH_PARAMS, DEFAULT_BLOCK_NUMBER_CONFIGS, DEFAULT_GAS_ERROR_FAILURE_OVERRIDES, DEFAULT_RETRY_OPTIONS, DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES, GAS_ERROR_FAILURE_OVERRIDES, RETRY_OPTIONS, SUCCESS_RATE_FAILURE_OVERRIDES, } from '../../util/onchainQuoteProviderConfigs';
import { UNSUPPORTED_TOKENS } from '../../util/unsupported-tokens';
import { SwapToRatioStatus, SwapType } from '../router';
import { CachingV4PoolProvider } from '../../providers/v4/caching-pool-provider';
import { V4PoolProvider, } from '../../providers/v4/pool-provider';
import { DEFAULT_ROUTING_CONFIG_BY_CHAIN, ETH_GAS_STATION_API_URL, } from './config';
import { getBestSwapRoute } from './functions/best-swap-route';
import { calculateRatioAmountIn } from './functions/calculate-ratio-amount-in';
import { getMixedCrossLiquidityCandidatePools, getV2CandidatePools, getV3CandidatePools, getV4CandidatePools, } from './functions/get-candidate-pools';
import { MixedRouteHeuristicGasModelFactory } from './gas-models/mixedRoute/mixed-route-heuristic-gas-model';
import { V2HeuristicGasModelFactory } from './gas-models/v2/v2-heuristic-gas-model';
import { NATIVE_OVERHEAD } from './gas-models/v3/gas-costs';
import { V3HeuristicGasModelFactory } from './gas-models/v3/v3-heuristic-gas-model';
import { MixedQuoter, V2Quoter, V3Quoter } from './quoters';
import { V4Quoter } from './quoters/v4-quoter';
export class MapWithLowerCaseKey extends Map {
    set(key, value) {
        return super.set(key.toLowerCase(), value);
    }
}
export class LowerCaseStringArray extends Array {
    constructor(...items) {
        // Convert all items to lowercase before calling the parent constructor
        super(...items.map((item) => item.toLowerCase()));
    }
}
export class AlphaRouter {
    constructor({ chainId, provider, multicall2Provider, v4SubgraphProvider, v4PoolProvider, v3PoolProvider, onChainQuoteProvider, v2PoolProvider, v2QuoteProvider, v2SubgraphProvider, tokenProvider, blockedTokenListProvider, v3SubgraphProvider, gasPriceProvider, v3GasModelFactory, v2GasModelFactory, mixedRouteGasModelFactory, swapRouterProvider, tokenValidatorProvider, arbitrumGasDataProvider, simulator, routeCachingProvider, tokenPropertiesProvider, portionProvider, v2Supported, }) {
        this.chainId = chainId;
        this.provider = provider;
        this.multicall2Provider =
            multicall2Provider !== null && multicall2Provider !== void 0 ? multicall2Provider : new UniswapMulticallProvider(chainId, provider, 375000);
        this.v4PoolProvider =
            v4PoolProvider !== null && v4PoolProvider !== void 0 ? v4PoolProvider : new CachingV4PoolProvider(this.chainId, new V4PoolProvider(ID_TO_CHAIN_ID(chainId), this.multicall2Provider), new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false })));
        this.v3PoolProvider =
            v3PoolProvider !== null && v3PoolProvider !== void 0 ? v3PoolProvider : new CachingV3PoolProvider(this.chainId, new V3PoolProvider(ID_TO_CHAIN_ID(chainId), this.multicall2Provider), new NodeJSCache(new NodeCache({ stdTTL: 360, useClones: false })));
        this.simulator = simulator;
        this.routeCachingProvider = routeCachingProvider;
        if (onChainQuoteProvider) {
            this.onChainQuoteProvider = onChainQuoteProvider;
        }
        else {
            switch (chainId) {
                case ChainId.OPTIMISM:
                case ChainId.OPTIMISM_GOERLI:
                case ChainId.OPTIMISM_SEPOLIA:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, {
                        retries: 2,
                        minTimeout: 100,
                        maxTimeout: 1000,
                    }, (_) => {
                        return {
                            multicallChunk: 110,
                            gasLimitPerCall: 1200000,
                            quoteMinSuccessRate: 0.1,
                        };
                    }, {
                        gasLimitOverride: 3000000,
                        multicallChunk: 45,
                    }, {
                        gasLimitOverride: 3000000,
                        multicallChunk: 45,
                    }, {
                        baseBlockOffset: -10,
                        rollback: {
                            enabled: true,
                            attemptsBeforeRollback: 1,
                            rollbackBlockOffset: -10,
                        },
                    });
                    break;
                case ChainId.BASE:
                case ChainId.BLAST:
                case ChainId.ZORA:
                case ChainId.BASE_GOERLI:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, {
                        retries: 2,
                        minTimeout: 100,
                        maxTimeout: 1000,
                    }, (_) => {
                        return {
                            multicallChunk: 80,
                            gasLimitPerCall: 1200000,
                            quoteMinSuccessRate: 0.1,
                        };
                    }, {
                        gasLimitOverride: 3000000,
                        multicallChunk: 45,
                    }, {
                        gasLimitOverride: 3000000,
                        multicallChunk: 45,
                    }, {
                        baseBlockOffset: -10,
                        rollback: {
                            enabled: true,
                            attemptsBeforeRollback: 1,
                            rollbackBlockOffset: -10,
                        },
                    });
                    break;
                case ChainId.ZKSYNC:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, {
                        retries: 2,
                        minTimeout: 100,
                        maxTimeout: 1000,
                    }, (_) => {
                        return {
                            multicallChunk: 27,
                            gasLimitPerCall: 3000000,
                            quoteMinSuccessRate: 0.1,
                        };
                    }, {
                        gasLimitOverride: 6000000,
                        multicallChunk: 13,
                    }, {
                        gasLimitOverride: 6000000,
                        multicallChunk: 13,
                    }, {
                        baseBlockOffset: -10,
                        rollback: {
                            enabled: true,
                            attemptsBeforeRollback: 1,
                            rollbackBlockOffset: -10,
                        },
                    });
                    break;
                case ChainId.ARBITRUM_ONE:
                case ChainId.ARBITRUM_GOERLI:
                case ChainId.ARBITRUM_SEPOLIA:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, {
                        retries: 2,
                        minTimeout: 100,
                        maxTimeout: 1000,
                    }, (_) => {
                        return {
                            multicallChunk: 10,
                            gasLimitPerCall: 12000000,
                            quoteMinSuccessRate: 0.1,
                        };
                    }, {
                        gasLimitOverride: 30000000,
                        multicallChunk: 6,
                    }, {
                        gasLimitOverride: 30000000,
                        multicallChunk: 6,
                    });
                    break;
                case ChainId.CELO:
                case ChainId.CELO_ALFAJORES:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, {
                        retries: 2,
                        minTimeout: 100,
                        maxTimeout: 1000,
                    }, (_) => {
                        return {
                            multicallChunk: 10,
                            gasLimitPerCall: 5000000,
                            quoteMinSuccessRate: 0.1,
                        };
                    }, {
                        gasLimitOverride: 5000000,
                        multicallChunk: 5,
                    }, {
                        gasLimitOverride: 6250000,
                        multicallChunk: 4,
                    });
                    break;
                case ChainId.POLYGON_MUMBAI:
                case ChainId.SEPOLIA:
                case ChainId.MAINNET:
                case ChainId.POLYGON:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, RETRY_OPTIONS[chainId], (_) => BATCH_PARAMS[chainId], GAS_ERROR_FAILURE_OVERRIDES[chainId], SUCCESS_RATE_FAILURE_OVERRIDES[chainId], BLOCK_NUMBER_CONFIGS[chainId]);
                    break;
                default:
                    this.onChainQuoteProvider = new OnChainQuoteProvider(chainId, provider, this.multicall2Provider, DEFAULT_RETRY_OPTIONS, (_) => DEFAULT_BATCH_PARAMS, DEFAULT_GAS_ERROR_FAILURE_OVERRIDES, DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES, DEFAULT_BLOCK_NUMBER_CONFIGS);
                    break;
            }
        }
        if (tokenValidatorProvider) {
            this.tokenValidatorProvider = tokenValidatorProvider;
        }
        else if (this.chainId === ChainId.MAINNET) {
            this.tokenValidatorProvider = new TokenValidatorProvider(this.chainId, this.multicall2Provider, new NodeJSCache(new NodeCache({ stdTTL: 30000, useClones: false })));
        }
        if (tokenPropertiesProvider) {
            this.tokenPropertiesProvider = tokenPropertiesProvider;
        }
        else {
            this.tokenPropertiesProvider = new TokenPropertiesProvider(this.chainId, new NodeJSCache(new NodeCache({ stdTTL: 86400, useClones: false })), new OnChainTokenFeeFetcher(this.chainId, provider));
        }
        this.v2PoolProvider =
            v2PoolProvider !== null && v2PoolProvider !== void 0 ? v2PoolProvider : new CachingV2PoolProvider(chainId, new V2PoolProvider(chainId, this.multicall2Provider, this.tokenPropertiesProvider), new NodeJSCache(new NodeCache({ stdTTL: 60, useClones: false })));
        this.v2QuoteProvider = v2QuoteProvider !== null && v2QuoteProvider !== void 0 ? v2QuoteProvider : new V2QuoteProvider();
        this.blockedTokenListProvider =
            blockedTokenListProvider !== null && blockedTokenListProvider !== void 0 ? blockedTokenListProvider : new CachingTokenListProvider(chainId, UNSUPPORTED_TOKENS, new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false })));
        this.tokenProvider =
            tokenProvider !== null && tokenProvider !== void 0 ? tokenProvider : new CachingTokenProviderWithFallback(chainId, new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false })), new CachingTokenListProvider(chainId, DEFAULT_TOKEN_LIST, new NodeJSCache(new NodeCache({ stdTTL: 3600, useClones: false }))), new TokenProvider(chainId, this.multicall2Provider));
        this.portionProvider = portionProvider !== null && portionProvider !== void 0 ? portionProvider : new PortionProvider();
        const chainName = ID_TO_NETWORK_NAME(chainId);
        // ipfs urls in the following format: `https://cloudflare-ipfs.com/ipns/api.uniswap.org/v1/pools/${protocol}/${chainName}.json`;
        if (v2SubgraphProvider) {
            this.v2SubgraphProvider = v2SubgraphProvider;
        }
        else {
            this.v2SubgraphProvider = new V2SubgraphProviderWithFallBacks([
                new CachingV2SubgraphProvider(chainId, new URISubgraphProvider(chainId, `https://cloudflare-ipfs.com/ipns/api.uniswap.org/v1/pools/v2/${chainName}.json`, undefined, 0), new NodeJSCache(new NodeCache({ stdTTL: 300, useClones: false }))),
                new StaticV2SubgraphProvider(chainId),
            ]);
        }
        if (v3SubgraphProvider) {
            this.v3SubgraphProvider = v3SubgraphProvider;
        }
        else {
            this.v3SubgraphProvider = new V3SubgraphProviderWithFallBacks([
                new CachingV3SubgraphProvider(chainId, new URISubgraphProvider(chainId, `https://cloudflare-ipfs.com/ipns/api.uniswap.org/v1/pools/v3/${chainName}.json`, undefined, 0), new NodeJSCache(new NodeCache({ stdTTL: 300, useClones: false }))),
                new StaticV3SubgraphProvider(chainId, this.v3PoolProvider),
            ]);
        }
        if (v4SubgraphProvider) {
            this.v4SubgraphProvider = v4SubgraphProvider;
        }
        else {
            this.v4SubgraphProvider = new V4SubgraphProviderWithFallBacks([
                new CachingV4SubgraphProvider(chainId, new URISubgraphProvider(chainId, `https://cloudflare-ipfs.com/ipns/api.uniswap.org/v1/pools/v4/${chainName}.json`, undefined, 0), new NodeJSCache(new NodeCache({ stdTTL: 300, useClones: false }))),
                new StaticV4SubgraphProvider(chainId, this.v4PoolProvider),
            ]);
        }
        let gasPriceProviderInstance;
        if (JsonRpcProvider.isProvider(this.provider)) {
            gasPriceProviderInstance = new OnChainGasPriceProvider(chainId, new EIP1559GasPriceProvider(this.provider), new LegacyGasPriceProvider(this.provider));
        }
        else {
            gasPriceProviderInstance = new ETHGasStationInfoProvider(ETH_GAS_STATION_API_URL);
        }
        this.gasPriceProvider =
            gasPriceProvider !== null && gasPriceProvider !== void 0 ? gasPriceProvider : new CachingGasStationProvider(chainId, gasPriceProviderInstance, new NodeJSCache(new NodeCache({ stdTTL: 7, useClones: false })));
        this.v3GasModelFactory =
            v3GasModelFactory !== null && v3GasModelFactory !== void 0 ? v3GasModelFactory : new V3HeuristicGasModelFactory(this.provider);
        this.v2GasModelFactory =
            v2GasModelFactory !== null && v2GasModelFactory !== void 0 ? v2GasModelFactory : new V2HeuristicGasModelFactory(this.provider);
        this.mixedRouteGasModelFactory =
            mixedRouteGasModelFactory !== null && mixedRouteGasModelFactory !== void 0 ? mixedRouteGasModelFactory : new MixedRouteHeuristicGasModelFactory();
        this.swapRouterProvider =
            swapRouterProvider !== null && swapRouterProvider !== void 0 ? swapRouterProvider : new SwapRouterProvider(this.multicall2Provider, this.chainId);
        if (chainId === ChainId.ARBITRUM_ONE ||
            chainId === ChainId.ARBITRUM_GOERLI) {
            this.l2GasDataProvider =
                arbitrumGasDataProvider !== null && arbitrumGasDataProvider !== void 0 ? arbitrumGasDataProvider : new ArbitrumGasDataProvider(chainId, this.provider);
        }
        // Initialize the Quoters.
        // Quoters are an abstraction encapsulating the business logic of fetching routes and quotes.
        this.v2Quoter = new V2Quoter(this.v2SubgraphProvider, this.v2PoolProvider, this.v2QuoteProvider, this.v2GasModelFactory, this.tokenProvider, this.chainId, this.blockedTokenListProvider, this.tokenValidatorProvider, this.l2GasDataProvider);
        this.v3Quoter = new V3Quoter(this.v3SubgraphProvider, this.v3PoolProvider, this.onChainQuoteProvider, this.tokenProvider, this.chainId, this.blockedTokenListProvider, this.tokenValidatorProvider);
        this.v4Quoter = new V4Quoter(this.v4SubgraphProvider, this.v4PoolProvider, this.onChainQuoteProvider, this.tokenProvider, this.chainId, this.blockedTokenListProvider, this.tokenValidatorProvider);
        this.mixedQuoter = new MixedQuoter(this.v3SubgraphProvider, this.v3PoolProvider, this.v2SubgraphProvider, this.v2PoolProvider, this.onChainQuoteProvider, this.tokenProvider, this.chainId, this.blockedTokenListProvider, this.tokenValidatorProvider);
        this.v2Supported = v2Supported !== null && v2Supported !== void 0 ? v2Supported : V2_SUPPORTED;
    }
    async routeToRatio(token0Balance, token1Balance, position, swapAndAddConfig, swapAndAddOptions, routingConfig = DEFAULT_ROUTING_CONFIG_BY_CHAIN(this.chainId)) {
        if (token1Balance.currency.wrapped.sortsBefore(token0Balance.currency.wrapped)) {
            [token0Balance, token1Balance] = [token1Balance, token0Balance];
        }
        let preSwapOptimalRatio = this.calculateOptimalRatio(position, position.pool.sqrtRatioX96, true);
        // set up parameters according to which token will be swapped
        let zeroForOne;
        if (position.pool.tickCurrent > position.tickUpper) {
            zeroForOne = true;
        }
        else if (position.pool.tickCurrent < position.tickLower) {
            zeroForOne = false;
        }
        else {
            zeroForOne = new Fraction(token0Balance.quotient, token1Balance.quotient).greaterThan(preSwapOptimalRatio);
            if (!zeroForOne)
                preSwapOptimalRatio = preSwapOptimalRatio.invert();
        }
        const [inputBalance, outputBalance] = zeroForOne
            ? [token0Balance, token1Balance]
            : [token1Balance, token0Balance];
        let optimalRatio = preSwapOptimalRatio;
        let postSwapTargetPool = position.pool;
        let exchangeRate = zeroForOne
            ? position.pool.token0Price
            : position.pool.token1Price;
        let swap = null;
        let ratioAchieved = false;
        let n = 0;
        // iterate until we find a swap with a sufficient ratio or return null
        while (!ratioAchieved) {
            n++;
            if (n > swapAndAddConfig.maxIterations) {
                log.info('max iterations exceeded');
                return {
                    status: SwapToRatioStatus.NO_ROUTE_FOUND,
                    error: 'max iterations exceeded',
                };
            }
            const amountToSwap = calculateRatioAmountIn(optimalRatio, exchangeRate, inputBalance, outputBalance);
            if (amountToSwap.equalTo(0)) {
                log.info(`no swap needed: amountToSwap = 0`);
                return {
                    status: SwapToRatioStatus.NO_SWAP_NEEDED,
                };
            }
            swap = await this.route(amountToSwap, outputBalance.currency, TradeType.EXACT_INPUT, undefined, {
                ...DEFAULT_ROUTING_CONFIG_BY_CHAIN(this.chainId),
                ...routingConfig,
                /// @dev We do not want to query for mixedRoutes for routeToRatio as they are not supported
                /// [Protocol.V3, Protocol.V2] will make sure we only query for V3 and V2
                protocols: [Protocol.V3, Protocol.V2],
            });
            if (!swap) {
                log.info('no route found from this.route()');
                return {
                    status: SwapToRatioStatus.NO_ROUTE_FOUND,
                    error: 'no route found',
                };
            }
            const inputBalanceUpdated = inputBalance.subtract(swap.trade.inputAmount);
            const outputBalanceUpdated = outputBalance.add(swap.trade.outputAmount);
            const newRatio = inputBalanceUpdated.divide(outputBalanceUpdated);
            let targetPoolPriceUpdate;
            swap.route.forEach((route) => {
                if (route.protocol === Protocol.V3) {
                    const v3Route = route;
                    v3Route.route.pools.forEach((pool, i) => {
                        if (pool.token0.equals(position.pool.token0) &&
                            pool.token1.equals(position.pool.token1) &&
                            pool.fee === position.pool.fee) {
                            targetPoolPriceUpdate = JSBI.BigInt(v3Route.sqrtPriceX96AfterList[i].toString());
                            optimalRatio = this.calculateOptimalRatio(position, JSBI.BigInt(targetPoolPriceUpdate.toString()), zeroForOne);
                        }
                    });
                }
            });
            if (!targetPoolPriceUpdate) {
                optimalRatio = preSwapOptimalRatio;
            }
            ratioAchieved =
                newRatio.equalTo(optimalRatio) ||
                    this.absoluteValue(newRatio.asFraction.divide(optimalRatio).subtract(1)).lessThan(swapAndAddConfig.ratioErrorTolerance);
            if (ratioAchieved && targetPoolPriceUpdate) {
                postSwapTargetPool = new Pool(position.pool.token0, position.pool.token1, position.pool.fee, targetPoolPriceUpdate, position.pool.liquidity, TickMath.getTickAtSqrtRatio(targetPoolPriceUpdate), position.pool.tickDataProvider);
            }
            exchangeRate = swap.trade.outputAmount.divide(swap.trade.inputAmount);
            log.info({
                exchangeRate: exchangeRate.asFraction.toFixed(18),
                optimalRatio: optimalRatio.asFraction.toFixed(18),
                newRatio: newRatio.asFraction.toFixed(18),
                inputBalanceUpdated: inputBalanceUpdated.asFraction.toFixed(18),
                outputBalanceUpdated: outputBalanceUpdated.asFraction.toFixed(18),
                ratioErrorTolerance: swapAndAddConfig.ratioErrorTolerance.toFixed(18),
                iterationN: n.toString(),
            }, 'QuoteToRatio Iteration Parameters');
            if (exchangeRate.equalTo(0)) {
                log.info('exchangeRate to 0');
                return {
                    status: SwapToRatioStatus.NO_ROUTE_FOUND,
                    error: 'insufficient liquidity to swap to optimal ratio',
                };
            }
        }
        if (!swap) {
            return {
                status: SwapToRatioStatus.NO_ROUTE_FOUND,
                error: 'no route found',
            };
        }
        let methodParameters;
        if (swapAndAddOptions) {
            methodParameters = await this.buildSwapAndAddMethodParameters(swap.trade, swapAndAddOptions, {
                initialBalanceTokenIn: inputBalance,
                initialBalanceTokenOut: outputBalance,
                preLiquidityPosition: position,
            });
        }
        return {
            status: SwapToRatioStatus.SUCCESS,
            result: { ...swap, methodParameters, optimalRatio, postSwapTargetPool },
        };
    }
    /**
     * @inheritdoc IRouter
     */
    async route(amount, quoteCurrency, tradeType, swapConfig, partialRoutingConfig = {}) {
        var _a, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const originalAmount = amount;
        const { currencyIn, currencyOut } = this.determineCurrencyInOutFromTradeType(tradeType, amount, quoteCurrency);
        const tokenIn = currencyIn.wrapped;
        const tokenOut = currencyOut.wrapped;
        const tokenOutProperties = await this.tokenPropertiesProvider.getTokensProperties([tokenOut], partialRoutingConfig);
        const feeTakenOnTransfer = (_c = (_a = tokenOutProperties[tokenOut.address.toLowerCase()]) === null || _a === void 0 ? void 0 : _a.tokenFeeResult) === null || _c === void 0 ? void 0 : _c.feeTakenOnTransfer;
        const externalTransferFailed = (_e = (_d = tokenOutProperties[tokenOut.address.toLowerCase()]) === null || _d === void 0 ? void 0 : _d.tokenFeeResult) === null || _e === void 0 ? void 0 : _e.externalTransferFailed;
        // We want to log the fee on transfer output tokens that we are taking fee or not
        // Ideally the trade size (normalized in USD) would be ideal to log here, but we don't have spot price of output tokens here.
        // We have to make sure token out is FOT with either buy/sell fee bps > 0
        if (((_h = (_g = (_f = tokenOutProperties[tokenOut.address.toLowerCase()]) === null || _f === void 0 ? void 0 : _f.tokenFeeResult) === null || _g === void 0 ? void 0 : _g.buyFeeBps) === null || _h === void 0 ? void 0 : _h.gt(0)) ||
            ((_l = (_k = (_j = tokenOutProperties[tokenOut.address.toLowerCase()]) === null || _j === void 0 ? void 0 : _j.tokenFeeResult) === null || _k === void 0 ? void 0 : _k.sellFeeBps) === null || _l === void 0 ? void 0 : _l.gt(0))) {
            if (feeTakenOnTransfer || externalTransferFailed) {
                // also to be extra safe, in case of FOT with feeTakenOnTransfer or externalTransferFailed,
                // we nullify the fee and flat fee to avoid any potential issues.
                // although neither web nor wallet should use the calldata returned from routing/SOR
                if ((swapConfig === null || swapConfig === void 0 ? void 0 : swapConfig.type) === SwapType.UNIVERSAL_ROUTER) {
                    swapConfig.fee = undefined;
                    swapConfig.flatFee = undefined;
                }
                metric.putMetric('TokenOutFeeOnTransferNotTakingFee', 1, MetricLoggerUnit.Count);
            }
            else {
                metric.putMetric('TokenOutFeeOnTransferTakingFee', 1, MetricLoggerUnit.Count);
            }
        }
        if (tradeType === TradeType.EXACT_OUTPUT) {
            const portionAmount = this.portionProvider.getPortionAmount(amount, tradeType, feeTakenOnTransfer, externalTransferFailed, swapConfig);
            if (portionAmount && portionAmount.greaterThan(ZERO)) {
                // In case of exact out swap, before we route, we need to make sure that the
                // token out amount accounts for flat portion, and token in amount after the best swap route contains the token in equivalent of portion.
                // In other words, in case a pool's LP fee bps is lower than the portion bps (0.01%/0.05% for v3), a pool can go insolvency.
                // This is because instead of the swapper being responsible for the portion,
                // the pool instead gets responsible for the portion.
                // The addition below avoids that situation.
                amount = amount.add(portionAmount);
            }
        }
        metric.setProperty('chainId', this.chainId);
        metric.setProperty('pair', `${tokenIn.symbol}/${tokenOut.symbol}`);
        metric.setProperty('tokenIn', tokenIn.address);
        metric.setProperty('tokenOut', tokenOut.address);
        metric.setProperty('tradeType', tradeType === TradeType.EXACT_INPUT ? 'ExactIn' : 'ExactOut');
        metric.putMetric(`QuoteRequestedForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
        // Get a block number to specify in all our calls. Ensures data we fetch from chain is
        // from the same block.
        const blockNumber = (_m = partialRoutingConfig.blockNumber) !== null && _m !== void 0 ? _m : this.getBlockNumberPromise();
        const routingConfig = _.merge({
            // These settings could be changed by the partialRoutingConfig
            useCachedRoutes: true,
            writeToCachedRoutes: true,
            optimisticCachedRoutes: false,
        }, DEFAULT_ROUTING_CONFIG_BY_CHAIN(this.chainId), partialRoutingConfig, { blockNumber });
        if (routingConfig.debugRouting) {
            log.warn(`Finalized routing config is ${JSON.stringify(routingConfig)}`);
        }
        const gasPriceWei = await this.getGasPriceWei(await blockNumber, await partialRoutingConfig.blockNumber);
        const quoteToken = quoteCurrency.wrapped;
        // const gasTokenAccessor = await this.tokenProvider.getTokens([routingConfig.gasToken!]);
        const gasToken = routingConfig.gasToken
            ? (await this.tokenProvider.getTokens([routingConfig.gasToken])).getTokenByAddress(routingConfig.gasToken)
            : undefined;
        const providerConfig = {
            ...routingConfig,
            blockNumber,
            additionalGasOverhead: NATIVE_OVERHEAD(this.chainId, amount.currency, quoteCurrency),
            gasToken,
            externalTransferFailed,
            feeTakenOnTransfer,
        };
        const { v2GasModel: v2GasModel, v3GasModel: v3GasModel, mixedRouteGasModel: mixedRouteGasModel, } = await this.getGasModels(gasPriceWei, amount.currency.wrapped, quoteToken, providerConfig);
        // Create a Set to sanitize the protocols input, a Set of undefined becomes an empty set,
        // Then create an Array from the values of that Set.
        const protocols = Array.from(new Set(routingConfig.protocols).values());
        const cacheMode = (_o = routingConfig.overwriteCacheMode) !== null && _o !== void 0 ? _o : (await ((_p = this.routeCachingProvider) === null || _p === void 0 ? void 0 : _p.getCacheMode(this.chainId, amount, quoteToken, tradeType, protocols)));
        // Fetch CachedRoutes
        let cachedRoutes;
        if (routingConfig.useCachedRoutes && cacheMode !== CacheMode.Darkmode) {
            cachedRoutes = await ((_q = this.routeCachingProvider) === null || _q === void 0 ? void 0 : _q.getCachedRoute(this.chainId, amount, quoteToken, tradeType, protocols, await blockNumber, routingConfig.optimisticCachedRoutes));
        }
        metric.putMetric(routingConfig.useCachedRoutes
            ? 'GetQuoteUsingCachedRoutes'
            : 'GetQuoteNotUsingCachedRoutes', 1, MetricLoggerUnit.Count);
        if (cacheMode &&
            routingConfig.useCachedRoutes &&
            cacheMode !== CacheMode.Darkmode &&
            !cachedRoutes) {
            metric.putMetric(`GetCachedRoute_miss_${cacheMode}`, 1, MetricLoggerUnit.Count);
            log.info({
                tokenIn: tokenIn.symbol,
                tokenInAddress: tokenIn.address,
                tokenOut: tokenOut.symbol,
                tokenOutAddress: tokenOut.address,
                cacheMode,
                amount: amount.toExact(),
                chainId: this.chainId,
                tradeType: this.tradeTypeStr(tradeType),
            }, `GetCachedRoute miss ${cacheMode} for ${this.tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType)}`);
        }
        else if (cachedRoutes && routingConfig.useCachedRoutes) {
            metric.putMetric(`GetCachedRoute_hit_${cacheMode}`, 1, MetricLoggerUnit.Count);
            log.info({
                tokenIn: tokenIn.symbol,
                tokenInAddress: tokenIn.address,
                tokenOut: tokenOut.symbol,
                tokenOutAddress: tokenOut.address,
                cacheMode,
                amount: amount.toExact(),
                chainId: this.chainId,
                tradeType: this.tradeTypeStr(tradeType),
            }, `GetCachedRoute hit ${cacheMode} for ${this.tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType)}`);
        }
        let swapRouteFromCachePromise = Promise.resolve(null);
        if (cachedRoutes) {
            swapRouteFromCachePromise = this.getSwapRouteFromCache(cachedRoutes, await blockNumber, amount, quoteToken, tradeType, routingConfig, v3GasModel, mixedRouteGasModel, gasPriceWei, v2GasModel, swapConfig, providerConfig);
        }
        let swapRouteFromChainPromise = Promise.resolve(null);
        if (!cachedRoutes || cacheMode !== CacheMode.Livemode) {
            swapRouteFromChainPromise = this.getSwapRouteFromChain(amount, tokenIn, tokenOut, protocols, quoteToken, tradeType, routingConfig, v3GasModel, mixedRouteGasModel, gasPriceWei, v2GasModel, swapConfig, providerConfig);
        }
        const [swapRouteFromCache, swapRouteFromChain] = await Promise.all([
            swapRouteFromCachePromise,
            swapRouteFromChainPromise,
        ]);
        let swapRouteRaw;
        let hitsCachedRoute = false;
        if (cacheMode === CacheMode.Livemode && swapRouteFromCache) {
            log.info(`CacheMode is ${cacheMode}, and we are using swapRoute from cache`);
            hitsCachedRoute = true;
            swapRouteRaw = swapRouteFromCache;
        }
        else {
            log.info(`CacheMode is ${cacheMode}, and we are using materialized swapRoute`);
            swapRouteRaw = swapRouteFromChain;
        }
        if (cacheMode === CacheMode.Tapcompare &&
            swapRouteFromCache &&
            swapRouteFromChain) {
            const quoteDiff = swapRouteFromChain.quote.subtract(swapRouteFromCache.quote);
            const quoteGasAdjustedDiff = swapRouteFromChain.quoteGasAdjusted.subtract(swapRouteFromCache.quoteGasAdjusted);
            const gasUsedDiff = swapRouteFromChain.estimatedGasUsed.sub(swapRouteFromCache.estimatedGasUsed);
            // Only log if quoteDiff is different from 0, or if quoteGasAdjustedDiff and gasUsedDiff are both different from 0
            if (!quoteDiff.equalTo(0) ||
                !(quoteGasAdjustedDiff.equalTo(0) || gasUsedDiff.eq(0))) {
                try {
                    // Calculates the percentage of the difference with respect to the quoteFromChain (not from cache)
                    const misquotePercent = quoteGasAdjustedDiff
                        .divide(swapRouteFromChain.quoteGasAdjusted)
                        .multiply(100);
                    metric.putMetric(`TapcompareCachedRoute_quoteGasAdjustedDiffPercent`, Number(misquotePercent.toExact()), MetricLoggerUnit.Percent);
                    log.warn({
                        quoteFromChain: swapRouteFromChain.quote.toExact(),
                        quoteFromCache: swapRouteFromCache.quote.toExact(),
                        quoteDiff: quoteDiff.toExact(),
                        quoteGasAdjustedFromChain: swapRouteFromChain.quoteGasAdjusted.toExact(),
                        quoteGasAdjustedFromCache: swapRouteFromCache.quoteGasAdjusted.toExact(),
                        quoteGasAdjustedDiff: quoteGasAdjustedDiff.toExact(),
                        gasUsedFromChain: swapRouteFromChain.estimatedGasUsed.toString(),
                        gasUsedFromCache: swapRouteFromCache.estimatedGasUsed.toString(),
                        gasUsedDiff: gasUsedDiff.toString(),
                        routesFromChain: swapRouteFromChain.routes.toString(),
                        routesFromCache: swapRouteFromCache.routes.toString(),
                        amount: amount.toExact(),
                        originalAmount: cachedRoutes === null || cachedRoutes === void 0 ? void 0 : cachedRoutes.originalAmount,
                        pair: this.tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType),
                        blockNumber,
                    }, `Comparing quotes between Chain and Cache for ${this.tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType)}`);
                }
                catch (error) {
                    // This is in response to the 'division by zero' error
                    // during https://uniswapteam.slack.com/archives/C059TGEC57W/p1723997015399579
                    if (error instanceof RangeError && error.message.includes('Division by zero')) {
                        log.error({
                            quoteGasAdjustedDiff: quoteGasAdjustedDiff.toExact(),
                            swapRouteFromChainQuoteGasAdjusted: swapRouteFromChain.quoteGasAdjusted.toExact(),
                        }, 'Error calculating misquote percent');
                    }
                    // We don't want to change the behavior here. If it throws an error, we want to log it and re-throw
                    throw error;
                }
            }
        }
        if (!swapRouteRaw) {
            return null;
        }
        const { quote, quoteGasAdjusted, estimatedGasUsed, routes: routeAmounts, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, estimatedGasUsedGasToken, } = swapRouteRaw;
        if (this.routeCachingProvider &&
            routingConfig.writeToCachedRoutes &&
            cacheMode !== CacheMode.Darkmode &&
            swapRouteFromChain) {
            // Generate the object to be cached
            const routesToCache = CachedRoutes.fromRoutesWithValidQuotes(swapRouteFromChain.routes, this.chainId, tokenIn, tokenOut, protocols.sort(), // sort it for consistency in the order of the protocols.
            await blockNumber, tradeType, amount.toExact());
            if (routesToCache) {
                // Attempt to insert the entry in cache. This is fire and forget promise.
                // The catch method will prevent any exception from blocking the normal code execution.
                this.routeCachingProvider
                    .setCachedRoute(routesToCache, amount)
                    .then((success) => {
                    const status = success ? 'success' : 'rejected';
                    metric.putMetric(`SetCachedRoute_${status}`, 1, MetricLoggerUnit.Count);
                })
                    .catch((reason) => {
                    log.error({
                        reason: reason,
                        tokenPair: this.tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType),
                    }, `SetCachedRoute failure`);
                    metric.putMetric(`SetCachedRoute_failure`, 1, MetricLoggerUnit.Count);
                });
            }
            else {
                metric.putMetric(`SetCachedRoute_unnecessary`, 1, MetricLoggerUnit.Count);
            }
        }
        metric.putMetric(`QuoteFoundForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
        // Build Trade object that represents the optimal swap.
        const trade = buildTrade(currencyIn, currencyOut, tradeType, routeAmounts);
        let methodParameters;
        // If user provided recipient, deadline etc. we also generate the calldata required to execute
        // the swap and return it too.
        if (swapConfig) {
            methodParameters = buildSwapMethodParameters(trade, swapConfig, this.chainId);
        }
        const tokenOutAmount = tradeType === TradeType.EXACT_OUTPUT
            ? originalAmount // we need to pass in originalAmount instead of amount, because amount already added portionAmount in case of exact out swap
            : quote;
        const portionAmount = this.portionProvider.getPortionAmount(tokenOutAmount, tradeType, feeTakenOnTransfer, externalTransferFailed, swapConfig);
        const portionQuoteAmount = this.portionProvider.getPortionQuoteAmount(tradeType, quote, amount, // we need to pass in amount instead of originalAmount here, because amount here needs to add the portion for exact out
        portionAmount);
        // we need to correct quote and quote gas adjusted for exact output when portion is part of the exact out swap
        const correctedQuote = this.portionProvider.getQuote(tradeType, quote, portionQuoteAmount);
        const correctedQuoteGasAdjusted = this.portionProvider.getQuoteGasAdjusted(tradeType, quoteGasAdjusted, portionQuoteAmount);
        const quoteGasAndPortionAdjusted = this.portionProvider.getQuoteGasAndPortionAdjusted(tradeType, quoteGasAdjusted, portionAmount);
        const swapRoute = {
            quote: correctedQuote,
            quoteGasAdjusted: correctedQuoteGasAdjusted,
            estimatedGasUsed,
            estimatedGasUsedQuoteToken,
            estimatedGasUsedUSD,
            estimatedGasUsedGasToken,
            gasPriceWei,
            route: routeAmounts,
            trade,
            methodParameters,
            blockNumber: BigNumber.from(await blockNumber),
            hitsCachedRoute: hitsCachedRoute,
            portionAmount: portionAmount,
            quoteGasAndPortionAdjusted: quoteGasAndPortionAdjusted,
        };
        if (swapConfig &&
            swapConfig.simulate &&
            methodParameters &&
            methodParameters.calldata) {
            if (!this.simulator) {
                throw new Error('Simulator not initialized!');
            }
            log.info(JSON.stringify({ swapConfig, methodParameters, providerConfig }, null, 2), `Starting simulation`);
            const fromAddress = swapConfig.simulate.fromAddress;
            const beforeSimulate = Date.now();
            const swapRouteWithSimulation = await this.simulator.simulate(fromAddress, swapConfig, swapRoute, amount, 
            // Quote will be in WETH even if quoteCurrency is ETH
            // So we init a new CurrencyAmount object here
            CurrencyAmount.fromRawAmount(quoteCurrency, quote.quotient.toString()), providerConfig);
            metric.putMetric('SimulateTransaction', Date.now() - beforeSimulate, MetricLoggerUnit.Milliseconds);
            return swapRouteWithSimulation;
        }
        return swapRoute;
    }
    async getSwapRouteFromCache(cachedRoutes, blockNumber, amount, quoteToken, tradeType, routingConfig, v3GasModel, mixedRouteGasModel, gasPriceWei, v2GasModel, swapConfig, providerConfig) {
        log.info({
            protocols: cachedRoutes.protocolsCovered,
            tradeType: cachedRoutes.tradeType,
            cachedBlockNumber: cachedRoutes.blockNumber,
            quoteBlockNumber: blockNumber,
        }, 'Routing across CachedRoute');
        const quotePromises = [];
        const v4Routes = cachedRoutes.routes.filter((route) => route.protocol === Protocol.V4);
        const v3Routes = cachedRoutes.routes.filter((route) => route.protocol === Protocol.V3);
        const v2Routes = cachedRoutes.routes.filter((route) => route.protocol === Protocol.V2);
        const mixedRoutes = cachedRoutes.routes.filter((route) => route.protocol === Protocol.MIXED);
        let percents;
        let amounts;
        if (cachedRoutes.routes.length > 1) {
            // If we have more than 1 route, we will quote the different percents for it, following the regular process
            [percents, amounts] = this.getAmountDistribution(amount, routingConfig);
        }
        else if (cachedRoutes.routes.length == 1) {
            [percents, amounts] = [[100], [amount]];
        }
        else {
            // In this case this means that there's no route, so we return null
            return Promise.resolve(null);
        }
        if (v4Routes.length > 0) {
            const v4RoutesFromCache = v4Routes.map((cachedRoute) => cachedRoute.route);
            metric.putMetric('SwapRouteFromCache_V4_GetQuotes_Request', 1, MetricLoggerUnit.Count);
            const beforeGetQuotes = Date.now();
            quotePromises.push(this.v4Quoter
                .getQuotes(v4RoutesFromCache, amounts, percents, quoteToken, tradeType, routingConfig, undefined, v3GasModel, gasPriceWei)
                .then((result) => {
                metric.putMetric(`SwapRouteFromCache_V4_GetQuotes_Load`, Date.now() - beforeGetQuotes, MetricLoggerUnit.Milliseconds);
                return result;
            }));
        }
        if (v3Routes.length > 0) {
            const v3RoutesFromCache = v3Routes.map((cachedRoute) => cachedRoute.route);
            metric.putMetric('SwapRouteFromCache_V3_GetQuotes_Request', 1, MetricLoggerUnit.Count);
            const beforeGetQuotes = Date.now();
            quotePromises.push(this.v3Quoter
                .getQuotes(v3RoutesFromCache, amounts, percents, quoteToken, tradeType, routingConfig, undefined, v3GasModel)
                .then((result) => {
                metric.putMetric(`SwapRouteFromCache_V3_GetQuotes_Load`, Date.now() - beforeGetQuotes, MetricLoggerUnit.Milliseconds);
                return result;
            }));
        }
        if (v2Routes.length > 0) {
            const v2RoutesFromCache = v2Routes.map((cachedRoute) => cachedRoute.route);
            metric.putMetric('SwapRouteFromCache_V2_GetQuotes_Request', 1, MetricLoggerUnit.Count);
            const beforeGetQuotes = Date.now();
            quotePromises.push(this.v2Quoter
                .refreshRoutesThenGetQuotes(cachedRoutes.tokenIn, cachedRoutes.tokenOut, v2RoutesFromCache, amounts, percents, quoteToken, tradeType, routingConfig, gasPriceWei)
                .then((result) => {
                metric.putMetric(`SwapRouteFromCache_V2_GetQuotes_Load`, Date.now() - beforeGetQuotes, MetricLoggerUnit.Milliseconds);
                return result;
            }));
        }
        if (mixedRoutes.length > 0) {
            const mixedRoutesFromCache = mixedRoutes.map((cachedRoute) => cachedRoute.route);
            metric.putMetric('SwapRouteFromCache_Mixed_GetQuotes_Request', 1, MetricLoggerUnit.Count);
            const beforeGetQuotes = Date.now();
            quotePromises.push(this.mixedQuoter
                .getQuotes(mixedRoutesFromCache, amounts, percents, quoteToken, tradeType, routingConfig, undefined, mixedRouteGasModel)
                .then((result) => {
                metric.putMetric(`SwapRouteFromCache_Mixed_GetQuotes_Load`, Date.now() - beforeGetQuotes, MetricLoggerUnit.Milliseconds);
                return result;
            }));
        }
        const getQuotesResults = await Promise.all(quotePromises);
        const allRoutesWithValidQuotes = _.flatMap(getQuotesResults, (quoteResult) => quoteResult.routesWithValidQuotes);
        return getBestSwapRoute(amount, percents, allRoutesWithValidQuotes, tradeType, this.chainId, routingConfig, this.portionProvider, v2GasModel, v3GasModel, swapConfig, providerConfig);
    }
    async getSwapRouteFromChain(amount, tokenIn, tokenOut, protocols, quoteToken, tradeType, routingConfig, v3GasModel, mixedRouteGasModel, gasPriceWei, v2GasModel, swapConfig, providerConfig) {
        var _a;
        // Generate our distribution of amounts, i.e. fractions of the input amount.
        // We will get quotes for fractions of the input amount for different routes, then
        // combine to generate split routes.
        const [percents, amounts] = this.getAmountDistribution(amount, routingConfig);
        const noProtocolsSpecified = protocols.length === 0;
        const v4ProtocolSpecified = protocols.includes(Protocol.V4);
        const v3ProtocolSpecified = protocols.includes(Protocol.V3);
        const v2ProtocolSpecified = protocols.includes(Protocol.V2);
        const v2SupportedInChain = (_a = this.v2Supported) === null || _a === void 0 ? void 0 : _a.includes(this.chainId);
        const shouldQueryMixedProtocol = protocols.includes(Protocol.MIXED) ||
            (noProtocolsSpecified && v2SupportedInChain);
        const mixedProtocolAllowed = [ChainId.MAINNET, ChainId.GOERLI].includes(this.chainId) &&
            tradeType === TradeType.EXACT_INPUT;
        const beforeGetCandidates = Date.now();
        let v4CandidatePoolsPromise = Promise.resolve(undefined);
        // we are explicitly requiring people to specify v4 for now
        if (v4ProtocolSpecified) {
            // if (v4ProtocolSpecified || noProtocolsSpecified) {
            v4CandidatePoolsPromise = getV4CandidatePools({
                tokenIn,
                tokenOut,
                tokenProvider: this.tokenProvider,
                blockedTokenListProvider: this.blockedTokenListProvider,
                poolProvider: this.v4PoolProvider,
                routeType: tradeType,
                subgraphProvider: this.v4SubgraphProvider,
                routingConfig,
                chainId: this.chainId,
            }).then((candidatePools) => {
                metric.putMetric('GetV4CandidatePools', Date.now() - beforeGetCandidates, MetricLoggerUnit.Milliseconds);
                return candidatePools;
            });
        }
        let v3CandidatePoolsPromise = Promise.resolve(undefined);
        if (v3ProtocolSpecified ||
            noProtocolsSpecified ||
            (shouldQueryMixedProtocol && mixedProtocolAllowed)) {
            v3CandidatePoolsPromise = getV3CandidatePools({
                tokenIn,
                tokenOut,
                tokenProvider: this.tokenProvider,
                blockedTokenListProvider: this.blockedTokenListProvider,
                poolProvider: this.v3PoolProvider,
                routeType: tradeType,
                subgraphProvider: this.v3SubgraphProvider,
                routingConfig,
                chainId: this.chainId,
            }).then((candidatePools) => {
                metric.putMetric('GetV3CandidatePools', Date.now() - beforeGetCandidates, MetricLoggerUnit.Milliseconds);
                return candidatePools;
            });
        }
        let v2CandidatePoolsPromise = Promise.resolve(undefined);
        if ((v2SupportedInChain && (v2ProtocolSpecified || noProtocolsSpecified)) ||
            (shouldQueryMixedProtocol && mixedProtocolAllowed)) {
            // Fetch all the pools that we will consider routing via. There are thousands
            // of pools, so we filter them to a set of candidate pools that we expect will
            // result in good prices.
            v2CandidatePoolsPromise = getV2CandidatePools({
                tokenIn,
                tokenOut,
                tokenProvider: this.tokenProvider,
                blockedTokenListProvider: this.blockedTokenListProvider,
                poolProvider: this.v2PoolProvider,
                routeType: tradeType,
                subgraphProvider: this.v2SubgraphProvider,
                routingConfig,
                chainId: this.chainId,
            }).then((candidatePools) => {
                metric.putMetric('GetV2CandidatePools', Date.now() - beforeGetCandidates, MetricLoggerUnit.Milliseconds);
                return candidatePools;
            });
        }
        const quotePromises = [];
        // for v4, for now we explicitly require people to specify
        if (v4ProtocolSpecified) {
            log.info({ protocols, tradeType }, 'Routing across V4');
            metric.putMetric('SwapRouteFromChain_V4_GetRoutesThenQuotes_Request', 1, MetricLoggerUnit.Count);
            const beforeGetRoutesThenQuotes = Date.now();
            quotePromises.push(v4CandidatePoolsPromise.then((v4CandidatePools) => this.v4Quoter
                .getRoutesThenQuotes(tokenIn, tokenOut, amount, amounts, percents, quoteToken, v4CandidatePools, tradeType, routingConfig, v3GasModel)
                .then((result) => {
                metric.putMetric(`SwapRouteFromChain_V4_GetRoutesThenQuotes_Load`, Date.now() - beforeGetRoutesThenQuotes, MetricLoggerUnit.Milliseconds);
                return result;
            })));
        }
        // Maybe Quote V3 - if V3 is specified, or no protocol is specified
        if (v3ProtocolSpecified || noProtocolsSpecified) {
            log.info({ protocols, tradeType }, 'Routing across V3');
            metric.putMetric('SwapRouteFromChain_V3_GetRoutesThenQuotes_Request', 1, MetricLoggerUnit.Count);
            const beforeGetRoutesThenQuotes = Date.now();
            quotePromises.push(v3CandidatePoolsPromise.then((v3CandidatePools) => this.v3Quoter
                .getRoutesThenQuotes(tokenIn, tokenOut, amount, amounts, percents, quoteToken, v3CandidatePools, tradeType, routingConfig, v3GasModel)
                .then((result) => {
                metric.putMetric(`SwapRouteFromChain_V3_GetRoutesThenQuotes_Load`, Date.now() - beforeGetRoutesThenQuotes, MetricLoggerUnit.Milliseconds);
                return result;
            })));
        }
        // Maybe Quote V2 - if V2 is specified, or no protocol is specified AND v2 is supported in this chain
        if (v2SupportedInChain && (v2ProtocolSpecified || noProtocolsSpecified)) {
            log.info({ protocols, tradeType }, 'Routing across V2');
            metric.putMetric('SwapRouteFromChain_V2_GetRoutesThenQuotes_Request', 1, MetricLoggerUnit.Count);
            const beforeGetRoutesThenQuotes = Date.now();
            quotePromises.push(v2CandidatePoolsPromise.then((v2CandidatePools) => this.v2Quoter
                .getRoutesThenQuotes(tokenIn, tokenOut, amount, amounts, percents, quoteToken, v2CandidatePools, tradeType, routingConfig, v2GasModel, gasPriceWei)
                .then((result) => {
                metric.putMetric(`SwapRouteFromChain_V2_GetRoutesThenQuotes_Load`, Date.now() - beforeGetRoutesThenQuotes, MetricLoggerUnit.Milliseconds);
                return result;
            })));
        }
        // Maybe Quote mixed routes
        // if MixedProtocol is specified or no protocol is specified and v2 is supported AND tradeType is ExactIn
        // AND is Mainnet or Gorli
        if (shouldQueryMixedProtocol && mixedProtocolAllowed) {
            log.info({ protocols, tradeType }, 'Routing across MixedRoutes');
            metric.putMetric('SwapRouteFromChain_Mixed_GetRoutesThenQuotes_Request', 1, MetricLoggerUnit.Count);
            const beforeGetRoutesThenQuotes = Date.now();
            quotePromises.push(Promise.all([v3CandidatePoolsPromise, v2CandidatePoolsPromise]).then(async ([v3CandidatePools, v2CandidatePools]) => {
                const crossLiquidityPools = await getMixedCrossLiquidityCandidatePools({
                    tokenIn,
                    tokenOut,
                    blockNumber: routingConfig.blockNumber,
                    v2SubgraphProvider: this.v2SubgraphProvider,
                    v3SubgraphProvider: this.v3SubgraphProvider,
                    v2Candidates: v2CandidatePools,
                    v3Candidates: v3CandidatePools,
                });
                return this.mixedQuoter
                    .getRoutesThenQuotes(tokenIn, tokenOut, amount, amounts, percents, quoteToken, [v3CandidatePools, v2CandidatePools, crossLiquidityPools], tradeType, routingConfig, mixedRouteGasModel)
                    .then((result) => {
                    metric.putMetric(`SwapRouteFromChain_Mixed_GetRoutesThenQuotes_Load`, Date.now() - beforeGetRoutesThenQuotes, MetricLoggerUnit.Milliseconds);
                    return result;
                });
            }));
        }
        const getQuotesResults = await Promise.all(quotePromises);
        const allRoutesWithValidQuotes = [];
        const allCandidatePools = [];
        getQuotesResults.forEach((getQuoteResult) => {
            allRoutesWithValidQuotes.push(...getQuoteResult.routesWithValidQuotes);
            if (getQuoteResult.candidatePools) {
                allCandidatePools.push(getQuoteResult.candidatePools);
            }
        });
        if (allRoutesWithValidQuotes.length === 0) {
            log.info({ allRoutesWithValidQuotes }, 'Received no valid quotes');
            return null;
        }
        // Given all the quotes for all the amounts for all the routes, find the best combination.
        const bestSwapRoute = await getBestSwapRoute(amount, percents, allRoutesWithValidQuotes, tradeType, this.chainId, routingConfig, this.portionProvider, v2GasModel, v3GasModel, swapConfig, providerConfig);
        if (bestSwapRoute) {
            this.emitPoolSelectionMetrics(bestSwapRoute, allCandidatePools);
        }
        return bestSwapRoute;
    }
    tradeTypeStr(tradeType) {
        return tradeType === TradeType.EXACT_INPUT ? 'ExactIn' : 'ExactOut';
    }
    tokenPairSymbolTradeTypeChainId(tokenIn, tokenOut, tradeType) {
        return `${tokenIn.symbol}/${tokenOut.symbol}/${this.tradeTypeStr(tradeType)}/${this.chainId}`;
    }
    determineCurrencyInOutFromTradeType(tradeType, amount, quoteCurrency) {
        if (tradeType === TradeType.EXACT_INPUT) {
            return {
                currencyIn: amount.currency,
                currencyOut: quoteCurrency,
            };
        }
        else {
            return {
                currencyIn: quoteCurrency,
                currencyOut: amount.currency,
            };
        }
    }
    async getGasPriceWei(latestBlockNumber, requestBlockNumber) {
        // Track how long it takes to resolve this async call.
        const beforeGasTimestamp = Date.now();
        // Get an estimate of the gas price to use when estimating gas cost of different routes.
        const { gasPriceWei } = await this.gasPriceProvider.getGasPrice(latestBlockNumber, requestBlockNumber);
        metric.putMetric('GasPriceLoad', Date.now() - beforeGasTimestamp, MetricLoggerUnit.Milliseconds);
        return gasPriceWei;
    }
    async getGasModels(gasPriceWei, amountToken, quoteToken, providerConfig) {
        var _a;
        const beforeGasModel = Date.now();
        const usdPoolPromise = getHighestLiquidityV3USDPool(this.chainId, this.v3PoolProvider, providerConfig);
        const nativeCurrency = WRAPPED_NATIVE_CURRENCY[this.chainId];
        const nativeAndQuoteTokenV3PoolPromise = !quoteToken.equals(nativeCurrency)
            ? getHighestLiquidityV3NativePool(quoteToken, this.v3PoolProvider, providerConfig)
            : Promise.resolve(null);
        const nativeAndAmountTokenV3PoolPromise = !amountToken.equals(nativeCurrency)
            ? getHighestLiquidityV3NativePool(amountToken, this.v3PoolProvider, providerConfig)
            : Promise.resolve(null);
        // If a specific gas token is specified in the provider config
        // fetch the highest liq V3 pool with it and the native currency
        const nativeAndSpecifiedGasTokenV3PoolPromise = (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken) &&
            !(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken.equals(nativeCurrency))
            ? getHighestLiquidityV3NativePool(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.gasToken, this.v3PoolProvider, providerConfig)
            : Promise.resolve(null);
        const [usdPool, nativeAndQuoteTokenV3Pool, nativeAndAmountTokenV3Pool, nativeAndSpecifiedGasTokenV3Pool,] = await Promise.all([
            usdPoolPromise,
            nativeAndQuoteTokenV3PoolPromise,
            nativeAndAmountTokenV3PoolPromise,
            nativeAndSpecifiedGasTokenV3PoolPromise,
        ]);
        const pools = {
            usdPool: usdPool,
            nativeAndQuoteTokenV3Pool: nativeAndQuoteTokenV3Pool,
            nativeAndAmountTokenV3Pool: nativeAndAmountTokenV3Pool,
            nativeAndSpecifiedGasTokenV3Pool: nativeAndSpecifiedGasTokenV3Pool,
        };
        const v2GasModelPromise = ((_a = this.v2Supported) === null || _a === void 0 ? void 0 : _a.includes(this.chainId))
            ? this.v2GasModelFactory
                .buildGasModel({
                chainId: this.chainId,
                gasPriceWei,
                poolProvider: this.v2PoolProvider,
                token: quoteToken,
                l2GasDataProvider: this.l2GasDataProvider,
                providerConfig: providerConfig,
            })
                .catch((_) => undefined) // If v2 model throws uncaught exception, we return undefined v2 gas model, so there's a chance v3 route can go through
            : Promise.resolve(undefined);
        const v3GasModelPromise = this.v3GasModelFactory.buildGasModel({
            chainId: this.chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: this.v2PoolProvider,
            l2GasDataProvider: this.l2GasDataProvider,
            providerConfig: providerConfig,
        });
        const mixedRouteGasModelPromise = this.mixedRouteGasModelFactory.buildGasModel({
            chainId: this.chainId,
            gasPriceWei,
            pools,
            amountToken,
            quoteToken,
            v2poolProvider: this.v2PoolProvider,
            providerConfig: providerConfig,
        });
        const [v2GasModel, v3GasModel, mixedRouteGasModel] = await Promise.all([
            v2GasModelPromise,
            v3GasModelPromise,
            mixedRouteGasModelPromise,
        ]);
        metric.putMetric('GasModelCreation', Date.now() - beforeGasModel, MetricLoggerUnit.Milliseconds);
        return {
            v2GasModel: v2GasModel,
            v3GasModel: v3GasModel,
            mixedRouteGasModel: mixedRouteGasModel,
        };
    }
    // Note multiplications here can result in a loss of precision in the amounts (e.g. taking 50% of 101)
    // This is reconcilled at the end of the algorithm by adding any lost precision to one of
    // the splits in the route.
    getAmountDistribution(amount, routingConfig) {
        const { distributionPercent } = routingConfig;
        const percents = [];
        const amounts = [];
        for (let i = 1; i <= 100 / distributionPercent; i++) {
            percents.push(i * distributionPercent);
            amounts.push(amount.multiply(new Fraction(i * distributionPercent, 100)));
        }
        return [percents, amounts];
    }
    async buildSwapAndAddMethodParameters(trade, swapAndAddOptions, swapAndAddParameters) {
        const { swapOptions: { recipient, slippageTolerance, deadline, inputTokenPermit }, addLiquidityOptions: addLiquidityConfig, } = swapAndAddOptions;
        const preLiquidityPosition = swapAndAddParameters.preLiquidityPosition;
        const finalBalanceTokenIn = swapAndAddParameters.initialBalanceTokenIn.subtract(trade.inputAmount);
        const finalBalanceTokenOut = swapAndAddParameters.initialBalanceTokenOut.add(trade.outputAmount);
        const approvalTypes = await this.swapRouterProvider.getApprovalType(finalBalanceTokenIn, finalBalanceTokenOut);
        const zeroForOne = finalBalanceTokenIn.currency.wrapped.sortsBefore(finalBalanceTokenOut.currency.wrapped);
        return {
            ...SwapRouter.swapAndAddCallParameters(trade, {
                recipient,
                slippageTolerance,
                deadlineOrPreviousBlockhash: deadline,
                inputTokenPermit,
            }, Position.fromAmounts({
                pool: preLiquidityPosition.pool,
                tickLower: preLiquidityPosition.tickLower,
                tickUpper: preLiquidityPosition.tickUpper,
                amount0: zeroForOne
                    ? finalBalanceTokenIn.quotient.toString()
                    : finalBalanceTokenOut.quotient.toString(),
                amount1: zeroForOne
                    ? finalBalanceTokenOut.quotient.toString()
                    : finalBalanceTokenIn.quotient.toString(),
                useFullPrecision: false,
            }), addLiquidityConfig, approvalTypes.approvalTokenIn, approvalTypes.approvalTokenOut),
            to: SWAP_ROUTER_02_ADDRESSES(this.chainId),
        };
    }
    emitPoolSelectionMetrics(swapRouteRaw, allPoolsBySelection) {
        const poolAddressesUsed = new Set();
        const { routes: routeAmounts } = swapRouteRaw;
        _(routeAmounts)
            .flatMap((routeAmount) => {
            const { poolAddresses } = routeAmount;
            return poolAddresses;
        })
            .forEach((address) => {
            poolAddressesUsed.add(address.toLowerCase());
        });
        for (const poolsBySelection of allPoolsBySelection) {
            const { protocol } = poolsBySelection;
            _.forIn(poolsBySelection.selections, (pools, topNSelection) => {
                const topNUsed = _.findLastIndex(pools, (pool) => poolAddressesUsed.has(pool.id.toLowerCase())) + 1;
                metric.putMetric(_.capitalize(`${protocol}${topNSelection}`), topNUsed, MetricLoggerUnit.Count);
            });
        }
        let hasV3Route = false;
        let hasV2Route = false;
        let hasMixedRoute = false;
        for (const routeAmount of routeAmounts) {
            if (routeAmount.protocol === Protocol.V3) {
                hasV3Route = true;
            }
            if (routeAmount.protocol === Protocol.V2) {
                hasV2Route = true;
            }
            if (routeAmount.protocol === Protocol.MIXED) {
                hasMixedRoute = true;
            }
        }
        if (hasMixedRoute && (hasV3Route || hasV2Route)) {
            if (hasV3Route && hasV2Route) {
                metric.putMetric(`MixedAndV3AndV2SplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`MixedAndV3AndV2SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
            else if (hasV3Route) {
                metric.putMetric(`MixedAndV3SplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`MixedAndV3SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
            else if (hasV2Route) {
                metric.putMetric(`MixedAndV2SplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`MixedAndV2SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
        }
        else if (hasV3Route && hasV2Route) {
            metric.putMetric(`V3AndV2SplitRoute`, 1, MetricLoggerUnit.Count);
            metric.putMetric(`V3AndV2SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
        }
        else if (hasMixedRoute) {
            if (routeAmounts.length > 1) {
                metric.putMetric(`MixedSplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`MixedSplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
            else {
                metric.putMetric(`MixedRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`MixedRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
        }
        else if (hasV3Route) {
            if (routeAmounts.length > 1) {
                metric.putMetric(`V3SplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`V3SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
            else {
                metric.putMetric(`V3Route`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`V3RouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
        }
        else if (hasV2Route) {
            if (routeAmounts.length > 1) {
                metric.putMetric(`V2SplitRoute`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`V2SplitRouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
            else {
                metric.putMetric(`V2Route`, 1, MetricLoggerUnit.Count);
                metric.putMetric(`V2RouteForChain${this.chainId}`, 1, MetricLoggerUnit.Count);
            }
        }
    }
    calculateOptimalRatio(position, sqrtRatioX96, zeroForOne) {
        const upperSqrtRatioX96 = TickMath.getSqrtRatioAtTick(position.tickUpper);
        const lowerSqrtRatioX96 = TickMath.getSqrtRatioAtTick(position.tickLower);
        // returns Fraction(0, 1) for any out of range position regardless of zeroForOne. Implication: function
        // cannot be used to determine the trading direction of out of range positions.
        if (JSBI.greaterThan(sqrtRatioX96, upperSqrtRatioX96) ||
            JSBI.lessThan(sqrtRatioX96, lowerSqrtRatioX96)) {
            return new Fraction(0, 1);
        }
        const precision = JSBI.BigInt('1' + '0'.repeat(18));
        let optimalRatio = new Fraction(SqrtPriceMath.getAmount0Delta(sqrtRatioX96, upperSqrtRatioX96, precision, true), SqrtPriceMath.getAmount1Delta(sqrtRatioX96, lowerSqrtRatioX96, precision, true));
        if (!zeroForOne)
            optimalRatio = optimalRatio.invert();
        return optimalRatio;
    }
    async userHasSufficientBalance(fromAddress, tradeType, amount, quote) {
        try {
            const neededBalance = tradeType === TradeType.EXACT_INPUT ? amount : quote;
            let balance;
            if (neededBalance.currency.isNative) {
                balance = await this.provider.getBalance(fromAddress);
            }
            else {
                const tokenContract = Erc20__factory.connect(neededBalance.currency.address, this.provider);
                balance = await tokenContract.balanceOf(fromAddress);
            }
            return balance.gte(BigNumber.from(neededBalance.quotient.toString()));
        }
        catch (e) {
            log.error(e, 'Error while checking user balance');
            return false;
        }
    }
    absoluteValue(fraction) {
        const numeratorAbs = JSBI.lessThan(fraction.numerator, JSBI.BigInt(0))
            ? JSBI.unaryMinus(fraction.numerator)
            : fraction.numerator;
        const denominatorAbs = JSBI.lessThan(fraction.denominator, JSBI.BigInt(0))
            ? JSBI.unaryMinus(fraction.denominator)
            : fraction.denominator;
        return new Fraction(numeratorAbs, denominatorAbs);
    }
    getBlockNumberPromise() {
        return retry(async (_b, attempt) => {
            if (attempt > 1) {
                log.info(`Get block number attempt ${attempt}`);
            }
            return this.provider.getBlockNumber();
        }, {
            retries: 2,
            minTimeout: 100,
            maxTimeout: 1000,
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWxwaGEtcm91dGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2FscGhhLXJvdXRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sMEJBQTBCLENBQUM7QUFDckQsT0FBTyxFQUFnQixlQUFlLEVBQUUsTUFBTSwwQkFBMEIsQ0FBQztBQUN6RSxPQUFPLGtCQUFrQixNQUFNLDZCQUE2QixDQUFDO0FBQzdELE9BQU8sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFTLElBQUksRUFBRSxNQUFNLHFCQUFxQixDQUFDO0FBQ3hFLE9BQU8sRUFDTCxPQUFPLEVBRVAsUUFBUSxFQUVSLFNBQVMsR0FDVixNQUFNLG1CQUFtQixDQUFDO0FBRTNCLE9BQU8sRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUMxRSxPQUFPLEtBQUssTUFBTSxhQUFhLENBQUM7QUFDaEMsT0FBTyxJQUFJLE1BQU0sTUFBTSxDQUFDO0FBQ3hCLE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUN2QixPQUFPLFNBQVMsTUFBTSxZQUFZLENBQUM7QUFFbkMsT0FBTyxFQUNMLFlBQVksRUFDWixTQUFTLEVBQ1QseUJBQXlCLEVBQ3pCLGdDQUFnQyxFQUNoQyxxQkFBcUIsRUFDckIseUJBQXlCLEVBQ3pCLHFCQUFxQixFQUNyQix5QkFBeUIsRUFDekIseUJBQXlCLEVBQ3pCLHVCQUF1QixFQUN2Qix5QkFBeUIsRUFRekIsc0JBQXNCLEVBQ3RCLFdBQVcsRUFDWCx1QkFBdUIsRUFDdkIsb0JBQW9CLEVBRXBCLHdCQUF3QixFQUN4Qix3QkFBd0IsRUFDeEIsd0JBQXdCLEVBQ3hCLGtCQUFrQixFQUNsQix1QkFBdUIsRUFDdkIsd0JBQXdCLEVBQ3hCLG1CQUFtQixFQUNuQixlQUFlLEVBQ2YsK0JBQStCLEVB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