"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.V4SubgraphProvider = void 0;
const router_sdk_1 = require("@uniswap/router-sdk");
const sdk_core_1 = require("@uniswap/sdk-core");
const subgraph_provider_1 = require("../subgraph-provider");
const SUBGRAPH_URL_BY_CHAIN = {
    [sdk_core_1.ChainId.SEPOLIA]: '',
};
class V4SubgraphProvider extends subgraph_provider_1.SubgraphProvider {
    constructor(chainId, retries = 2, timeout = 30000, rollback = true, trackedEthThreshold = 0.01, untrackedUsdThreshold = Number.MAX_VALUE, subgraphUrlOverride) {
        super(router_sdk_1.Protocol.V4, chainId, retries, timeout, rollback, trackedEthThreshold, untrackedUsdThreshold, subgraphUrlOverride !== null && subgraphUrlOverride !== void 0 ? subgraphUrlOverride : SUBGRAPH_URL_BY_CHAIN[chainId]);
    }
}
exports.V4SubgraphProvider = V4SubgraphProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ViZ3JhcGgtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3Y0L3N1YmdyYXBoLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9EQUErQztBQUMvQyxnREFBbUQ7QUFHbkQsNERBQXdEO0FBcUN4RCxNQUFNLHFCQUFxQixHQUFzQztJQUMvRCxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRTtDQUN0QixDQUFDO0FBZ0JGLE1BQWEsa0JBQ1gsU0FBUSxvQ0FBbUQ7SUFHM0QsWUFDRSxPQUFnQixFQUNoQixPQUFPLEdBQUcsQ0FBQyxFQUNYLE9BQU8sR0FBRyxLQUFLLEVBQ2YsUUFBUSxHQUFHLElBQUksRUFDZixtQkFBbUIsR0FBRyxJQUFJLEVBQzFCLHFCQUFxQixHQUFHLE1BQU0sQ0FBQyxTQUFTLEVBQ3hDLG1CQUE0QjtRQUU1QixLQUFLLENBQ0gscUJBQVEsQ0FBQyxFQUFFLEVBQ1gsT0FBTyxFQUNQLE9BQU8sRUFDUCxPQUFPLEVBQ1AsUUFBUSxFQUNSLG1CQUFtQixFQUNuQixxQkFBcUIsRUFDckIsbUJBQW1CLGFBQW5CLG1CQUFtQixjQUFuQixtQkFBbUIsR0FBSSxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FDdEQsQ0FBQztJQUNKLENBQUM7Q0FDRjtBQXhCRCxnREF3QkMifQ==