"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeAllRoutes = exports.computeAllMixedRoutes = exports.computeAllV2Routes = exports.computeAllV3Routes = exports.computeAllV4Routes = void 0;
const v2_sdk_1 = require("@uniswap/v2-sdk");
const v3_sdk_1 = require("@uniswap/v3-sdk");
const log_1 = require("../../../util/log");
const routes_1 = require("../../../util/routes");
const router_1 = require("../../router");
function computeAllV4Routes(tokenIn, tokenOut, pools, maxHops) {
    // TODO: ROUTE-217 - Support native currency routing in V4
    return computeAllRoutes(tokenIn.wrapped, tokenOut.wrapped, (route, tokenIn, tokenOut) => {
        return new router_1.V4Route(route, tokenIn, tokenOut);
    }, pools, maxHops);
}
exports.computeAllV4Routes = computeAllV4Routes;
function computeAllV3Routes(tokenIn, tokenOut, pools, maxHops) {
    return computeAllRoutes(tokenIn, tokenOut, (route, tokenIn, tokenOut) => {
        return new router_1.V3Route(route, tokenIn, tokenOut);
    }, pools, maxHops);
}
exports.computeAllV3Routes = computeAllV3Routes;
function computeAllV2Routes(tokenIn, tokenOut, pools, maxHops) {
    return computeAllRoutes(tokenIn, tokenOut, (route, tokenIn, tokenOut) => {
        return new router_1.V2Route(route, tokenIn, tokenOut);
    }, pools, maxHops);
}
exports.computeAllV2Routes = computeAllV2Routes;
function computeAllMixedRoutes(tokenIn, tokenOut, parts, maxHops) {
    const routesRaw = computeAllRoutes(tokenIn, tokenOut, (route, tokenIn, tokenOut) => {
        return new router_1.MixedRoute(route, tokenIn, tokenOut);
    }, parts, maxHops);
    /// filter out pure v3 and v2 routes
    return routesRaw.filter((route) => {
        return (!route.pools.every((pool) => pool instanceof v3_sdk_1.Pool) &&
            !route.pools.every((pool) => pool instanceof v2_sdk_1.Pair));
    });
}
exports.computeAllMixedRoutes = computeAllMixedRoutes;
function computeAllRoutes(tokenIn, tokenOut, buildRoute, pools, maxHops) {
    var _a;
    const poolsUsed = Array(pools.length).fill(false);
    const routes = [];
    const computeRoutes = (tokenIn, tokenOut, currentRoute, poolsUsed, tokensVisited, _previousTokenOut) => {
        if (currentRoute.length > maxHops) {
            return;
        }
        if (currentRoute.length > 0 &&
            currentRoute[currentRoute.length - 1].involvesToken(tokenOut)) {
            routes.push(buildRoute([...currentRoute], tokenIn, tokenOut));
            return;
        }
        for (let i = 0; i < pools.length; i++) {
            if (poolsUsed[i]) {
                continue;
            }
            const curPool = pools[i];
            const previousTokenOut = _previousTokenOut ? _previousTokenOut : tokenIn;
            if (!curPool.involvesToken(previousTokenOut)) {
                continue;
            }
            const currentTokenOut = curPool.token0.equals(previousTokenOut)
                ? curPool.token1
                : curPool.token0;
            // TODO: ROUTE-217 - Support native currency routing in V4
            if (tokensVisited.has(currentTokenOut.wrapped.address.toLowerCase())) {
                continue;
            }
            tokensVisited.add(currentTokenOut.wrapped.address.toLowerCase());
            currentRoute.push(curPool);
            poolsUsed[i] = true;
            computeRoutes(tokenIn, tokenOut, currentRoute, poolsUsed, tokensVisited, currentTokenOut.wrapped);
            poolsUsed[i] = false;
            currentRoute.pop();
            tokensVisited.delete(currentTokenOut.wrapped.address.toLowerCase());
        }
    };
    computeRoutes(tokenIn, tokenOut, [], poolsUsed, new Set([tokenIn.address.toLowerCase()]));
    log_1.log.info({
        routes: routes.map(routes_1.routeToString),
        pools: pools.map(routes_1.poolToString),
    }, `Computed ${routes.length} possible routes for type ${(_a = routes[0]) === null || _a === void 0 ? void 0 : _a.protocol}.`);
    return routes;
}
exports.computeAllRoutes = computeAllRoutes;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1hbGwtcm91dGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2Z1bmN0aW9ucy9jb21wdXRlLWFsbC1yb3V0ZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsNENBQXVDO0FBQ3ZDLDRDQUFpRDtBQUdqRCwyQ0FBd0M7QUFDeEMsaURBQW1FO0FBQ25FLHlDQU1zQjtBQUV0QixTQUFnQixrQkFBa0IsQ0FDaEMsT0FBaUIsRUFDakIsUUFBa0IsRUFDbEIsS0FBZSxFQUNmLE9BQWU7SUFFZiwwREFBMEQ7SUFDMUQsT0FBTyxnQkFBZ0IsQ0FDckIsT0FBTyxDQUFDLE9BQU8sRUFDZixRQUFRLENBQUMsT0FBTyxFQUNoQixDQUFDLEtBQWUsRUFBRSxPQUFpQixFQUFFLFFBQWtCLEVBQUUsRUFBRTtRQUN6RCxPQUFPLElBQUksZ0JBQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQy9DLENBQUMsRUFDRCxLQUFLLEVBQ0wsT0FBTyxDQUNSLENBQUM7QUFDSixDQUFDO0FBaEJELGdEQWdCQztBQUVELFNBQWdCLGtCQUFrQixDQUNoQyxPQUFjLEVBQ2QsUUFBZSxFQUNmLEtBQWUsRUFDZixPQUFlO0lBRWYsT0FBTyxnQkFBZ0IsQ0FDckIsT0FBTyxFQUNQLFFBQVEsRUFDUixDQUFDLEtBQWUsRUFBRSxPQUFjLEVBQUUsUUFBZSxFQUFFLEVBQUU7UUFDbkQsT0FBTyxJQUFJLGdCQUFPLENBQUMsS0FBSyxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMvQyxDQUFDLEVBQ0QsS0FBSyxFQUNMLE9BQU8sQ0FDUixDQUFDO0FBQ0osQ0FBQztBQWZELGdEQWVDO0FBRUQsU0FBZ0Isa0JBQWtCLENBQ2hDLE9BQWMsRUFDZCxRQUFlLEVBQ2YsS0FBYSxFQUNiLE9BQWU7SUFFZixPQUFPLGdCQUFnQixDQUNyQixPQUFPLEVB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