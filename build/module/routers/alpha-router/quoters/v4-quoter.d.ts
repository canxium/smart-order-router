import { BigNumber } from '@ethersproject/bignumber';
import { ChainId, Currency, Token, TradeType } from '@uniswap/sdk-core';
import { IOnChainQuoteProvider, ITokenListProvider, ITokenProvider, ITokenValidatorProvider, IV4PoolProvider, IV4SubgraphProvider } from '../../../providers';
import { CurrencyAmount } from '../../../util';
import { V4Route } from '../../router';
import { AlphaRouterConfig } from '../alpha-router';
import { RouteWithValidQuote } from '../entities';
import { CandidatePoolsBySelectionCriteria, V4CandidatePools } from '../functions/get-candidate-pools';
import { IGasModel } from '../gas-models';
import { BaseQuoter } from './base-quoter';
import { GetQuotesResult, GetRoutesResult } from './model';
export declare class V4Quoter extends BaseQuoter<V4CandidatePools, V4Route, Currency> {
    protected v4SubgraphProvider: IV4SubgraphProvider;
    protected v4PoolProvider: IV4PoolProvider;
    protected onChainQuoteProvider: IOnChainQuoteProvider;
    constructor(v4SubgraphProvider: IV4SubgraphProvider, v4PoolProvider: IV4PoolProvider, onChainQuoteProvider: IOnChainQuoteProvider, tokenProvider: ITokenProvider, chainId: ChainId, blockedTokenListProvider?: ITokenListProvider, tokenValidatorProvider?: ITokenValidatorProvider);
    protected getRoutes(tokenIn: Currency, tokenOut: Currency, v4CandidatePools: V4CandidatePools, _tradeType: TradeType, routingConfig: AlphaRouterConfig): Promise<GetRoutesResult<V4Route>>;
    getQuotes(_routes: V4Route[], _amounts: CurrencyAmount[], _percents: number[], _quoteToken: Token, _tradeType: TradeType, _routingConfig: AlphaRouterConfig, _candidatePools: CandidatePoolsBySelectionCriteria | undefined, _gasModel: IGasModel<RouteWithValidQuote> | undefined, _gasPriceWei: BigNumber | undefined): Promise<GetQuotesResult>;
}
