import { Protocol } from '@uniswap/router-sdk';
import { TokenValidationResult, } from '../../../providers';
import { metric, MetricLoggerUnit } from '../../../util';
import { computeAllV4Routes } from '../functions/compute-all-routes';
import { BaseQuoter } from './base-quoter';
export class V4Quoter extends BaseQuoter {
    constructor(v4SubgraphProvider, v4PoolProvider, onChainQuoteProvider, tokenProvider, chainId, blockedTokenListProvider, tokenValidatorProvider) {
        super(tokenProvider, chainId, Protocol.V4, blockedTokenListProvider, tokenValidatorProvider);
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
            if (tokenValidation == TokenValidationResult.STF &&
                (token.equals(tokenIn) || token.equals(tokenOut))) {
                return false;
            }
            return (tokenValidation == TokenValidationResult.FOT ||
                tokenValidation == TokenValidationResult.STF);
        });
        // Given all our candidate pools, compute all the possible ways to route from tokenIn to tokenOut.
        const { maxSwapsPerPath } = routingConfig;
        const routes = computeAllV4Routes(tokenIn, tokenOut, pools, maxSwapsPerPath);
        metric.putMetric('V4GetRoutesLoad', Date.now() - beforeGetRoutes, MetricLoggerUnit.Milliseconds);
        return {
            routes,
            candidatePools,
        };
    }
    getQuotes(_routes, _amounts, _percents, _quoteToken, _tradeType, _routingConfig, _candidatePools, _gasModel, _gasPriceWei) {
        throw new Error('Method not implemented.');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidjQtcXVvdGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL3F1b3RlcnMvdjQtcXVvdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUUvQyxPQUFPLEVBT0wscUJBQXFCLEdBQ3RCLE1BQU0sb0JBQW9CLENBQUM7QUFDNUIsT0FBTyxFQUFrQixNQUFNLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFJekUsT0FBTyxFQUFFLGtCQUFrQixFQUFFLE1BQU0saUNBQWlDLENBQUM7QUFNckUsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUczQyxNQUFNLE9BQU8sUUFBUyxTQUFRLFVBQStDO0lBSzNFLFlBQ0Usa0JBQXVDLEVBQ3ZDLGNBQStCLEVBQy9CLG9CQUEyQyxFQUMzQyxhQUE2QixFQUM3QixPQUFnQixFQUNoQix3QkFBNkMsRUFDN0Msc0JBQWdEO1FBRWhELEtBQUssQ0FDSCxhQUFhLEVBQ2IsT0FBTyxFQUNQLFFBQVEsQ0FBQyxFQUFFLEVBQ1gsd0JBQXdCLEVBQ3hCLHNCQUFzQixDQUN2QixDQUFDO1FBQ0YsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGtCQUFrQixDQUFDO1FBQzdDLElBQUksQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxvQkFBb0IsQ0FBQztJQUNuRCxDQUFDO0lBRVMsS0FBSyxDQUFDLFNBQVMsQ0FDdkIsT0FBaUIsRUFDakIsUUFBa0IsRUFDbEIsZ0JBQWtDLEVBQ2xDLFVBQXFCLEVBQ3JCLGFBQWdDO1FBRWhDLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNuQyw2RUFBNkU7UUFDN0UsOEVBQThFO1FBQzlFLHlCQUF5QjtRQUN6QixNQUFNLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxHQUFHLGdCQUFnQixDQUFDO1FBQzFELE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUU1QyxrSEFBa0g7UUFDbEgsTUFBTSxLQUFLLEdBQUcsTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQ2pELFFBQVEsRUFDUixDQUNFLEtBQWUsRUFDZixlQUFrRCxFQUN6QyxFQUFFO1lBQ1gsMEVBQTBFO1lBQzFFLElBQUksQ0FBQyxlQUFlLEVBQUU7Z0JBQ3BCLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7WUFFRCwyRUFBMkU7WUFDM0UsZ0ZBQWdGO1lBQ2hGLDRFQUE0RTtZQUM1RSxXQUFXO1lBQ1gsRUFBRTtZQUNGLElBQ0UsZUFBZSxJQUFJLHFCQUFxQixDQUFDLEdBQUc7Z0JBQzVDLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQ2pEO2dCQUNBLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7WUFFRCxPQUFPLENBQ0wsZUFBZSxJQUFJLHFCQUFxQixDQUFDLEdBQUc7Z0JBQzVDLGVBQWUsSUFBSSxxQkFBcUIsQ0FBQyxHQUFHLENBQzdDLENBQUM7UUFDSixDQUFDLENBQ0YsQ0FBQztRQUVGLGtHQUFrRztRQUNsRyxNQUFNLEVBQUUsZUFBZSxFQUFFLEdBQUcsYUFBYSxDQUFDO1FBQzFDLE1BQU0sTUFBTSxHQUFHLGtCQUFrQixDQUMvQixPQUFPLEVBQ1AsUUFBUSxFQUNSLEtBQUssRUFDTCxlQUFlLENBQ2hCLENBQUM7UUFFRixNQUFNLENBQUMsU0FBUyxDQUNkLGlCQUFpQixFQUNqQixJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsZUFBZSxFQUM1QixnQkFBZ0IsQ0FBQyxZQUFZLENBQzlCLENBQUM7UUFFRixPQUFPO1lBQ0wsTUFBTTtZQUNOLGNBQWM7U0FDZixDQUFDO0lBQ0osQ0FBQztJQUVELFNBQVMsQ0FDUCxPQUFrQixFQUNsQixRQUEwQixFQUMxQixTQUFtQixFQUNuQixXQUFrQixFQUNsQixVQUFxQixFQUNyQixjQUFpQyxFQUNqQyxlQUE4RCxFQUM5RCxTQUFxRCxFQUNyRCxZQUFtQztRQUVuQyxNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7SUFDN0MsQ0FBQztDQUNGIn0=