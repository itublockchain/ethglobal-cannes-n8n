import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import { Chain } from 'viem';
import * as chains from 'viem/chains';

export class ViemGetChain implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Viem: Get Chain',
		name: 'viemGetChain',
		icon: { light: 'file:viem.svg', dark: 'file:viem.svg' },
		group: ['transform'],
		version: 1,
		description: 'This node allows you to get a chain from a chain ID or chain name.',
		defaults: {
			name: 'Viem: Get Chain',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		codex: {
			categories: ['Viem', 'Blockchain', 'Chain'],
			alias: ['viem', 'blockchain', 'chain'],
			subcategories: {
				viem: ['Viem', 'Blockchain', 'Chain'],
			},
		},
		properties: [
			{
				displayName: 'Chain Name (if not provided, chain ID is required)',
				name: 'chainName',
				type: 'string',
				default: 'Sepolia',
			},
			{
				displayName: 'Chain ID (if not provided, chain name is required)',
				name: 'chainId',
				type: 'number',
				default: 11155111,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const chainId = this.getNodeParameter('chainId', i) as number;
			const chainName = this.getNodeParameter('chainName', i) as string;

			let chain: Chain | undefined;

			if (chainId) {
				chain = Object.values(chains).find((chain: Chain) => chain.id === chainId) as Chain;
			}

			if (chainName) {
				chain = Object.values(chains).find((chain: Chain) => chain.name === chainName) as Chain;
			}

			if (!chain) {
				throw new Error(`Chain ${chainId} or ${chainName} not found`);
			}

			returnData.push({
				json: {
					chain: chain,
				},
			});
		}

		return [returnData];
	}
}
