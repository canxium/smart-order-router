import { Protocol } from '@uniswap/router-sdk';
import { ChainId, TradeType } from '@uniswap/sdk-core';
import { ADDRESS_ZERO, FeeAmount } from '@uniswap/v3-sdk';
import _ from 'lodash';
import { DAI_OPTIMISM_SEPOLIA, USDC_ARBITRUM_SEPOLIA, USDC_OPTIMISM_SEPOLIA, USDT_OPTIMISM_SEPOLIA, WBTC_OPTIMISM_SEPOLIA, } from '../../../providers';
import { CELO, CELO_ALFAJORES, CEUR_CELO, CEUR_CELO_ALFAJORES, CUSD_CELO, CUSD_CELO_ALFAJORES, DAI_ARBITRUM, DAI_AVAX, DAI_BNB, DAI_MAINNET, DAI_MOONBEAM, DAI_OPTIMISM, DAI_OPTIMISM_GOERLI, DAI_POLYGON_MUMBAI, DAI_SEPOLIA, FEI_MAINNET, USDB_BLAST, USDC_ARBITRUM, USDC_ARBITRUM_GOERLI, USDC_AVAX, USDC_BASE, USDC_BNB, USDC_ETHEREUM_GNOSIS, USDC_MAINNET, USDC_MOONBEAM, USDC_OPTIMISM, USDC_OPTIMISM_GOERLI, USDC_POLYGON, USDC_SEPOLIA, USDC_CANXIUM, USDT_ARBITRUM, USDT_BNB, USDT_MAINNET, USDT_OPTIMISM, USDT_OPTIMISM_GOERLI, WBTC_ARBITRUM, WBTC_GNOSIS, WBTC_MAINNET, WBTC_MOONBEAM, WBTC_OPTIMISM, WBTC_OPTIMISM_GOERLI, WGLMR_MOONBEAM, WMATIC_POLYGON, WMATIC_POLYGON_MUMBAI, WSTETH_MAINNET, WXDAI_GNOSIS, WCAU_CANXIUM, } from '../../../providers/token-provider';
import { unparseFeeAmount, WRAPPED_NATIVE_CURRENCY } from '../../../util';
import { parseFeeAmount } from '../../../util/amounts';
import { log } from '../../../util/log';
import { metric, MetricLoggerUnit } from '../../../util/metric';
const baseTokensByChain = {
    [ChainId.MAINNET]: [
        USDC_MAINNET,
        USDT_MAINNET,
        WBTC_MAINNET,
        DAI_MAINNET,
        WRAPPED_NATIVE_CURRENCY[1],
        FEI_MAINNET,
        WSTETH_MAINNET,
    ],
    [ChainId.OPTIMISM]: [
        DAI_OPTIMISM,
        USDC_OPTIMISM,
        USDT_OPTIMISM,
        WBTC_OPTIMISM,
    ],
    [ChainId.SEPOLIA]: [DAI_SEPOLIA, USDC_SEPOLIA],
    [ChainId.OPTIMISM_GOERLI]: [
        DAI_OPTIMISM_GOERLI,
        USDC_OPTIMISM_GOERLI,
        USDT_OPTIMISM_GOERLI,
        WBTC_OPTIMISM_GOERLI,
    ],
    [ChainId.OPTIMISM_SEPOLIA]: [
        DAI_OPTIMISM_SEPOLIA,
        USDC_OPTIMISM_SEPOLIA,
        USDT_OPTIMISM_SEPOLIA,
        WBTC_OPTIMISM_SEPOLIA,
    ],
    [ChainId.ARBITRUM_ONE]: [
        DAI_ARBITRUM,
        USDC_ARBITRUM,
        WBTC_ARBITRUM,
        USDT_ARBITRUM,
    ],
    [ChainId.ARBITRUM_GOERLI]: [USDC_ARBITRUM_GOERLI],
    [ChainId.ARBITRUM_SEPOLIA]: [USDC_ARBITRUM_SEPOLIA],
    [ChainId.POLYGON]: [USDC_POLYGON, WMATIC_POLYGON],
    [ChainId.POLYGON_MUMBAI]: [DAI_POLYGON_MUMBAI, WMATIC_POLYGON_MUMBAI],
    [ChainId.CELO]: [CUSD_CELO, CEUR_CELO, CELO],
    [ChainId.CELO_ALFAJORES]: [
        CUSD_CELO_ALFAJORES,
        CEUR_CELO_ALFAJORES,
        CELO_ALFAJORES,
    ],
    [ChainId.GNOSIS]: [WBTC_GNOSIS, WXDAI_GNOSIS, USDC_ETHEREUM_GNOSIS],
    [ChainId.MOONBEAM]: [
        DAI_MOONBEAM,
        USDC_MOONBEAM,
        WBTC_MOONBEAM,
        WGLMR_MOONBEAM,
    ],
    [ChainId.BNB]: [DAI_BNB, USDC_BNB, USDT_BNB],
    [ChainId.AVALANCHE]: [DAI_AVAX, USDC_AVAX],
    [ChainId.BASE]: [USDC_BASE],
    [ChainId.BLAST]: [WRAPPED_NATIVE_CURRENCY[ChainId.BLAST], USDB_BLAST],
    [ChainId.ZORA]: [WRAPPED_NATIVE_CURRENCY[ChainId.ZORA]],
    [ChainId.ZKSYNC]: [WRAPPED_NATIVE_CURRENCY[ChainId.ZKSYNC]],
    [ChainId.CANXIUM]: [
        USDC_CANXIUM,
        WCAU_CANXIUM
    ],
};
class SubcategorySelectionPools {
    constructor(pools, poolsNeeded) {
        this.pools = pools;
        this.poolsNeeded = poolsNeeded;
    }
    hasEnoughPools() {
        return this.pools.length >= this.poolsNeeded;
    }
}
/**
 * Function that finds any missing pools that were not selected by the heuristic but that would
 *   create a route with the topPool by TVL with either tokenIn or tokenOut across protocols.
 *
 *   e.g. In V2CandidatePools we found that wstETH/DOG is the most liquid pool,
 *        then in V3CandidatePools ETH/wstETH is *not* the most liquid pool, so it is not selected
 *        This process will look for that pool in order to complete the route.
 *
 */
export async function getMixedCrossLiquidityCandidatePools({ tokenIn, tokenOut, blockNumber, v2SubgraphProvider, v3SubgraphProvider, v2Candidates, v3Candidates, }) {
    const v2Pools = (await v2SubgraphProvider.getPools(tokenIn, tokenOut, {
        blockNumber,
    })).sort((a, b) => b.reserve - a.reserve);
    const v3Pools = (await v3SubgraphProvider.getPools(tokenIn, tokenOut, {
        blockNumber,
    })).sort((a, b) => b.tvlUSD - a.tvlUSD);
    const tokenInAddress = tokenIn.address.toLowerCase();
    const tokenOutAddress = tokenOut.address.toLowerCase();
    const v2SelectedPools = findCrossProtocolMissingPools(tokenInAddress, tokenOutAddress, v2Pools, v2Candidates, v3Candidates);
    const v3SelectedPools = findCrossProtocolMissingPools(tokenInAddress, tokenOutAddress, v3Pools, v3Candidates, v2Candidates);
    const selectedV2Pools = [
        v2SelectedPools.forTokenIn,
        v2SelectedPools.forTokenOut,
    ].filter((pool) => pool !== undefined);
    const selectedV3Pools = [
        v3SelectedPools.forTokenIn,
        v3SelectedPools.forTokenOut,
    ].filter((pool) => pool !== undefined);
    return {
        v2Pools: selectedV2Pools,
        v3Pools: selectedV3Pools,
    };
}
function findCrossProtocolMissingPools(tokenInAddress, tokenOutAddress, pools, candidatesInProtocolToSearch, candidatesInContextProtocol) {
    var _a;
    const selectedPools = {};
    const previouslySelectedPools = new Set((_a = candidatesInProtocolToSearch === null || candidatesInProtocolToSearch === void 0 ? void 0 : candidatesInProtocolToSearch.subgraphPools.map((pool) => pool.id)) !== null && _a !== void 0 ? _a : []);
    const topPoolByTvlWithTokenOut = candidatesInContextProtocol === null || candidatesInContextProtocol === void 0 ? void 0 : candidatesInContextProtocol.candidatePools.selections.topByTVLUsingTokenOut[0];
    const crossTokenAgainstTokenOut = (topPoolByTvlWithTokenOut === null || topPoolByTvlWithTokenOut === void 0 ? void 0 : topPoolByTvlWithTokenOut.token0.id.toLowerCase()) === tokenOutAddress
        ? topPoolByTvlWithTokenOut === null || topPoolByTvlWithTokenOut === void 0 ? void 0 : topPoolByTvlWithTokenOut.token1.id.toLowerCase()
        : topPoolByTvlWithTokenOut === null || topPoolByTvlWithTokenOut === void 0 ? void 0 : topPoolByTvlWithTokenOut.token0.id.toLowerCase();
    const topPoolByTvlWithTokenIn = candidatesInContextProtocol === null || candidatesInContextProtocol === void 0 ? void 0 : candidatesInContextProtocol.candidatePools.selections.topByTVLUsingTokenIn[0];
    const crossTokenAgainstTokenIn = (topPoolByTvlWithTokenIn === null || topPoolByTvlWithTokenIn === void 0 ? void 0 : topPoolByTvlWithTokenIn.token0.id.toLowerCase()) === tokenInAddress
        ? topPoolByTvlWithTokenIn === null || topPoolByTvlWithTokenIn === void 0 ? void 0 : topPoolByTvlWithTokenIn.token1.id.toLowerCase()
        : topPoolByTvlWithTokenIn === null || topPoolByTvlWithTokenIn === void 0 ? void 0 : topPoolByTvlWithTokenIn.token0.id.toLowerCase();
    for (const pool of pools) {
        // If we already found both pools for tokenIn and tokenOut. break out of this for loop.
        if (selectedPools.forTokenIn !== undefined &&
            selectedPools.forTokenOut !== undefined) {
            break;
        }
        // If the pool has already been selected. continue to the next pool.
        if (previouslySelectedPools.has(pool.id.toLowerCase())) {
            continue;
        }
        const poolToken0Address = pool.token0.id.toLowerCase();
        const poolToken1Address = pool.token1.id.toLowerCase();
        // If we haven't selected the pool for tokenIn, and we found a pool matching the tokenOut, and the intermediateToken, select this pool
        if (selectedPools.forTokenIn === undefined &&
            ((poolToken0Address === tokenOutAddress &&
                poolToken1Address === crossTokenAgainstTokenIn) ||
                (poolToken1Address === tokenOutAddress &&
                    poolToken0Address === crossTokenAgainstTokenIn))) {
            selectedPools.forTokenIn = pool;
        }
        // If we haven't selected the pool for tokenOut, and we found a pool matching the tokenIn, and the intermediateToken, select this pool
        if (selectedPools.forTokenOut === undefined &&
            ((poolToken0Address === tokenInAddress &&
                poolToken1Address === crossTokenAgainstTokenOut) ||
                (poolToken1Address === tokenInAddress &&
                    poolToken0Address === crossTokenAgainstTokenOut))) {
            selectedPools.forTokenOut = pool;
        }
    }
    return selectedPools;
}
// TODO: ROUTE-241 - refactor getV3CandidatePools against getV4CandidatePools
export async function getV4CandidatePools({ tokenIn, tokenOut, routeType, routingConfig, subgraphProvider, tokenProvider, poolProvider, blockedTokenListProvider, chainId, }) {
    var _a, _b, _c, _d, _e;
    const { blockNumber, v4PoolSelection: { topN, topNDirectSwaps, topNTokenInOut, topNSecondHop, topNSecondHopForTokenAddress, tokensToAvoidOnSecondHops, topNWithEachBaseToken, topNWithBaseToken, }, } = routingConfig;
    const tokenInAddress = tokenIn.address.toLowerCase();
    const tokenOutAddress = tokenOut.address.toLowerCase();
    const beforeSubgraphPools = Date.now();
    const allPools = await subgraphProvider.getPools(tokenIn, tokenOut, {
        blockNumber,
    });
    log.info({ samplePools: allPools.slice(0, 3) }, 'Got all pools from V4 subgraph provider');
    // Although this is less of an optimization than the V2 equivalent,
    // save some time copying objects by mutating the underlying pool directly.
    for (const pool of allPools) {
        pool.token0.id = pool.token0.id.toLowerCase();
        pool.token1.id = pool.token1.id.toLowerCase();
    }
    metric.putMetric('V4SubgraphPoolsLoad', Date.now() - beforeSubgraphPools, MetricLoggerUnit.Milliseconds);
    const beforePoolsFiltered = Date.now();
    // Only consider pools where neither tokens are in the blocked token list.
    let filteredPools = allPools;
    if (blockedTokenListProvider) {
        filteredPools = [];
        for (const pool of allPools) {
            const token0InBlocklist = await blockedTokenListProvider.hasTokenByAddress(pool.token0.id);
            const token1InBlocklist = await blockedTokenListProvider.hasTokenByAddress(pool.token1.id);
            if (token0InBlocklist || token1InBlocklist) {
                continue;
            }
            filteredPools.push(pool);
        }
    }
    // Sort by tvlUSD in descending order
    const subgraphPoolsSorted = filteredPools.sort((a, b) => b.tvlUSD - a.tvlUSD);
    log.info(`After filtering blocked tokens went from ${allPools.length} to ${subgraphPoolsSorted.length}.`);
    const poolAddressesSoFar = new Set();
    const addToAddressSet = (pools) => {
        _(pools)
            .map((pool) => pool.id)
            .forEach((poolAddress) => poolAddressesSoFar.add(poolAddress));
    };
    const baseTokens = (_a = baseTokensByChain[chainId]) !== null && _a !== void 0 ? _a : [];
    const topByBaseWithTokenIn = _(baseTokens)
        .flatMap((token) => {
        return _(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            const tokenAddress = token.address.toLowerCase();
            return ((subgraphPool.token0.id == tokenAddress &&
                subgraphPool.token1.id == tokenInAddress) ||
                (subgraphPool.token1.id == tokenAddress &&
                    subgraphPool.token0.id == tokenInAddress));
        })
            .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
            .slice(0, topNWithEachBaseToken)
            .value();
    })
        .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
        .slice(0, topNWithBaseToken)
        .value();
    const topByBaseWithTokenOut = _(baseTokens)
        .flatMap((token) => {
        return _(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            const tokenAddress = token.address.toLowerCase();
            return ((subgraphPool.token0.id == tokenAddress &&
                subgraphPool.token1.id == tokenOutAddress) ||
                (subgraphPool.token1.id == tokenAddress &&
                    subgraphPool.token0.id == tokenOutAddress));
        })
            .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
            .slice(0, topNWithEachBaseToken)
            .value();
    })
        .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
        .slice(0, topNWithBaseToken)
        .value();
    let top2DirectSwapPool = _(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return (!poolAddressesSoFar.has(subgraphPool.id) &&
            ((subgraphPool.token0.id == tokenInAddress &&
                subgraphPool.token1.id == tokenOutAddress) ||
                (subgraphPool.token1.id == tokenInAddress &&
                    subgraphPool.token0.id == tokenOutAddress)));
    })
        .slice(0, topNDirectSwaps)
        .value();
    if (top2DirectSwapPool.length == 0 && topNDirectSwaps > 0) {
        // If we requested direct swap pools but did not find any in the subgraph query.
        // Optimistically add them into the query regardless. Invalid pools ones will be dropped anyway
        // when we query the pool on-chain. Ensures that new pools for new pairs can be swapped on immediately.
        top2DirectSwapPool = _.map([
            [FeeAmount.HIGH, 200, ADDRESS_ZERO],
            [FeeAmount.MEDIUM, 60, ADDRESS_ZERO],
            [FeeAmount.LOW, 10, ADDRESS_ZERO],
            [FeeAmount.LOWEST, 1, ADDRESS_ZERO],
        ], (poolParams) => {
            const [fee, tickSpacing, hooks] = poolParams;
            const { currency0, currency1, poolId } = poolProvider.getPoolId(tokenIn, tokenOut, fee, tickSpacing, hooks);
            return {
                id: poolId,
                feeTier: unparseFeeAmount(fee),
                tickSpacing: tickSpacing.toString(),
                hooks: hooks,
                liquidity: '10000',
                token0: {
                    id: currency0.wrapped.address,
                },
                token1: {
                    id: currency1.wrapped.address,
                },
                tvlETH: 10000,
                tvlUSD: 10000,
            };
        });
    }
    addToAddressSet(top2DirectSwapPool);
    const wrappedNativeAddress = (_b = WRAPPED_NATIVE_CURRENCY[chainId]) === null || _b === void 0 ? void 0 : _b.address.toLowerCase();
    // Main reason we need this is for gas estimates, only needed if token out is not native.
    // We don't check the seen address set because if we've already added pools for getting native quotes
    // theres no need to add more.
    let top2EthQuoteTokenPool = [];
    if ((((_c = WRAPPED_NATIVE_CURRENCY[chainId]) === null || _c === void 0 ? void 0 : _c.symbol) ==
        ((_d = WRAPPED_NATIVE_CURRENCY[ChainId.MAINNET]) === null || _d === void 0 ? void 0 : _d.symbol) &&
        tokenOut.symbol != 'WETH' &&
        tokenOut.symbol != 'WETH9' &&
        tokenOut.symbol != 'ETH') ||
        (((_e = WRAPPED_NATIVE_CURRENCY[chainId]) === null || _e === void 0 ? void 0 : _e.symbol) == WMATIC_POLYGON.symbol &&
            tokenOut.symbol != 'MATIC' &&
            tokenOut.symbol != 'WMATIC')) {
        top2EthQuoteTokenPool = _(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            if (routeType == TradeType.EXACT_INPUT) {
                return ((subgraphPool.token0.id == wrappedNativeAddress &&
                    subgraphPool.token1.id == tokenOutAddress) ||
                    (subgraphPool.token1.id == wrappedNativeAddress &&
                        subgraphPool.token0.id == tokenOutAddress));
            }
            else {
                return ((subgraphPool.token0.id == wrappedNativeAddress &&
                    subgraphPool.token1.id == tokenInAddress) ||
                    (subgraphPool.token1.id == wrappedNativeAddress &&
                        subgraphPool.token0.id == tokenInAddress));
            }
        })
            .slice(0, 1)
            .value();
    }
    addToAddressSet(top2EthQuoteTokenPool);
    const topByTVL = _(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return !poolAddressesSoFar.has(subgraphPool.id);
    })
        .slice(0, topN)
        .value();
    addToAddressSet(topByTVL);
    const topByTVLUsingTokenIn = _(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return (!poolAddressesSoFar.has(subgraphPool.id) &&
            (subgraphPool.token0.id == tokenInAddress ||
                subgraphPool.token1.id == tokenInAddress));
    })
        .slice(0, topNTokenInOut)
        .value();
    addToAddressSet(topByTVLUsingTokenIn);
    const topByTVLUsingTokenOut = _(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return (!poolAddressesSoFar.has(subgraphPool.id) &&
            (subgraphPool.token0.id == tokenOutAddress ||
                subgraphPool.token1.id == tokenOutAddress));
    })
        .slice(0, topNTokenInOut)
        .value();
    addToAddressSet(topByTVLUsingTokenOut);
    const topByTVLUsingTokenInSecondHops = _(topByTVLUsingTokenIn)
        .map((subgraphPool) => {
        return tokenInAddress == subgraphPool.token0.id
            ? subgraphPool.token1.id
            : subgraphPool.token0.id;
    })
        .flatMap((secondHopId) => {
        var _a;
        return _(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            return (!poolAddressesSoFar.has(subgraphPool.id) &&
                !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(secondHopId.toLowerCase())) &&
                (subgraphPool.token0.id == secondHopId ||
                    subgraphPool.token1.id == secondHopId));
        })
            .slice(0, (_a = topNSecondHopForTokenAddress === null || topNSecondHopForTokenAddress === void 0 ? void 0 : topNSecondHopForTokenAddress.get(secondHopId)) !== null && _a !== void 0 ? _a : topNSecondHop)
            .value();
    })
        .uniqBy((pool) => pool.id)
        .value();
    addToAddressSet(topByTVLUsingTokenInSecondHops);
    const topByTVLUsingTokenOutSecondHops = _(topByTVLUsingTokenOut)
        .map((subgraphPool) => {
        return tokenOutAddress == subgraphPool.token0.id
            ? subgraphPool.token1.id
            : subgraphPool.token0.id;
    })
        .flatMap((secondHopId) => {
        var _a;
        return _(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            return (!poolAddressesSoFar.has(subgraphPool.id) &&
                !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(secondHopId.toLowerCase())) &&
                (subgraphPool.token0.id == secondHopId ||
                    subgraphPool.token1.id == secondHopId));
        })
            .slice(0, (_a = topNSecondHopForTokenAddress === null || topNSecondHopForTokenAddress === void 0 ? void 0 : topNSecondHopForTokenAddress.get(secondHopId)) !== null && _a !== void 0 ? _a : topNSecondHop)
            .value();
    })
        .uniqBy((pool) => pool.id)
        .value();
    addToAddressSet(topByTVLUsingTokenOutSecondHops);
    const subgraphPools = _([
        ...topByBaseWithTokenIn,
        ...topByBaseWithTokenOut,
        ...top2DirectSwapPool,
        ...top2EthQuoteTokenPool,
        ...topByTVL,
        ...topByTVLUsingTokenIn,
        ...topByTVLUsingTokenOut,
        ...topByTVLUsingTokenInSecondHops,
        ...topByTVLUsingTokenOutSecondHops,
    ])
        .compact()
        .uniqBy((pool) => pool.id)
        .value();
    const tokenAddresses = _(subgraphPools)
        .flatMap((subgraphPool) => [subgraphPool.token0.id, subgraphPool.token1.id])
        .compact()
        .uniq()
        .value();
    log.info(`Getting the ${tokenAddresses.length} tokens within the ${subgraphPools.length} V4 pools we are considering`);
    const tokenAccessor = await tokenProvider.getTokens(tokenAddresses, {
        blockNumber,
    });
    const printV4SubgraphPool = (s) => {
        var _a, _b, _c, _d;
        return `${(_b = (_a = tokenAccessor.getTokenByAddress(s.token0.id)) === null || _a === void 0 ? void 0 : _a.symbol) !== null && _b !== void 0 ? _b : s.token0.id}/${(_d = (_c = tokenAccessor.getTokenByAddress(s.token1.id)) === null || _c === void 0 ? void 0 : _c.symbol) !== null && _d !== void 0 ? _d : s.token1.id}/${s.feeTier}/${s.tickSpacing}/${s.hooks}`;
    };
    log.info({
        topByBaseWithTokenIn: topByBaseWithTokenIn.map(printV4SubgraphPool),
        topByBaseWithTokenOut: topByBaseWithTokenOut.map(printV4SubgraphPool),
        topByTVL: topByTVL.map(printV4SubgraphPool),
        topByTVLUsingTokenIn: topByTVLUsingTokenIn.map(printV4SubgraphPool),
        topByTVLUsingTokenOut: topByTVLUsingTokenOut.map(printV4SubgraphPool),
        topByTVLUsingTokenInSecondHops: topByTVLUsingTokenInSecondHops.map(printV4SubgraphPool),
        topByTVLUsingTokenOutSecondHops: topByTVLUsingTokenOutSecondHops.map(printV4SubgraphPool),
        top2DirectSwap: top2DirectSwapPool.map(printV4SubgraphPool),
        top2EthQuotePool: top2EthQuoteTokenPool.map(printV4SubgraphPool),
    }, `V4 Candidate Pools`);
    const tokenPairsRaw = _.map(subgraphPools, (subgraphPool) => {
        const tokenA = tokenAccessor.getTokenByAddress(subgraphPool.token0.id);
        const tokenB = tokenAccessor.getTokenByAddress(subgraphPool.token1.id);
        let fee;
        try {
            fee = parseFeeAmount(subgraphPool.feeTier);
        }
        catch (err) {
            log.info({ subgraphPool }, `Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}/${subgraphPool.feeTier} because fee tier not supported`);
            return undefined;
        }
        if (!tokenA || !tokenB) {
            log.info(`Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}/${fee} because ${tokenA ? subgraphPool.token1.id : subgraphPool.token0.id} not found by token provider`);
            return undefined;
        }
        return [
            tokenA,
            tokenB,
            fee,
            Number(subgraphPool.tickSpacing),
            subgraphPool.hooks,
        ];
    });
    const tokenPairs = _.compact(tokenPairsRaw);
    metric.putMetric('V4PoolsFilterLoad', Date.now() - beforePoolsFiltered, MetricLoggerUnit.Milliseconds);
    const beforePoolsLoad = Date.now();
    const poolAccessor = await poolProvider.getPools(tokenPairs, {
        blockNumber,
    });
    metric.putMetric('V4PoolsLoad', Date.now() - beforePoolsLoad, MetricLoggerUnit.Milliseconds);
    const poolsBySelection = {
        protocol: Protocol.V4,
        selections: {
            topByBaseWithTokenIn,
            topByBaseWithTokenOut,
            topByDirectSwapPool: top2DirectSwapPool,
            topByEthQuoteTokenPool: top2EthQuoteTokenPool,
            topByTVL,
            topByTVLUsingTokenIn,
            topByTVLUsingTokenOut,
            topByTVLUsingTokenInSecondHops,
            topByTVLUsingTokenOutSecondHops,
        },
    };
    return { poolAccessor, candidatePools: poolsBySelection, subgraphPools };
}
export async function getV3CandidatePools({ tokenIn, tokenOut, routeType, routingConfig, subgraphProvider, tokenProvider, poolProvider, blockedTokenListProvider, chainId, }) {
    var _a, _b, _c, _d, _e;
    const { blockNumber, v3PoolSelection: { topN, topNDirectSwaps, topNTokenInOut, topNSecondHop, topNSecondHopForTokenAddress, tokensToAvoidOnSecondHops, topNWithEachBaseToken, topNWithBaseToken, }, } = routingConfig;
    const tokenInAddress = tokenIn.address.toLowerCase();
    const tokenOutAddress = tokenOut.address.toLowerCase();
    const beforeSubgraphPools = Date.now();
    const allPools = await subgraphProvider.getPools(tokenIn, tokenOut, {
        blockNumber,
    });
    log.info({ samplePools: allPools.slice(0, 3) }, 'Got all pools from V3 subgraph provider');
    // Although this is less of an optimization than the V2 equivalent,
    // save some time copying objects by mutating the underlying pool directly.
    for (const pool of allPools) {
        pool.token0.id = pool.token0.id.toLowerCase();
        pool.token1.id = pool.token1.id.toLowerCase();
    }
    metric.putMetric('V3SubgraphPoolsLoad', Date.now() - beforeSubgraphPools, MetricLoggerUnit.Milliseconds);
    const beforePoolsFiltered = Date.now();
    // Only consider pools where neither tokens are in the blocked token list.
    let filteredPools = allPools;
    if (blockedTokenListProvider) {
        filteredPools = [];
        for (const pool of allPools) {
            const token0InBlocklist = await blockedTokenListProvider.hasTokenByAddress(pool.token0.id);
            const token1InBlocklist = await blockedTokenListProvider.hasTokenByAddress(pool.token1.id);
            if (token0InBlocklist || token1InBlocklist) {
                continue;
            }
            filteredPools.push(pool);
        }
    }
    // Sort by tvlUSD in descending order
    const subgraphPoolsSorted = filteredPools.sort((a, b) => b.tvlUSD - a.tvlUSD);
    log.info(`After filtering blocked tokens went from ${allPools.length} to ${subgraphPoolsSorted.length}.`);
    const poolAddressesSoFar = new Set();
    const addToAddressSet = (pools) => {
        _(pools)
            .map((pool) => pool.id)
            .forEach((poolAddress) => poolAddressesSoFar.add(poolAddress));
    };
    const baseTokens = (_a = baseTokensByChain[chainId]) !== null && _a !== void 0 ? _a : [];
    const topByBaseWithTokenIn = _(baseTokens)
        .flatMap((token) => {
        return _(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            const tokenAddress = token.address.toLowerCase();
            return ((subgraphPool.token0.id == tokenAddress &&
                subgraphPool.token1.id == tokenInAddress) ||
                (subgraphPool.token1.id == tokenAddress &&
                    subgraphPool.token0.id == tokenInAddress));
        })
            .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
            .slice(0, topNWithEachBaseToken)
            .value();
    })
        .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
        .slice(0, topNWithBaseToken)
        .value();
    const topByBaseWithTokenOut = _(baseTokens)
        .flatMap((token) => {
        return _(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            const tokenAddress = token.address.toLowerCase();
            return ((subgraphPool.token0.id == tokenAddress &&
                subgraphPool.token1.id == tokenOutAddress) ||
                (subgraphPool.token1.id == tokenAddress &&
                    subgraphPool.token0.id == tokenOutAddress));
        })
            .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
            .slice(0, topNWithEachBaseToken)
            .value();
    })
        .sortBy((tokenListPool) => -tokenListPool.tvlUSD)
        .slice(0, topNWithBaseToken)
        .value();
    let top2DirectSwapPool = _(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return (!poolAddressesSoFar.has(subgraphPool.id) &&
            ((subgraphPool.token0.id == tokenInAddress &&
                subgraphPool.token1.id == tokenOutAddress) ||
                (subgraphPool.token1.id == tokenInAddress &&
                    subgraphPool.token0.id == tokenOutAddress)));
    })
        .slice(0, topNDirectSwaps)
        .value();
    if (top2DirectSwapPool.length == 0 && topNDirectSwaps > 0) {
        // If we requested direct swap pools but did not find any in the subgraph query.
        // Optimistically add them into the query regardless. Invalid pools ones will be dropped anyway
        // when we query the pool on-chain. Ensures that new pools for new pairs can be swapped on immediately.
        top2DirectSwapPool = _.map([FeeAmount.HIGH, FeeAmount.MEDIUM, FeeAmount.LOW, FeeAmount.LOWEST], (feeAmount) => {
            const { token0, token1, poolAddress } = poolProvider.getPoolAddress(tokenIn, tokenOut, feeAmount);
            return {
                id: poolAddress,
                feeTier: unparseFeeAmount(feeAmount),
                liquidity: '10000',
                token0: {
                    id: token0.address,
                },
                token1: {
                    id: token1.address,
                },
                tvlETH: 10000,
                tvlUSD: 10000,
            };
        });
    }
    addToAddressSet(top2DirectSwapPool);
    const wrappedNativeAddress = (_b = WRAPPED_NATIVE_CURRENCY[chainId]) === null || _b === void 0 ? void 0 : _b.address.toLowerCase();
    // Main reason we need this is for gas estimates, only needed if token out is not native.
    // We don't check the seen address set because if we've already added pools for getting native quotes
    // theres no need to add more.
    let top2EthQuoteTokenPool = [];
    if ((((_c = WRAPPED_NATIVE_CURRENCY[chainId]) === null || _c === void 0 ? void 0 : _c.symbol) ==
        ((_d = WRAPPED_NATIVE_CURRENCY[ChainId.MAINNET]) === null || _d === void 0 ? void 0 : _d.symbol) &&
        tokenOut.symbol != 'WETH' &&
        tokenOut.symbol != 'WETH9' &&
        tokenOut.symbol != 'ETH') ||
        (((_e = WRAPPED_NATIVE_CURRENCY[chainId]) === null || _e === void 0 ? void 0 : _e.symbol) == WMATIC_POLYGON.symbol &&
            tokenOut.symbol != 'MATIC' &&
            tokenOut.symbol != 'WMATIC')) {
        top2EthQuoteTokenPool = _(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            if (routeType == TradeType.EXACT_INPUT) {
                return ((subgraphPool.token0.id == wrappedNativeAddress &&
                    subgraphPool.token1.id == tokenOutAddress) ||
                    (subgraphPool.token1.id == wrappedNativeAddress &&
                        subgraphPool.token0.id == tokenOutAddress));
            }
            else {
                return ((subgraphPool.token0.id == wrappedNativeAddress &&
                    subgraphPool.token1.id == tokenInAddress) ||
                    (subgraphPool.token1.id == wrappedNativeAddress &&
                        subgraphPool.token0.id == tokenInAddress));
            }
        })
            .slice(0, 1)
            .value();
    }
    addToAddressSet(top2EthQuoteTokenPool);
    const topByTVL = _(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return !poolAddressesSoFar.has(subgraphPool.id);
    })
        .slice(0, topN)
        .value();
    addToAddressSet(topByTVL);
    const topByTVLUsingTokenIn = _(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return (!poolAddressesSoFar.has(subgraphPool.id) &&
            (subgraphPool.token0.id == tokenInAddress ||
                subgraphPool.token1.id == tokenInAddress));
    })
        .slice(0, topNTokenInOut)
        .value();
    addToAddressSet(topByTVLUsingTokenIn);
    const topByTVLUsingTokenOut = _(subgraphPoolsSorted)
        .filter((subgraphPool) => {
        return (!poolAddressesSoFar.has(subgraphPool.id) &&
            (subgraphPool.token0.id == tokenOutAddress ||
                subgraphPool.token1.id == tokenOutAddress));
    })
        .slice(0, topNTokenInOut)
        .value();
    addToAddressSet(topByTVLUsingTokenOut);
    const topByTVLUsingTokenInSecondHops = _(topByTVLUsingTokenIn)
        .map((subgraphPool) => {
        return tokenInAddress == subgraphPool.token0.id
            ? subgraphPool.token1.id
            : subgraphPool.token0.id;
    })
        .flatMap((secondHopId) => {
        var _a;
        return _(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            return (!poolAddressesSoFar.has(subgraphPool.id) &&
                !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(secondHopId.toLowerCase())) &&
                (subgraphPool.token0.id == secondHopId ||
                    subgraphPool.token1.id == secondHopId));
        })
            .slice(0, (_a = topNSecondHopForTokenAddress === null || topNSecondHopForTokenAddress === void 0 ? void 0 : topNSecondHopForTokenAddress.get(secondHopId)) !== null && _a !== void 0 ? _a : topNSecondHop)
            .value();
    })
        .uniqBy((pool) => pool.id)
        .value();
    addToAddressSet(topByTVLUsingTokenInSecondHops);
    const topByTVLUsingTokenOutSecondHops = _(topByTVLUsingTokenOut)
        .map((subgraphPool) => {
        return tokenOutAddress == subgraphPool.token0.id
            ? subgraphPool.token1.id
            : subgraphPool.token0.id;
    })
        .flatMap((secondHopId) => {
        var _a;
        return _(subgraphPoolsSorted)
            .filter((subgraphPool) => {
            return (!poolAddressesSoFar.has(subgraphPool.id) &&
                !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(secondHopId.toLowerCase())) &&
                (subgraphPool.token0.id == secondHopId ||
                    subgraphPool.token1.id == secondHopId));
        })
            .slice(0, (_a = topNSecondHopForTokenAddress === null || topNSecondHopForTokenAddress === void 0 ? void 0 : topNSecondHopForTokenAddress.get(secondHopId)) !== null && _a !== void 0 ? _a : topNSecondHop)
            .value();
    })
        .uniqBy((pool) => pool.id)
        .value();
    addToAddressSet(topByTVLUsingTokenOutSecondHops);
    const subgraphPools = _([
        ...topByBaseWithTokenIn,
        ...topByBaseWithTokenOut,
        ...top2DirectSwapPool,
        ...top2EthQuoteTokenPool,
        ...topByTVL,
        ...topByTVLUsingTokenIn,
        ...topByTVLUsingTokenOut,
        ...topByTVLUsingTokenInSecondHops,
        ...topByTVLUsingTokenOutSecondHops,
    ])
        .compact()
        .uniqBy((pool) => pool.id)
        .value();
    const tokenAddresses = _(subgraphPools)
        .flatMap((subgraphPool) => [subgraphPool.token0.id, subgraphPool.token1.id])
        .compact()
        .uniq()
        .value();
    log.info(`Getting the ${tokenAddresses.length} tokens within the ${subgraphPools.length} V3 pools we are considering`);
    const tokenAccessor = await tokenProvider.getTokens(tokenAddresses, {
        blockNumber,
    });
    const printV3SubgraphPool = (s) => {
        var _a, _b, _c, _d;
        return `${(_b = (_a = tokenAccessor.getTokenByAddress(s.token0.id)) === null || _a === void 0 ? void 0 : _a.symbol) !== null && _b !== void 0 ? _b : s.token0.id}/${(_d = (_c = tokenAccessor.getTokenByAddress(s.token1.id)) === null || _c === void 0 ? void 0 : _c.symbol) !== null && _d !== void 0 ? _d : s.token1.id}/${s.feeTier}`;
    };
    log.info({
        topByBaseWithTokenIn: topByBaseWithTokenIn.map(printV3SubgraphPool),
        topByBaseWithTokenOut: topByBaseWithTokenOut.map(printV3SubgraphPool),
        topByTVL: topByTVL.map(printV3SubgraphPool),
        topByTVLUsingTokenIn: topByTVLUsingTokenIn.map(printV3SubgraphPool),
        topByTVLUsingTokenOut: topByTVLUsingTokenOut.map(printV3SubgraphPool),
        topByTVLUsingTokenInSecondHops: topByTVLUsingTokenInSecondHops.map(printV3SubgraphPool),
        topByTVLUsingTokenOutSecondHops: topByTVLUsingTokenOutSecondHops.map(printV3SubgraphPool),
        top2DirectSwap: top2DirectSwapPool.map(printV3SubgraphPool),
        top2EthQuotePool: top2EthQuoteTokenPool.map(printV3SubgraphPool),
    }, `V3 Candidate Pools`);
    const tokenPairsRaw = _.map(subgraphPools, (subgraphPool) => {
        const tokenA = tokenAccessor.getTokenByAddress(subgraphPool.token0.id);
        const tokenB = tokenAccessor.getTokenByAddress(subgraphPool.token1.id);
        let fee;
        try {
            fee = parseFeeAmount(subgraphPool.feeTier);
        }
        catch (err) {
            log.info({ subgraphPool }, `Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}/${subgraphPool.feeTier} because fee tier not supported`);
            return undefined;
        }
        if (!tokenA || !tokenB) {
            log.info(`Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}/${fee} because ${tokenA ? subgraphPool.token1.id : subgraphPool.token0.id} not found by token provider`);
            return undefined;
        }
        return [tokenA, tokenB, fee];
    });
    const tokenPairs = _.compact(tokenPairsRaw);
    metric.putMetric('V3PoolsFilterLoad', Date.now() - beforePoolsFiltered, MetricLoggerUnit.Milliseconds);
    const beforePoolsLoad = Date.now();
    const poolAccessor = await poolProvider.getPools(tokenPairs, {
        blockNumber,
    });
    metric.putMetric('V3PoolsLoad', Date.now() - beforePoolsLoad, MetricLoggerUnit.Milliseconds);
    const poolsBySelection = {
        protocol: Protocol.V3,
        selections: {
            topByBaseWithTokenIn,
            topByBaseWithTokenOut,
            topByDirectSwapPool: top2DirectSwapPool,
            topByEthQuoteTokenPool: top2EthQuoteTokenPool,
            topByTVL,
            topByTVLUsingTokenIn,
            topByTVLUsingTokenOut,
            topByTVLUsingTokenInSecondHops,
            topByTVLUsingTokenOutSecondHops,
        },
    };
    return { poolAccessor, candidatePools: poolsBySelection, subgraphPools };
}
export async function getV2CandidatePools({ tokenIn, tokenOut, routeType, routingConfig, subgraphProvider, tokenProvider, poolProvider, blockedTokenListProvider, chainId, }) {
    var _a;
    const { blockNumber, v2PoolSelection: { topN, topNDirectSwaps, topNTokenInOut, topNSecondHop, tokensToAvoidOnSecondHops, topNWithEachBaseToken, topNWithBaseToken, }, } = routingConfig;
    const tokenInAddress = tokenIn.address.toLowerCase();
    const tokenOutAddress = tokenOut.address.toLowerCase();
    const beforeSubgraphPools = Date.now();
    const allPoolsRaw = await subgraphProvider.getPools(tokenIn, tokenOut, {
        blockNumber,
    });
    // With tens of thousands of V2 pools, operations that copy pools become costly.
    // Mutate the pool directly rather than creating a new pool / token to optimmize for speed.
    for (const pool of allPoolsRaw) {
        pool.token0.id = pool.token0.id.toLowerCase();
        pool.token1.id = pool.token1.id.toLowerCase();
    }
    metric.putMetric('V2SubgraphPoolsLoad', Date.now() - beforeSubgraphPools, MetricLoggerUnit.Milliseconds);
    const beforePoolsFiltered = Date.now();
    // Sort by pool reserve in descending order.
    const subgraphPoolsSorted = allPoolsRaw.sort((a, b) => b.reserve - a.reserve);
    const poolAddressesSoFar = new Set();
    // Always add the direct swap pool into the mix regardless of if it exists in the subgraph pool list.
    // Ensures that new pools can be swapped on immediately, and that if a pool was filtered out of the
    // subgraph query for some reason (e.g. trackedReserveETH was 0), then we still consider it.
    let topByDirectSwapPool = [];
    if (topNDirectSwaps > 0) {
        const { token0, token1, poolAddress } = poolProvider.getPoolAddress(tokenIn, tokenOut);
        poolAddressesSoFar.add(poolAddress.toLowerCase());
        topByDirectSwapPool = [
            {
                id: poolAddress,
                token0: {
                    id: token0.address,
                },
                token1: {
                    id: token1.address,
                },
                supply: 10000,
                reserve: 10000,
                reserveUSD: 10000, // Not used. Set to arbitrary number.
            },
        ];
    }
    const wethAddress = WRAPPED_NATIVE_CURRENCY[chainId].address.toLowerCase();
    const topByBaseWithTokenInMap = new Map();
    const topByBaseWithTokenOutMap = new Map();
    const baseTokens = (_a = baseTokensByChain[chainId]) !== null && _a !== void 0 ? _a : [];
    const baseTokensAddresses = new Set();
    baseTokens.forEach((token) => {
        const baseTokenAddr = token.address.toLowerCase();
        baseTokensAddresses.add(baseTokenAddr);
        topByBaseWithTokenInMap.set(baseTokenAddr, new SubcategorySelectionPools([], topNWithEachBaseToken));
        topByBaseWithTokenOutMap.set(baseTokenAddr, new SubcategorySelectionPools([], topNWithEachBaseToken));
    });
    let topByBaseWithTokenInPoolsFound = 0;
    let topByBaseWithTokenOutPoolsFound = 0;
    // Main reason we need this is for gas estimates
    // There can ever only be 1 Token/ETH pool, so we will only look for 1
    let topNEthQuoteToken = 1;
    // but, we only need it if token out is not ETH.
    if (tokenOut.symbol == 'WETH' ||
        tokenOut.symbol == 'WETH9' ||
        tokenOut.symbol == 'ETH') {
        // if it's eth we change the topN to 0, so we can break early from the loop.
        topNEthQuoteToken = 0;
    }
    const topByEthQuoteTokenPool = [];
    const topByTVLUsingTokenIn = [];
    const topByTVLUsingTokenOut = [];
    const topByTVL = [];
    // Used to track how many iterations we do in the first loop
    let loopsInFirstIteration = 0;
    // Filtering step for up to first hop
    // The pools are pre-sorted, so we can just iterate through them and fill our heuristics.
    for (const subgraphPool of subgraphPoolsSorted) {
        loopsInFirstIteration += 1;
        // Check if we have satisfied all the heuristics, if so, we can stop.
        if (topByBaseWithTokenInPoolsFound >= topNWithBaseToken &&
            topByBaseWithTokenOutPoolsFound >= topNWithBaseToken &&
            topByEthQuoteTokenPool.length >= topNEthQuoteToken &&
            topByTVL.length >= topN &&
            topByTVLUsingTokenIn.length >= topNTokenInOut &&
            topByTVLUsingTokenOut.length >= topNTokenInOut) {
            // We have satisfied all the heuristics, so we can stop.
            break;
        }
        if (poolAddressesSoFar.has(subgraphPool.id)) {
            // We've already added this pool, so skip it.
            continue;
        }
        // Only consider pools where neither tokens are in the blocked token list.
        if (blockedTokenListProvider) {
            const [token0InBlocklist, token1InBlocklist] = await Promise.all([
                blockedTokenListProvider.hasTokenByAddress(subgraphPool.token0.id),
                blockedTokenListProvider.hasTokenByAddress(subgraphPool.token1.id),
            ]);
            if (token0InBlocklist || token1InBlocklist) {
                continue;
            }
        }
        const tokenInToken0TopByBase = topByBaseWithTokenInMap.get(subgraphPool.token0.id);
        if (topByBaseWithTokenInPoolsFound < topNWithBaseToken &&
            tokenInToken0TopByBase &&
            subgraphPool.token0.id != tokenOutAddress &&
            subgraphPool.token1.id == tokenInAddress) {
            topByBaseWithTokenInPoolsFound += 1;
            poolAddressesSoFar.add(subgraphPool.id);
            if (topByTVLUsingTokenIn.length < topNTokenInOut) {
                topByTVLUsingTokenIn.push(subgraphPool);
            }
            if (routeType === TradeType.EXACT_OUTPUT &&
                subgraphPool.token0.id == wethAddress) {
                topByEthQuoteTokenPool.push(subgraphPool);
            }
            tokenInToken0TopByBase.pools.push(subgraphPool);
            continue;
        }
        const tokenInToken1TopByBase = topByBaseWithTokenInMap.get(subgraphPool.token1.id);
        if (topByBaseWithTokenInPoolsFound < topNWithBaseToken &&
            tokenInToken1TopByBase &&
            subgraphPool.token0.id == tokenInAddress &&
            subgraphPool.token1.id != tokenOutAddress) {
            topByBaseWithTokenInPoolsFound += 1;
            poolAddressesSoFar.add(subgraphPool.id);
            if (topByTVLUsingTokenIn.length < topNTokenInOut) {
                topByTVLUsingTokenIn.push(subgraphPool);
            }
            if (routeType === TradeType.EXACT_OUTPUT &&
                subgraphPool.token1.id == wethAddress) {
                topByEthQuoteTokenPool.push(subgraphPool);
            }
            tokenInToken1TopByBase.pools.push(subgraphPool);
            continue;
        }
        const tokenOutToken0TopByBase = topByBaseWithTokenOutMap.get(subgraphPool.token0.id);
        if (topByBaseWithTokenOutPoolsFound < topNWithBaseToken &&
            tokenOutToken0TopByBase &&
            subgraphPool.token0.id != tokenInAddress &&
            subgraphPool.token1.id == tokenOutAddress) {
            topByBaseWithTokenOutPoolsFound += 1;
            poolAddressesSoFar.add(subgraphPool.id);
            if (topByTVLUsingTokenOut.length < topNTokenInOut) {
                topByTVLUsingTokenOut.push(subgraphPool);
            }
            if (routeType === TradeType.EXACT_INPUT &&
                subgraphPool.token0.id == wethAddress) {
                topByEthQuoteTokenPool.push(subgraphPool);
            }
            tokenOutToken0TopByBase.pools.push(subgraphPool);
            continue;
        }
        const tokenOutToken1TopByBase = topByBaseWithTokenOutMap.get(subgraphPool.token1.id);
        if (topByBaseWithTokenOutPoolsFound < topNWithBaseToken &&
            tokenOutToken1TopByBase &&
            subgraphPool.token0.id == tokenOutAddress &&
            subgraphPool.token1.id != tokenInAddress) {
            topByBaseWithTokenOutPoolsFound += 1;
            poolAddressesSoFar.add(subgraphPool.id);
            if (topByTVLUsingTokenOut.length < topNTokenInOut) {
                topByTVLUsingTokenOut.push(subgraphPool);
            }
            if (routeType === TradeType.EXACT_INPUT &&
                subgraphPool.token1.id == wethAddress) {
                topByEthQuoteTokenPool.push(subgraphPool);
            }
            tokenOutToken1TopByBase.pools.push(subgraphPool);
            continue;
        }
        // Note: we do not need to check other native currencies for the V2 Protocol
        if (topByEthQuoteTokenPool.length < topNEthQuoteToken &&
            ((routeType === TradeType.EXACT_INPUT &&
                ((subgraphPool.token0.id == wethAddress &&
                    subgraphPool.token1.id == tokenOutAddress) ||
                    (subgraphPool.token1.id == wethAddress &&
                        subgraphPool.token0.id == tokenOutAddress))) ||
                (routeType === TradeType.EXACT_OUTPUT &&
                    ((subgraphPool.token0.id == wethAddress &&
                        subgraphPool.token1.id == tokenInAddress) ||
                        (subgraphPool.token1.id == wethAddress &&
                            subgraphPool.token0.id == tokenInAddress))))) {
            poolAddressesSoFar.add(subgraphPool.id);
            topByEthQuoteTokenPool.push(subgraphPool);
            continue;
        }
        if (topByTVL.length < topN) {
            poolAddressesSoFar.add(subgraphPool.id);
            topByTVL.push(subgraphPool);
            continue;
        }
        if (topByTVLUsingTokenIn.length < topNTokenInOut &&
            (subgraphPool.token0.id == tokenInAddress ||
                subgraphPool.token1.id == tokenInAddress)) {
            poolAddressesSoFar.add(subgraphPool.id);
            topByTVLUsingTokenIn.push(subgraphPool);
            continue;
        }
        if (topByTVLUsingTokenOut.length < topNTokenInOut &&
            (subgraphPool.token0.id == tokenOutAddress ||
                subgraphPool.token1.id == tokenOutAddress)) {
            poolAddressesSoFar.add(subgraphPool.id);
            topByTVLUsingTokenOut.push(subgraphPool);
            continue;
        }
    }
    metric.putMetric('V2SubgraphLoopsInFirstIteration', loopsInFirstIteration, MetricLoggerUnit.Count);
    const topByBaseWithTokenIn = [];
    for (const topByBaseWithTokenInSelection of topByBaseWithTokenInMap.values()) {
        topByBaseWithTokenIn.push(...topByBaseWithTokenInSelection.pools);
    }
    const topByBaseWithTokenOut = [];
    for (const topByBaseWithTokenOutSelection of topByBaseWithTokenOutMap.values()) {
        topByBaseWithTokenOut.push(...topByBaseWithTokenOutSelection.pools);
    }
    // Filtering step for second hops
    const topByTVLUsingTokenInSecondHopsMap = new Map();
    const topByTVLUsingTokenOutSecondHopsMap = new Map();
    const tokenInSecondHopAddresses = topByTVLUsingTokenIn
        .filter((pool) => {
        // filtering second hops
        if (tokenInAddress === pool.token0.id) {
            return !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(pool.token1.id.toLowerCase()));
        }
        else {
            return !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(pool.token0.id.toLowerCase()));
        }
    })
        .map((pool) => tokenInAddress === pool.token0.id ? pool.token1.id : pool.token0.id);
    const tokenOutSecondHopAddresses = topByTVLUsingTokenOut
        .filter((pool) => {
        // filtering second hops
        if (tokenOutAddress === pool.token0.id) {
            return !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(pool.token1.id.toLowerCase()));
        }
        else {
            return !(tokensToAvoidOnSecondHops === null || tokensToAvoidOnSecondHops === void 0 ? void 0 : tokensToAvoidOnSecondHops.includes(pool.token0.id.toLowerCase()));
        }
    })
        .map((pool) => tokenOutAddress === pool.token0.id ? pool.token1.id : pool.token0.id);
    for (const secondHopId of tokenInSecondHopAddresses) {
        topByTVLUsingTokenInSecondHopsMap.set(secondHopId, new SubcategorySelectionPools([], topNSecondHop));
    }
    for (const secondHopId of tokenOutSecondHopAddresses) {
        topByTVLUsingTokenOutSecondHopsMap.set(secondHopId, new SubcategorySelectionPools([], topNSecondHop));
    }
    // Used to track how many iterations we do in the second loop
    let loopsInSecondIteration = 0;
    if (tokenInSecondHopAddresses.length > 0 ||
        tokenOutSecondHopAddresses.length > 0) {
        for (const subgraphPool of subgraphPoolsSorted) {
            loopsInSecondIteration += 1;
            let allTokenInSecondHopsHaveTheirTopN = true;
            for (const secondHopPools of topByTVLUsingTokenInSecondHopsMap.values()) {
                if (!secondHopPools.hasEnoughPools()) {
                    allTokenInSecondHopsHaveTheirTopN = false;
                    break;
                }
            }
            let allTokenOutSecondHopsHaveTheirTopN = true;
            for (const secondHopPools of topByTVLUsingTokenOutSecondHopsMap.values()) {
                if (!secondHopPools.hasEnoughPools()) {
                    allTokenOutSecondHopsHaveTheirTopN = false;
                    break;
                }
            }
            if (allTokenInSecondHopsHaveTheirTopN &&
                allTokenOutSecondHopsHaveTheirTopN) {
                // We have satisfied all the heuristics, so we can stop.
                break;
            }
            if (poolAddressesSoFar.has(subgraphPool.id)) {
                continue;
            }
            // Only consider pools where neither tokens are in the blocked token list.
            if (blockedTokenListProvider) {
                const [token0InBlocklist, token1InBlocklist] = await Promise.all([
                    blockedTokenListProvider.hasTokenByAddress(subgraphPool.token0.id),
                    blockedTokenListProvider.hasTokenByAddress(subgraphPool.token1.id),
                ]);
                if (token0InBlocklist || token1InBlocklist) {
                    continue;
                }
            }
            const tokenInToken0SecondHop = topByTVLUsingTokenInSecondHopsMap.get(subgraphPool.token0.id);
            if (tokenInToken0SecondHop && !tokenInToken0SecondHop.hasEnoughPools()) {
                poolAddressesSoFar.add(subgraphPool.id);
                tokenInToken0SecondHop.pools.push(subgraphPool);
                continue;
            }
            const tokenInToken1SecondHop = topByTVLUsingTokenInSecondHopsMap.get(subgraphPool.token1.id);
            if (tokenInToken1SecondHop && !tokenInToken1SecondHop.hasEnoughPools()) {
                poolAddressesSoFar.add(subgraphPool.id);
                tokenInToken1SecondHop.pools.push(subgraphPool);
                continue;
            }
            const tokenOutToken0SecondHop = topByTVLUsingTokenOutSecondHopsMap.get(subgraphPool.token0.id);
            if (tokenOutToken0SecondHop &&
                !tokenOutToken0SecondHop.hasEnoughPools()) {
                poolAddressesSoFar.add(subgraphPool.id);
                tokenOutToken0SecondHop.pools.push(subgraphPool);
                continue;
            }
            const tokenOutToken1SecondHop = topByTVLUsingTokenOutSecondHopsMap.get(subgraphPool.token1.id);
            if (tokenOutToken1SecondHop &&
                !tokenOutToken1SecondHop.hasEnoughPools()) {
                poolAddressesSoFar.add(subgraphPool.id);
                tokenOutToken1SecondHop.pools.push(subgraphPool);
                continue;
            }
        }
    }
    metric.putMetric('V2SubgraphLoopsInSecondIteration', loopsInSecondIteration, MetricLoggerUnit.Count);
    const topByTVLUsingTokenInSecondHops = [];
    for (const secondHopPools of topByTVLUsingTokenInSecondHopsMap.values()) {
        topByTVLUsingTokenInSecondHops.push(...secondHopPools.pools);
    }
    const topByTVLUsingTokenOutSecondHops = [];
    for (const secondHopPools of topByTVLUsingTokenOutSecondHopsMap.values()) {
        topByTVLUsingTokenOutSecondHops.push(...secondHopPools.pools);
    }
    const subgraphPools = _([
        ...topByBaseWithTokenIn,
        ...topByBaseWithTokenOut,
        ...topByDirectSwapPool,
        ...topByEthQuoteTokenPool,
        ...topByTVL,
        ...topByTVLUsingTokenIn,
        ...topByTVLUsingTokenOut,
        ...topByTVLUsingTokenInSecondHops,
        ...topByTVLUsingTokenOutSecondHops,
    ])
        .uniqBy((pool) => pool.id)
        .value();
    const tokenAddressesSet = new Set();
    for (const pool of subgraphPools) {
        tokenAddressesSet.add(pool.token0.id);
        tokenAddressesSet.add(pool.token1.id);
    }
    const tokenAddresses = Array.from(tokenAddressesSet);
    log.info(`Getting the ${tokenAddresses.length} tokens within the ${subgraphPools.length} V2 pools we are considering`);
    const tokenAccessor = await tokenProvider.getTokens(tokenAddresses, {
        blockNumber,
    });
    const printV2SubgraphPool = (s) => {
        var _a, _b, _c, _d;
        return `${(_b = (_a = tokenAccessor.getTokenByAddress(s.token0.id)) === null || _a === void 0 ? void 0 : _a.symbol) !== null && _b !== void 0 ? _b : s.token0.id}/${(_d = (_c = tokenAccessor.getTokenByAddress(s.token1.id)) === null || _c === void 0 ? void 0 : _c.symbol) !== null && _d !== void 0 ? _d : s.token1.id}`;
    };
    log.info({
        topByBaseWithTokenIn: topByBaseWithTokenIn.map(printV2SubgraphPool),
        topByBaseWithTokenOut: topByBaseWithTokenOut.map(printV2SubgraphPool),
        topByTVL: topByTVL.map(printV2SubgraphPool),
        topByTVLUsingTokenIn: topByTVLUsingTokenIn.map(printV2SubgraphPool),
        topByTVLUsingTokenOut: topByTVLUsingTokenOut.map(printV2SubgraphPool),
        topByTVLUsingTokenInSecondHops: topByTVLUsingTokenInSecondHops.map(printV2SubgraphPool),
        topByTVLUsingTokenOutSecondHops: topByTVLUsingTokenOutSecondHops.map(printV2SubgraphPool),
        top2DirectSwap: topByDirectSwapPool.map(printV2SubgraphPool),
        top2EthQuotePool: topByEthQuoteTokenPool.map(printV2SubgraphPool),
    }, `V2 Candidate pools`);
    const tokenPairsRaw = _.map(subgraphPools, (subgraphPool) => {
        const tokenA = tokenAccessor.getTokenByAddress(subgraphPool.token0.id);
        const tokenB = tokenAccessor.getTokenByAddress(subgraphPool.token1.id);
        if (!tokenA || !tokenB) {
            log.info(`Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}`);
            return undefined;
        }
        return [tokenA, tokenB];
    });
    const tokenPairs = _.compact(tokenPairsRaw);
    metric.putMetric('V2PoolsFilterLoad', Date.now() - beforePoolsFiltered, MetricLoggerUnit.Milliseconds);
    const beforePoolsLoad = Date.now();
    // this should be the only place to enable fee-on-transfer fee fetching,
    // because this places loads pools (pairs of tokens with fot taxes) from the subgraph
    const poolAccessor = await poolProvider.getPools(tokenPairs, routingConfig);
    metric.putMetric('V2PoolsLoad', Date.now() - beforePoolsLoad, MetricLoggerUnit.Milliseconds);
    const poolsBySelection = {
        protocol: Protocol.V2,
        selections: {
            topByBaseWithTokenIn,
            topByBaseWithTokenOut,
            topByDirectSwapPool,
            topByEthQuoteTokenPool,
            topByTVL,
            topByTVLUsingTokenIn,
            topByTVLUsingTokenOut,
            topByTVLUsingTokenInSecondHops,
            topByTVLUsingTokenOutSecondHops,
        },
    };
    return { poolAccessor, candidatePools: poolsBySelection, subgraphPools };
}
export async function getMixedRouteCandidatePools({ v3CandidatePools, v2CandidatePools, crossLiquidityPools, routingConfig, tokenProvider, v3poolProvider, v2poolProvider, }) {
    const beforeSubgraphPools = Date.now();
    const [{ subgraphPools: V3subgraphPools, candidatePools: V3candidatePools }, { subgraphPools: V2subgraphPools, candidatePools: V2candidatePools },] = [v3CandidatePools, v2CandidatePools];
    // Injects the liquidity pools found by the getMixedCrossLiquidityCandidatePools function
    V2subgraphPools.push(...crossLiquidityPools.v2Pools);
    V3subgraphPools.push(...crossLiquidityPools.v3Pools);
    metric.putMetric('MixedSubgraphPoolsLoad', Date.now() - beforeSubgraphPools, MetricLoggerUnit.Milliseconds);
    const beforePoolsFiltered = Date.now();
    /**
     * Main heuristic for pruning mixedRoutes:
     * - we pick V2 pools with higher liq than respective V3 pools, or if the v3 pool doesn't exist
     *
     * This way we can reduce calls to our provider since it's possible to generate a lot of mixed routes
     */
    /// We only really care about pools involving the tokenIn or tokenOut explictly,
    /// since there's no way a long tail token in V2 would be routed through as an intermediary
    const V2topByTVLPoolIds = new Set([
        ...V2candidatePools.selections.topByTVLUsingTokenIn,
        ...V2candidatePools.selections.topByBaseWithTokenIn,
        /// tokenOut:
        ...V2candidatePools.selections.topByTVLUsingTokenOut,
        ...V2candidatePools.selections.topByBaseWithTokenOut,
        /// Direct swap:
        ...V2candidatePools.selections.topByDirectSwapPool,
        // Cross Liquidity (has to be added to be considered):
        ...crossLiquidityPools.v2Pools,
    ].map((poolId) => poolId.id));
    const V2topByTVLSortedPools = _(V2subgraphPools)
        .filter((pool) => V2topByTVLPoolIds.has(pool.id))
        .sortBy((pool) => -pool.reserveUSD)
        .value();
    /// we consider all returned V3 pools for this heuristic to "fill in the gaps"
    const V3sortedPools = _(V3subgraphPools)
        .sortBy((pool) => -pool.tvlUSD)
        .value();
    /// Finding pools with greater reserveUSD on v2 than tvlUSD on v3, or if there is no v3 liquidity
    const buildV2Pools = [];
    V2topByTVLSortedPools.forEach((V2subgraphPool) => {
        const V3subgraphPool = V3sortedPools.find((pool) => (pool.token0.id == V2subgraphPool.token0.id &&
            pool.token1.id == V2subgraphPool.token1.id) ||
            (pool.token0.id == V2subgraphPool.token1.id &&
                pool.token1.id == V2subgraphPool.token0.id));
        if (V3subgraphPool) {
            if (V2subgraphPool.reserveUSD > V3subgraphPool.tvlUSD) {
                log.info({
                    token0: V2subgraphPool.token0.id,
                    token1: V2subgraphPool.token1.id,
                    v2reserveUSD: V2subgraphPool.reserveUSD,
                    v3tvlUSD: V3subgraphPool.tvlUSD,
                }, `MixedRoute heuristic, found a V2 pool with higher liquidity than its V3 counterpart`);
                buildV2Pools.push(V2subgraphPool);
            }
        }
        else {
            log.info({
                token0: V2subgraphPool.token0.id,
                token1: V2subgraphPool.token1.id,
                v2reserveUSD: V2subgraphPool.reserveUSD,
            }, `MixedRoute heuristic, found a V2 pool with no V3 counterpart`);
            buildV2Pools.push(V2subgraphPool);
        }
    });
    log.info(buildV2Pools.length, `Number of V2 candidate pools that fit first heuristic`);
    const subgraphPools = [...buildV2Pools, ...V3sortedPools];
    const tokenAddresses = _(subgraphPools)
        .flatMap((subgraphPool) => [subgraphPool.token0.id, subgraphPool.token1.id])
        .compact()
        .uniq()
        .value();
    log.info(`Getting the ${tokenAddresses.length} tokens within the ${subgraphPools.length} pools we are considering`);
    const tokenAccessor = await tokenProvider.getTokens(tokenAddresses, routingConfig);
    const V3tokenPairsRaw = _.map(V3sortedPools, (subgraphPool) => {
        const tokenA = tokenAccessor.getTokenByAddress(subgraphPool.token0.id);
        const tokenB = tokenAccessor.getTokenByAddress(subgraphPool.token1.id);
        let fee;
        try {
            fee = parseFeeAmount(subgraphPool.feeTier);
        }
        catch (err) {
            log.info({ subgraphPool }, `Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}/${subgraphPool.feeTier} because fee tier not supported`);
            return undefined;
        }
        if (!tokenA || !tokenB) {
            log.info(`Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}/${fee} because ${tokenA ? subgraphPool.token1.id : subgraphPool.token0.id} not found by token provider`);
            return undefined;
        }
        return [tokenA, tokenB, fee];
    });
    const V3tokenPairs = _.compact(V3tokenPairsRaw);
    const V2tokenPairsRaw = _.map(buildV2Pools, (subgraphPool) => {
        const tokenA = tokenAccessor.getTokenByAddress(subgraphPool.token0.id);
        const tokenB = tokenAccessor.getTokenByAddress(subgraphPool.token1.id);
        if (!tokenA || !tokenB) {
            log.info(`Dropping candidate pool for ${subgraphPool.token0.id}/${subgraphPool.token1.id}`);
            return undefined;
        }
        return [tokenA, tokenB];
    });
    const V2tokenPairs = _.compact(V2tokenPairsRaw);
    metric.putMetric('MixedPoolsFilterLoad', Date.now() - beforePoolsFiltered, MetricLoggerUnit.Milliseconds);
    const beforePoolsLoad = Date.now();
    const [V2poolAccessor, V3poolAccessor] = await Promise.all([
        v2poolProvider.getPools(V2tokenPairs, routingConfig),
        v3poolProvider.getPools(V3tokenPairs, routingConfig),
    ]);
    metric.putMetric('MixedPoolsLoad', Date.now() - beforePoolsLoad, MetricLoggerUnit.Milliseconds);
    /// @dev a bit tricky here since the original V2CandidateSelections object included pools that we may have dropped
    /// as part of the heuristic. We need to reconstruct a new object with the v3 pools too.
    const buildPoolsBySelection = (key) => {
        return [
            ...buildV2Pools.filter((pool) => V2candidatePools.selections[key].map((p) => p.id).includes(pool.id)),
            ...V3candidatePools.selections[key],
        ];
    };
    const poolsBySelection = {
        protocol: Protocol.MIXED,
        selections: {
            topByBaseWithTokenIn: buildPoolsBySelection('topByBaseWithTokenIn'),
            topByBaseWithTokenOut: buildPoolsBySelection('topByBaseWithTokenOut'),
            topByDirectSwapPool: buildPoolsBySelection('topByDirectSwapPool'),
            topByEthQuoteTokenPool: buildPoolsBySelection('topByEthQuoteTokenPool'),
            topByTVL: buildPoolsBySelection('topByTVL'),
            topByTVLUsingTokenIn: buildPoolsBySelection('topByTVLUsingTokenIn'),
            topByTVLUsingTokenOut: buildPoolsBySelection('topByTVLUsingTokenOut'),
            topByTVLUsingTokenInSecondHops: buildPoolsBySelection('topByTVLUsingTokenInSecondHops'),
            topByTVLUsingTokenOutSecondHops: buildPoolsBySelection('topByTVLUsingTokenOutSecondHops'),
        },
    };
    return {
        V2poolAccessor,
        V3poolAccessor,
        candidatePools: poolsBySelection,
        subgraphPools,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0LWNhbmRpZGF0ZS1wb29scy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9yb3V0ZXJzL2FscGhhLXJvdXRlci9mdW5jdGlvbnMvZ2V0LWNhbmRpZGF0ZS1wb29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDL0MsT0FBTyxFQUFFLE9BQU8sRUFBUyxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQUM5RCxPQUFPLEVBQUUsWUFBWSxFQUFFLFNBQVMsRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQzFELE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQztBQUV2QixPQUFPLEVBQ0wsb0JBQW9CLEVBS3BCLHFCQUFxQixFQUNyQixxQkFBcUIsRUFDckIscUJBQXFCLEVBSXJCLHFCQUFxQixHQUN0QixNQUFNLG9CQUFvQixDQUFDO0FBQzVCLE9BQU8sRUFDTCxJQUFJLEVBQ0osY0FBYyxFQUNkLFNBQVMsRUFDVCxtQkFBbUIsRUFDbkIsU0FBUyxFQUNULG1CQUFtQixFQUNuQixZQUFZLEVBQ1osUUFBUSxFQUNSLE9BQU8sRUFDUCxXQUFXLEVBQ1gsWUFBWSxFQUNaLFlBQVksRUFDWixtQkFBbUIsRUFDbkIsa0JBQWtCLEVBQ2xCLFdBQVcsRUFDWCxXQUFXLEVBRVgsVUFBVSxFQUNWLGFBQWEsRUFDYixvQkFBb0IsRUFDcEIsU0FBUyxFQUNULFNBQVMsRUFDVCxRQUFRLEVBQ1Isb0JBQW9CLEVBQ3BCLFlBQVksRUFDWixhQUFhLEVBQ2IsYUFBYSxFQUNiLG9CQUFvQixFQUNwQixZQUFZLEVBQ1osWUFBWSxFQUNaLFlBQVksRUFDWixhQUFhLEVBQ2IsUUFBUSxFQUNSLFlBQVksRUFDWixhQUFhLEVBQ2Isb0JBQW9CLEVBQ3BCLGFBQWEsRUFDYixXQUFXLEVBQ1gsWUFBWSxFQUNaLGFBQWEsRUFDYixhQUFhLEVBQ2Isb0JBQW9CLEVBQ3BC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