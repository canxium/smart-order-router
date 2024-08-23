"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenderlySimulator = exports.FallbackTenderlySimulator = exports.TENDERLY_NOT_SUPPORTED_CHAINS = void 0;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const constants_1 = require("@ethersproject/constants");
const permit2_sdk_1 = require("@uniswap/permit2-sdk");
const sdk_core_1 = require("@uniswap/sdk-core");
const universal_router_sdk_1 = require("@uniswap/universal-router-sdk");
const axios_1 = __importDefault(require("axios"));
const ethers_1 = require("ethers/lib/ethers");
const routers_1 = require("../routers");
const Erc20__factory_1 = require("../types/other/factories/Erc20__factory");
const Permit2__factory_1 = require("../types/other/factories/Permit2__factory");
const util_1 = require("../util");
const callData_1 = require("../util/callData");
const gas_factory_helpers_1 = require("../util/gas-factory-helpers");
const simulation_provider_1 = require("./simulation-provider");
var TenderlySimulationType;
(function (TenderlySimulationType) {
    TenderlySimulationType["QUICK"] = "quick";
    TenderlySimulationType["FULL"] = "full";
    TenderlySimulationType["ABI"] = "abi";
})(TenderlySimulationType || (TenderlySimulationType = {}));
const TENDERLY_BATCH_SIMULATE_API = (tenderlyBaseUrl, tenderlyUser, tenderlyProject) => `${tenderlyBaseUrl}/api/v1/account/${tenderlyUser}/project/${tenderlyProject}/simulate-batch`;
const TENDERLY_NODE_API = (chainId, tenderlyNodeApiKey) => {
    switch (chainId) {
        case sdk_core_1.ChainId.MAINNET:
            return `https://mainnet.gateway.tenderly.co/${tenderlyNodeApiKey}`;
        default:
            throw new Error(`ChainId ${chainId} does not correspond to a tenderly node endpoint`);
    }
};
exports.TENDERLY_NOT_SUPPORTED_CHAINS = [
    sdk_core_1.ChainId.CELO,
    sdk_core_1.ChainId.CELO_ALFAJORES,
    sdk_core_1.ChainId.ZKSYNC,
];
// We multiply tenderly gas limit by this to overestimate gas limit
const DEFAULT_ESTIMATE_MULTIPLIER = 1.3;
class FallbackTenderlySimulator extends simulation_provider_1.Simulator {
    constructor(chainId, provider, portionProvider, tenderlySimulator, ethEstimateGasSimulator) {
        super(provider, portionProvider, chainId);
        this.tenderlySimulator = tenderlySimulator;
        this.ethEstimateGasSimulator = ethEstimateGasSimulator;
    }
    async simulateTransaction(fromAddress, swapOptions, swapRoute, providerConfig) {
        // Make call to eth estimate gas if possible
        // For erc20s, we must check if the token allowance is sufficient
        const inputAmount = swapRoute.trade.inputAmount;
        if (inputAmount.currency.isNative ||
            (await this.checkTokenApproved(fromAddress, inputAmount, swapOptions, this.provider))) {
            util_1.log.info('Simulating with eth_estimateGas since token is native or approved.');
            try {
                const swapRouteWithGasEstimate = await this.ethEstimateGasSimulator.ethEstimateGas(fromAddress, swapOptions, swapRoute, providerConfig);
                return swapRouteWithGasEstimate;
            }
            catch (err) {
                util_1.log.info({ err: err }, 'Error simulating using eth_estimateGas');
                // If it fails, we should still try to simulate using Tenderly
                // return { ...swapRoute, simulationStatus: SimulationStatus.Failed };
            }
        }
        try {
            return await this.tenderlySimulator.simulateTransaction(fromAddress, swapOptions, swapRoute, providerConfig);
        }
        catch (err) {
            util_1.log.error({ err: err }, 'Failed to simulate via Tenderly');
            if (err instanceof Error && err.message.includes('timeout')) {
                routers_1.metric.putMetric('TenderlySimulationTimeouts', 1, routers_1.MetricLoggerUnit.Count);
            }
            return Object.assign(Object.assign({}, swapRoute), { simulationStatus: simulation_provider_1.SimulationStatus.Failed });
        }
    }
}
exports.FallbackTenderlySimulator = FallbackTenderlySimulator;
class TenderlySimulator extends simulation_provider_1.Simulator {
    constructor(chainId, tenderlyBaseUrl, tenderlyUser, tenderlyProject, tenderlyAccessKey, tenderlyNodeApiKey, v2PoolProvider, v3PoolProvider, provider, portionProvider, overrideEstimateMultiplier, tenderlyRequestTimeout, tenderlyNodeApiMigrationPercent, tenderlyNodeApiEnabledChains) {
        super(provider, portionProvider, chainId);
        this.tenderlyNodeApiEnabledChains = [];
        this.tenderlyServiceInstance = axios_1.default.create({
            // keep connections alive,
            // maxSockets default is Infinity, so Infinity is read as 50 sockets
            httpAgent: new http_1.default.Agent({ keepAlive: true }),
            httpsAgent: new https_1.default.Agent({ keepAlive: true }),
        });
        this.tenderlyBaseUrl = tenderlyBaseUrl;
        this.tenderlyUser = tenderlyUser;
        this.tenderlyProject = tenderlyProject;
        this.tenderlyAccessKey = tenderlyAccessKey;
        this.tenderlyNodeApiKey = tenderlyNodeApiKey;
        this.v2PoolProvider = v2PoolProvider;
        this.v3PoolProvider = v3PoolProvider;
        this.overrideEstimateMultiplier = overrideEstimateMultiplier !== null && overrideEstimateMultiplier !== void 0 ? overrideEstimateMultiplier : {};
        this.tenderlyRequestTimeout = tenderlyRequestTimeout;
        this.tenderlyNodeApiMigrationPercent = tenderlyNodeApiMigrationPercent;
        this.tenderlyNodeApiEnabledChains = tenderlyNodeApiEnabledChains;
    }
    async simulateTransaction(fromAddress, swapOptions, swapRoute, providerConfig) {
        var _a, _b, _c;
        const currencyIn = swapRoute.trade.inputAmount.currency;
        const tokenIn = currencyIn.wrapped;
        const chainId = this.chainId;
        if (exports.TENDERLY_NOT_SUPPORTED_CHAINS.includes(chainId)) {
            const msg = `${exports.TENDERLY_NOT_SUPPORTED_CHAINS.toString()} not supported by Tenderly!`;
            util_1.log.info(msg);
            return Object.assign(Object.assign({}, swapRoute), { simulationStatus: simulation_provider_1.SimulationStatus.NotSupported });
        }
        if (!swapRoute.methodParameters) {
            const msg = 'No calldata provided to simulate transaction';
            util_1.log.info(msg);
            throw new Error(msg);
        }
        const { calldata } = swapRoute.methodParameters;
        util_1.log.info({
            calldata: swapRoute.methodParameters.calldata,
            fromAddress: fromAddress,
            chainId: chainId,
            tokenInAddress: tokenIn.address,
            router: swapOptions.type,
        }, 'Simulating transaction on Tenderly');
        const blockNumber = await (providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.blockNumber);
        let estimatedGasUsed;
        const estimateMultiplier = (_a = this.overrideEstimateMultiplier[chainId]) !== null && _a !== void 0 ? _a : DEFAULT_ESTIMATE_MULTIPLIER;
        if (swapOptions.type == routers_1.SwapType.UNIVERSAL_ROUTER) {
            // simulating from beacon chain deposit address that should always hold **enough balance**
            if (currencyIn.isNative && this.chainId == sdk_core_1.ChainId.MAINNET) {
                fromAddress = util_1.BEACON_CHAIN_DEPOSIT_ADDRESS;
            }
            // Do initial onboarding approval of Permit2.
            const erc20Interface = Erc20__factory_1.Erc20__factory.createInterface();
            const approvePermit2Calldata = erc20Interface.encodeFunctionData('approve', [(0, permit2_sdk_1.permit2Address)(this.chainId), constants_1.MaxUint256]);
            // We are unsure if the users calldata contains a permit or not. We just
            // max approve the Universal Router from Permit2 instead, which will cover both cases.
            const permit2Interface = Permit2__factory_1.Permit2__factory.createInterface();
            const approveUniversalRouterCallData = permit2Interface.encodeFunctionData('approve', [
                tokenIn.address,
                (0, universal_router_sdk_1.UNIVERSAL_ROUTER_ADDRESS)(this.chainId),
                util_1.MAX_UINT160,
                Math.floor(new Date().getTime() / 1000) + 10000000,
            ]);
            const approvePermit2 = {
                network_id: chainId,
                estimate_gas: true,
                input: approvePermit2Calldata,
                to: tokenIn.address,
                value: '0',
                from: fromAddress,
                block_number: blockNumber,
                simulation_type: TenderlySimulationType.QUICK,
                save_if_fails: providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.saveTenderlySimulationIfFailed,
            };
            const approveUniversalRouter = {
                network_id: chainId,
                estimate_gas: true,
                input: approveUniversalRouterCallData,
                to: (0, permit2_sdk_1.permit2Address)(this.chainId),
                value: '0',
                from: fromAddress,
                block_number: blockNumber,
                simulation_type: TenderlySimulationType.QUICK,
                save_if_fails: providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.saveTenderlySimulationIfFailed,
            };
            const swap = {
                network_id: chainId,
                input: calldata,
                estimate_gas: true,
                to: (0, universal_router_sdk_1.UNIVERSAL_ROUTER_ADDRESS)(this.chainId),
                value: currencyIn.isNative ? swapRoute.methodParameters.value : '0',
                from: fromAddress,
                block_number: blockNumber,
                simulation_type: TenderlySimulationType.QUICK,
                save_if_fails: providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.saveTenderlySimulationIfFailed,
            };
            const body = {
                simulations: [approvePermit2, approveUniversalRouter, swap],
                estimate_gas: true,
            };
            const opts = {
                headers: {
                    'X-Access-Key': this.tenderlyAccessKey,
                },
                timeout: this.tenderlyRequestTimeout,
            };
            const url = TENDERLY_BATCH_SIMULATE_API(this.tenderlyBaseUrl, this.tenderlyUser, this.tenderlyProject);
            routers_1.metric.putMetric('TenderlySimulationUniversalRouterRequests', 1, routers_1.MetricLoggerUnit.Count);
            const before = Date.now();
            if (Math.random() * 100 < ((_b = this.tenderlyNodeApiMigrationPercent) !== null && _b !== void 0 ? _b : 0) &&
                ((_c = this.tenderlyNodeApiEnabledChains) !== null && _c !== void 0 ? _c : []).find((chainId) => chainId === this.chainId)) {
                const { data: resp, status: httpStatus } = await this.requestNodeSimulation(approvePermit2, approveUniversalRouter, swap);
                // We will maintain the original metrics TenderlySimulationUniversalRouterLatencies and TenderlySimulationUniversalRouterResponseStatus
                // so that they don't provide the existing tenderly dashboard as well as simulation alerts
                // In the meanwhile, we also add tenderly node metrics to distinguish from the tenderly api metrics
                // Once we migrate to node endpoint 100%, original metrics TenderlySimulationUniversalRouterLatencies and TenderlySimulationUniversalRouterResponseStatus
                // will work as is
                routers_1.metric.putMetric('TenderlySimulationUniversalRouterLatencies', Date.now() - before, routers_1.MetricLoggerUnit.Milliseconds);
                routers_1.metric.putMetric('TenderlyNodeSimulationUniversalRouterLatencies', Date.now() - before, routers_1.MetricLoggerUnit.Milliseconds);
                routers_1.metric.putMetric(`TenderlySimulationUniversalRouterResponseStatus${httpStatus}`, 1, routers_1.MetricLoggerUnit.Count);
                routers_1.metric.putMetric(`TenderlyNodeSimulationUniversalRouterResponseStatus${httpStatus}`, 1, routers_1.MetricLoggerUnit.Count);
                // Validate tenderly response body
                if (!resp ||
                    !resp.result ||
                    resp.result.length < 3 ||
                    resp.result[2].error) {
                    util_1.log.error({ resp }, `Failed to invoke Tenderly Node Endpoint for gas estimation bundle ${JSON.stringify(body, null, 2)}.`);
                    return Object.assign(Object.assign({}, swapRoute), { simulationStatus: simulation_provider_1.SimulationStatus.Failed });
                }
                // Parse the gas used in the simulation response object, and then pad it so that we overestimate.
                estimatedGasUsed = ethers_1.BigNumber.from((Number(resp.result[2].gas) * estimateMultiplier).toFixed(0));
                util_1.log.info({
                    body,
                    approvePermit2GasUsed: resp.result[0].gasUsed,
                    approveUniversalRouterGasUsed: resp.result[1].gasUsed,
                    swapGasUsed: resp.result[2].gasUsed,
                    approvePermit2Gas: resp.result[0].gas,
                    approveUniversalRouterGas: resp.result[1].gas,
                    swapGas: resp.result[2].gas,
                    swapWithMultiplier: estimatedGasUsed.toString(),
                }, 'Successfully Simulated Approvals + Swap via Tenderly node endpoint for Universal Router. Gas used.');
            }
            else {
                const { data: resp, status: httpStatus } = await this.tenderlyServiceInstance
                    .post(url, body, opts)
                    .finally(() => {
                    routers_1.metric.putMetric('TenderlySimulationLatencies', Date.now() - before, routers_1.MetricLoggerUnit.Milliseconds);
                });
                routers_1.metric.putMetric('TenderlySimulationUniversalRouterLatencies', Date.now() - before, routers_1.MetricLoggerUnit.Milliseconds);
                routers_1.metric.putMetric('TenderlyApiSimulationUniversalRouterLatencies', Date.now() - before, routers_1.MetricLoggerUnit.Milliseconds);
                routers_1.metric.putMetric(`TenderlySimulationUniversalRouterResponseStatus${httpStatus}`, 1, routers_1.MetricLoggerUnit.Count);
                routers_1.metric.putMetric(`TenderlyApiSimulationUniversalRouterResponseStatus${httpStatus}`, 1, routers_1.MetricLoggerUnit.Count);
                // Validate tenderly response body
                if (!resp ||
                    resp.simulation_results.length < 3 ||
                    !resp.simulation_results[2].transaction ||
                    resp.simulation_results[2].transaction.error_message) {
                    this.logTenderlyErrorResponse(resp);
                    return Object.assign(Object.assign({}, swapRoute), { simulationStatus: simulation_provider_1.SimulationStatus.Failed });
                }
                // Parse the gas used in the simulation response object, and then pad it so that we overestimate.
                estimatedGasUsed = ethers_1.BigNumber.from((resp.simulation_results[2].transaction.gas * estimateMultiplier).toFixed(0));
                util_1.log.info({
                    body,
                    approvePermit2GasUsed: resp.simulation_results[0].transaction.gas_used,
                    approveUniversalRouterGasUsed: resp.simulation_results[1].transaction.gas_used,
                    swapGasUsed: resp.simulation_results[2].transaction.gas_used,
                    approvePermit2Gas: resp.simulation_results[0].transaction.gas,
                    approveUniversalRouterGas: resp.simulation_results[1].transaction.gas,
                    swapGas: resp.simulation_results[2].transaction.gas,
                    swapWithMultiplier: estimatedGasUsed.toString(),
                }, 'Successfully Simulated Approvals + Swap via Tenderly Api endpoint for Universal Router. Gas used.');
                util_1.log.info({
                    body,
                    swapSimulation: resp.simulation_results[2].simulation,
                    swapTransaction: resp.simulation_results[2].transaction,
                }, 'Successful Tenderly Api endpoint Swap Simulation for Universal Router');
            }
        }
        else if (swapOptions.type == routers_1.SwapType.SWAP_ROUTER_02) {
            const approve = {
                network_id: chainId,
                input: callData_1.APPROVE_TOKEN_FOR_TRANSFER,
                estimate_gas: true,
                to: tokenIn.address,
                value: '0',
                from: fromAddress,
                simulation_type: TenderlySimulationType.QUICK,
            };
            const swap = {
                network_id: chainId,
                input: calldata,
                to: (0, util_1.SWAP_ROUTER_02_ADDRESSES)(chainId),
                estimate_gas: true,
                value: currencyIn.isNative ? swapRoute.methodParameters.value : '0',
                from: fromAddress,
                block_number: blockNumber,
                simulation_type: TenderlySimulationType.QUICK,
            };
            const body = { simulations: [approve, swap] };
            const opts = {
                headers: {
                    'X-Access-Key': this.tenderlyAccessKey,
                },
                timeout: this.tenderlyRequestTimeout,
            };
            const url = TENDERLY_BATCH_SIMULATE_API(this.tenderlyBaseUrl, this.tenderlyUser, this.tenderlyProject);
            routers_1.metric.putMetric('TenderlySimulationSwapRouter02Requests', 1, routers_1.MetricLoggerUnit.Count);
            const before = Date.now();
            const { data: resp, status: httpStatus } = await this.tenderlyServiceInstance.post(url, body, opts);
            routers_1.metric.putMetric(`TenderlySimulationSwapRouter02ResponseStatus${httpStatus}`, 1, routers_1.MetricLoggerUnit.Count);
            const latencies = Date.now() - before;
            util_1.log.info(`Tenderly simulation swap router02 request body: ${body}, having latencies ${latencies} in milliseconds.`);
            routers_1.metric.putMetric('TenderlySimulationSwapRouter02Latencies', latencies, routers_1.MetricLoggerUnit.Milliseconds);
            // Validate tenderly response body
            if (!resp ||
                resp.simulation_results.length < 2 ||
                !resp.simulation_results[1].transaction ||
                resp.simulation_results[1].transaction.error_message) {
                const msg = `Failed to Simulate Via Tenderly!: ${resp.simulation_results[1].transaction.error_message}`;
                util_1.log.info({ err: resp.simulation_results[1].transaction.error_message }, msg);
                return Object.assign(Object.assign({}, swapRoute), { simulationStatus: simulation_provider_1.SimulationStatus.Failed });
            }
            // Parse the gas used in the simulation response object, and then pad it so that we overestimate.
            estimatedGasUsed = ethers_1.BigNumber.from((resp.simulation_results[1].transaction.gas * estimateMultiplier).toFixed(0));
            util_1.log.info({
                body,
                approveGasUsed: resp.simulation_results[0].transaction.gas_used,
                swapGasUsed: resp.simulation_results[1].transaction.gas_used,
                approveGas: resp.simulation_results[0].transaction.gas,
                swapGas: resp.simulation_results[1].transaction.gas,
                swapWithMultiplier: estimatedGasUsed.toString(),
            }, 'Successfully Simulated Approval + Swap via Tenderly for SwapRouter02. Gas used.');
            util_1.log.info({
                body,
                swapTransaction: resp.simulation_results[1].transaction,
                swapSimulation: resp.simulation_results[1].simulation,
            }, 'Successful Tenderly Swap Simulation for SwapRouter02');
        }
        else {
            throw new Error(`Unsupported swap type: ${swapOptions}`);
        }
        const { estimatedGasUsedUSD, estimatedGasUsedQuoteToken, estimatedGasUsedGasToken, quoteGasAdjusted, } = await (0, gas_factory_helpers_1.calculateGasUsed)(chainId, swapRoute, estimatedGasUsed, this.v2PoolProvider, this.v3PoolProvider, this.provider, providerConfig);
        return Object.assign(Object.assign({}, (0, gas_factory_helpers_1.initSwapRouteFromExisting)(swapRoute, this.v2PoolProvider, this.v3PoolProvider, this.portionProvider, quoteGasAdjusted, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, swapOptions, estimatedGasUsedGasToken, providerConfig)), { simulationStatus: simulation_provider_1.SimulationStatus.Succeeded });
    }
    logTenderlyErrorResponse(resp) {
        util_1.log.info({
            resp,
        }, 'Failed to Simulate on Tenderly');
        util_1.log.info({
            err: resp.simulation_results.length >= 1
                ? resp.simulation_results[0].transaction
                : {},
        }, 'Failed to Simulate on Tenderly #1 Transaction');
        util_1.log.info({
            err: resp.simulation_results.length >= 1
                ? resp.simulation_results[0].simulation
                : {},
        }, 'Failed to Simulate on Tenderly #1 Simulation');
        util_1.log.info({
            err: resp.simulation_results.length >= 2
                ? resp.simulation_results[1].transaction
                : {},
        }, 'Failed to Simulate on Tenderly #2 Transaction');
        util_1.log.info({
            err: resp.simulation_results.length >= 2
                ? resp.simulation_results[1].simulation
                : {},
        }, 'Failed to Simulate on Tenderly #2 Simulation');
        util_1.log.info({
            err: resp.simulation_results.length >= 3
                ? resp.simulation_results[2].transaction
                : {},
        }, 'Failed to Simulate on Tenderly #3 Transaction');
        util_1.log.info({
            err: resp.simulation_results.length >= 3
                ? resp.simulation_results[2].simulation
                : {},
        }, 'Failed to Simulate on Tenderly #3 Simulation');
    }
    async requestNodeSimulation(approvePermit2, approveUniversalRouter, swap) {
        const nodeEndpoint = TENDERLY_NODE_API(this.chainId, this.tenderlyNodeApiKey);
        const blockNumber = swap.block_number
            ? ethers_1.BigNumber.from(swap.block_number).toHexString().replace('0x0', '0x')
            : 'latest';
        const body = {
            id: 1,
            jsonrpc: '2.0',
            method: 'tenderly_estimateGasBundle',
            params: [
                [
                    {
                        from: approvePermit2.from,
                        to: approvePermit2.to,
                        data: approvePermit2.input,
                    },
                    {
                        from: approveUniversalRouter.from,
                        to: approveUniversalRouter.to,
                        data: approveUniversalRouter.input,
                    },
                    { from: swap.from, to: swap.to, data: swap.input },
                ],
                blockNumber,
            ],
        };
        const opts = {
            timeout: this.tenderlyRequestTimeout,
        };
        const before = Date.now();
        try {
            // For now, we don't timeout tenderly node endpoint, but we should before we live switch to node endpoint
            const { data: resp, status: httpStatus } = await this.tenderlyServiceInstance.post(nodeEndpoint, body, opts);
            const latencies = Date.now() - before;
            routers_1.metric.putMetric('TenderlyNodeGasEstimateBundleLatencies', latencies, routers_1.MetricLoggerUnit.Milliseconds);
            routers_1.metric.putMetric('TenderlyNodeGasEstimateBundleSuccess', 1, routers_1.MetricLoggerUnit.Count);
            if (httpStatus !== 200) {
                util_1.log.error(`Failed to invoke Tenderly Node Endpoint for gas estimation bundle ${JSON.stringify(body, null, 2)}. HTTP Status: ${httpStatus}`, { resp });
                return { data: resp, status: httpStatus };
            }
            return { data: resp, status: httpStatus };
        }
        catch (err) {
            util_1.log.error({ err }, `Failed to invoke Tenderly Node Endpoint for gas estimation bundle ${JSON.stringify(body, null, 2)}. Error: ${err}`);
            routers_1.metric.putMetric('TenderlyNodeGasEstimateBundleFailure', 1, routers_1.MetricLoggerUnit.Count);
            // we will have to re-throw the error, so that simulation-provider can catch the error, and return simulation status = failed
            throw err;
        }
    }
}
exports.TenderlySimulator = TenderlySimulator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVuZGVybHktc2ltdWxhdGlvbi1wcm92aWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9wcm92aWRlcnMvdGVuZGVybHktc2ltdWxhdGlvbi1wcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxnREFBd0I7QUFDeEIsa0RBQTBCO0FBRTFCLHdEQUFzRDtBQUV0RCxzREFBc0Q7QUFDdEQsZ0RBQTRDO0FBQzVDLHdFQUF5RTtBQUN6RSxrREFBa0Q7QUFDbEQsOENBQThDO0FBRTlDLHdDQU9vQjtBQUNwQiw0RUFBeUU7QUFDekUsZ0ZBQTZFO0FBQzdFLGtDQUtpQjtBQUNqQiwrQ0FBOEQ7QUFDOUQscUVBR3FDO0FBSXJDLCtEQUkrQjtBQTBDL0IsSUFBSyxzQkFJSjtBQUpELFdBQUssc0JBQXNCO0lBQ3pCLHlDQUFlLENBQUE7SUFDZix1Q0FBYSxDQUFBO0lBQ2IscUNBQVcsQ0FBQTtBQUNiLENBQUMsRUFKSSxzQkFBc0IsS0FBdEIsc0JBQXNCLFFBSTFCO0FBeUNELE1BQU0sMkJBQTJCLEdBQUcsQ0FDbEMsZUFBdUIsRUFDdkIsWUFBb0IsRUFDcEIsZUFBdUIsRUFDdkIsRUFBRSxDQUNGLEdBQUcsZUFBZSxtQkFBbUIsWUFBWSxZQUFZLGVBQWUsaUJBQWlCLENBQUM7QUFFaEcsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLE9BQWdCLEVBQUUsa0JBQTBCLEVBQUUsRUFBRTtJQUN6RSxRQUFRLE9BQU8sRUFBRTtRQUNmLEtBQUssa0JBQU8sQ0FBQyxPQUFPO1lBQ2xCLE9BQU8sdUNBQXVDLGtCQUFrQixFQUFFLENBQUM7UUFDckU7WUFDRSxNQUFNLElBQUksS0FBSyxDQUNiLFdBQVcsT0FBTyxrREFBa0QsQ0FDckUsQ0FBQztLQUNMO0FBQ0gsQ0FBQyxDQUFDO0FBRVcsUUFBQSw2QkFBNkIsR0FBRztJQUMzQyxrQkFBTyxDQUFDLElBQUk7SUFDWixrQkFBTyxDQUFDLGNBQWM7SUFDdEIsa0JBQU8s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