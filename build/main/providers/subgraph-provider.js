"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubgraphProvider = void 0;
const async_retry_1 = __importDefault(require("async-retry"));
const await_timeout_1 = __importDefault(require("await-timeout"));
const graphql_request_1 = require("graphql-request");
const lodash_1 = __importDefault(require("lodash"));
const util_1 = require("../util");
const PAGE_SIZE = 1000; // 1k is max possible query size from subgraph.
class SubgraphProvider {
    constructor(protocol, chainId, retries = 2, timeout = 30000, rollback = true, trackedEthThreshold = 0.01, untrackedUsdThreshold = Number.MAX_VALUE, subgraphUrl) {
        this.protocol = protocol;
        this.chainId = chainId;
        this.retries = retries;
        this.timeout = timeout;
        this.rollback = rollback;
        this.trackedEthThreshold = trackedEthThreshold;
        this.untrackedUsdThreshold = untrackedUsdThreshold;
        this.subgraphUrl = subgraphUrl;
        this.protocol = protocol;
        if (!this.subgraphUrl) {
            throw new Error(`No subgraph url for chain id: ${this.chainId}`);
        }
        this.client = new graphql_request_1.GraphQLClient(this.subgraphUrl);
    }
    async getPools(_tokenIn, _tokenOut, providerConfig) {
        const beforeAll = Date.now();
        let blockNumber = (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
            ? await providerConfig.blockNumber
            : undefined;
        const query = (0, graphql_request_1.gql) `
      query getPools($pageSize: Int!, $id: String) {
        pools(
          first: $pageSize
          ${blockNumber ? `block: { number: ${blockNumber} }` : ``}
          where: { id_gt: $id }
        ) {
          id
          token0 {
            symbol
            id
          }
          token1 {
            symbol
            id
          }
          feeTier
          liquidity
          totalValueLockedUSD
          totalValueLockedETH
          totalValueLockedUSDUntracked
        }
      }
    `;
        let pools = [];
        util_1.log.info(`Getting ${this.protocol} pools from the subgraph with page size ${PAGE_SIZE}${(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
            ? ` as of block ${providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber}`
            : ''}.`);
        let retries = 0;
        await (0, async_retry_1.default)(async () => {
            const timeout = new await_timeout_1.default();
            const getPools = async () => {
                let lastId = '';
                let pools = [];
                let poolsPage = [];
                // metrics variables
                let totalPages = 0;
                do {
                    totalPages += 1;
                    const poolsResult = await this.client.request(query, {
                        pageSize: PAGE_SIZE,
                        id: lastId,
                    });
                    poolsPage = poolsResult.pools;
                    pools = pools.concat(poolsPage);
                    lastId = pools[pools.length - 1].id;
                    util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.paginate.pageSize`, poolsPage.length);
                } while (poolsPage.length > 0);
                util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.paginate`, totalPages);
                util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.pools.length`, pools.length);
                return pools;
            };
            try {
                const getPoolsPromise = getPools();
                const timerPromise = timeout.set(this.timeout).then(() => {
                    throw new Error(`Timed out getting pools from subgraph: ${this.timeout}`);
                });
                pools = await Promise.race([getPoolsPromise, timerPromise]);
                return;
            }
            catch (err) {
                util_1.log.error({ err }, `Error fetching ${this.protocol} Subgraph Pools.`);
                throw err;
            }
            finally {
                timeout.clear();
            }
        }, {
            retries: this.retries,
            onRetry: (err, retry) => {
                retries += 1;
                if (this.rollback &&
                    blockNumber &&
                    lodash_1.default.includes(err.message, 'indexed up to')) {
                    util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.indexError`, 1);
                    blockNumber = blockNumber - 10;
                    util_1.log.info(`Detected subgraph indexing error. Rolled back block number to: ${blockNumber}`);
                }
                util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.timeout`, 1);
                pools = [];
                util_1.log.info({ err }, `Failed to get pools from subgraph. Retry attempt: ${retry}`);
            },
        });
        util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.retries`, retries);
        const untrackedPools = pools.filter((pool) => parseInt(pool.liquidity) > 0 ||
            parseFloat(pool.totalValueLockedETH) > this.trackedEthThreshold ||
            parseFloat(pool.totalValueLockedUSDUntracked) >
                this.untrackedUsdThreshold);
        util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.untracked.length`, untrackedPools.length);
        util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.untracked.percent`, (untrackedPools.length / pools.length) * 100);
        const beforeFilter = Date.now();
        const poolsSanitized = pools
            .filter((pool) => parseInt(pool.liquidity) > 0 ||
            parseFloat(pool.totalValueLockedETH) > this.trackedEthThreshold)
            .map((pool) => {
            const { totalValueLockedETH, totalValueLockedUSD } = pool;
            return {
                id: pool.id.toLowerCase(),
                feeTier: pool.feeTier,
                token0: {
                    id: pool.token0.id.toLowerCase(),
                },
                token1: {
                    id: pool.token1.id.toLowerCase(),
                },
                liquidity: pool.liquidity,
                tvlETH: parseFloat(totalValueLockedETH),
                tvlUSD: parseFloat(totalValueLockedUSD),
            };
        });
        util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.filter.latency`, Date.now() - beforeFilter);
        util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.filter.length`, poolsSanitized.length);
        util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.filter.percent`, (poolsSanitized.length / pools.length) * 100);
        util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools`, 1);
        util_1.metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.latency`, Date.now() - beforeAll);
        util_1.log.info(`Got ${pools.length} ${this.protocol} pools from the subgraph. ${poolsSanitized.length} after filtering`);
        return poolsSanitized;
    }
}
exports.SubgraphProvider = SubgraphProvider;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ViZ3JhcGgtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3N1YmdyYXBoLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUVBLDhEQUFnQztBQUNoQyxrRUFBb0M7QUFDcEMscURBQXFEO0FBQ3JELG9EQUF1QjtBQUV2QixrQ0FBc0M7QUFhdEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQUMsK0NBQStDO0FBaUN2RSxNQUFzQixnQkFBZ0I7SUFNcEMsWUFDVSxRQUFrQixFQUNsQixPQUFnQixFQUNoQixVQUFVLENBQUMsRUFDWCxVQUFVLEtBQUssRUFDZixXQUFXLElBQUksRUFDZixzQkFBc0IsSUFBSSxFQUMxQix3QkFBd0IsTUFBTSxDQUFDLFNBQVMsRUFDeEMsV0FBb0I7UUFQcEIsYUFBUSxHQUFSLFFBQVEsQ0FBVTtRQUNsQixZQUFPLEdBQVAsT0FBTyxDQUFTO1FBQ2hCLFlBQU8sR0FBUCxPQUFPLENBQUk7UUFDWCxZQUFPLEdBQVAsT0FBTyxDQUFRO1FBQ2YsYUFBUSxHQUFSLFFBQVEsQ0FBTztRQUNmLHdCQUFtQixHQUFuQixtQkFBbUIsQ0FBTztRQUMxQiwwQkFBcUIsR0FBckIscUJBQXFCLENBQW1CO1FBQ3hDLGdCQUFXLEdBQVgsV0FBVyxDQUFTO1FBRTVCLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsaUNBQWlDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1NBQ2xFO1FBQ0QsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLCtCQUFhLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFTSxLQUFLLENBQUMsUUFBUSxDQUNuQixRQUFnQixFQUNoQixTQUFpQixFQUNqQixjQUErQjtRQUUv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