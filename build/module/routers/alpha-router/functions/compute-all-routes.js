import { Pair } from '@uniswap/v2-sdk';
import { Pool as V3Pool } from '@uniswap/v3-sdk';
import { log } from '../../../util/log';
import { poolToString, routeToString } from '../../../util/routes';
import { MixedRoute, V2Route, V3Route, V4Route, } from '../../router';
export function computeAllV4Routes(tokenIn, tokenOut, pools, maxHops) {
    // TODO: ROUTE-217 - Support native currency routing in V4
    return computeAllRoutes(tokenIn.wrapped, tokenOut.wrapped, (route, tokenIn, tokenOut) => {
        return new V4Route(route, tokenIn, tokenOut);
    }, pools, maxHops);
}
export function computeAllV3Routes(tokenIn, tokenOut, pools, maxHops) {
    return computeAllRoutes(tokenIn, tokenOut, (route, tokenIn, tokenOut) => {
        return new V3Route(route, tokenIn, tokenOut);
    }, pools, maxHops);
}
export function computeAllV2Routes(tokenIn, tokenOut, pools, maxHops) {
    return computeAllRoutes(tokenIn, tokenOut, (route, tokenIn, tokenOut) => {
        return new V2Route(route, tokenIn, tokenOut);
    }, pools, maxHops);
}
export function computeAllMixedRoutes(tokenIn, tokenOut, parts, maxHops) {
    const routesRaw = computeAllRoutes(tokenIn, tokenOut, (route, tokenIn, tokenOut) => {
        return new MixedRoute(route, tokenIn, tokenOut);
    }, parts, maxHops);
    /// filter out pure v3 and v2 routes
    return routesRaw.filter((route) => {
        return (!route.pools.every((pool) => pool instanceof V3Pool) &&
            !route.pools.every((pool) => pool instanceof Pair));
    });
}
export function computeAllRoutes(tokenIn, tokenOut, buildRoute, pools, maxHops) {
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
    log.info({
        routes: routes.map(routeToString),
        pools: pools.map(poolToString),
    }, `Computed ${routes.length} possible routes for type ${(_a = routes[0]) === null || _a === void 0 ? void 0 : _a.protocol}.`);
    return routes;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcHV0ZS1hbGwtcm91dGVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3JvdXRlcnMvYWxwaGEtcm91dGVyL2Z1bmN0aW9ucy9jb21wdXRlLWFsbC1yb3V0ZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxJQUFJLElBQUksTUFBTSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFHakQsT0FBTyxFQUFFLEdBQUcsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQ3hDLE9BQU8sRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDbkUsT0FBTyxFQUNMLFVBQVUsRUFFVixPQUFPLEVBQ1AsT0FBTyxFQUNQLE9BQU8sR0FDUixNQUFNLGNBQWMsQ0FBQztBQUV0QixNQUFNLFVBQVUsa0JBQWtCLENBQ2hDLE9BQWlCLEVBQ2pCLFFBQWtCLEVBQ2xCLEtBQWUsRUFDZixPQUFlO0lBRWYsMERBQTBEO0lBQzFELE9BQU8sZ0JBQWdCLENBQ3JCLE9BQU8sQ0FBQyxPQUFPLEVBQ2YsUUFBUSxDQUFDLE9BQU8sRUFDaEIsQ0FBQyxLQUFlLEVBQUUsT0FBaUIsRUFBRSxRQUFrQixFQUFFLEVBQUU7UUFDekQsT0FBTyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQy9DLENBQUMsRUFDRCxLQUFLLEVBQ0wsT0FBTyxDQUNSLENBQUM7QUFDSixDQUFDO0FBRUQsTUFBTSxVQUFVLGtCQUFrQixDQUNoQyxPQUFjLEVBQ2QsUUFBZSxFQUNmLEtBQWUsRUFDZixPQUFlO0lBRWYsT0FBTyxnQkFBZ0IsQ0FDckIsT0FBTyxFQUNQLFFBQVEsRUFDUixDQUFDLEtBQWUsRUFBRSxPQUFjLEVBQUUsUUFBZSxFQUFFLEVBQUU7UUFDbkQsT0FBTyxJQUFJLE9BQU8sQ0FB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