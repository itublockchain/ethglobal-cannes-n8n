import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import { privateKeyToAccount } from 'viem/accounts';
import { Abi, createPublicClient, createWalletClient, http } from 'viem';
import * as chains from 'viem/chains';

export class ViemContract implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Viem: Contract',
		name: 'viemContract',
		icon: { light: 'file:viem.svg', dark: 'file:viem.svg' },
		group: ['transform'],
		version: 1,
		description: 'This node allows you to interact with a contract on a blockchain.',
		defaults: {
			name: 'Viem: Contract',
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
			categories: ['Viem', 'Blockchain', 'Contract'],
			alias: ['viem', 'blockchain', 'contract'],
			subcategories: {
				viem: ['Viem', 'Blockchain', 'Contract'],
			},
		},
		properties: [
			{
				displayName: 'Chain ID',
				name: 'chainID',
				type: 'number',
				default: 11155111,
			},
			{
				displayName: 'Contract Address',
				name: 'contractAddress',
				type: 'string',
				default: '',
				required: true,
				description: 'Ethereum address of the contract',
			},
			{
				displayName: 'ABI',
				name: 'abi',
				type: 'json',
				default: [],
				required: true,
			},
			{
				displayName: 'Function Name',
				name: 'functionName',
				type: 'string',
				default: '',
				required: true,
			},
			{
				displayName: 'Contract Type (read/write)',
				name: 'contractType',
				type: 'string',
				default: 'read',
				required: true,
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
			const contractType = this.getNodeParameter('contractType', i) as string;

			const contractAddress = this.getNodeParameter('contractAddress', i) as string;
			const abiJSON = this.getNodeParameter('abi', i);
			const abi = JSON.parse(abiJSON as string) as Abi;

			const functionName = this.getNodeParameter('functionName', i) as string;

			const chainID = this.getNodeParameter('chainID', i) as number;
			const chain = Object.values(chains).find((chain) => chain.id === chainID);

			if (!chain) {
				throw new Error('Chain not found');
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

			switch (contractType) {
				case 'write':
					const { request } = await publicClient.simulateContract({
						account,
						address: contractAddress as `0x${string}`,
						abi,
						functionName,
					});

					const tx = await walletClient.writeContract(request);

					returnData.push({
						json: {
							address: contractAddress as `0x${string}`,
							data: tx,
						},
					});
					break;
				case 'read':
					const data = await publicClient.readContract({
						address: contractAddress as `0x${string}`,
						abi,
						functionName: functionName,
					});

					returnData.push({
						json: {
							address: contractAddress as `0x${string}`,
							data: data as string,
							chain,
						},
					});
					break;
			}
		}

		return [returnData];
	}
}
