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

export class RelayExecuteSwap implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Relay: Execute Swap',
		name: 'relayExecuteSwap',
		icon: { light: 'file:relay.svg', dark: 'file:relay.svg' },
		group: ['transform'],
		version: 1,
		description:
			'Execute cross-chain swaps using Relay Protocol. Takes a quote from Relay Get Quote and executes the actual swap transaction.',
		defaults: {
			name: 'Relay: Execute Swap',
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
			categories: ['Relay', 'Blockchain', 'DeFi', 'Execute Swap'],
			alias: ['relay', 'blockchain', 'defi', 'execute', 'swap'],
			subcategories: {
				relay: ['Relay', 'Blockchain', 'DeFi', 'Execute Swap'],
			},
		},
		properties: [
			{
				displayName: 'Quote Source',
				name: 'quoteSource',
				type: 'options',
				options: [
					{
						name: 'From Previous Node',
						value: 'previousNode',
						description: 'Use quote from the previous node output',
					},
					{
						name: 'Manual Input',
						value: 'manual',
						description: 'Manually provide the quote object',
					},
				],
				default: 'previousNode',
				description: 'Source of the quote to execute',
			},
			{
				displayName: 'Quote Data',
				name: 'quoteData',
				type: 'string',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: '{}',
				required: true,
				placeholder: 'Paste the complete quote object here',
				description: 'The complete quote object returned from Relay Get Quote',
				displayOptions: {
					show: {
						quoteSource: ['manual'],
					},
				},
			},
			{
				displayName: 'Input Chain',
				name: 'inputChain',
				type: 'number',
				default: 'sepolia',
				description: 'Source blockchain network',
			},
			{
				displayName: 'Enable Progress Tracking',
				name: 'enableProgressTracking',
				type: 'boolean',
				default: true,
				description: 'Whether to track and return progress updates during swap execution',
			},
			{
				displayName: 'Wait for Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				default: true,
				description: 'Whether to wait for the swap to complete before returning results',
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

				const quoteSource = this.getNodeParameter('quoteSource', i) as string;
				const enableProgressTracking = this.getNodeParameter(
					'enableProgressTracking',
					i,
				) as boolean;
				const waitForCompletion = this.getNodeParameter('waitForCompletion', i) as boolean;

				let quote: any;
				let inputChain: any;

				if (quoteSource === 'previousNode') {
					// Get quote from previous node's output
					quote = items[i].json;

					// Extract chain info from metadata if available
					if (quote.metadata?.inputChain) {
						const chainName = quote.metadata.inputChain;

						inputChain = Object.values(chains).find(
							(chain: Chain) => chain.name === chainName,
						) as Chain;
					}
				} else {
					// Manual input
					const quoteDataStr = this.getNodeParameter('quoteData', i) as string;

					try {
						quote = JSON.parse(quoteDataStr);
					} catch (parseError) {
						throw new NodeOperationError(
							this.getNode(),
							'Invalid JSON format in quote data. Please provide a valid quote object.',
						);
					}

					const inputChainId = this.getNodeParameter('inputChain', i) as number;
					inputChain = Object.values(chains).find(
						(chain: Chain) => chain.id === inputChainId,
					) as Chain;
				}

				if (!quote) {
					throw new NodeOperationError(
						this.getNode(),
						'No quote found. Please ensure the previous node provides a valid quote or manually input quote data.',
					);
				}

				if (!inputChain) {
					throw new NodeOperationError(
						this.getNode(),
						'Could not determine input chain. Please check your quote data or chain selection.',
					);
				}

				// Validate that we have a proper quote object
				if (!quote.steps || !Array.isArray(quote.steps)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid quote object. Quote must contain a steps array.',
					);
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

				// Track progress updates
				const progressUpdates: any[] = [];
				let finalResult: any = null;

				const executePromise = relayClient.actions.execute({
					quote,
					wallet: walletClient as any,
					onProgress: enableProgressTracking
						? (progress: any) => {
								const progressData = {
									timestamp: new Date().toISOString(),
									steps: progress.steps,
									fees: progress.fees,
									breakdown: progress.breakdown,
									txHashes: progress.txHashes,
									currentStep: progress.currentStep,
									currentStepItem: progress.currentStepItem,
									details: progress.details,
								};

								progressUpdates.push(progressData);

								// Log progress for debugging
							}
						: undefined,
				});

				if (waitForCompletion) {
					finalResult = await executePromise;
				} else {
					// Start execution but don't wait
				}

				const executionData = {
					executed: true,
					executionTimestamp: new Date().toISOString(),
					quote: quote,
					progressUpdates: progressUpdates,
					finalResult: finalResult,
					metadata: {
						enableProgressTracking,
						waitForCompletion,
						progressUpdateCount: progressUpdates.length,
						inputChain: inputChain.name,
						walletAddress: account.address,
					},
				};

				if (waitForCompletion && finalResult) {
					// Include final transaction details
					executionData.finalResult = finalResult;
				}

				returnData.push({
					json: executionData,
				});
			} catch (error) {
				if (error instanceof NodeOperationError) {
					throw error;
				}
				throw new NodeOperationError(
					this.getNode(),
					`Error executing swap for item ${i}: ${error.message}`,
				);
			}
		}

		return [returnData];
	}
}
