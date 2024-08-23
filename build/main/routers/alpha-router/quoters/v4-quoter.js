"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.V4Quoter = void 0;
const router_sdk_1 = require("@uniswap/router-sdk");
const providers_1 = require("../../../providers");
const util_1 = require("../../../util");
const compute_all_routes_1 = require("../functions/compute-all-routes");
const base_quoter_1 = require("./base-quoter");
class V4Quoter extends base_quoter_1.BaseQuoter {
    constructor(v4SubgraphProvider, v4PoolProvider, onChainQuoteProvider, tokenProvider, chainId, blockedTokenListProvider, tokenValidatorProvider) {
        super(tokenProvider, chainId, router_sdk_1.Protocol.V4, blockedTokenListProvider, tokenValidatorProvider);
        this.v4SubgraphProvider = v4SubgraphProvider;
        this.v4PoolProvider = v4PoolProvider;
        this.onChainQuoteProvider = onChainQuoteProvider;
    }
    async getRoutes(tokenIn, tokenOut, v4CandidatePools, _tradeType, routingConfig) {
        const beforeGetRoutes = Date.now();
        // Fetch all the pools that we will consider routing via. There are thousands
        // of pools, so we filter them to a set of candidate pools that we expect will
        // result in good prices.
        const { poolAccessor, candidatePools } = v4CandidatePools;
        const poolsRaw = poolAccessor.getAllPools();
        // Drop any pools that contain fee on transfer tokens (not supported by v3) or have issues with being transferred.
        const pools = await this.applyTokenValidatorToPools(poolsRaw, (token, tokenValidation) => {
            // If there is no available validation result we assume the token is fine.
            if (!tokenValidation) {
                return false;
            }
            // Only filters out *intermediate* pools that involve tokens that we detect
            // cant be transferred. This prevents us trying to route through tokens that may
            // not be transferrable, but allows users to still swap those tokens if they
            // specify.
            //
            if (tokenValidation == providers_1.TokenValidationResult.STF &&
                (token.equals(tokenIn) || token.equals(tokenOut))) {
                return false;
            }
            return (tokenValidation == providers_1.TokenValidationResult.FOT ||
                tokenValidation == providers_1.TokenValidationResult.STF);
        });
        // Given all our candidate pools, compute all the possible ways to route from tokenIn to tokenOut.
        const { maxSwapsPerPath } = routingConfig;
        const routes = (0, compute_all_routes_1.computeAllV4Routes)(tokenIn, tokenOut, pools, maxSwapsPerPath);
        util_1.metric.putMetric('V4GetRoutesLoad', Date.now() - beforeGetRoutes, util_1.MetricLoggerUnit.Milliseconds);
        return {
            routes,
            candidatePools,
        };
    }
    getQuotes(_routes, _amounts, _percents, _quoteToken, _tradeType, _routingConfig, _candidatePools, _gasModel, _gasPriceWei) {
        throw new Error('Method not implemented.');
    }
}
exports.V4Quoter = V4Quoter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjQtcXVvdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL3F1b3RlcnMvdjQtcXVvdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLG9EQUErQztBQUUvQyxrREFRNEI7QUFDNUIsd0NBQXlFO0FBSXpFLHdFQUFxRTtBQU1yRSwrQ0FBMkM7QUFHM0MsTUFBYSxRQUFTLFNBQVEsd0JBQStDO0lBSzNFLFlBQ0Usa0JBQXVDLEVBQ3ZDLGNBQStCLEVBQy9CLG9CQUEyQyxFQUMzQyxhQUE2QixFQUM3QixPQUFnQixFQUNoQix3QkFBNkMsRUFDN0Msc0JBQWdEO1FBRWhELEtBQUssQ0FDSCxhQUFhLEVBQ2IsT0FBTyxFQUNQLHFCQUFRLENBQUMsRUFBRSxFQUNYLHdCQUF3QixFQUN4QixzQkFBc0IsQ0FDdkIsQ0FBQztRQUNGLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxrQkFBa0IsQ0FBQztRQUM3QyxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztRQUNyQyxJQUFJLENBQUMsb0JBQW9CLEdBQUcsb0JBQW9CLENBQUM7SUFDbkQsQ0FBQztJQUVTLEtBQUssQ0FBQyxTQUFTLENBQ3ZCLE9BQWlCLEVBQ2pCLFFBQWtCLEVBQ2xCLGdCQUFrQyxFQUNsQyxVQUFxQixFQUNyQixhQUFnQztRQUVoQyxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDbkMsNkVBQTZFO1FBQzdFLDhFQUE4RTtRQUM5RSx5QkFBeUI7UUFDekIsTUFBTSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsR0FBRyxnQkFBZ0IsQ0FBQztRQUMxRCxNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsV0FBVyxFQUFFLENBQUM7UUFFNUMsa0hBQWtIO1FBQ2xILE1BQU0sS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUNqRCxRQUFRLEVBQ1IsQ0FDRSxLQUFlLEVBQ2YsZUFBa0QsRUFDekMsRUFBRTtZQUNYLDBFQUEwRTtZQUMxRSxJQUFJLENBQUMsZUFBZSxFQUFFO2dCQUNwQixPQUFPLEtBQUssQ0FBQzthQUNkO1lBRUQsMkVBQTJFO1lBQzNFLGdGQUFnRjtZQUNoRiw0RUFBNEU7WUFDNUUsV0FBVztZQUNYLEVBQUU7WUFDRixJQUNFLGVBQWUsSUFBSSxpQ0FBcUIsQ0FBQyxHQUFHO2dCQUM1QyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUNqRDtnQkFDQSxPQUFPLEtBQUssQ0FBQzthQUNkO1lBRUQsT0FBTyxDQUNMLGVBQWUsSUFBSSxpQ0FBcUIsQ0FBQyxHQUFHO2dCQUM1QyxlQUFlLElBQUksaUNBQXFCLENBQUMsR0FBRyxDQUM3QyxDQUFDO1FBQ0osQ0FBQyxDQUNGLENBQUM7UUFFRixrR0FBa0c7UUFDbEcsTUFBTSxFQUFFLGVBQWUsRUFBRSxHQUFHLGFBQWEsQ0FBQztRQUMxQyxNQUFNLE1BQU0sR0FBRyxJQUFBLHVDQUFrQixFQUMvQixPQUFPLEVBQ1AsUUFBUSxFQUNSLEtBQUssRUFDTCxlQUFlLENBQ2hCLENBQUM7UUFFRixhQUFNLENBQUMsU0FBUyxDQUNkLGlCQUFpQixFQUNqQixJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsZUFBZSxFQUM1Qix1QkFBZ0IsQ0FBQyxZQUFZLENBQzlCLENBQUM7UUFFRixPQUFPO1lBQ0wsTUFBTTtZQUNOLGNBQWM7U0FDZixDQUFDO0lBQ0osQ0FBQztJQUVELFNBQVMsQ0FDUCxPQUFrQixFQUNsQixRQUEwQixFQUMxQixTQUFtQixFQUNuQixXQUFrQixFQUNsQixVQUFxQixFQUNyQixjQUFpQyxFQUNqQyxlQUE4RCxFQUM5RCxTQUFxRCxFQUNyRCxZQUFtQztRQUVuQyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDN0MsQ0FBQztDQUNGO0FBekdELDRCQXlHQyJ9