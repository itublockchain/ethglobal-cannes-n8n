import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { createPublicClient, createWalletClient, http, parseUnits, getContract, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia, polygon, arbitrum, base, optimism, avalanche } from 'viem/chains';

const SUPPORTED_CHAINS = {
	mainnet,
	sepolia,
	polygon,
	arbitrum,
	base,
	optimism,
	avalanche,
};

const POOL_ADDRESSES = {
arbitrumSepolia:"",
optimismSepolia:"",
baseSepolia:"",
	sepolia: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951',
};

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
	{
		inputs: [],
		name: 'name',
		outputs: [{ name: '', type: 'string' }],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'symbol',
		outputs: [{ name: '', type: 'string' }],
		stateMutability: 'view',
		type: 'function',
	},
] as const;

const AAVE_POOL_ABI = [
	{
		inputs: [
			{ name: 'asset', type: 'address' },
			{ name: 'amount', type: 'uint256' },
			{ name: 'onBehalfOf', type: 'address' },
			{ name: 'referralCode', type: 'uint16' },
		],
		name: 'supply',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
] as const;

export class AaveSupply implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Aave: Supply Assets',
		name: 'aaveSupply',
		group: ['transform'],
		version: 1,
		description: 'Supply (deposit) assets to Aave V3 protocol to earn interest',
		defaults: {
			name: 'Aave: Supply Assets',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'aaveCredentials',
				required: true,
			},
		],
		codex: {
			categories: ['Aave', 'Blockchain', 'DeFi', 'Supply'],
			alias: ['aave', 'blockchain', 'defi', 'supply'],
			subcategories: {
				aave: ['Aave', 'Blockchain', 'DeFi', 'Supply'],
			},
		},
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
				description: 'ERC20 token address to supply (e.g., USDC, DAI, WETH)',
				placeholder: '0xA0b86a33E6441E2E552D4dd58D66f5D74aEeAdb1',
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				default: '0',
				required: true,
				description: 'Amount to supply in human readable format (e.g., "100" for 100 USDC). Use "max" to supply your entire balance.',
			},
			{
				displayName: 'On Behalf Of',
				name: 'onBehalfOf',
				type: 'string',
				default: '',
				description: 'Address to supply on behalf of (leave empty for your own address)',
			},
			{
				displayName: 'Referral Code',
				name: 'referralCode',
				type: 'number',
				default: 0,
				description: 'Referral code for the operation (usually 0)',
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

		const credentials = await this.getCredentials('aaveCredentials');
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
				const amountInput = this.getNodeParameter('amount', i) as string;
				const onBehalfOf = this.getNodeParameter('onBehalfOf', i, '') as string;
				const referralCode = this.getNodeParameter('referralCode', i, 0) as number;
				const simulationOnly = this.getNodeParameter('simulationOnly', i, false) as boolean;

				if (!assetAddress || !amountInput) {
					throw new NodeOperationError(this.getNode(), 'Asset address and amount are required');
				}

				const chain = SUPPORTED_CHAINS[networkKey as keyof typeof SUPPORTED_CHAINS];
				if (!chain) {
					throw new NodeOperationError(this.getNode(), `Unsupported network: ${networkKey}`);
				}

				const poolAddress = POOL_ADDRESSES[networkKey as keyof typeof POOL_ADDRESSES];
				if (!poolAddress) {
					throw new NodeOperationError(
						this.getNode(),
						`Pool address not configured for network: ${networkKey}`,
					);
				}

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

				const tokenContract = getContract({
					address: assetAddress,
					abi: ERC20_ABI,
					client: walletClient,
				});

				const poolContract = getContract({
					address: poolAddress as `0x${string}`,
					abi: AAVE_POOL_ABI,
					client: walletClient,
				});

				// Get token info
				const [decimals, balance, tokenName, tokenSymbol] = await Promise.all([
					tokenContract.read.decimals(),
					tokenContract.read.balanceOf([account.address]),
					tokenContract.read.name().catch(() => 'Unknown'),
					tokenContract.read.symbol().catch(() => 'Unknown'),
				]);

				// Handle "max" amount or parse the specified amount
				let parsedAmount: bigint;
				if (amountInput.toLowerCase() === 'max') {
					parsedAmount = balance;
				} else {
					parsedAmount = parseUnits(amountInput, decimals);
				}

				// Check if user has sufficient balance
				if (balance < parsedAmount) {
					throw new NodeOperationError(
						this.getNode(),
						`Insufficient balance. Trying to supply ${formatUnits(parsedAmount, decimals)} ${tokenSymbol}, but wallet only has ${formatUnits(balance, decimals)} ${tokenSymbol}. Wallet address: ${account.address}`,
					);
				}

				// If amount is 0, throw error
				if (parsedAmount === 0n) {
					throw new NodeOperationError(
						this.getNode(),
						`Cannot supply 0 tokens. Current balance: ${formatUnits(balance, decimals)} ${tokenSymbol}`,
					);
				}

				const result: any = {
					success: true,
					operation: 'supply',
					network: chain.name,
					poolAddress,
					assetAddress,
					tokenName,
					tokenSymbol,
					decimals,
					requestedAmount: amountInput,
					actualAmount: formatUnits(parsedAmount, decimals),
					parsedAmount: parsedAmount.toString(),
					walletBalance: formatUnits(balance, decimals),
					walletAddress: account.address,
					timestamp: new Date().toISOString(),
				};

				if (simulationOnly) {
					try {
						const allowance = await tokenContract.read.allowance([
							account.address,
							poolAddress as `0x${string}`,
						]);

						result.simulation = {
							supplyAmount: parsedAmount.toString(),
							supplyAmountFormatted: formatUnits(parsedAmount, decimals),
							currentAllowance: allowance.toString(),
							currentAllowanceFormatted: formatUnits(allowance, decimals),
							walletBalance: balance.toString(),
							walletBalanceFormatted: formatUnits(balance, decimals),
							needsApproval: allowance < parsedAmount,
							sufficientBalance: balance >= parsedAmount,
							estimatedGas: 'simulation_mode',
						};
					} catch (error: any) {
						result.simulation = {
							error: error.message,
							success: false,
						};
					}
				} else {
					// Check and approve if needed
					const allowance = await tokenContract.read.allowance([
						account.address,
						poolAddress as `0x${string}`,
					]);

					if (allowance < parsedAmount) {
						const approveHash = await tokenContract.write.approve([
							poolAddress as `0x${string}`,
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

					// Execute supply
					const supplyHash = await poolContract.write.supply([
						assetAddress,
						parsedAmount,
						(onBehalfOf as `0x${string}`) || account.address,
						referralCode,
					]);

					const supplyReceipt = await publicClient.waitForTransactionReceipt({
						hash: supplyHash,
					});

					result.transaction = {
						hash: supplyHash,
						blockNumber: supplyReceipt.blockNumber.toString(),
						gasUsed: supplyReceipt.gasUsed.toString(),
						status: supplyReceipt.status,
					};

					// Get updated balance
					const newBalance = await tokenContract.read.balanceOf([account.address]);
					result.newWalletBalance = formatUnits(newBalance, decimals);
					result.newWalletBalanceRaw = newBalance.toString();
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
