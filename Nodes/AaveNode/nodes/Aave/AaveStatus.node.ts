import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { ethers } from 'ethers';
import { UiPoolDataProvider, ChainId } from '@aave/contract-helpers';
import * as markets from '@bgd-labs/aave-address-book';
import dayjs from 'dayjs';
import { formatReserves, formatUserSummary } from '@aave/math-utils';

// Network configuration using official Aave Address Book
const CHAIN_CONFIG = {
	'ethereum-sepolia': {
		chainId: ChainId.sepolia,
		rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com', // Using single primary RPC
		market: markets.AaveV3Sepolia,
		name: 'Ethereum Sepolia',
	},
	'arbitrum-sepolia': {
		chainId: ChainId.arbitrum_sepolia,
		rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
		market: markets.AaveV3ArbitrumSepolia,
		name: 'Arbitrum Sepolia',
	},

	'optimism-sepolia': {
		chainId: ChainId.optimism_sepolia,
		rpcUrl: 'https://sepolia.optimism.io',
		market: markets.AaveV3OptimismSepolia,
		name: 'Optimism Sepolia',
	},
	'base-sepolia': {
		chainId: ChainId.base_sepolia,
		rpcUrl: 'https://sepolia.base.org',
		market: markets.AaveV3BaseSepolia,
		name: 'Base Sepolia',
	},
};

export class AaveStatus implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Aave V3 Risk Status',
		name: 'aaveV3RiskStatus',
		group: ['transform'],
		version: 1,
		description: 'Get user health factor from Aave V3 protocol',
		defaults: {
			name: 'Aave V3 Risk Status',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'aaveCredentials',
				required: false,
			},
		],
		properties: [
			{
				displayName: 'Network',
				name: 'network',
				type: 'options',
				options: [
					{ name: 'Ethereum Sepolia (Testnet)', value: 'ethereum-sepolia' },
					{ name: 'Arbitrum Sepolia (Testnet)', value: 'arbitrum-sepolia' },
					{ name: 'Avalanche Fuji (Testnet)', value: 'avalanche-fuji' },
					{ name: 'Optimism Sepolia (Testnet)', value: 'optimism-sepolia' },
					{ name: 'Base Sepolia (Testnet)', value: 'base-sepolia' },
					{ name: 'Ethereum Mainnet', value: 'ethereum-mainnet' },
					{ name: 'Polygon Mainnet', value: 'polygon-mainnet' },
					{ name: 'Arbitrum One', value: 'arbitrum-mainnet' },
					{ name: 'Avalanche', value: 'avalanche-mainnet' },
					{ name: 'Optimism', value: 'optimism-mainnet' },
					{ name: 'Base', value: 'base-mainnet' },
				],
				default: 'ethereum-sepolia',
				description: 'Select the network to query',
			},
			{
				displayName: 'User Address',
				name: 'userAddress',
				type: 'string',
				default: '',
				required: true,
				description: 'User address to check health factor for',
				placeholder: '0x...',
			},
			{
				displayName: 'Custom RPC URL (Optional)',
				name: 'customRpcUrl',
				type: 'string',
				default: '',
				description: 'Optional custom RPC URL to override default',
			},
			{
				displayName: 'Timeout (ms)',
				name: 'timeout',
				type: 'number',
				default: 15000,
				description: 'Request timeout in milliseconds',
			},
		],
	};

	// Risk assessment helper
	private static getRiskStatus(healthFactor: number) {
		if (healthFactor === -1)
			return {
				level: 'NO_DEBT',
				description: 'No borrowed assets',
			};
		if (healthFactor < 1)
			return {
				level: 'LIQUIDATED',
				description: 'Position can be liquidated',
			};
		if (healthFactor < 1.05)
			return {
				level: 'CRITICAL',
				description: 'Very high liquidation risk',
			};
		if (healthFactor < 1.2)
			return {
				level: 'HIGH',
				description: 'High liquidation risk',
			};
		if (healthFactor < 1.5)
			return {
				level: 'MEDIUM',
				description: 'Medium liquidation risk',
			};
		if (healthFactor < 2)
			return {
				level: 'LOW',
				description: 'Low liquidation risk',
			};
		return {
			level: 'SAFE',
			description: 'Very safe position',
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const networkKey = this.getNodeParameter('network', i) as string;
				const userAddress = this.getNodeParameter('userAddress', i) as string;
				const customRpcUrl = this.getNodeParameter('customRpcUrl', i, '') as string;
				const timeout = this.getNodeParameter('timeout', i, 15000) as number;

				if (!ethers.utils.isAddress(userAddress)) {
					throw new NodeOperationError(this.getNode(), `Invalid user address: ${userAddress}`);
				}

				const chainConfig = CHAIN_CONFIG[networkKey as keyof typeof CHAIN_CONFIG];
				if (!chainConfig) {
					throw new NodeOperationError(this.getNode(), `Unsupported network: ${networkKey}`);
				}

				// Use custom RPC or fallback to default, without explicit retry logic
				const rpcToUse = customRpcUrl || chainConfig.rpcUrl;
				const provider = new ethers.providers.JsonRpcProvider({
					url: rpcToUse,
					timeout: timeout,
				});

				// Validate chain ID - no retry here, if it fails, it fails
				const network = await provider.getNetwork();
				if (network.chainId !== chainConfig.chainId) {
					throw new NodeOperationError(
						this.getNode(),
						`Chain ID mismatch for ${rpcToUse}. Expected ${chainConfig.chainId}, got ${network.chainId}`,
					);
				}

				const poolDataProviderContract = new UiPoolDataProvider({
					uiPoolDataProviderAddress: chainConfig.market.UI_POOL_DATA_PROVIDER,
					provider,
					chainId: chainConfig.chainId,
				});

				// Object containing array or users aave positions and active eMode category
				// { userReserves, userEmodeCategoryId }
				const userReserves = await poolDataProviderContract.getUserReservesHumanized({
					lendingPoolAddressProvider: chainConfig.market.POOL_ADDRESSES_PROVIDER,
					user: userAddress,
				});

				const reserves = await poolDataProviderContract.getReservesHumanized({
					lendingPoolAddressProvider: chainConfig.market.POOL_ADDRESSES_PROVIDER,
				});

				const reservesArray = reserves.reservesData;
				const baseCurrencyData = reserves.baseCurrencyData;
				const userReservesArray = userReserves.userReserves;
				const currentTimestamp = dayjs().unix();

				const formattedReserves = formatReserves({
					reserves: reservesArray,
					currentTimestamp,
					marketReferenceCurrencyDecimals: baseCurrencyData.marketReferenceCurrencyDecimals,
					marketReferencePriceInUsd: baseCurrencyData.marketReferenceCurrencyPriceInUsd,
				});

				const userSummary = formatUserSummary({
					currentTimestamp,
					marketReferencePriceInUsd: baseCurrencyData.marketReferenceCurrencyPriceInUsd,
					marketReferenceCurrencyDecimals: baseCurrencyData.marketReferenceCurrencyDecimals,
					userReserves: userReservesArray,
					formattedReserves,
					userEmodeCategoryId: userReserves.userEmodeCategoryId,
				});

				const result: Record<string, any> = {
					success: true,
					network: chainConfig.name,
					userAddress,
					healthFactor: userSummary.healthFactor,
					riskStatus: AaveStatus.getRiskStatus(parseFloat(userSummary.healthFactor)),
				};

				returnData.push({ json: result });
			} catch (error: any) {
				returnData.push({
					json: {
						success: false,
						error: error.message || 'Unknown error',
						network: this.getNodeParameter('network', i),
						userAddress: this.getNodeParameter('userAddress', i),
					},
				});
			}
		}
		return [returnData];
	}
}
