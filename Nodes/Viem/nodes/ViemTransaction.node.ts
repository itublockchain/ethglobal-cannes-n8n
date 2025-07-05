import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, createWalletClient, http, Chain } from 'viem';
import * as chains from 'viem/chains';

export class ViemTransaction implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Viem: Transaction',
		name: 'viemTransaction',
		group: ['transform'],
		version: 1,
		description: 'This node allows you to send a transaction to a blockchain.',
		defaults: {
			name: 'Viem: Transaction',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'viemCredentials',
				required: true,
			},
		],
		usableAsTool: true,
		codex: {
			categories: ['Viem', 'Blockchain', 'Transaction', 'Wallet'],
			alias: ['viem', 'blockchain', 'transaction', 'wallet'],
			subcategories: {
				viem: ['Viem', 'Blockchain', 'Transaction', 'Wallet'],
			},
		},
		properties: [
			{
				displayName: 'Chain',
				name: 'chain',
				type: 'string',
				default: 'Sepolia',
			},
			{
				displayName: 'Recipient Address',
				name: 'recipientAddress',
				type: 'string',
				default: '',
				required: true,
				description: 'Ethereum address of the recipient',
			},
			{
				displayName: 'Value',
				name: 'value',
				type: 'number',
				default: 0,
				required: true,
				description: 'Value in ETH',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('viemCredentials');
		const privateKey = credentials.privateKey;

		const account = privateKeyToAccount(privateKey as `0x${string}`);

		for (let i = 0; i < items.length; i++) {
			const to = this.getNodeParameter('recipientAddress', i) as string;
			const value = this.getNodeParameter('value', i) as number;

			const chainName = this.getNodeParameter('chain', i);

			const chain = Object.values(chains).find((c: Chain) => c.name === chainName) as Chain;

			if (!chain) {
				throw new Error(`Chain ${chainName} not found`);
			}

			const publicClient = createPublicClient({
				chain,
				transport: http(chain.rpcUrls.default.http[0]),
			});

			const walletClient = createWalletClient({
				account,
				chain,
				transport: http(chain.rpcUrls.default.http[0]),
			});

			const tx = await walletClient.sendTransaction({
				account,
				to: to as `0x${string}`,
				value: BigInt(value * 10 ** 18),
				chain,
			});

			const receipt = await publicClient.waitForTransactionReceipt({
				hash: tx as `0x${string}`,
			});

			returnData.push({
				json: {
					tx,
					receipt,
					txHash: receipt.transactionHash,
					chain,
				},
			});
		}

		return [returnData];
	}
}
