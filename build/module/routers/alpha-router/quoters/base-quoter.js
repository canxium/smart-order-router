import _ from 'lodash';
import { log, metric, MetricLoggerUnit, poolToString, } from '../../../util';
/**
 * Interface for a Quoter.
 * Defines the base dependencies, helper methods and interface for how to fetch quotes.
 *
 * @abstract
 * @template CandidatePools
 * @template Route
 */
export class BaseQuoter {
    constructor(tokenProvider, chainId, protocol, blockedTokenListProvider, tokenValidatorProvider) {
        this.tokenProvider = tokenProvider;
        this.chainId = chainId;
        this.protocol = protocol;
        this.blockedTokenListProvider = blockedTokenListProvider;
        this.tokenValidatorProvider = tokenValidatorProvider;
    }
    /**
     * Public method which would first get the routes and then get the quotes.
     *
     * @param tokenIn The token that the user wants to provide
     * @param tokenOut The token that the usaw wants to receive
     * @param amounts the list of amounts to query for EACH route.
     * @param percents the percentage of each amount.
     * @param quoteToken
     * @param candidatePools
     * @param tradeType
     * @param routingConfig
     * @param gasModel the gasModel to be used for estimating gas cost
     * @param gasPriceWei instead of passing gasModel, gasPriceWei is used to generate a gasModel
     */
    getRoutesThenQuotes(tokenIn, tokenOut, amount, amounts, percents, quoteToken, candidatePools, tradeType, routingConfig, gasModel, gasPriceWei) {
        return this.getRoutes(tokenIn, tokenOut, candidatePools, tradeType, routingConfig).then((routesResult) => {
            if (routesResult.routes.length == 1) {
                metric.putMetric(`${this.protocol}QuoterSingleRoute`, 1, MetricLoggerUnit.Count);
                percents = [100];
                amounts = [amount];
            }
            if (routesResult.routes.length > 0) {
                metric.putMetric(`${this.protocol}QuoterRoutesFound`, routesResult.routes.length, MetricLoggerUnit.Count);
            }
            else {
                metric.putMetric(`${this.protocol}QuoterNoRoutesFound`, routesResult.routes.length, MetricLoggerUnit.Count);
            }
            return this.getQuotes(routesResult.routes, amounts, percents, quoteToken, tradeType, routingConfig, routesResult.candidatePools, gasModel, gasPriceWei);
        });
    }
    async applyTokenValidatorToPools(pools, isInvalidFn) {
        if (!this.tokenValidatorProvider) {
            return pools;
        }
        log.info(`Running token validator on ${pools.length} pools`);
        const tokens = _.flatMap(pools, (pool) => [pool.token0, pool.token1]);
        const tokenValidationResults = await this.tokenValidatorProvider.validateTokens(tokens.map((token) => token.wrapped));
        const poolsFiltered = _.filter(pools, (pool) => {
            const token0Validation = tokenValidationResults.getValidationByToken(pool.token0.wrapped);
            const token1Validation = tokenValidationResults.getValidationByToken(pool.token1.wrapped);
            const token0Invalid = isInvalidFn(pool.token0, token0Validation);
            const token1Invalid = isInvalidFn(pool.token1, token1Validation);
            if (token0Invalid || token1Invalid) {
                log.info(`Dropping pool ${poolToString(pool)} because token is invalid. ${pool.token0.symbol}: ${token0Validation}, ${pool.token1.symbol}: ${token1Validation}`);
            }
            return !token0Invalid && !token1Invalid;
        });
        return poolsFiltered;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1xdW90ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcm91dGVycy9hbHBoYS1yb3V0ZXIvcXVvdGVycy9iYXNlLXF1b3Rlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFNQSxPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFRdkIsT0FBTyxFQUVMLEdBQUcsRUFDSCxNQUFNLEVBQ04sZ0JBQWdCLEVBQ2hCLFlBQVksR0FDYixNQUFNLGVBQWUsQ0FBQztBQWV2Qjs7Ozs7OztHQU9HO0FBQ0gsTUFBTSxPQUFnQixVQUFVO0lBYTlCLFlBQ0UsYUFBNkIsRUFDN0IsT0FBZ0IsRUFDaEIsUUFBa0IsRUFDbEIsd0JBQTZDLEVBQzdDLHNCQUFnRDtRQUVoRCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNuQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsd0JBQXdCLEdBQUcsd0JBQXdCLENBQUM7UUFDekQsSUFBSSxDQUFDLHNCQUFzQixHQUFHLHNCQUFzQixDQUFDO0lBQ3ZELENBQUM7SUFnREQ7Ozs7Ozs7Ozs7Ozs7T0FhRztJQUNJLG1CQUFtQixDQUN4QixPQUFrQixFQUNsQixRQUFtQixFQUNuQixNQUFzQixFQUN0QixPQUF5QixFQUN6QixRQUFrQixFQUNsQixVQUFpQixFQUNqQixjQUE4QixFQUM5QixTQUFvQixFQUNwQixhQUFnQyxFQUNoQyxRQUF5QyxFQUN6QyxXQUF1QjtRQUV2QixPQUFPLElBQUksQ0FBQyxTQUFTLENBQ25CLE9BQU8sRUFDUCxRQUFRLEVBQ1IsY0FBYyxFQUNkLFNBQVMsRUFDVCxhQUFhLENBQ2QsQ0FBQyxJQUFJLENBQUMsQ0FBQyxZQUFZLEVBQUUsRUFBRTtZQUN0QixJQUFJLFlBQVksQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtnQkFDbkMsTUFBTSxDQUFDLFNBQVMsQ0FDZCxHQUFHLElBQUksQ0FBQyxRQUFRLG1CQUFtQixFQUNuQyxDQUFDLEVBQ0QsZ0JBQWdCLENBQUMsS0FBSyxDQUN2QixDQUFDO2dCQUNGLFFBQVEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNqQixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUNwQjtZQUVELElBQUksWUFBWSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUNsQyxNQUFNLENBQUMsU0FBUyxDQUNkLEdBQUcsSUFBSSxDQUFDLFFBQVEsbUJBQW1CLEVBQ25DLFlBQVksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUMxQixnQkFBZ0IsQ0FBQyxLQUFLLENBQ3ZCLENBQUM7YUFDSDtpQkFBTTtnQkFDTCxNQUFNLENBQUMsU0FBUyxDQUNkLEdBQUcsSUFBSSxDQUFDLFFBQVEscUJBQXFCLEVBQ3JDLFlBQVksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUMxQixnQkFBZ0IsQ0FBQyxLQUFLLENBQ3ZCLENBQUM7YUFDSDtZQUVELE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FDbkIsWUFBWSxDQUFDLE1BQU0sRUFDbkIsT0FBTyxFQUNQLFFBQVEsRUFDUixVQUFVLEVBQ1YsU0FBUyxFQUNULGFBQWEsRUFDYixZQUFZLENBQUMsY0FBYyxFQUMzQixRQUFRLEVBQ1IsV0FBVyxDQUNaLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFUyxLQUFLLENBQUMsMEJBQTBCLENBQ3hDLEtBQVUsRUFDVixXQUdZO1FBRVosSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsRUFBRTtZQUNoQyxPQUFPLEtBQUssQ0FBQztTQUNkO1FBRUQsR0FBRyxDQUFDLElBQUksQ0FBQyw4QkFBOEIsS0FBSyxDQUFDLE1BQU0sUUFBUSxDQUFDLENBQUM7UUFFN0QsTUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUV0RSxNQUFNLHNCQUFzQixHQUMxQixNQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxjQUFjLENBQzlDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FDckMsQ0FBQztRQUVKLE1BQU0sYUFBYSxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLENBQUMsSUFBTyxFQUFFLEVBQUU7WUFDaEQsTUFBTSxnQkFBZ0IsR0FBRyxzQkFBc0IsQ0FBQyxvQkFBb0IsQ0FDbEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQ3BCLENBQUM7WUFDRixNQUFNLGdCQUFnQixHQUFHLHNCQUFzQixDQUFDLG9CQUFvQixDQUNsRSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FDcEIsQ0FBQztZQUVGLE1BQU0sYUFBYSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFDakUsTUFBTSxhQUFhLEdBQUcsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUVqRSxJQUFJLGFBQWEsSUFBSSxhQUFhLEVBQUU7Z0JBQ2xDLEdBQUcsQ0FBQyxJQUFJLENBQ04saUJBQWlCLFlBQVksQ0FBQyxJQUFJLENBQUMsOEJBQ2pDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFDZCxLQUFLLGdCQUFnQixLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxLQUFLLGdCQUFnQixFQUFFLENBQ3BFLENBQUM7YUFDSDtZQUVELE9BQU8sQ0FBQyxhQUFhLElBQUksQ0FBQyxhQUFhLENBQUM7UUFDMUMsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLGFBQWEsQ0FBQztJQUN2QixDQUFDO0NBQ0YifQ==