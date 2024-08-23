"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseQuoter = void 0;
const lodash_1 = __importDefault(require("lodash"));
const util_1 = require("../../../util");
/**
 * Interface for a Quoter.
 * Defines the base dependencies, helper methods and interface for how to fetch quotes.
 *
 * @abstract
 * @template CandidatePools
 * @template Route
 */
class BaseQuoter {
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
                util_1.metric.putMetric(`${this.protocol}QuoterSingleRoute`, 1, util_1.MetricLoggerUnit.Count);
                percents = [100];
                amounts = [amount];
            }
            if (routesResult.routes.length > 0) {
                util_1.metric.putMetric(`${this.protocol}QuoterRoutesFound`, routesResult.routes.length, util_1.MetricLoggerUnit.Count);
            }
            else {
                util_1.metric.putMetric(`${this.protocol}QuoterNoRoutesFound`, routesResult.routes.length, util_1.MetricLoggerUnit.Count);
            }
            return this.getQuotes(routesResult.routes, amounts, percents, quoteToken, tradeType, routingConfig, routesResult.candidatePools, gasModel, gasPriceWei);
        });
    }
    async applyTokenValidatorToPools(pools, isInvalidFn) {
        if (!this.tokenValidatorProvider) {
            return pools;
        }
        util_1.log.info(`Running token validator on ${pools.length} pools`);
        const tokens = lodash_1.default.flatMap(pools, (pool) => [pool.token0, pool.token1]);
        const tokenValidationResults = await this.tokenValidatorProvider.validateTokens(tokens.map((token) => token.wrapped));
        const poolsFiltered = lodash_1.default.filter(pools, (pool) => {
            const token0Validation = tokenValidationResults.getValidationByToken(pool.token0.wrapped);
            const token1Validation = tokenValidationResults.getValidationByToken(pool.token1.wrapped);
            const token0Invalid = isInvalidFn(pool.token0, token0Validation);
            const token1Invalid = isInvalidFn(pool.token1, token1Validation);
            if (token0Invalid || token1Invalid) {
                util_1.log.info(`Dropping pool ${(0, util_1.poolToString)(pool)} because token is invalid. ${pool.token0.symbol}: ${token0Validation}, ${pool.token1.symbol}: ${token1Validation}`);
            }
            return !token0Invalid && !token1Invalid;
        });
        return poolsFiltered;
    }
}
exports.BaseQuoter = BaseQuoter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFzZS1xdW90ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9zcmMvcm91dGVycy9hbHBoYS1yb3V0ZXIvcXVvdGVycy9iYXNlLXF1b3Rlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFNQSxvREFBdUI7QUFRdkIsd0NBTXVCO0FBZXZCOzs7Ozs7O0dBT0c7QUFDSCxNQUFzQixVQUFVO0lBYTlCLFlBQ0UsYUFBNkIsRUFDN0IsT0FBZ0IsRUFDaEIsUUFBa0IsRUFDbEIsd0JBQTZDLEVBQzdDLHNCQUFnRDtRQUVoRCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNuQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsd0JBQXdCLEdBQUcsd0JBQXdCLENBQUM7UUFDekQsSUFBSSxDQUFDLHNCQUFzQixHQUFHLHNCQUFzQixDQUFDO0lBQ3ZELENBQUM7SUFnREQ7Ozs7Ozs7Ozs7Ozs7T0FhRztJQUNJLG1CQUFtQixDQUN4QixPQUFrQixFQUNsQixRQUFtQixFQUNuQixNQUFzQixFQUN0QixPQUF5QixFQUN6QixRQUFrQixFQUNsQixVQUFpQixFQUNqQixjQUE4QixFQUM5QixTQUFvQixFQUNwQixhQUFnQyxFQUNoQyxRQUF5QyxFQUN6QyxXQUF1QjtRQUV2QixPQUFPLElBQUksQ0FBQyxTQUFTLENBQ25CLE9BQU8sRUFDUCxRQUFRLEVBQ1IsY0FBYyxFQUNkLFNBQVMsRUFDVCxhQUFhLENBQ2QsQ0FBQyxJQUFJLENBQUMsQ0FBQyxZQUFZLEVBQUUsRUFBRTtZQUN0QixJQUFJLFlBQVksQ0FBQyxNQUFNLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtnQkFDbkMsYUFBTSxDQUFDLFNBQVMsQ0FDZCxHQUFHLElBQUksQ0FBQyxRQUFRLG1CQUFtQixFQUNuQyxDQUFDLEVBQ0QsdUJBQWdCLENBQUMs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