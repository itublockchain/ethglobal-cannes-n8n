import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { getClient } from '@reservoir0x/relay-sdk';

import {
	holesky,
	sepolia,
	abstractTestnet,
	arbitrumSepolia,
	baseSepolia,
	optimismSepolia,
	polygonAmoy,
} from 'viem/chains';

// Define available testnet chains
const SUPPORTED_CHAINS = {
	abstractTestnet, // 11124
	polygonAmoy, // 80002 (Amoy)
	arbitrumSepolia, // 421614
	baseSepolia, // 84532
	sepolia, // 11155111
	holesky, // 17000
	optimismSepolia, // 11155420
};

export class RelayGetQuote implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Relay: Get Quote',
		name: 'relayGetQuote',
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
				type: 'options',
				options: Object.entries(SUPPORTED_CHAINS).map(([key, chain]) => ({
					name: `${chain.name} (${key})`,
					value: key,
				})),
				default: 'mainnet',
				description: 'The blockchain network where the input token is located',
			},
			{
				displayName: 'Output Chain',
				name: 'outputChain',
				type: 'options',
				options: Object.entries(SUPPORTED_CHAINS).map(([key, chain]) => ({
					name: `${chain.name} (${key})`,
					value: key,
				})),
				default: 'mainnet',
				description: 'The blockchain network where you want to receive the output token',
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
				const inputCurrencyAddress = this.getNodeParameter('inputCurrencyAddress', i) as string;
				const outputCurrencyAddress = this.getNodeParameter('outputCurrencyAddress', i) as string;
				const amount = this.getNodeParameter('amount', i) as string;
				const recipientAddress = this.getNodeParameter('recipientAddress', i) as string;
				const inputChainKey = this.getNodeParameter('inputChain', i) as string;
				const outputChainKey = this.getNodeParameter('outputChain', i) as string;

				// Validate inputs
				if (!inputCurrencyAddress || !outputCurrencyAddress || !amount || !recipientAddress) {
					throw new NodeOperationError(
						this.getNode(),
						'All fields are required: inputCurrencyAddress, outputCurrencyAddress, amount, and recipientAddress',
					);
				}

				const inputChain = SUPPORTED_CHAINS[inputChainKey as keyof typeof SUPPORTED_CHAINS];
				const outputChain = SUPPORTED_CHAINS[outputChainKey as keyof typeof SUPPORTED_CHAINS];

				if (!inputChain) {
					throw new NodeOperationError(
						this.getNode(),
						`Input chain ${inputChainKey} is not supported`,
					);
				}
				if (!outputChain) {
					throw new NodeOperationError(
						this.getNode(),
						`Output chain ${outputChainKey} is not supported`,
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
