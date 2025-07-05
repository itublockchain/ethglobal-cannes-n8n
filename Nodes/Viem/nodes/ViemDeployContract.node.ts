import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import { privateKeyToAccount } from 'viem/accounts';
import { Abi, createWalletClient, http } from 'viem';
import * as chains from 'viem/chains';

export class ViemDeployContract implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Viem: Deploy Contract',
		name: 'viemDeployContract',
		group: ['transform'],
		version: 1,
		description: 'This node allows you to interact with a contract on a blockchain.',
		defaults: {
			name: 'Viem: Deploy Contract',
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
			categories: ['Viem', 'Blockchain', 'Deploy', 'Contract'],
			alias: ['viem', 'blockchain', 'deploy', 'contract'],
			subcategories: {
				viem: ['Viem', 'Blockchain', 'Deploy', 'Contract'],
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
				displayName: 'ABI',
				name: 'abi',
				type: 'json',
				default: [],
				required: true,
			},
			{
				displayName: 'Bytecode',
				name: 'bytecode',
				type: 'string',
				default: '',
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
			const constructorArguments = [10000000, 'asdasd', 42, 'adfsdf'];
			const bytecode = this.getNodeParameter('bytecode', i) as `0x${string}`;

			const chainID = this.getNodeParameter('chainID', i) as number;

			const chain = Object.values(chains).find((chain) => chain.id === chainID);

			if (!chain) {
				throw new Error('Chain not found');
			}

			if (!constructorArguments) {
				throw new Error('Constructor arguments are required');
			}

			const abiJSON = this.getNodeParameter('abi', i);
			const abi = abiJSON as Abi;

			const walletClient = createWalletClient({
				account,
				chain,
				transport: http(chain.rpcUrls.default.http[0]),
			});

			const tx = await walletClient.deployContract({
				abi,
				bytecode: bytecode as `0x${string}`,
				args: constructorArguments,
			});

			returnData.push({
				json: {
					tx,
					chain,
				},
			});
		}

		return [returnData];
	}
}
