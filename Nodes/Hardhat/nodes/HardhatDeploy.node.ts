import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import compileContract from './lib/compileContract';
import { Abi, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as chains from 'viem/chains';

export class HardhatDeploy implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Hardhat: Deploy',
		name: 'hardhatDeploy',
		group: ['transform'],
		version: 1,
		description: "This node allows you to deploy a contract from it's code.",
		defaults: {
			name: 'Hardhat: Deploy',
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
			categories: ['Hardhat', 'Blockchain', 'Deploy', 'Contract'],
			alias: ['hardhat', 'blockchain', 'deploy', 'contract'],
			subcategories: {
				hardhat: ['Hardhat', 'Blockchain', 'Deploy', 'Contract'],
			},
		},
		properties: [
			{
				displayName: 'Contract Code',
				name: 'contractCode',
				type: 'string',
				default: '',
				required: true,
			},
			{
				displayName: 'Chain ID',
				name: 'chainID',
				type: 'number',
				default: 10,
				required: true,
			},
			{
				displayName: 'Constructor Arguments',
				name: 'constructorArguments',
				type: 'json',
				default: [],
				required: true,
			},
			{
				displayName: 'Contract Name',
				name: 'contractName',
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
			const contractCode = this.getNodeParameter('contractCode', i) as string;
			const chainID = this.getNodeParameter('chainID', i) as number;
			const constructorArguments = this.getNodeParameter('constructorArguments', i) as any[];
			const contractName = this.getNodeParameter('contractName', i) as string;

			const [allContracts, credentials] = await Promise.all([
				compileContract(contractCode),
				this.getCredentials('viemCredentials'),
			]);

			if (!credentials) {
				throw new Error('Credentials not found');
			}

			const privateKey = credentials.privateKey as `0x${string}`;
			const account = privateKeyToAccount(privateKey);

			const chain = Object.values(chains).find((chain) => chain.id === chainID);

			if (!chain) {
				throw new Error('Chain not found');
			}

			const walletClient = createWalletClient({
				account,
				chain,
				transport: http(chain.rpcUrls.default.http[0]),
			});

			const contract = allContracts[contractName];

			if (!contract) {
				throw new Error('Contract not found');
			}

			const tx = await walletClient.deployContract({
				abi: contract.abi as Abi,
				bytecode: contract.bytecode as `0x${string}`,
				args: constructorArguments,
			});

			returnData.push({
				json: {
					tx,
					contract,
				},
			});
		}

		return [returnData];
	}
}
