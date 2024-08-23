import { ChainId } from '@uniswap/sdk-core';
export const NETWORKS_WITH_SAME_RETRY_OPTIONS = Object.values(ChainId);
export function constructSameRetryOptionsMap(retryOptions, additionalNetworks = []) {
    return NETWORKS_WITH_SAME_RETRY_OPTIONS.concat(additionalNetworks).reduce((memo, chainId) => {
        memo[chainId] = retryOptions;
        return memo;
    }, {});
}
export const DEFAULT_RETRY_OPTIONS = {
    retries: 2,
    minTimeout: 100,
    maxTimeout: 1000,
};
export const RETRY_OPTIONS = {
    ...constructSameRetryOptionsMap(DEFAULT_RETRY_OPTIONS),
};
export const NETWORKS_WITH_SAME_BATCH_PARAMS = Object.values(ChainId);
export function constructSameBatchParamsMap(batchParams, additionalNetworks = []) {
    return NETWORKS_WITH_SAME_BATCH_PARAMS.concat(additionalNetworks).reduce((memo, chainId) => {
        memo[chainId] = batchParams;
        return memo;
    }, {});
}
export const DEFAULT_BATCH_PARAMS = {
    multicallChunk: 210,
    gasLimitPerCall: 705000,
    quoteMinSuccessRate: 0.15,
};
export const BATCH_PARAMS = {
    ...constructSameBatchParamsMap(DEFAULT_BATCH_PARAMS),
};
export const NETWORKS_WITH_SAME_GAS_ERROR_FAILURE_OVERRIDES = Object.values(ChainId);
export function constructSameGasErrorFailureOverridesMap(gasErrorFailureOverrides, additionalNetworks = []) {
    return NETWORKS_WITH_SAME_GAS_ERROR_FAILURE_OVERRIDES.concat(additionalNetworks).reduce((memo, chainId) => {
        memo[chainId] = gasErrorFailureOverrides;
        return memo;
    }, {});
}
export const DEFAULT_GAS_ERROR_FAILURE_OVERRIDES = {
    gasLimitOverride: 2000000,
    multicallChunk: 70,
};
export const GAS_ERROR_FAILURE_OVERRIDES = {
    ...constructSameGasErrorFailureOverridesMap(DEFAULT_GAS_ERROR_FAILURE_OVERRIDES),
};
export const NETWORKS_WITH_SAME_SUCCESS_RATE_FAILURE_OVERRIDES = [
    ChainId.POLYGON,
];
export function constructSameSuccessRateFailureOverridesMap(successRateFailureOverrides, additionalNetworks = []) {
    return NETWORKS_WITH_SAME_SUCCESS_RATE_FAILURE_OVERRIDES.concat(additionalNetworks).reduce((memo, chainId) => {
        memo[chainId] = successRateFailureOverrides;
        return memo;
    }, {});
}
export const DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES = {
    gasLimitOverride: 1300000,
    multicallChunk: 110,
};
export const SUCCESS_RATE_FAILURE_OVERRIDES = {
    ...constructSameSuccessRateFailureOverridesMap(DEFAULT_SUCCESS_RATE_FAILURE_OVERRIDES),
};
export const NETWORKS_WITH_SAME_BLOCK_NUMBER_CONFIGS = Object.values(ChainId);
export function constructSameBlockNumberConfigsMap(blockNumberConfigs, additionalNetworks = []) {
    return NETWORKS_WITH_SAME_BLOCK_NUMBER_CONFIGS.concat(additionalNetworks).reduce((memo, chainId) => {
        memo[chainId] = blockNumberConfigs;
        return memo;
    }, {});
}
export const DEFAULT_BLOCK_NUMBER_CONFIGS = {
    baseBlockOffset: 0,
    rollback: { enabled: false },
};
export const BLOCK_NUMBER_CONFIGS = {
    ...constructSameBlockNumberConfigsMap(DEFAULT_BLOCK_NUMBER_CONFIGS),
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib25jaGFpblF1b3RlUHJvdmlkZXJDb25maWdzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3V0aWwvb25jaGFpblF1b3RlUHJvdmlkZXJDb25maWdzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQztBQVM1QyxNQUFNLENBQUMsTUFBTSxnQ0FBZ0MsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUMzRCxPQUFPLENBQ0ssQ0FBQztBQUVmLE1BQU0sVUFBVSw0QkFBNEIsQ0FDMUMsWUFBZSxFQUNmLHFCQUFnQyxFQUFFO0lBRWxDLE9BQU8sZ0NBQWdDLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUV0RSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsRUFBRTtRQUNuQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsWUFBWSxDQUFDO1FBQzdCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ1QsQ0FBQztBQUVELE1BQU0sQ0FBQyxNQUFNLHFCQUFxQixHQUFzQjtJQUN0RCxPQUFPLEVBQUUsQ0FBQztJQUNWLFVBQVUsRUFBRSxHQUFHO0lBQ2YsVUFBVSxFQUFFLElBQUk7Q0FDakIsQ0FBQztBQUVGLE1BQU0sQ0FBQyxNQUFNLGFBQWEsR0FBRztJQUMzQixHQUFHLDRCQUE0QixDQUFDLHFCQUFxQixDQUFDO0NBQ3ZELENBQUM7QUFFRixNQUFNLENBQUMsTUFBTSwrQkFBK0IsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUMxRCxPQUFPLENBQ0ssQ0FBQztBQUVmLE1BQU0sVUFBVSwyQkFBMkIsQ0FDekMsV0FBYyxFQUNkLHFCQUFnQyxFQUFFO0lBRWxDLE9BQU8sK0JBQStCLENBQUMsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxDQUVyRSxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsRUFBRTtR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