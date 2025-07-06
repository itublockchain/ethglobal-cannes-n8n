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

export class FetchTokenEvents implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'The Graph: Fetch Token Events',
		name: 'fetchTokenEvents',
		group: ['transform'],
		version: 1,
		description: 'Fetch Token Events using The Graph',
		defaults: {
			name: 'The Graph: Fetch Token Events',
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
			categories: ['The Graph', 'Blockchain', 'Fetch', 'Token', 'Events'],
			alias: ['thegraph', 'blockchain', 'fetch', 'token', 'events'],
			subcategories: {
				thegraph: ['The Graph', 'Blockchain', 'Fetch', 'Token', 'Events'],
			},
		},
		properties: [
			{
				displayName: 'Token Contract Address',
				name: 'tokenContractAddress',
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

		let prevHash = workflowStaticData.prevHashToken;

		for (let i = 0; i < items.length; i++) {
			const chain = this.getNodeParameter('chain', i) as string;
			const network = networks.find((ntw) => ntw == chain);

			if (!network) throw new Error('Network not found.');

			const tokenContractAddress = this.getNodeParameter('tokenContractAddress', i) as string;
			const options = {
				method: 'GET',
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${credentials.apiToken}`,
				},
			};

			const response = await fetch(
				`https://token-api.thegraph.com/transfers/evm?network_id=${network}&contract=${tokenContractAddress}&orderBy=timestamp&orderDirection=desc&limit=10&page=1`,
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
				workflowStaticData.prevHashToken = _hash;
			}
		}

		return [returnData];
	}
}
