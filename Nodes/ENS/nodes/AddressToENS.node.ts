import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';
import { createPublicClient, http } from 'viem';

import * as chains from 'viem/chains';

export class AddressToENS implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ENS: Get ENS from Address',
		name: 'getENSFromAddress',
		group: ['transform'],
		version: 1,
		description: 'Get ENS from Address',
		defaults: {
			name: 'ENS: Get ENS from Address',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		codex: {
			categories: ['ENS', 'Blockchain', 'ENS Resolver', 'Address'],
			alias: ['ens', 'blockchain', 'ensResolver', 'address'],
			subcategories: {
				ens: ['ENS', 'Blockchain', 'ENS Resolver', 'Address'],
			},
		},
		properties: [
			{
				displayName: 'Address',
				name: 'address',
				type: 'string',
				default: '',
				required: true,
			},
			{
				displayName: 'Chain',
				name: 'chain',
				type: 'string',
				default: 'Ethereum',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const address = this.getNodeParameter('address', i) as string;

			const chainName = this.getNodeParameter('chain', i) as string;
			const chain = Object.values(chains).find((chain) => chain.name === chainName);

			if (!chain) {
				throw new Error(`Chain ${chainName} not found`);
			}

			const publicClient = createPublicClient({
				chain,
				transport: http(chain.rpcUrls.default.http[0]),
			});

			try {
				const ensName = await publicClient.getEnsName({
					address: address as `0x${string}`,
				});

				if (!ensName) {
					throw new Error('ENS not found');
				}

				returnData.push({
					json: {
						ensName,
						chainName,
					},
				});
			} catch (error) {
				throw new Error('Failed to get ENS resolver');
			}
		}

		return [returnData];
	}
}
