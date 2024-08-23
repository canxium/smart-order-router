"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeAmountsToString = exports.routeToString = exports.poolToString = exports.routeToPools = exports.routeToTokens = void 0;
const router_sdk_1 = require("@uniswap/router-sdk");
const sdk_core_1 = require("@uniswap/sdk-core");
const v2_sdk_1 = require("@uniswap/v2-sdk");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const v4_sdk_1 = require("@uniswap/v4-sdk");
const lodash_1 = __importDefault(require("lodash"));
const addresses_1 = require("./addresses");
const _1 = require(".");
const routeToTokens = (route) => {
    switch (route.protocol) {
        case router_sdk_1.Protocol.V4:
            return route.currencyPath;
        case router_sdk_1.Protocol.V3:
            return route.tokenPath;
        case router_sdk_1.Protocol.V2:
        case router_sdk_1.Protocol.MIXED:
            return route.path;
        default:
            throw new Error(`Unsupported route ${JSON.stringify(route)}`);
    }
};
exports.routeToTokens = routeToTokens;
const routeToPools = (route) => {
    switch (route.protocol) {
        case router_sdk_1.Protocol.V4:
        case router_sdk_1.Protocol.V3:
        case router_sdk_1.Protocol.MIXED:
            return route.pools;
        case router_sdk_1.Protocol.V2:
            return route.pairs;
        default:
            throw new Error(`Unsupported route ${JSON.stringify(route)}`);
    }
};
exports.routeToPools = routeToPools;
const poolToString = (pool) => {
    if (pool instanceof v4_sdk_1.Pool) {
        return ` -- ${pool.fee / 10000}% [${v4_sdk_1.Pool.getPoolId(pool.token0, pool.token1, pool.fee, 0, router_sdk_1.ADDRESS_ZERO)}]`;
    }
    else if (pool instanceof v3_sdk_1.Pool) {
        return ` -- ${pool.fee / 10000}% [${v3_sdk_1.Pool.getAddress(pool.token0, pool.token1, pool.fee, undefined, addresses_1.V3_CORE_FACTORY_ADDRESSES[pool.chainId])}]`;
    }
    else if (pool instanceof v2_sdk_1.Pair) {
        return ` -- [${v2_sdk_1.Pair.getAddress(pool.token0, pool.token1)}]`;
    }
    else {
        throw new Error(`Unsupported pool ${JSON.stringify(pool)}`);
    }
};
exports.poolToString = poolToString;
const routeToString = (route) => {
    const routeStr = [];
    const tokens = (0, exports.routeToTokens)(route);
    const tokenPath = lodash_1.default.map(tokens, (token) => `${token.symbol}`);
    const pools = (0, exports.routeToPools)(route);
    const poolFeePath = lodash_1.default.map(pools, (pool) => {
        if (pool instanceof v2_sdk_1.Pair) {
            return ` -- [${v2_sdk_1.Pair.getAddress(pool.token0, pool.token1)}]`;
        }
        else if (pool instanceof v3_sdk_1.Pool) {
            return ` -- ${pool.fee / 10000}% [${v3_sdk_1.Pool.getAddress(pool.token0, pool.token1, pool.fee, undefined, addresses_1.V3_CORE_FACTORY_ADDRESSES[pool.chainId])}]`;
        }
        else if (pool instanceof v4_sdk_1.Pool) {
            return ` -- ${pool.fee / 10000}% [${v4_sdk_1.Pool.getPoolId(pool.token0, pool.token1, pool.fee, 0, router_sdk_1.ADDRESS_ZERO)}]`;
        }
        else {
            throw new Error(`Unsupported pool ${JSON.stringify(pool)}`);
        }
        return `${(0, exports.poolToString)(pool)} --> `;
    });
    for (let i = 0; i < tokenPath.length; i++) {
        routeStr.push(tokenPath[i]);
        if (i < poolFeePath.length) {
            routeStr.push(poolFeePath[i]);
        }
    }
    return routeStr.join('');
};
exports.routeToString = routeToString;
const routeAmountsToString = (routeAmounts) => {
    const total = lodash_1.default.reduce(routeAmounts, (total, cur) => {
        return total.add(cur.amount);
    }, _1.CurrencyAmount.fromRawAmount(routeAmounts[0].amount.currency, 0));
    const routeStrings = lodash_1.default.map(routeAmounts, ({ protocol, route, amount }) => {
        const portion = amount.divide(total);
        const percent = new sdk_core_1.Percent(portion.numerator, portion.denominator);
        /// @dev special case for MIXED routes we want to show user friendly V2+V3 instead
        return `[${protocol == router_sdk_1.Protocol.MIXED ? 'V2 + V3' : protocol}] ${percent.toFixed(2)}% = ${(0, exports.routeToString)(route)}`;
    });
    return lodash_1.default.join(routeStrings, ', ');
};
exports.routeAmountsToString = routeAmountsToString;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL3V0aWwvcm91dGVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLG9EQUE2RDtBQUM3RCxnREFBc0Q7QUFDdEQsNENBQXVDO0FBQ3ZDLDRDQUFpRDtBQUNqRCw0Q0FBaUQ7QUFDakQsb0RBQXVCO0FBS3ZCLDJDQUF3RDtBQUV4RCx3QkFBbUM7QUFFNUIsTUFBTSxhQUFhLEdBQUcsQ0FDM0IsS0FBc0IsRUFDVixFQUFFO0lBQ2QsUUFBUSxLQUFLLENBQUMsUUFBUSxFQUFFO1FBQ3RCLEtBQUsscUJBQVEsQ0FBQyxFQUFFO1lBQ2QsT0FBTyxLQUFLLENBQUMsWUFBWSxDQUFBO1FBQzNCLEtBQUsscUJBQVEsQ0FBQyxFQUFFO1lBQ2QsT0FBTyxLQUFLLENBQUMsU0FBUyxDQUFBO1FBQ3hCLEtBQUsscUJBQVEsQ0FBQyxFQUFFLENBQUM7UUFDakIsS0FBSyxxQkFBUSxDQUFDLEtBQUs7WUFDakIsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFBO1FBQ25CO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUE7S0FDaEU7QUFDSCxDQUFDLENBQUE7QUFkWSxRQUFBLGFBQWEsaUJBY3pCO0FBRU0sTUFBTSxZQUFZLEdBQUcsQ0FDMUIsS0FBc0IsRUFDTSxFQUFFO0lBQzlCLFFBQVEsS0FBSyxDQUFDLFFBQVEsRUFBRTtRQUN0QixLQUFLLHFCQUFRLENBQUMsRUFBRSxDQUFDO1FBQ2pCLEtBQUsscUJBQVEsQ0FBQyxFQUFFLENBQUM7UUFDakIsS0FBSyxxQkFBUSxDQUFDLEtBQUs7WUFDakIsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFBO1FBQ3BCLEtBQUsscUJBQVEsQ0FBQyxFQUFFO1lBQ2QsT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFBO1FBQ3BCO1lBQ0UsTUFBTSxJQUFJLEtB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