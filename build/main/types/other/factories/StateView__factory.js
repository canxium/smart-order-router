"use strict";
/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateView__factory = void 0;
const ethers_1 = require("ethers");
const _abi = [
    {
        type: "constructor",
        inputs: [
            {
                name: "_poolManager",
                type: "address",
                internalType: "contract IPoolManager",
            },
        ],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "getFeeGrowthGlobals",
        inputs: [
            {
                name: "poolId",
                type: "bytes32",
                internalType: "PoolId",
            },
        ],
        outputs: [
            {
                name: "feeGrowthGlobal0",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "feeGrowthGlobal1",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getFeeGrowthInside",
        inputs: [
            {
                name: "poolId",
                type: "bytes32",
                internalType: "PoolId",
            },
            {
                name: "tickLower",
                type: "int24",
                internalType: "int24",
            },
            {
                name: "tickUpper",
                type: "int24",
                internalType: "int24",
            },
        ],
        outputs: [
            {
                name: "feeGrowthInside0X128",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "feeGrowthInside1X128",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getLiquidity",
        inputs: [
            {
                name: "poolId",
                type: "bytes32",
                internalType: "PoolId",
            },
        ],
        outputs: [
            {
                name: "liquidity",
                type: "uint128",
                internalType: "uint128",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getPositionInfo",
        inputs: [
            {
                name: "poolId",
                type: "bytes32",
                internalType: "PoolId",
            },
            {
                name: "positionId",
                type: "bytes32",
                internalType: "bytes32",
            },
        ],
        outputs: [
            {
                name: "liquidity",
                type: "uint128",
                internalType: "uint128",
            },
            {
                name: "feeGrowthInside0LastX128",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "feeGrowthInside1LastX128",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getPositionInfo",
        inputs: [
            {
                name: "poolId",
                type: "bytes32",
                internalType: "PoolId",
            },
            {
                name: "owner",
                type: "address",
                internalType: "address",
            },
            {
                name: "tickLower",
                type: "int24",
                internalType: "int24",
            },
            {
                name: "tickUpper",
                type: "int24",
                internalType: "int24",
            },
            {
                name: "salt",
                type: "bytes32",
                internalType: "bytes32",
            },
        ],
        outputs: [
            {
                name: "liquidity",
                type: "uint128",
                internalType: "uint128",
            },
            {
                name: "feeGrowthInside0LastX128",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "feeGrowthInside1LastX128",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getPositionLiquidity",
        inputs: [
            {
                name: "poolId",
                type: "bytes32",
                internalType: "PoolId",
            },
            {
                name: "positionId",
                type: "bytes32",
                internalType: "bytes32",
            },
        ],
        outputs: [
            {
                name: "liquidity",
                type: "uint128",
                internalType: "uint128",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getSlot0",
        inputs: [
            {
                name: "poolId",
                type: "bytes32",
                internalType: "PoolId",
            },
        ],
        outputs: [
            {
                name: "sqrtPriceX96",
                type: "uint160",
                internalType: "uint160",
            },
            {
                name: "tick",
                type: "int24",
                internalType: "int24",
            },
            {
                name: "protocolFee",
                type: "uint24",
                internalType: "uint24",
            },
            {
                name: "lpFee",
                type: "uint24",
                internalType: "uint24",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getTickBitmap",
        inputs: [
            {
                name: "poolId",
                type: "bytes32",
                internalType: "PoolId",
            },
            {
                name: "tick",
                type: "int16",
                internalType: "int16",
            },
        ],
        outputs: [
            {
                name: "tickBitmap",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getTickFeeGrowthOutside",
        inputs: [
            {
                name: "poolId",
                type: "bytes32",
                internalType: "PoolId",
            },
            {
                name: "tick",
                type: "int24",
                internalType: "int24",
            },
        ],
        outputs: [
            {
                name: "feeGrowthOutside0X128",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "feeGrowthOutside1X128",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getTickInfo",
        inputs: [
            {
                name: "poolId",
                type: "bytes32",
                internalType: "PoolId",
            },
            {
                name: "tick",
                type: "int24",
                internalType: "int24",
            },
        ],
        outputs: [
            {
                name: "liquidityGross",
                type: "uint128",
                internalType: "uint128",
            },
            {
                name: "liquidityNet",
                type: "int128",
                internalType: "int128",
            },
            {
                name: "feeGrowthOutside0X128",
                type: "uint256",
                internalType: "uint256",
            },
            {
                name: "feeGrowthOutside1X128",
                type: "uint256",
                internalType: "uint256",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "getTickLiquidity",
        inputs: [
            {
                name: "poolId",
                type: "bytes32",
                internalType: "PoolId",
            },
            {
                name: "tick",
                type: "int24",
                internalType: "int24",
            },
        ],
        outputs: [
            {
                name: "liquidityGross",
                type: "uint128",
                internalType: "uint128",
            },
            {
                name: "liquidityNet",
                type: "int128",
                internalType: "int128",
            },
        ],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "poolManager",
        inputs: [],
        outputs: [
            {
                name: "",
                type: "address",
                internalType: "contract IPoolManager",
            },
        ],
        stateMutability: "view",
    },
];
class StateView__factory {
    static createInterface() {
        return new ethers_1.utils.Interface(_abi);
    }
    static connect(address, signerOrProvider) {
        return new ethers_1.Contract(address, _abi, signerOrProvider);
    }
}
exports.StateView__factory = StateView__factory;
StateView__factory.abi = _abi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3RhdGVWaWV3X19mYWN0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3R5cGVzL290aGVyL2ZhY3Rvcmllcy9TdGF0ZVZpZXdfX2ZhY3RvcnkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLCtDQUErQztBQUMvQyxvQkFBb0I7QUFDcEIsb0JBQW9COzs7QUFHcEIsbUNBQWlEO0FBR2pELE1BQU0sSUFBSSxHQUFHO0lBQ1g7UUFDRSxJQUFJLEVBQUUsYUFBYTtRQUNuQixNQUFNLEVBQUU7WUFDTjtnQkFDRSxJQUFJLEVBQUUsY0FBYztnQkFDcEIsSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsWUFBWSxFQUFFLHVCQUF1QjthQUN0QztTQUNGO1FBQ0QsZUFBZSxFQUFFLFlBQVk7S0FDOUI7SUFDRDtRQUNFLElBQUksRUFBRSxVQUFVO1FBQ2hCLElBQUksRUFBRSxxQkFBcUI7UUFDM0IsTUFBTSxFQUFFO1lBQ047Z0JBQ0UsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsWUFBWSxFQUFFLFFBQVE7YUFDdkI7U0FDRjtRQUNELE9BQU8sRUFBRTtZQUNQO2dCQUNFLElBQUksRUFBRSxrQkFBa0I7Z0JBQ3hCLElBQUksRUFBRSxTQUFTO2dCQUNmLFlBQVksRUFBRSxTQUFTO2FBQ3hCO1lBQ0Q7Z0JBQ0UsSUFBSSxFQUFFLGtCQUFrQjtnQkFDeEIsSUFBSSxFQUFFLFNBQVM7Z0JBQ2YsWUFBWSxFQUFFLFNBQVM7YUFDeEI7U0FDRjtRQUNELGVBQWUsRUFBRSxNQUFNO0tBQ3hCO0lBQ0Q7UUFDRSxJQUFJLEVBQUUsVUFBVTtRQUNoQixJQUFJLEVBQUUsb0JBQW9CO1FBQzFCLE1BQU0sRUFBRTtZQUNOO2dCQUNFLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRSxTQUFTO2dCQUNmLFlBQVksRUFBRSxRQUFRO2FBQ3ZCO1lBQ0Q7Z0JBQ0UsSUFBSSxFQUFFLFdBQVc7Z0JBQ2pCLElB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