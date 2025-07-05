import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

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

export class ViewWalletBalances implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'The Graph: View Wallet Balances',
		name: 'viewWalletBalances',
		group: ['transform'],
		version: 1,
		description: 'View Wallet Balances',
		defaults: {
			name: 'The Graph: View Wallet Balances',
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
			categories: ['The Graph', 'Blockchain', 'Address', 'Wallet', 'Balance'],
			alias: ['thegraph', 'blockchain', 'address', 'wallet', 'balance'],
			subcategories: {
				thegraph: ['The Graph', 'Blockchain', 'Address', 'Wallet', 'Balance'],
			},
		},
		properties: [
			{
				displayName: 'EVM Address',
				name: 'address',
				type: 'string',
				default: '',
				required: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const address = this.getNodeParameter('address', i) as string;
			const credentials = await this.getCredentials('theGraphCredentials');

			if (!address) {
				throw new Error('Address is required');
			}

			const options = {
				method: 'GET',
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${credentials.apiToken}`,
				},
			};

			const walletBalances = await Promise.all(
				networks.map(async (network) => {
					const response = await fetch(
						`https://token-api.thegraph.com/balances/evm/${address}?network_id=${network}`,
						options,
					);

					const { data } = (await response.json()) as { data: object[] };

					return data;
				}),
			);

			const allNetworksFlat = walletBalances.reduce((old, next) => old.concat(next), []);

			const networkIdGrouped = allNetworksFlat.reduce((acc: Record<string, any[]>, item: any) => {
				const { network_id } = item;
				if (!acc[network_id]) acc[network_id] = [];
				acc[network_id].push(item);
				return acc;
			}, {});

			returnData.push({
				json: {
					balances: networkIdGrouped,
				},
			});
		}

		return [returnData];
	}
}
