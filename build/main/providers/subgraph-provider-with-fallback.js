"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubgraphProviderWithFallBacks = void 0;
const util_1 = require("../util");
class SubgraphProviderWithFallBacks {
    constructor(fallbacks, protocol) {
        this.fallbacks = fallbacks;
        this.protocol = protocol;
    }
    async getPools(tokenIn, tokenOut, providerConfig) {
        for (let i = 0; i < this.fallbacks.length; i++) {
            const provider = this.fallbacks[i];
            try {
                const pools = await provider.getPools(tokenIn, tokenOut, providerConfig);
                return pools;
            }
            catch (err) {
                util_1.log.info(`Failed to get subgraph pools for ${this.protocol} from fallback #${i}`);
            }
        }
        throw new Error('Failed to get subgraph pools from any providers');
    }
}
exports.SubgraphProviderWithFallBacks = SubgraphProviderWithFallBacks;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3ViZ3JhcGgtcHJvdmlkZXItd2l0aC1mYWxsYmFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvc3ViZ3JhcGgtcHJvdmlkZXItd2l0aC1mYWxsYmFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFHQSxrQ0FBOEI7QUFJOUIsTUFBc0IsNkJBQTZCO0lBSWpELFlBQ1UsU0FBNkMsRUFDN0MsUUFBa0I7UUFEbEIsY0FBUyxHQUFULFNBQVMsQ0FBb0M7UUFDN0MsYUFBUSxHQUFSLFFBQVEsQ0FBVTtJQUN6QixDQUFDO0lBRUcsS0FBSyxDQUFDLFFBQVEsQ0FDbkIsT0FBZSxFQUNmLFFBQWdCLEVBQ2hCLGNBQStCO1FBRS9CLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM5QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBRSxDQUFDO1lBQ3BDLElBQUk7Z0JBQ0YsTUFBTSxLQUFLLEdBQUcsTUFBTSxRQUFRLENBQUMsUUFBUSxDQUNuQyxPQUFPLEVBQ1AsUUFBUSxFQUNSLGNBQWMsQ0FDZixDQUFDO2dCQUNGLE9BQU8sS0FBSyxDQUFDO2FBQ2Q7WUFBQyxPQUFPLEdBQUcsRUFBRTtnQkFDWixVQUFHLENBQUMsSUFBSSxDQUNOLG9DQUFvQyxJQUFJLENBQUMsUUFBUSxtQkFBbUIsQ0FBQyxFQUFFLENBQ3hFLENBQUM7YUFDSDtTQUNGO1FBRUQsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO0lBQ3JFLENBQUM7Q0FDRjtBQWhDRCxzRUFnQ0MifQ==