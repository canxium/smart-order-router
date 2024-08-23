"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticV4SubgraphProvider = void 0;
const v3_sdk_1 = require("@uniswap/v3-sdk");
const v4_sdk_1 = require("@uniswap/v4-sdk");
const lodash_1 = __importDefault(require("lodash"));
const util_1 = require("../../util");
const caching_subgraph_provider_1 = require("../caching-subgraph-provider");
const jsbi_1 = __importDefault(require("jsbi"));
class StaticV4SubgraphProvider {
    constructor(chainId, poolProvider) {
        this.chainId = chainId;
        this.poolProvider = poolProvider;
    }
    async getPools(tokenIn, tokenOut, providerConfig) {
        util_1.log.info('In static subgraph provider for V4');
        const bases = caching_subgraph_provider_1.BASES_TO_CHECK_TRADES_AGAINST[this.chainId];
        const basePairs = lodash_1.default.flatMap(bases, (base) => bases.map((otherBase) => [base, otherBase]));
        if (tokenIn && tokenOut) {
            basePairs.push([tokenIn, tokenOut], ...bases.map((base) => [tokenIn, base]), ...bases.map((base) => [tokenOut, base]));
        }
        const pairs = (0, lodash_1.default)(basePairs)
            .filter((tokens) => Boolean(tokens[0] && tokens[1]))
            .filter(([tokenA, tokenB]) => tokenA.address !== tokenB.address && !tokenA.equals(tokenB))
            .flatMap(([tokenA, tokenB]) => {
            // TODO: we will follow up with expanding the fee tiers and tick spacing from just hard-coding from v3 for now.
            return [
                [tokenA, tokenB, v3_sdk_1.FeeAmount.LOWEST, 1, v3_sdk_1.ADDRESS_ZERO],
                [tokenA, tokenB, v3_sdk_1.FeeAmount.LOW, 10, v3_sdk_1.ADDRESS_ZERO],
                [tokenA, tokenB, v3_sdk_1.FeeAmount.MEDIUM, 60, v3_sdk_1.ADDRESS_ZERO],
                [tokenA, tokenB, v3_sdk_1.FeeAmount.HIGH, 200, v3_sdk_1.ADDRESS_ZERO],
            ];
        })
            .value();
        util_1.log.info(`V4 Static subgraph provider about to get ${pairs.length} pools on-chain`);
        const poolAccessor = await this.poolProvider.getPools(pairs, providerConfig);
        const pools = poolAccessor.getAllPools();
        const poolAddressSet = new Set();
        const subgraphPools = (0, lodash_1.default)(pools)
            .map((pool) => {
            const { token0, token1, fee, tickSpacing, hooks, liquidity } = pool;
            const poolAddress = v4_sdk_1.Pool.getPoolId(token0, token1, fee, tickSpacing, hooks);
            if (poolAddressSet.has(poolAddress)) {
                return undefined;
            }
            poolAddressSet.add(poolAddress);
            const liquidityNumber = jsbi_1.default.toNumber(liquidity);
            return {
                id: poolAddress,
                feeTier: (0, util_1.unparseFeeAmount)(fee),
                tickSpacing: tickSpacing.toString(),
                hooks: hooks,
                liquidity: liquidity.toString(),
                token0: {
                    id: token0.wrapped.address,
                },
                token1: {
                    id: token1.wrapped.address,
                },
                // As a very rough proxy we just use liquidity for TVL.
                tvlETH: liquidityNumber,
                tvlUSD: liquidityNumber,
            };
        })
            .compact()
            .value();
        return subgraphPools;
    }
}
exports.StaticV4SubgraphProvider = StaticV4SubgraphProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGljLXN1YmdyYXBoLXByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3Byb3ZpZGVycy92NC9zdGF0aWMtc3ViZ3JhcGgtcHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQ0EsNENBQTBEO0FBQzFELDRDQUF1QztBQUN2QyxvREFBdUI7QUFFdkIscUNBQW1EO0FBQ25ELDRFQUE2RTtBQUU3RSxnREFBd0I7QUFLeEIsTUFBYSx3QkFBd0I7SUFDbkMsWUFDVSxPQUFnQixFQUNoQixZQUE2QjtRQUQ3QixZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ2hCLGlCQUFZLEdBQVosWUFBWSxDQUFpQjtJQUNwQyxDQUFDO0lBRUcsS0FBSyxDQUFDLFFBQVEsQ0FDbkIsT0FBZSxFQUNmLFFBQWdCLEVBQ2hCLGNBQStCO1FBRS9CLFVBQUcsQ0FBQyxJQUFJLENBQUMsb0NBQW9DLENBQUMsQ0FBQztRQUMvQyxNQUFNLEtBQUssR0FBRyx5REFBNkIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFMUQsTUFBTSxTQUFTLEdBQXFCLGdCQUFDLENBQUMsT0FBTyxDQUMzQyxLQUFLLEVBQ0wsQ0FBQyxJQUFJLEVBQW9CLEVBQUUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUN4RSxDQUFDO1FBRUYsSUFBSSxPQUFPLElBQUksUUFBUSxFQUFFO1lBQ3ZCLFNBQVMsQ0FBQyxJQUFJLENBQ1osQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLEVBQ25CLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBa0IsRUFBRSxDQUFDLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQ3ZELEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBa0IsRUFBRSxDQUFD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