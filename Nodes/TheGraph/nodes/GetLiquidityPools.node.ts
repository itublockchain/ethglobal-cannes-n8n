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

export class GetLiquidityPools implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'The Graph: Get Liquidity Pools',
		name: 'getLiquidityPools',
		group: ['transform'],
		version: 1,
		description: 'Get Liquidity Pools',
		defaults: {
			name: 'The Graph: Get Liquidity Pools',
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
			categories: ['The Graph', 'Blockchain', 'Address', 'Token', 'Liquidity', 'Pool'],
			alias: ['thegraph', 'blockchain', 'address', 'token', 'liquidity', 'pool'],
			subcategories: {
				thegraph: ['The Graph', 'Blockchain', 'Address', 'Token', 'Liquidity', 'Pool'],
			},
		},
		properties: [
			{
				displayName: 'Token Address',
				name: 'tokenAddress',
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
			const tokenAddress = this.getNodeParameter('tokenAddress', i) as string;
			const credentials = await this.getCredentials('theGraphCredentials');

			const options = {
				method: 'GET',
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${credentials.apiToken}`,
				},
			};

			let liquidityPools = await Promise.all(
				networks.map(async (network) => {
					const response = await fetch(
						`https://token-api.thegraph.com/pools/evm?network_id=${network}&token=${tokenAddress}`,
						options,
					);

					const { data } = (await response.json()) as { data: object[] };

					if (data.length === 0) return;

					return data;
				}),
			);

			const liquidityPoolsFlat = liquidityPools.filter((ntw) => ntw).flat();

			const networkIdGrouped = liquidityPoolsFlat.reduce(
				(acc: Record<string, any[]>, item: any) => {
					const { network_id } = item;
					if (!acc[network_id]) acc[network_id] = [];
					acc[network_id].push(item);
					return acc;
				},
				{},
			);

			returnData.push({
				json: {
					liquidityPools: networkIdGrouped,
				},
			});
		}

		return [returnData];
	}
}
