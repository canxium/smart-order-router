import { Protocol } from '@uniswap/router-sdk';
import { ChainId } from '@uniswap/sdk-core';
import { SubgraphProvider } from '../subgraph-provider';
const SUBGRAPH_URL_BY_CHAIN = {
    [ChainId.MAINNET]: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
    [ChainId.OPTIMISM]: 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-post-regenesis',
    // todo: add once subgraph is live
    [ChainId.OPTIMISM_SEPOLIA]: '',
    [ChainId.ARBITRUM_ONE]: 'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal',
    // todo: add once subgraph is live
    [ChainId.ARBITRUM_SEPOLIA]: '',
    [ChainId.POLYGON]: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon',
    [ChainId.CELO]: 'https://api.thegraph.com/subgraphs/name/jesse-sawa/uniswap-celo',
    [ChainId.GOERLI]: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-gorli',
    [ChainId.BNB]: 'https://api.thegraph.com/subgraphs/name/ilyamk/uniswap-v3---bnb-chain',
    [ChainId.AVALANCHE]: 'https://api.thegraph.com/subgraphs/name/lynnshaoyu/uniswap-v3-avax',
    [ChainId.BASE]: 'https://api.studio.thegraph.com/query/48211/uniswap-v3-base/version/latest',
    [ChainId.BLAST]: 'https://gateway-arbitrum.network.thegraph.com/api/0ae45f0bf40ae2e73119b44ccd755967/subgraphs/id/2LHovKznvo8YmKC9ZprPjsYAZDCc4K5q4AYz8s3cnQn1',
    [ChainId.CANXIUM]: 'https://graph.canxium.net/subgraphs/name/canixum/v3-swap',
};
export class V3SubgraphProvider extends SubgraphProvider {
    constructor(chainId, retries = 2, timeout = 30000, rollback = true, trackedEthThreshold = 0.01, untrackedUsdThreshold = Number.MAX_VALUE, subgraphUrlOverride) {
        super(Protocol.V3, chainId, retries, timeout, rollback, trackedEthThreshold, untrackedUsdThreshold, subgraphUrlOverride !== null && subgraphUrlOverride !== void 0 ? subgraphUrlOverride : SUBGRAPH_URL_BY_CHAIN[chainId]);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ViZ3JhcGgtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3YzL3N1YmdyYXBoLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUMvQyxPQUFPLEVBQUUsT0FBTyxFQUFTLE1BQU0sbUJBQW1CLENBQUM7QUFHbkQsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFpQ3hELE1BQU0scUJBQXFCLEdBQXNDO0lBQy9ELENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUNmLDREQUE0RDtJQUM5RCxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFDaEIsMkVBQTJFO0lBQzdFLGtDQUFrQztJQUNsQyxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEVBQUU7SUFDOUIsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLEVBQ3BCLG9FQUFvRTtJQUN0RSxrQ0FBa0M7SUFDbEMsQ0FBQyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxFQUFFO0lBQzlCLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUNmLHNFQUFzRTtJQUN4RSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFDWixpRUFBaUU7SUFDbkUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQ2Qsb0VBQW9FO0lBQ3RFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUNYLHVFQUF1RTtJQUN6RSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFDakIsb0VBQW9FO0lBQ3RFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUNaLDRFQUE0RTtJQUM5RSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFDYiw4SUFBOEk7SUFDaEosQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQ2YsMERBQTBEO0NBQzdELENBQUM7QUFnQkYsTUFBTSxPQUFPLGtCQUNYLFNBQVEsZ0JBQW1EO0lBRTNELFlBQ0UsT0FBZ0IsRUFDaEIsT0FBTyxHQUFHLENBQUMsRUFDWCxPQUFPLEdBQUcsS0FBSyxFQUNmLFFBQVEsR0FBRyxJQUFJLEVBQ2YsbUJBQW1CLEdBQUcsSUFBSSxFQUMxQixxQkFBcUIsR0FBRyxNQUFNLENBQUMsU0FBUyxFQUN4QyxtQkFBNEI7UUFFNUIsS0FBSyxDQUNILFFBQVEsQ0FBQyxFQUFFLEVBQ1gsT0FBTyxFQUNQLE9BQU8sRUFDUCxPQUFPLEVBQ1AsUUFBUSxFQUNSLG1CQUFtQixFQUNuQixxQkFBcUIsRUFDckIsbUJBQW1CLGFBQW5CLG1CQUFtQixjQUFuQixtQkFBbUIsR0FBSSxxQkFBcUIsQ0FBQyxPQUFPLENBQUMsQ0FDdEQsQ0FBQztJQUNKLENBQUM7Q0FDRiJ9