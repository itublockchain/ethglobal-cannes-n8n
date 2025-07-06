import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	NodeConnectionType,
	INodeExecutionData,
} from 'n8n-workflow';

import crypto from 'crypto';

const networks = [
	'arbitrum-one',
	'avalanche',
	'base',
	'bsc',
	'mainnet',
	'matic',
	'optimism',
	'unichain',
];

const hash = (json: object) => {
	return crypto.createHash('sha256').update(JSON.stringify(json)).digest('hex');
};

export class FetchNFTEvents implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'The Graph: Fetch NFT Events',
		name: 'fetchNFTEvents',
		icon: { light: 'file:thegraph.svg', dark: 'file:thegraph.svg' },
		group: ['transform'],
		version: 1,
		description: 'Fetch NFT Events using The Graph',
		defaults: {
			name: 'The Graph: Fetch NFT Events',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'theGraphCredentials',
				required: true,
			},
		],
		usableAsTool: true,
		codex: {
			categories: ['The Graph', 'Blockchain', 'Fetch', 'NFT', 'Events'],
			alias: ['thegraph', 'blockchain', 'fetch', 'nft', 'events'],
			subcategories: {
				thegraph: ['The Graph', 'Blockchain', 'Fetch', 'NFT', 'Events'],
			},
		},
		properties: [
			{
				displayName: 'NFT Contract Address',
				name: 'nftContractAddress',
				type: 'string',
				default: '',
				required: true,
			},
			{
				displayName: 'chain',
				name: 'chain',
				type: 'string',
				default: 'mainnet',
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('theGraphCredentials');

		const workflowStaticData = this.getWorkflowStaticData('global');

		let prevHash = workflowStaticData.prevHash;

		for (let i = 0; i < items.length; i++) {
			const chain = this.getNodeParameter('chain', i) as string;
			const network = networks.find((ntw) => ntw == chain);

			if (!network) throw new Error('Network not found.');

			const nftContractAddress = this.getNodeParameter('nftContractAddress', i) as string;
			const options = {
				method: 'GET',
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${credentials.apiToken}`,
				},
			};

			const response = await fetch(
				`https://token-api.thegraph.com/nft/activities/evm?network_id=${network}&contract=${nftContractAddress}&orderBy=timestamp&orderDirection=desc&limit=10&page=1`,
				options,
			);

			const json = (await response.json()) as { data: object };
			const _hash = hash(json.data);

			if (prevHash !== _hash) {
				returnData.push({
					json: {
						events: json.data,
						prevHash,
						hash: _hash,
					},
				});
				workflowStaticData.prevHash = _hash;
			}
		}

		return [returnData];
	}
}
