import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeParameterValue,
} from 'n8n-workflow';

import { privateKeyToAccount } from 'viem/accounts';
import { Chain, createPublicClient, createWalletClient, erc20Abi, http } from 'viem';
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
				type: 'json',
				default: chains.sepolia as unknown as NodeParameterValue,
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
			{
				displayName: 'Choose Token or Native Currency',
				name: 'tokenOrNative',
				type: 'options',
				options: [
					{ name: 'Token', value: 'token' },
					{ name: 'Native Currency', value: 'native' },
				],
				default: 'native',
				required: true,
			},
			{
				displayName: 'ERC20 Token Address (Optional)',
				name: 'tokenAddress',
				type: 'string',
				default: '',
				required: false,
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
			const tokenOrNative = this.getNodeParameter('tokenOrNative', i) as string;
			const tokenAddress = this.getNodeParameter('tokenAddress', i) as string;

			const chain = this.getNodeParameter('chain', i) as Chain;

			const publicClient = createPublicClient({
				chain,
				transport: http(chain.rpcUrls.default.http[0]),
			});

			const walletClient = createWalletClient({
				account,
				chain,
				transport: http(chain.rpcUrls.default.http[0]),
			});

			switch (tokenOrNative) {
				case 'token':
					const balance = await publicClient.readContract({
						address: tokenAddress as `0x${string}`,
						abi: erc20Abi,
						functionName: 'balanceOf',
						args: [account.address],
					});

					if (balance < BigInt(value * 10 ** 18)) {
						throw new Error('Insufficient balance');
					}

					const tx1 = await walletClient.writeContract({
						abi: erc20Abi,
						address: tokenAddress as `0x${string}`,
						functionName: 'transfer',
						args: [to as `0x${string}`, BigInt(value * 10 ** 18)],
					});

					const receipt1 = await publicClient.waitForTransactionReceipt({
						hash: tx1 as `0x${string}`,
					});

					returnData.push({
						json: {
							tx: tx1,
							receipt: receipt1,
							txHash: receipt1.transactionHash,
						},
					});
					break;
				case 'native':
					const tx2 = await walletClient.sendTransaction({
						account,
						to: to as `0x${string}`,
						value: BigInt(value * 10 ** 18),
					});

					const receipt2 = await publicClient.waitForTransactionReceipt({
						hash: tx2 as `0x${string}`,
					});

					returnData.push({
						json: {
							tx: tx2,
							receipt: receipt2,
							txHash: receipt2.transactionHash,
							chain,
						},
					});
					break;
			}
		}

		return [returnData];
	}
}
