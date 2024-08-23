import { ChainId } from '@uniswap/sdk-core';
import { opStackChains } from '../util/l2FeeChains';
import { IGasPriceProvider } from './gas-price-provider';
const DEFAULT_EIP_1559_SUPPORTED_CHAINS = [
    ChainId.MAINNET,
    ChainId.GOERLI,
    ChainId.POLYGON_MUMBAI,
    ChainId.ARBITRUM_ONE,
    ChainId.CANXIUM,
    ...opStackChains,
];
/**
 * Gets gas prices on chain. If the chain supports EIP-1559 and has the feeHistory API,
 * uses the EIP1559 provider. Otherwise it will use a legacy provider that uses eth_gasPrice
 *
 * @export
 * @class OnChainGasPriceProvider
 */
export class OnChainGasPriceProvider extends IGasPriceProvider {
    constructor(chainId, eip1559GasPriceProvider, legacyGasPriceProvider, eipChains = DEFAULT_EIP_1559_SUPPORTED_CHAINS) {
        super();
        this.chainId = chainId;
        this.eip1559GasPriceProvider = eip1559GasPriceProvider;
        this.legacyGasPriceProvider = legacyGasPriceProvider;
        this.eipChains = eipChains;
    }
    async getGasPrice(latestBlockNumber, requestBlockNumber) {
        if (this.eipChains.includes(this.chainId)) {
            return this.eip1559GasPriceProvider.getGasPrice(latestBlockNumber, requestBlockNumber);
        }
        return this.legacyGasPriceProvider.getGasPrice(latestBlockNumber, requestBlockNumber);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib24tY2hhaW4tZ2FzLXByaWNlLXByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3Byb3ZpZGVycy9vbi1jaGFpbi1nYXMtcHJpY2UtcHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBRTVDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUVwRCxPQUFPLEVBQVksaUJBQWlCLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUduRSxNQUFNLGlDQUFpQyxHQUFHO0lBQ3hDLE9BQU8sQ0FBQyxPQUFPO0lBQ2YsT0FBTyxDQUFDLE1BQU07SUFDZCxPQUFPLENBQUMsY0FBYztJQUN0QixPQUFPLENBQUMsWUFBWTtJQUNwQixPQUFPLENBQUMsT0FBTztJQUNmLEdBQUcsYUFBYTtDQUNqQixDQUFDO0FBRUY7Ozs7OztHQU1HO0FBQ0gsTUFBTSxPQUFPLHVCQUF3QixTQUFRLGlCQUFpQjtJQUM1RCxZQUNZLE9BQWdCLEVBQ2hCLHVCQUFnRCxFQUNoRCxzQkFBOEMsRUFDOUMsWUFBdUIsaUNBQWlDO1FBRWxFLEtBQUssRUFBRSxDQUFDO1FBTEUsWUFBTyxHQUFQLE9BQU8sQ0FBUztRQUNoQiw0QkFBdUIsR0FBdkIsdUJBQXVCLENBQXlCO1FBQ2hELDJCQUFzQixHQUF0QixzQkFBc0IsQ0FBd0I7UUFDOUMsY0FBUyxHQUFULFNBQVMsQ0FBK0M7SUFHcEUsQ0FBQztJQUVlLEtBQUssQ0FBQyxXQUFXLENBQy9CLGlCQUF5QixFQUN6QixrQkFBMkI7UUFFM0IsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDekMsT0FBTyxJQUFJLENBQUMsdUJBQXVCLENBQUMsV0FBVyxDQUM3QyxpQkFBaUIsRUFDakIsa0JBQWtCLENBQ25CLENBQUM7U0FDSDtRQUVELE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLFdBQVcsQ0FDNUMsaUJBQWlCLEVBQ2pCLGtCQUFrQixDQUNuQixDQUFDO0lBQ0osQ0FBQztDQUNGIn0=