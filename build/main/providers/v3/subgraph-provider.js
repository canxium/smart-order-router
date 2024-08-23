"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.V3SubgraphProvider = void 0;
const router_sdk_1 = require("@uniswap/router-sdk");
const sdk_core_1 = require("@uniswap/sdk-core");
const subgraph_provider_1 = require("../subgraph-provider");
const SUBGRAPH_URL_BY_CHAIN = {
    [sdk_core_1.ChainId.MAINNET]: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
    [sdk_core_1.ChainId.OPTIMISM]: 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis',
    // todo: add once subgraph is live
    [sdk_core_1.ChainId.OPTIMISM_SEPOLIA]: '',
    [sdk_core_1.ChainId.ARBITRUM_ONE]: 'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal',
    // todo: add once subgraph is live
    [sdk_core_1.ChainId.ARBITRUM_SEPOLIA]: '',
    [sdk_core_1.ChainId.POLYGON]: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon',
    [sdk_core_1.ChainId.CELO]: 'https://api.thegraph.com/subgraphs/name/jesse-sawa/uniswap-celo',
    [sdk_core_1.ChainId.GOERLI]: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-gorli',
    [sdk_core_1.ChainId.BNB]: 'https://api.thegraph.com/subgraphs/name/ilyamk/uniswap-v3---bnb-chain',
    [sdk_core_1.ChainId.AVALANCHE]: 'https://api.thegraph.com/subgraphs/name/lynnshaoyu/uniswap-v3-avax',
    [sdk_core_1.ChainId.BASE]: 'https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest',
    [sdk_core_1.ChainId.BLAST]: 'https://gateway-arbitrum.network.thegraph.com/api/0ae45f0bf40ae2e73119b44ccd755967/subgraphs/id/2LHovKznvo8YmKC9ZprPjsYAZDCc4K5q4AYz8s3cnQn1',
    [sdk_core_1.ChainId.CANXIUM]: 'https://graph.canxium.net/subgraphs/name/canixum/v3-swap',
};
class V3SubgraphProvider extends subgraph_provider_1.SubgraphProvider {
    constructor(chainId, retries = 2, timeout = 30000, rollback = true, trackedEthThreshold = 0.01, untrackedUsdThreshold = Number.MAX_VALUE, subgraphUrlOverride) {
        super(router_sdk_1.Protocol.V3, chainId, retries, timeout, rollback, trackedEthThreshold, untrackedUsdThreshold, subgraphUrlOverride !== null && subgraphUrlOverride !== void 0 ? subgraphUrlOverride : SUBGRAPH_URL_BY_CHAIN[chainId]);
    }
}
exports.V3SubgraphProvider = V3SubgraphProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ViZ3JhcGgtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3YzL3N1YmdyYXBoLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9EQUErQztBQUMvQyxnREFBbUQ7QUFHbkQsNERBQXdEO0FBaUN4RCxNQUFNLHFCQUFxQixHQUFzQztJQUMvRCxDQUFDLGtCQUFPLENBQUMsT0FBTyxDQUFDLEVBQ2YsNERBQTREO0lBQzlELENBQUMsa0JBQU8sQ0FBQyxRQUFRLENBQUMsRUFDaEIsMkVBQTJFO0lBQzdFLGtDQUFrQztJQUNsQyxDQUFDLGtCQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxFQUFFO0lBQzlCLENBQUMsa0JBQU8sQ0FBQyxZQUFZLENBQUMsRUFDcEIsb0VBQW9FO0lBQ3RFLGtDQUFrQztJQUNsQyxDQUFDLGtCQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxFQUFFO0lBQzlCLENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUMsRUFDZixzRUFBc0U7SUFDeEUsQ0FBQyxrQkFBTyxDQUFDLElBQUksQ0FBQyxFQUNaLGlFQUFpRTtJQUNuRSxDQUFDLGtCQUFPLENBQUMsTUFBTSxDQUFDLEVBQ2Qsb0VBQW9FO0lBQ3RFLENBQUMsa0JBQU8sQ0FBQyxHQUFHLENBQUMsRUFDWCx1RUFBdUU7SUFDekUsQ0FBQyxrQkFBTyxDQUFDLFNBQVMsQ0FBQyxFQUNqQixvRUFBb0U7SUFDdEUsQ0FBQyxrQkFBTyxDQUFDLElBQUksQ0FBQyxFQUNaLDRFQUE0RTtJQUM5RSxDQUFDLGtCQUFPLENBQUMsS0FBSyxDQUFDLEVBQ2IsOElBQThJO0lBQ2hKLENBQUMsa0JBQU8sQ0FBQyxPQUFPLENBQUMsRUFDZiwwREFBMEQ7Q0FDN0QsQ0FBQztBQWdCRixNQUFhLGtCQUNYLFNBQVEsb0NBQW1EO0lBRTNELFlBQ0UsT0FBZ0IsRUFDaEIsT0FBTyxHQUFHLENBQUMsRUFDWCxPQUFPLEdBQUcsS0FBSyxFQUNmLFFBQVEsR0FBRyxJQUFJLEVBQ2YsbUJBQW1CLEdBQUcsSUFBSSxFQUMxQixxQkFBcUIsR0FBRyxNQUFNLENBQUMsU0FBUyxFQUN4QyxtQkFBNEI7UUFFNUIsS0FBSyxDQUNILHFCQUFRLENBQUMsRUFBRSxFQUNYLE9BQU8sRUFDUCxPQUFPLEVBQ1AsT0FBTyxFQUNQLFFBQVEsRUFDUixtQkFBbUIsRUFDbkIscUJBQXFCLEVBQ3JCLG1CQUFtQixhQUFuQixtQkFBbUIsY0FBbkIsbUJBQW1CLEdBQUkscUJBQXFCLENBQUMsT0FBTyxDQUFDLENBQ3RELENBQUM7SUFDSixDQUFDO0NBQ0Y7QUF2QkQsZ0RBdUJDIn0=