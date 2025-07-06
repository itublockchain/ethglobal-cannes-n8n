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
	getContract,
	formatUnits,
} from 'viem';
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
	arbitrumSepolia: '',
	optimismSepolia: '',
	baseSepolia: '',
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
		inputs: [{ name: 'account', type: 'address' }],
		name: 'balanceOf',
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

const DEBT_TOKEN_ABI = [
	{
		inputs: [{ name: 'account', type: 'address' }],
		name: 'balanceOf',
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'view',
		type: 'function',
	},
] as const;

const AAVE_POOL_ABI = [
	{
		inputs: [
			{ name: 'asset', type: 'address' },
			{ name: 'amount', type: 'uint256' },
			{ name: 'interestRateMode', type: 'uint256' },
			{ name: 'onBehalfOf', type: 'address' },
		],
		name: 'repay',
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [{ name: 'asset', type: 'address' }],
		name: 'getReserveData',
		outputs: [
			{
				name: '',
				type: 'tuple',
				components: [
					{ name: 'configuration', type: 'uint256' },
					{ name: 'liquidityIndex', type: 'uint128' },
					{ name: 'currentLiquidityRate', type: 'uint128' },
					{ name: 'variableBorrowIndex', type: 'uint128' },
					{ name: 'currentVariableBorrowRate', type: 'uint128' },
					{ name: 'currentStableBorrowRate', type: 'uint128' },
					{ name: 'lastUpdateTimestamp', type: 'uint40' },
					{ name: 'id', type: 'uint16' },
					{ name: 'aTokenAddress', type: 'address' },
					{ name: 'stableDebtTokenAddress', type: 'address' },
					{ name: 'variableDebtTokenAddress', type: 'address' },
					{ name: 'interestRateStrategyAddress', type: 'address' },
					{ name: 'accruedToTreasury', type: 'uint128' },
					{ name: 'unbacked', type: 'uint128' },
					{ name: 'isolationModeTotalDebt', type: 'uint128' },
				],
			},
		],
		stateMutability: 'view',
		type: 'function',
	},
] as const;

export class AaveRepay implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Aave: Repay',
		name: 'aaveRepay',
		icon: { light: 'file:aave.svg', dark: 'file:aave.svg' },
		group: ['transform'],
		version: 1,
		description: 'Repay borrowed assets to Aave V3 protocol',
		defaults: {
			name: 'Aave: Repay',
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
			categories: ['Aave', 'Blockchain', 'DeFi', 'Repay'],
			alias: ['aave', 'blockchain', 'defi', 'repay'],
			subcategories: {
				aave: ['Aave', 'Blockchain', 'DeFi', 'Repay'],
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
				default: 'sepolia',
				description: 'Blockchain network to use',
			},
			{
				displayName: 'Asset Address',
				name: 'assetAddress',
				type: 'string',
				default: '',
				required: true,
				description: 'Token address to repay',
				placeholder: '0xA0b86a33E6441E2E552D4dd58D66f5D74aEeAdb1',
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				default: '0',
				required: true,
				description: 'Amount to repay (e.g., "100") or "max" for full repayment',
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

				// Get token info and variable debt token address (most common)
				const [decimals, tokenSymbol, reserveData, balance] = await Promise.all([
					tokenContract.read.decimals(),
					tokenContract.read.symbol().catch(() => 'Unknown'),
					poolContract.read.getReserveData([assetAddress]),
					tokenContract.read.balanceOf([account.address]),
				]);

				// Use variable debt token (rate mode 2) as default
				const variableDebtTokenAddress = reserveData.variableDebtTokenAddress;
				const debtTokenContract = getContract({
					address: variableDebtTokenAddress as `0x${string}`,
					abi: DEBT_TOKEN_ABI,
					client: publicClient,
				});

				// Get current variable debt balance
				const debtBalance = await debtTokenContract.read.balanceOf([account.address]);

				// Handle "max" amount or parse the specified amount
				let parsedAmount: bigint;
				if (amountInput.toLowerCase() === 'max') {
					parsedAmount = debtBalance;
				} else {
					parsedAmount = parseUnits(amountInput, decimals);
				}

				// Check if user has debt to repay
				if (debtBalance === 0n) {
					throw new NodeOperationError(
						this.getNode(),
						`No debt found for ${tokenSymbol}. Current debt balance: 0`,
					);
				}

				// Check if user has sufficient token balance to repay
				if (balance < parsedAmount) {
					throw new NodeOperationError(
						this.getNode(),
						`Insufficient balance. Need ${formatUnits(
							parsedAmount,
							decimals,
						)} ${tokenSymbol}, but wallet has ${formatUnits(balance, decimals)} ${tokenSymbol}`,
					);
				}

				// If amount is 0, throw error
				if (parsedAmount === 0n) {
					throw new NodeOperationError(
						this.getNode(),
						`Cannot repay 0 tokens. Current debt: ${formatUnits(
							debtBalance,
							decimals,
						)} ${tokenSymbol}`,
					);
				}

				// Limit repay amount to actual debt
				if (parsedAmount > debtBalance) {
					parsedAmount = debtBalance;
				}

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
					await publicClient.waitForTransactionReceipt({ hash: approveHash });
				}

				// Execute repay transaction (use rate mode 2 for variable debt)
				const repayAmount =
					amountInput.toLowerCase() === 'max'
						? BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
						: parsedAmount;

				const repayHash = await poolContract.write.repay([
					assetAddress,
					repayAmount,
					BigInt(2), // Variable rate mode
					account.address,
				]);

				const repayReceipt = await publicClient.waitForTransactionReceipt({
					hash: repayHash,
				});

				// Get updated balances
				const [newTokenBalance, newDebtBalance] = await Promise.all([
					tokenContract.read.balanceOf([account.address]),
					debtTokenContract.read.balanceOf([account.address]),
				]);

				const result = {
					success: true,
					network: chain.name,
					assetAddress,
					tokenSymbol,
					amount: amountInput,
					actualAmount: formatUnits(parsedAmount, decimals),
					transaction: {
						hash: repayHash,
						blockNumber: repayReceipt.blockNumber.toString(),
						gasUsed: repayReceipt.gasUsed.toString(),
						status: repayReceipt.status,
					},
					balances: {
						tokenBefore: formatUnits(balance, decimals),
						tokenAfter: formatUnits(newTokenBalance, decimals),
						debtBefore: formatUnits(debtBalance, decimals),
						debtAfter: formatUnits(newDebtBalance, decimals),
						repaidAmount: formatUnits(debtBalance - newDebtBalance, decimals),
					},
					timestamp: new Date().toISOString(),
				};

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
