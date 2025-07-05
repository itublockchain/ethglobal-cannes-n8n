import {
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
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

// https://token-api.thegraph.com/nft/activities/evm?network_id=mainnet&contract=0xbd3531da5cf5857e7cfaa92426877b022e612cf8&any=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&orderBy=timestamp&orderDirection=desc&limit=10&page=1
export class NFTTransferTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'The Graph: NFT Transfer Trigger',
		name: 'nftTransferTrigger',
		group: ['trigger'],
		version: 1,
		description: 'NFT Transfer Trigger',
		defaults: {
			name: 'The Graph: NFT Transfer Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'theGraphCredentials',
				required: true,
			},
		],
		codex: {
			categories: ['The Graph', 'Blockchain', 'Trigger', 'NFT', 'Transfer'],
			alias: ['thegraph', 'blockchain', 'Trigger', 'NFT', 'Transfer'],
			subcategories: {
				thegraph: ['The Graph', 'Blockchain', 'Trigger', 'NFT', 'Transfer'],
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

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const interval = this.getNodeParameter('interval', 1) as number;

		const chain = this.getNodeParameter('chain', 1);
		const nftContractAddress = this.getNodeParameter('nftContractAddress', 1);

		const credentials = await this.getCredentials('theGraphCredentials');

		const network = networks.find((ntw) => ntw == chain);

		if (!network) throw new Error('Network not found.');

		if (interval <= 0) {
			throw new Error('The interval has to be set to at least 1 or higher!');
		}

		const executeTrigger = async () => {
			// Every time the emit function gets called a new workflow
			// executions gets started with the provided entries.

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

			const json = (await response.json()) as object;

			const entry = {
				...json,
			};

			this.emit([this.helpers.returnJsonArray([entry])]);
		};

		// Sets an interval and triggers the workflow all n seconds
		// (depends on what the user selected on the node)
		const intervalValue = interval * 5 * 1000;
		const intervalObj = setInterval(executeTrigger, intervalValue);

		// The "closeFunction" function gets called by n8n whenever
		// the workflow gets deactivated and can so clean up.
		async function closeFunction() {
			clearInterval(intervalObj);
		}

		// The "manualTriggerFunction" function gets called by n8n
		// when a user is in the workflow editor and starts the
		// workflow manually. So the function has to make sure that
		// the emit() gets called with similar data like when it
		// would trigger by itself so that the user knows what data
		// to expect.
		async function manualTriggerFunction() {
			await executeTrigger();
		}

		return {
			closeFunction,
			manualTriggerFunction,
		};
	}
}
