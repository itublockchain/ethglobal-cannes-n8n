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

export class RelayGetQuote implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Relay: Get Quote',
		name: 'relayGetQuote',
		icon: { light: 'file:relay.svg', dark: 'file:relay.svg' },
		group: ['transform'],
		version: 1,
		description:
			'Get cross-chain swap quotes using Relay Protocol. Relay enables instant, gas-free bridging and swapping across multiple blockchains.',
		defaults: {
			name: 'Relay: Get Quote',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'relayCredentials',
				required: true,
			},
		],
		usableAsTool: true,
		codex: {
			categories: ['Relay', 'Blockchain', 'DeFi', 'Get Quote'],
			alias: ['relay', 'blockchain', 'defi', 'get', 'quote'],
			subcategories: {
				relay: ['Relay', 'Blockchain', 'DeFi', 'Get Quote'],
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
				displayName: 'Input Currency Address',
				name: 'inputCurrencyAddress',
				type: 'string',
				default: '',
				required: true,
				placeholder: '0x...',
				description:
					'Contract address of the token you want to swap from. Use the zero address (0x0000000000000000000000000000000000000000) for native tokens like ETH.',
			},
			{
				displayName: 'Output Currency Address',
				name: 'outputCurrencyAddress',
				type: 'string',
				default: '',
				required: true,
				placeholder: '0x...',
				description:
					'Contract address of the token you want to swap to. Use the zero address (0x0000000000000000000000000000000000000000) for native tokens like ETH.',
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				default: '0',
				required: true,
				placeholder: '1000000000000000000',
				description:
					'Amount to swap in the smallest unit of the input token (wei for ETH). For example, 1 ETH = 1000000000000000000 wei.',
			},
			{
				displayName: 'Recipient Address',
				name: 'recipientAddress',
				type: 'string',
				default: '',
				required: true,
				placeholder: '0x...',
				description: 'Wallet address that will receive the output tokens after the swap',
			},
			{
				displayName: 'Is Testnet',
				name: 'isTestnet',
				type: 'boolean',
				default: '',
				required: false,
				description: 'Is the network testnet',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		let credentials;
		try {
			credentials = await this.getCredentials('relayCredentials');
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				'Failed to get credentials. Please ensure relayCredentials are properly configured.',
			);
		}

		const privateKey = credentials.privateKey as string;

		if (!privateKey || !privateKey.startsWith('0x')) {
			throw new NodeOperationError(
				this.getNode(),
				'Invalid private key format. Private key must start with 0x.',
			);
		}

		const account = privateKeyToAccount(privateKey as `0x${string}`);

		for (let i = 0; i < items.length; i++) {
			try {
				const isTestnet = this.getNodeParameter('isTestnet', i) as boolean;
				const api = isTestnet ? "'https://api.testnet.relay.link'" : "'https://api.relay.link'";

				const inputCurrencyAddress = this.getNodeParameter('inputCurrencyAddress', i) as string;
				const outputCurrencyAddress = this.getNodeParameter('outputCurrencyAddress', i) as string;
				const amount = this.getNodeParameter('amount', i) as string;
				const recipientAddress = this.getNodeParameter('recipientAddress', i) as string;
				const inputChainId = this.getNodeParameter('inputChain', i) as number;
				const outputChainId = this.getNodeParameter('outputChain', i) as number;
				const inputChain = Object.values(chains).find(
					(chain: Chain) => chain.id === inputChainId,
				) as Chain;
				const outputChain = Object.values(chains).find(
					(chain: Chain) => chain.id === outputChainId,
				) as Chain;

				// Validate inputs
				if (!inputCurrencyAddress || !outputCurrencyAddress || !amount || !recipientAddress) {
					throw new NodeOperationError(
						this.getNode(),
						'All fields are required: inputCurrencyAddress, outputCurrencyAddress, amount, and recipientAddress',
					);
				}

				if (!inputChain) {
					throw new NodeOperationError(
						this.getNode(),
						`Input chain ${inputChainId} is not supported`,
					);
				}
				if (!outputChain) {
					throw new NodeOperationError(
						this.getNode(),
						`Output chain ${outputChainId} is not supported`,
					);
				}

				// Validate amount is a valid number
				if (isNaN(Number(amount)) || Number(amount) <= 0) {
					throw new NodeOperationError(this.getNode(), 'Amount must be a valid positive number');
				}

				const walletClient = createWalletClient({
					account,
					chain: inputChain,
					transport: http(inputChain.rpcUrls.default.http[0]),
				});

				createClient({
					baseApiUrl: api,
				});
				const relayClient = getClient();
				if (!relayClient) {
					throw new NodeOperationError(this.getNode(), 'Failed to initialize Relay client');
				}

				const quote = await relayClient.actions.getQuote({
					chainId: inputChain.id,
					toChainId: outputChain.id,
					currency: inputCurrencyAddress,
					toCurrency: outputCurrencyAddress,
					amount: amount,
					wallet: walletClient as any,
					tradeType: 'EXACT_INPUT',
					user: account.address,
					recipient: recipientAddress,
				});

				if (!quote) {
					throw new NodeOperationError(this.getNode(), 'Failed to get quote from Relay');
				}

				returnData.push({
					json: {
						...quote,
						metadata: {
							inputChain: inputChain.name,
							outputChain: outputChain.name,
							inputCurrencyAddress,
							outputCurrencyAddress,
							amount,
							recipientAddress,
							timestamp: new Date().toISOString(),
						},
					},
				});
			} catch (error) {
				if (error instanceof NodeOperationError) {
					throw error;
				}
				throw new NodeOperationError(
					this.getNode(),
					`Error processing item ${i}: ${error.message}`,
				);
			}
		}

		return [returnData];
	}
}
