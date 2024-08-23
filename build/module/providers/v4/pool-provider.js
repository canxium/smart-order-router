import { ADDRESS_ZERO } from '@uniswap/router-sdk';
import { Pool } from '@uniswap/v4-sdk';
import retry from 'async-retry';
import { log, STATE_VIEW_ADDRESSES } from '../../util';
import { StateView__factory } from '../../types/other/factories/StateView__factory';
import { PoolProvider } from '../pool-provider';
// TODO: export sortsBefore from v4-sdk https://github.com/Uniswap/sdks/tree/main/sdks/v4-sdk/src/utils to avoid duplication
export function sortsBefore(currencyA, currencyB) {
    if (currencyA.isNative)
        return true;
    if (currencyB.isNative)
        return false;
    return currencyA.wrapped.sortsBefore(currencyB.wrapped);
}
export class V4PoolProvider extends PoolProvider {
    /**
     * Creates an instance of V4PoolProvider.
     * @param chainId The chain id to use.
     * @param multicall2Provider The multicall provider to use to get the pools.
     * @param retryOptions The retry options for each call to the multicall.
     */
    constructor(chainId, multicall2Provider, retryOptions = {
        retries: 2,
        minTimeout: 50,
        maxTimeout: 500,
    }) {
        super(chainId, multicall2Provider, retryOptions);
        // Computing pool id is slow as it requires hashing, encoding etc.
        // Addresses never change so can always be cached.
        this.POOL_ID_CACHE = {};
    }
    async getPools(currencyPairs, providerConfig) {
        return await super.getPoolsInternal(currencyPairs, providerConfig);
    }
    getPoolId(currencyA, currencyB, fee, tickSpacing, hooks) {
        const { poolIdentifier, currency0, currency1 } = this.getPoolIdentifier([
            currencyA,
            currencyB,
            fee,
            tickSpacing,
            hooks,
        ]);
        return { poolId: poolIdentifier, currency0, currency1 };
    }
    getLiquidityFunctionName() {
        return 'getLiquidity';
    }
    getSlot0FunctionName() {
        return 'getSlot0';
    }
    async getPoolsData(poolIds, functionName, providerConfig) {
        const { results, blockNumber } = await retry(async () => {
            // NOTE: V4 pools are a singleton living under PoolsManager.
            // We have to retrieve the pool data from the state view contract.
            // To begin with, we will be consistent with how v4 subgraph retrieves the pool state - via state view.
            return this.multicall2Provider.callSameFunctionOnContractWithMultipleParams({
                address: STATE_VIEW_ADDRESSES[this.chainId],
                contractInterface: StateView__factory.createInterface(),
                functionName: functionName,
                functionParams: poolIds.map((poolId) => [poolId]),
                providerConfig,
            });
        }, this.retryOptions);
        log.debug(`Pool data fetched as of block ${blockNumber}`);
        return results;
    }
    getPoolIdentifier(pool) {
        const [currencyA, currencyB, fee, tickSpacing, hooks] = pool;
        const [currency0, currency1] = sortsBefore(currencyA, currencyB)
            ? [currencyA, currencyB]
            : [currencyB, currencyA];
        const currency0Addr = currency0.isNative
            ? ADDRESS_ZERO
            : currency0.wrapped.address;
        const currency1Addr = currency1.isNative
            ? ADDRESS_ZERO
            : currency1.wrapped.address;
        const cacheKey = `${this.chainId}/${currency0Addr}/${currency1Addr}/${fee}/${tickSpacing}/${hooks}`;
        const cachedId = this.POOL_ID_CACHE[cacheKey];
        if (cachedId) {
            return { poolIdentifier: cachedId, currency0, currency1 };
        }
        const poolId = Pool.getPoolId(currency0, currency1, fee, tickSpacing, hooks);
        this.POOL_ID_CACHE[cacheKey] = poolId;
        return { poolIdentifier: poolId, currency0, currency1 };
    }
    instantiatePool(pool, slot0, liquidity) {
        const [currency0, currency1, fee, tickSpacing, hooks] = pool;
        return new Pool(currency0, currency1, fee, tickSpacing, hooks, slot0.sqrtPriceX96.toString(), liquidity.toString(), slot0.tick);
    }
    instantiatePoolAccessor(poolIdentifierToPool) {
        return {
            getPool: (currencyA, currencyB, fee, tickSpacing, hooks) => {
                const { poolIdentifier } = this.getPoolIdentifier([
                    currencyA,
                    currencyB,
                    fee,
                    tickSpacing,
                    hooks,
                ]);
                return poolIdentifierToPool[poolIdentifier];
            },
            getPoolById: (poolId) => poolIdentifierToPool[poolId],
            getAllPools: () => Object.values(poolIdentifierToPool),
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9vbC1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy9wcm92aWRlcnMvdjQvcG9vbC1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFFbkQsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3ZDLE9BQU8sS0FBa0MsTUFBTSxhQUFhLENBQUM7QUFDN0QsT0FBTyxFQUFFLEdBQUcsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLFlBQVksQ0FBQztBQUl2RCxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxnREFBZ0QsQ0FBQztBQUNwRixPQUFPLEVBQXNCLFlBQVksRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBd0NwRSw0SEFBNEg7QUFDNUgsTUFBTSxVQUFVLFdBQVcsQ0FBQyxTQUFtQixFQUFFLFNBQW1CO0lBQ2xFLElBQUksU0FBUyxDQUFDLFFBQVE7UUFBRSxPQUFPLElBQUksQ0FBQztJQUNwQyxJQUFJLFNBQVMsQ0FBQyxRQUFRO1FBQUUsT0FBTyxLQUFLLENBQUM7SUFDckMsT0FBTyxTQUFTLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDMUQsQ0FBQztBQUVELE1BQU0sT0FBTyxjQUNYLFNBQVEsWUFNUDtJQU9EOzs7OztPQUtHO0lBQ0gsWUFDRSxPQUFnQixFQUNoQixrQkFBc0MsRUFDdEMsZUFBbUM7UUFDakMsT0FBTyxFQUFFLENBQUM7UUFDVixVQUFVLEVBQUUsRUFBRTtRQUNkLFVBQVUsRUFBRSxHQUFHO0tBQ2hCO1FBRUQsS0FBSyxDQUFDLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxZQUFZLENBQUMsQ0FBQztRQW5CbkQsa0VBQWtFO1FBQ2xFLGtEQUFrRDtRQUMxQyxrQkFBYSxHQUE4QixFQUFFLENBQUM7SUFrQnRELENBQUM7SUFFTSxL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