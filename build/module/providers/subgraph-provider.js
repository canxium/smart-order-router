import retry from 'async-retry';
import Timeout from 'await-timeout';
import { gql, GraphQLClient } from 'graphql-request';
import _ from 'lodash';
import { log, metric } from '../util';
const PAGE_SIZE = 1000; // 1k is max possible query size from subgraph.
export class SubgraphProvider {
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
        this.client = new GraphQLClient(this.subgraphUrl);
    }
    async getPools(_tokenIn, _tokenOut, providerConfig) {
        const beforeAll = Date.now();
        let blockNumber = (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
            ? await providerConfig.blockNumber
            : undefined;
        const query = gql `
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
        log.info(`Getting ${this.protocol} pools from the subgraph with page size ${PAGE_SIZE}${(providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber)
            ? ` as of block ${providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber}`
            : ''}.`);
        let retries = 0;
        await retry(async () => {
            const timeout = new Timeout();
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
                    metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.paginate.pageSize`, poolsPage.length);
                } while (poolsPage.length > 0);
                metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.paginate`, totalPages);
                metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.pools.length`, pools.length);
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
                log.error({ err }, `Error fetching ${this.protocol} Subgraph Pools.`);
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
                    _.includes(err.message, 'indexed up to')) {
                    metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.indexError`, 1);
                    blockNumber = blockNumber - 10;
                    log.info(`Detected subgraph indexing error. Rolled back block number to: ${blockNumber}`);
                }
                metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.timeout`, 1);
                pools = [];
                log.info({ err }, `Failed to get pools from subgraph. Retry attempt: ${retry}`);
            },
        });
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.retries`, retries);
        const untrackedPools = pools.filter((pool) => parseInt(pool.liquidity) > 0 ||
            parseFloat(pool.totalValueLockedETH) > this.trackedEthThreshold ||
            parseFloat(pool.totalValueLockedUSDUntracked) >
                this.untrackedUsdThreshold);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.untracked.length`, untrackedPools.length);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.untracked.percent`, (untrackedPools.length / pools.length) * 100);
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
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.filter.latency`, Date.now() - beforeFilter);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.filter.length`, poolsSanitized.length);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.filter.percent`, (poolsSanitized.length / pools.length) * 100);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools`, 1);
        metric.putMetric(`${this.protocol}SubgraphProvider.chain_${this.chainId}.getPools.latency`, Date.now() - beforeAll);
        log.info(`Got ${pools.length} ${this.protocol} pools from the subgraph. ${poolsSanitized.length} after filtering`);
        return poolsSanitized;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ViZ3JhcGgtcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvcHJvdmlkZXJzL3N1YmdyYXBoLXByb3ZpZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUVBLE9BQU8sS0FBSyxNQUFNLGFBQWEsQ0FBQztBQUNoQyxPQUFPLE9BQU8sTUFBTSxlQUFlLENBQUM7QUFDcEMsT0FBTyxFQUFFLEdBQUcsRUFBRSxhQUFhLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQUNyRCxPQUFPLENBQUMsTUFBTSxRQUFRLENBQUM7QUFFdkIsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUUsTUFBTSxTQUFTLENBQUM7QUFhdEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQUMsK0NBQStDO0FBaUN2RSxNQUFNLE9BQWdCLGdCQUFnQjtJQU1wQyxZQUNVLFFBQWtCLEVBQ2xCLE9BQWdCLEVBQ2hCLFVBQVUsQ0FBQyxFQUNYLFVBQVUsS0FBSyxFQUNmLFdBQVcsSUFBSSxFQUNmLHNCQUFzQixJQUFJLEVBQzFCLHdCQUF3QixNQUFNLENBQUMsU0FBUyxFQUN4QyxXQUFvQjtRQVBwQixhQUFRLEdBQVIsUUFBUSxDQUFVO1FBQ2xCLFlBQU8sR0FBUCxPQUFPLENBQVM7UUFDaEIsWUFBTyxHQUFQLE9BQU8sQ0FBSTtRQUNYLFlBQU8sR0FBUCxPQUFPLENBQVE7UUFDZixhQUFRLEdBQVIsUUFBUSxDQUFPO1FBQ2Ysd0JBQW1CLEdBQW5CLG1CQUFtQixDQUFPO1FBQzFCLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBbUI7UUFDeEMsZ0JBQVcsR0FBWCxXQUFXLENBQVM7UUFFNUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDckIsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7U0FDbEU7UUFDRCxJ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