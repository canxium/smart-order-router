import { ChainId, Token } from '@uniswap/sdk-core';
import { ProviderConfig } from '../provider';
import { IV4PoolProvider } from './pool-provider';
import { IV4SubgraphProvider, V4SubgraphPool } from './subgraph-provider';
export declare class StaticV4SubgraphProvider implements IV4SubgraphProvider {
    private chainId;
    private poolProvider;
    constructor(chainId: ChainId, poolProvider: IV4PoolProvider);
    getPools(tokenIn?: Token, tokenOut?: Token, providerConfig?: ProviderConfig): Promise<V4SubgraphPool[]>;
}
