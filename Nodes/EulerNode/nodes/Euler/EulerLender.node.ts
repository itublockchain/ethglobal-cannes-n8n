import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import {
	createPublicClient,
	createWalletClient,
	http,
	parseUnits,
	formatEther,
	getContract,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia, polygon, arbitrum, base, optimism } from 'viem/chains';

const SUPPORTED_CHAINS = {
	mainnet,
	sepolia,
	polygon,
	arbitrum,
	base,
	optimism,
};

// Basic ERC20 ABI for token operations
const ERC20_ABI = [
	{
		inputs: [
			{ name: 'spender', type: 'address' },
			{ name: 'amount', type: 'uint256' },
		],
		name: 'approve',
		outputs: [{ name: '', type: 'bool' }],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{ name: 'owner', type: 'address' },
			{ name: 'spender', type: 'address' },
		],
		name: 'allowance',
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'decimals',
		outputs: [{ name: '', type: 'uint8' }],
		stateMutability: 'view',
		type: 'function',
	},
] as const;

// Simplified Euler eToken ABI
const ETOKEN_ABI = [
	{
		inputs: [
			{ name: 'subAccountId', type: 'uint256' },
			{ name: 'amount', type: 'uint256' },
		],
		name: 'deposit',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [{ name: 'account', type: 'address' }],
		name: 'balanceOf',
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'view',
		type: 'function',
	},
] as const;

export class EulerLender implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Euler: Lend Assets',
		name: 'eulerLender',
		icon: { light: 'file:euler.svg', dark: 'file:euler.svg' },
		group: ['transform'],
		version: 1,
		description: 'Lend assets to Euler Finance protocol to earn interest',
		defaults: {
			name: 'Euler: Lend Assets',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'eulerCredentials',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Network',
				name: 'network',
				type: 'options',
				options: Object.entries(SUPPORTED_CHAINS).map(([key, chain]) => ({
					name: `${chain.name} (${key})`,
					value: key,
				})),
				default: 'mainnet',
				description: 'Blockchain network to interact with',
			},
			{
				displayName: 'Asset Address',
				name: 'assetAddress',
				type: 'string',
				default: '',
				required: true,
				description: 'ERC20 token address to lend (e.g., USDC, DAI, WETH)',
				placeholder: '0xA0b86a33E6441E2E552D4dd58D66f5D74aEeAdb1',
			},
			{
				displayName: 'eToken Address',
				name: 'eTokenAddress',
				type: 'string',
				default: '',
				required: true,
				description: 'Euler eToken contract address for the asset',
				placeholder: '0x...',
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				default: '0',
				required: true,
				description: 'Amount to lend in token units (e.g., 100 for 100 tokens)',
			},
			{
				displayName: 'Sub Account ID',
				name: 'subAccountId',
				type: 'number',
				default: 0,
				description: 'Sub-account ID (0 for primary account)',
			},
			{
				displayName: 'Simulation Only',
				name: 'simulationOnly',
				type: 'boolean',
				default: false,
				description: 'Only simulate the transaction without executing it',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Get credentials
		const credentials = await this.getCredentials('eulerCredentials');
		const privateKey = credentials.privateKey as string;
		const rpcUrl = credentials.rpcUrl as string;

		if (!privateKey?.startsWith('0x')) {
			throw new NodeOperationError(
				this.getNode(),
				'Invalid private key format. Must start with "0x".',
			);
		}

		for (let i = 0; i < items.length; i++) {
			try {
				const networkKey = this.getNodeParameter('network', i) as string;
				const assetAddress = this.getNodeParameter('assetAddress', i) as `0x${string}`;
				const eTokenAddress = this.getNodeParameter('eTokenAddress', i) as `0x${string}`;
				const amount = this.getNodeParameter('amount', i) as string;
				const subAccountId = this.getNodeParameter('subAccountId', i) as number;
				const simulationOnly = this.getNodeParameter('simulationOnly', i) as boolean;

				const results: any = {
					success: true,
					assetAddress,
					amount,
					subAccountId,
					timestamp: new Date().toISOString(),
				};

				returnData.push({ json: results });

				return [returnData];

				// Validate inputs
				if (!assetAddress || !eTokenAddress || !amount) {
					throw new NodeOperationError(
						this.getNode(),
						'Asset address, eToken address, and amount are required',
					);
				}

				const chain = SUPPORTED_CHAINS[networkKey as keyof typeof SUPPORTED_CHAINS];
				if (!chain) {
					throw new NodeOperationError(this.getNode(), `Unsupported network: ${networkKey}`);
				}

				// Setup viem clients
				const account = privateKeyToAccount(privateKey as `0x${string}`);

				const publicClient = createPublicClient({
					chain,
					transport: http(rpcUrl || chain.rpcUrls.default.http[0]),
				});

				const walletClient = createWalletClient({
					account,
					chain,
					transport: http(rpcUrl || chain.rpcUrls.default.http[0]),
				});

				// Get token contract
				const tokenContract = getContract({
					address: assetAddress,
					abi: ERC20_ABI,
					client: { public: publicClient, wallet: walletClient },
				});

				// Get eToken contract
				const eTokenContract = getContract({
					address: eTokenAddress,
					abi: ETOKEN_ABI,
					client: { public: publicClient, wallet: walletClient },
				});

				// Get token decimals and parse amount
				const decimals = await tokenContract.read.decimals();
				const parsedAmount = parseUnits(amount, decimals);

				const result: any = {
					success: true,
					network: chain.name,
					assetAddress,
					eTokenAddress,
					amount,
					parsedAmount: parsedAmount.toString(),
					subAccountId,
					timestamp: new Date().toISOString(),
				};

				if (simulationOnly) {
					// Simulate the operations
					try {
						// Check current allowance
						const allowance = await tokenContract.read.allowance([account.address, eTokenAddress]);
						result.simulation = {
							currentAllowance: allowance.toString(),
							needsApproval: allowance < parsedAmount,
							estimatedGas: 'simulation_mode',
						};
					} catch (error: any) {
						result.simulation = {
							error: error.message,
							success: false,
						};
					}
				} else {
					// Execute the actual transaction

					// Check and approve if needed
					const allowance = await tokenContract.read.allowance([account.address, eTokenAddress]);

					if (allowance < parsedAmount) {
						const approveHash = await tokenContract.write.approve([eTokenAddress, parsedAmount]);
						const approveReceipt = await publicClient.waitForTransactionReceipt({
							hash: approveHash,
						});

						result.approvalTx = {
							hash: approveHash,
							blockNumber: approveReceipt.blockNumber.toString(),
							gasUsed: approveReceipt.gasUsed.toString(),
							status: approveReceipt.status,
						};
					}

					// Execute deposit
					const depositHash = await eTokenContract.write.deposit([
						BigInt(subAccountId),
						parsedAmount,
					]);

					const depositReceipt = await publicClient.waitForTransactionReceipt({
						hash: depositHash,
					});

					result.transaction = {
						hash: depositHash,
						blockNumber: depositReceipt.blockNumber.toString(),
						gasUsed: depositReceipt.gasUsed.toString(),
						status: depositReceipt.status,
					};

					// Get updated eToken balance
					const eTokenBalance = await eTokenContract.read.balanceOf([account.address]);
					result.newETokenBalance = formatEther(eTokenBalance);
				}

				returnData.push({ json: result });
			} catch (error: any) {
				throw new NodeOperationError(
					this.getNode(),
					`Error processing item ${i}: ${error.message}`,
					{
						itemIndex: i,
					},
				);
			}
		}

		return [returnData];
	}
}
