import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { privateKeyToAccount } from 'viem/accounts';
import { Chain, createWalletClient, http } from 'viem';
import { createClient, getClient } from '@reservoir0x/relay-sdk';
import * as chains from 'viem/chains';

export class RelayCompleteSwap implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Relay: Complete Swap',
		name: 'relayCompleteSwap',
		icon: { light: 'file:relay.svg', dark: 'file:relay.svg' },
		group: ['transform'],
		version: 1,
		description: 'Complete cross-chain swap using Relay Protocol',
		defaults: {
			name: 'Relay: Complete Swap',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'relayCredentials',
				required: true,
			},
		],
		codex: {
			categories: ['Relay', 'Blockchain', 'DeFi', 'Complete Swap'],
			alias: ['relay', 'blockchain', 'defi', 'complete', 'swap'],
			subcategories: {
				relay: ['Relay', 'Blockchain', 'DeFi', 'Complete Swap'],
			},
		},
		properties: [
			{
				displayName: 'Input Chain',
				name: 'inputChain',
				type: 'number',
				default: 'sepolia',
				description: 'Source blockchain network',
			},
			{
				displayName: 'Output Chain',
				name: 'outputChain',
				type: 'number',
				default: 'polygonAmoy',
				description: 'Destination blockchain network',
			},
			{
				displayName: 'Input Token Address',
				name: 'inputToken',
				type: 'string',
				default: '0x0000000000000000000000000000000000000000',
				required: true,
				description: 'Token contract address (use 0x0000... for native token)',
			},
			{
				displayName: 'Output Token Address',
				name: 'outputToken',
				type: 'string',
				default: '0x0000000000000000000000000000000000000000',
				required: true,
				description: 'Desired token contract address (use 0x0000... for native token)',
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				default: '1000000000000000000',
				required: true,
				description: 'Amount in smallest unit (wei for ETH)',
			},
			{
				displayName: 'Recipient Address',
				name: 'recipient',
				type: 'string',
				default: '',
				description: 'Recipient address (optional, defaults to wallet address)',
			},
			{
				displayName: 'Max Slippage (%)',
				name: 'slippage',
				type: 'number',
				default: 3,
				description: 'Maximum slippage percentage',
			},
			{
				displayName: 'Is Testnet',
				name: 'isTestnet',
				type: 'boolean',
				default: true,
				required: false,
				description: 'Is the network testnet',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Get credentials
		const credentials = await this.getCredentials('relayCredentials');
		const privateKey = credentials.privateKey as string;

		if (!privateKey?.startsWith('0x')) {
			throw new NodeOperationError(this.getNode(), 'Invalid private key format');
		}

		const account = privateKeyToAccount(privateKey as `0x${string}`);

		for (let i = 0; i < items.length; i++) {
			try {
				const isTestnet = this.getNodeParameter('isTestnet', i) as boolean;
				const api = isTestnet ? "'https://api.testnet.relay.link'" : "'https://api.relay.link'";

				// Get parameters
				const inputChainId = this.getNodeParameter('inputChain', i) as number;
				const outputChainId = this.getNodeParameter('outputChain', i) as number;
				const inputChain = Object.values(chains).find(
					(chain: Chain) => chain.id === inputChainId,
				) as Chain;
				const outputChain = Object.values(chains).find(
					(chain: Chain) => chain.id === outputChainId,
				) as Chain;
				const inputToken = this.getNodeParameter('inputToken', i) as string;
				const outputToken = this.getNodeParameter('outputToken', i) as string;
				const amount = this.getNodeParameter('amount', i) as string;
				const recipient = (this.getNodeParameter('recipient', i) as string) || account.address;
				const slippage = this.getNodeParameter('slippage', i) as number;

				// Validate inputs
				if (!inputToken || !outputToken || !amount) {
					throw new NodeOperationError(this.getNode(), 'Missing required parameters');
				}

				if (!inputChain || !outputChain) {
					throw new NodeOperationError(this.getNode(), 'Invalid chain selection');
				}

				// Create wallet client with explicit type casting to resolve viem conflicts
				const walletClient = createWalletClient({
					account,
					chain: inputChain,
					transport: http(),
				});

				// Initialize Relay client
				createClient({
					baseApiUrl: api,
				});

				const relayClient = getClient();
				if (!relayClient) {
					throw new NodeOperationError(this.getNode(), 'Failed to initialize Relay client');
				}

				// Get quote with proper type handling
				const quote = await relayClient.actions.getQuote({
					chainId: inputChain.id,
					toChainId: outputChain.id,
					currency: inputToken,
					toCurrency: outputToken,
					amount: amount,
					wallet: walletClient as any, // Type assertion to bypass version conflicts
					tradeType: 'EXACT_INPUT' as any,
					user: account.address,
					recipient: recipient,
				});

				if (!quote) {
					throw new NodeOperationError(this.getNode(), 'Failed to get quote');
				}

				const result: any = {
					success: true,
					quote,
					parameters: {
						inputChain: inputChain.name,
						outputChain: outputChain.name,
						inputToken,
						outputToken,
						amount,
						recipient,
						slippage: `${slippage}%`,
					},
					timestamp: new Date().toISOString(),
				};

				try {
					const execution = await relayClient.actions.execute({
						quote,
						wallet: walletClient as any, // Type assertion to bypass conflicts
					});

					result.execution = {
						success: true,
						result: execution,
					};
				} catch (executionError: any) {
					result.execution = {
						success: false,
						error: executionError.message,
					};
				}

				returnData.push({ json: result });
			} catch (error: any) {
				throw new NodeOperationError(
					this.getNode(),
					`Error processing item ${i}: ${error.message}`,
				);
			}
		}

		return [returnData];
	}
}
