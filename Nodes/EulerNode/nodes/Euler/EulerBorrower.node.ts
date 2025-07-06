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
	{
		inputs: [{ name: 'account', type: 'address' }],
		name: 'balanceOf',
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'view',
		type: 'function',
	},
] as const;

// Euler dToken ABI for borrowing/repaying
const DTOKEN_ABI = [
	{
		inputs: [
			{ name: 'subAccountId', type: 'uint256' },
			{ name: 'amount', type: 'uint256' },
		],
		name: 'borrow',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{ name: 'subAccountId', type: 'uint256' },
			{ name: 'amount', type: 'uint256' },
		],
		name: 'repay',
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

// Euler eToken ABI for minting
const ETOKEN_ABI = [
	{
		inputs: [
			{ name: 'subAccountId', type: 'uint256' },
			{ name: 'amount', type: 'uint256' },
		],
		name: 'mint',
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

export class EulerBorrower implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Euler: Borrow Assets',
		name: 'eulerBorrower',
		icon: { light: 'file:euler.svg', dark: 'file:euler.svg' },
		group: ['transform'],
		version: 1,
		description: 'Borrow assets from Euler Finance protocol using collateral',
		defaults: {
			name: 'Euler: Borrow Assets',
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				options: [
					{ name: 'Borrow', value: 'borrow' },
					{ name: 'Mint (Self-Collateralized)', value: 'mint' },
					{ name: 'Repay', value: 'repay' },
				],
				default: 'borrow',
				description: 'Type of borrowing operation to perform',
			},
			{
				displayName: 'Asset Address',
				name: 'assetAddress',
				type: 'string',
				default: '',
				required: true,
				description: 'ERC20 token address to borrow/repay (e.g., USDC, DAI, WETH)',
				placeholder: '0xA0b86a33E6441E2E552D4dd58D66f5D74aEeAdb1',
			},
			{
				displayName: 'dToken Address',
				name: 'dTokenAddress',
				type: 'string',
				default: '',
				required: true,
				description: 'Euler dToken contract address for borrowing/repaying',
				placeholder: '0x...',
				displayOptions: {
					show: {
						operation: ['borrow', 'repay'],
					},
				},
			},
			{
				displayName: 'eToken Address',
				name: 'eTokenAddress',
				type: 'string',
				default: '',
				required: true,
				description: 'Euler eToken contract address for minting',
				placeholder: '0x...',
				displayOptions: {
					show: {
						operation: ['mint'],
					},
				},
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				default: '0',
				required: true,
				description: 'Amount to borrow/repay/mint in token units',
			},
			{
				displayName: 'Sub Account ID',
				name: 'subAccountId',
				type: 'number',
				default: 0,
				description: 'Sub-account ID (0 for primary account)',
			},
			{
				displayName: 'Repay All',
				name: 'repayAll',
				type: 'boolean',
				default: false,
				description: 'Repay the entire debt balance',
				displayOptions: {
					show: {
						operation: ['repay'],
					},
				},
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
				const operation = this.getNodeParameter('operation', i) as string;
				const assetAddress = this.getNodeParameter('assetAddress', i) as `0x${string}`;
				const dTokenAddress = this.getNodeParameter('dTokenAddress', i, '') as `0x${string}`;
				const eTokenAddress = this.getNodeParameter('eTokenAddress', i, '') as `0x${string}`;
				const amount = this.getNodeParameter('amount', i) as string;
				const subAccountId = this.getNodeParameter('subAccountId', i) as number;
				const repayAll = this.getNodeParameter('repayAll', i) as boolean;
				const simulationOnly = this.getNodeParameter('simulationOnly', i) as boolean;

				const results: any = {
					success: true,
					operation,
					assetAddress,
					amount,
					subAccountId,
					timestamp: new Date().toISOString(),
				};

				returnData.push({ json: results });

				return [returnData];

				// Validate inputs
				if (!assetAddress || !amount) {
					throw new NodeOperationError(this.getNode(), 'Asset address and amount are required');
				}

				if ((operation === 'borrow' || operation === 'repay') && !dTokenAddress) {
					throw new NodeOperationError(
						this.getNode(),
						'dToken address is required for borrow/repay operations',
					);
				}

				if (operation === 'mint' && !eTokenAddress) {
					throw new NodeOperationError(
						this.getNode(),
						'eToken address is required for mint operation',
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

				// Get token decimals and parse amount
				const decimals = await tokenContract.read.decimals();
				let parsedAmount = parseUnits(amount, decimals);

				const result: any = {
					success: true,
					operation,
					network: chain.name,
					assetAddress,
					amount,
					parsedAmount: parsedAmount.toString(),
					subAccountId,
					timestamp: new Date().toISOString(),
				};

				if (operation === 'borrow' || operation === 'repay') {
					result.dTokenAddress = dTokenAddress;

					// Get dToken contract
					const dTokenContract = getContract({
						address: dTokenAddress,
						abi: DTOKEN_ABI,
						client: { public: publicClient, wallet: walletClient },
					});

					if (operation === 'repay' && repayAll) {
						// Get current debt balance for repay all
						const debtBalance = await dTokenContract.read.balanceOf([account.address]);
						parsedAmount = debtBalance;
						result.repayAmount = formatEther(debtBalance);
					}

					if (simulationOnly) {
						// Simulate the operation
						try {
							if (operation === 'repay') {
								// Check current allowance for repayment
								const allowance = await tokenContract.read.allowance([
									account.address,
									dTokenAddress,
								]);
								result.simulation = {
									currentAllowance: allowance.toString(),
									needsApproval: allowance < parsedAmount,
									repayAmount: parsedAmount.toString(),
								};
							} else {
								// For borrow, just return success simulation
								result.simulation = {
									borrowAmount: parsedAmount.toString(),
									estimatedGas: 'simulation_mode',
								};
							}
						} catch (error: any) {
							result.simulation = {
								error: error.message,
								success: false,
							};
						}
					} else {
						// Execute the actual operation
						if (operation === 'borrow') {
							const borrowHash = await dTokenContract.write.borrow([
								BigInt(subAccountId),
								parsedAmount,
							]);

							const borrowReceipt = await publicClient.waitForTransactionReceipt({
								hash: borrowHash,
							});

							result.transaction = {
								hash: borrowHash,
								blockNumber: borrowReceipt.blockNumber.toString(),
								gasUsed: borrowReceipt.gasUsed.toString(),
								status: borrowReceipt.status,
							};

							// Get updated debt balance
							const newDebtBalance = await dTokenContract.read.balanceOf([account.address]);
							result.newDebtBalance = formatEther(newDebtBalance);
						} else if (operation === 'repay') {
							// Check and approve if needed for repayment
							const allowance = await tokenContract.read.allowance([
								account.address,
								dTokenAddress,
							]);

							if (allowance < parsedAmount) {
								const approveHash = await tokenContract.write.approve([
									dTokenAddress,
									parsedAmount,
								]);
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

							// Execute repayment
							const repayHash = await dTokenContract.write.repay([
								BigInt(subAccountId),
								parsedAmount,
							]);

							const repayReceipt = await publicClient.waitForTransactionReceipt({
								hash: repayHash,
							});

							result.transaction = {
								hash: repayHash,
								blockNumber: repayReceipt.blockNumber.toString(),
								gasUsed: repayReceipt.gasUsed.toString(),
								status: repayReceipt.status,
							};

							// Get remaining debt balance
							const remainingDebt = await dTokenContract.read.balanceOf([account.address]);
							result.remainingDebtBalance = formatEther(remainingDebt);
						}
					}
				} else if (operation === 'mint') {
					result.eTokenAddress = eTokenAddress;

					// Get eToken contract
					const eTokenContract = getContract({
						address: eTokenAddress,
						abi: ETOKEN_ABI,
						client: { public: publicClient, wallet: walletClient },
					});

					if (simulationOnly) {
						// Simulate mint operation
						try {
							result.simulation = {
								mintAmount: parsedAmount.toString(),
								estimatedGas: 'simulation_mode',
							};
						} catch (error: any) {
							result.simulation = {
								error: error.message,
								success: false,
							};
						}
					} else {
						// Execute mint operation
						const mintHash = await eTokenContract.write.mint([BigInt(subAccountId), parsedAmount]);

						const mintReceipt = await publicClient.waitForTransactionReceipt({
							hash: mintHash,
						});

						result.transaction = {
							hash: mintHash,
							blockNumber: mintReceipt.blockNumber.toString(),
							gasUsed: mintReceipt.gasUsed.toString(),
							status: mintReceipt.status,
						};

						// Get updated eToken balance
						const newETokenBalance = await eTokenContract.read.balanceOf([account.address]);
						result.newETokenBalance = formatEther(newETokenBalance);
					}
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
