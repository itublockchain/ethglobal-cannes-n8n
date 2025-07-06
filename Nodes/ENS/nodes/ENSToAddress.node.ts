import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';
import { createPublicClient, http } from 'viem';

import { normalize } from 'viem/ens';
import * as chains from 'viem/chains';

export class ENSToAddress implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ENS: Get Address from ENS',
		name: 'getAddressFromENS',
		icon: { light: 'file:ens.svg', dark: 'file:ens.svg' },
		group: ['transform'],
		version: 1,
		description: 'Get Address from ENS',
		defaults: {
			name: 'ENS: Get Address from ENS',
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
				displayName: 'ENS Name',
				name: 'ensName',
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
			const ensName = this.getNodeParameter('ensName', i) as string;

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
				const ensAddress = await publicClient.getEnsAddress({
					name: normalize(ensName),
				});

				if (!ensAddress) {
					throw new Error('ENS not found');
				}

				returnData.push({
					json: {
						ensAddress,
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
