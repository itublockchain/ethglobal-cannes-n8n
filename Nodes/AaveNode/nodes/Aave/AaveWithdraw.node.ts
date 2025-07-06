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

const ATOKEN_ABI = [
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
] as const;

const AAVE_POOL_ABI = [
	{
		inputs: [
			{ name: 'asset', type: 'address' },
			{ name: 'amount', type: 'uint256' },
			{ name: 'to', type: 'address' },
		],
		name: 'withdraw',
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [{ name: 'user', type: 'address' }],
		name: 'getUserAccountData',
		outputs: [
			{ name: 'totalCollateralBase', type: 'uint256' },
			{ name: 'totalDebtBase', type: 'uint256' },
			{ name: 'availableBorrowsBase', type: 'uint256' },
			{ name: 'currentLiquidationThreshold', type: 'uint256' },
			{ name: 'ltv', type: 'uint256' },
			{ name: 'healthFactor', type: 'uint256' },
		],
		stateMutability: 'view',
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

export class AaveWithdraw implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Aave: Withdraw Assets',
		name: 'aaveWithdraw',
		icon: { light: 'file:aave.svg', dark: 'file:aave.svg' },
		group: ['transform'],
		version: 1,
		description: 'Withdraw (redeem) assets from Aave V3 protocol',
		defaults: {
			name: 'Aave: Withdraw Assets',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'aaveCredentials',
				required: true,
			},
		],
		usableAsTool: true,
		codex: {
			categories: ['Aave', 'Blockchain', 'DeFi', 'Withdraw'],
			alias: ['aave', 'blockchain', 'defi', 'withdraw'],
			subcategories: {
				aave: ['Aave', 'Blockchain', 'DeFi', 'Withdraw'],
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
				description: 'Blockchain network to interact with',
			},
			{
				displayName: 'Asset Address',
				name: 'assetAddress',
				type: 'string',
				default: '',
				required: true,
				description: 'ERC20 token address to withdraw (e.g., USDC, DAI, WETH)',
				placeholder: '0xA0b86a33E6441E2E552D4dd58D66f5D74aEeAdb1',
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				default: '0',
				required: true,
				description:
					'Amount to withdraw in human readable format (e.g., "100" for 100 USDC). Use "max" to withdraw your entire aToken balance.',
			},
			{
				displayName: 'To Address',
				name: 'toAddress',
				type: 'string',
				default: '',
				description:
					'Address to send withdrawn tokens to (leave empty to send to your own address)',
			},
			{
				displayName: 'Check Health Factor',
				name: 'checkHealthFactor',
				type: 'boolean',
				default: true,
				description: 'Verify health factor after withdrawal to avoid liquidation risk',
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
				const toAddress = this.getNodeParameter('toAddress', i, '') as string;
				const checkHealthFactor = this.getNodeParameter('checkHealthFactor', i, true) as boolean;
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
					client: publicClient,
				});

				const poolContract = getContract({
					address: poolAddress as `0x${string}`,
					abi: AAVE_POOL_ABI,
					client: walletClient,
				});

				// Get token info and aToken address
				const [decimals, tokenName, tokenSymbol, reserveData] = await Promise.all([
					tokenContract.read.decimals(),
					tokenContract.read.name().catch(() => 'Unknown'),
					tokenContract.read.symbol().catch(() => 'Unknown'),
					poolContract.read.getReserveData([assetAddress]),
				]);

				const aTokenAddress = reserveData.aTokenAddress;

				const aTokenContract = getContract({
					address: aTokenAddress as `0x${string}`,
					abi: ATOKEN_ABI,
					client: publicClient,
				});

				// Get aToken balance (supplied balance)
				const aTokenBalance = await aTokenContract.read.balanceOf([account.address]);

				// Handle "max" amount or parse the specified amount
				let parsedAmount: bigint;
				if (amountInput.toLowerCase() === 'max') {
					parsedAmount = aTokenBalance;
				} else {
					parsedAmount = parseUnits(amountInput, decimals);
				}

				// Check if user has sufficient aToken balance
				if (aTokenBalance < parsedAmount) {
					throw new NodeOperationError(
						this.getNode(),
						`Insufficient aToken balance. Trying to withdraw ${formatUnits(
							parsedAmount,
							decimals,
						)} ${tokenSymbol}, but you only have ${formatUnits(
							aTokenBalance,
							decimals,
						)} a${tokenSymbol} supplied. Wallet address: ${account.address}`,
					);
				}

				// If amount is 0, throw error
				if (parsedAmount === 0n) {
					throw new NodeOperationError(
						this.getNode(),
						`Cannot withdraw 0 tokens. Current aToken balance: ${formatUnits(
							aTokenBalance,
							decimals,
						)} a${tokenSymbol}`,
					);
				}

				const result: any = {
					success: true,
					operation: 'withdraw',
					network: chain.name,
					poolAddress,
					assetAddress,
					aTokenAddress,
					tokenName,
					tokenSymbol,
					decimals,
					requestedAmount: amountInput,
					actualAmount: formatUnits(parsedAmount, decimals),
					parsedAmount: parsedAmount.toString(),
					aTokenBalance: formatUnits(aTokenBalance, decimals),
					walletAddress: account.address,
					timestamp: new Date().toISOString(),
				};

				// Get user account data for health factor checks
				if (checkHealthFactor || simulationOnly) {
					try {
						const [
							totalCollateralBase,
							totalDebtBase,
							availableBorrowsBase,
							currentLiquidationThreshold,
							ltv,
							healthFactor,
						] = await poolContract.read.getUserAccountData([account.address]);

						const healthFactorFormatted = formatUnits(healthFactor, 18);

						result.accountData = {
							totalCollateralBase: totalCollateralBase.toString(),
							totalDebtBase: totalDebtBase.toString(),
							availableBorrowsBase: availableBorrowsBase.toString(),
							currentLiquidationThreshold: currentLiquidationThreshold.toString(),
							ltv: ltv.toString(),
							healthFactor: healthFactor.toString(),
							healthFactorFormatted: healthFactorFormatted,
							riskLevel: assessRiskLevel(parseFloat(healthFactorFormatted)),
						};

						// Check if withdrawal would cause health factor issues
						if (checkHealthFactor && totalDebtBase > 0n) {
							// Simple check: if user has debt and health factor is already low, warn about withdrawal
							if (parseFloat(healthFactorFormatted) < 1.5) {
								result.warning = `Warning: Current health factor is ${healthFactorFormatted}. Withdrawing collateral may increase liquidation risk.`;
							}
						}
					} catch (error: any) {
						result.accountDataError = error.message;
					}
				}

				if (simulationOnly) {
					try {
						// Get current underlying token balance
						const currentTokenBalance = await tokenContract.read.balanceOf([account.address]);

						result.simulation = {
							withdrawAmount: parsedAmount.toString(),
							withdrawAmountFormatted: formatUnits(parsedAmount, decimals),
							currentATokenBalance: aTokenBalance.toString(),
							currentATokenBalanceFormatted: formatUnits(aTokenBalance, decimals),
							currentTokenBalance: currentTokenBalance.toString(),
							currentTokenBalanceFormatted: formatUnits(currentTokenBalance, decimals),
							estimatedTokenBalanceAfter: formatUnits(currentTokenBalance + parsedAmount, decimals),
							estimatedATokenBalanceAfter: formatUnits(aTokenBalance - parsedAmount, decimals),
							estimatedGas: 'simulation_mode',
							canWithdraw: aTokenBalance >= parsedAmount,
						};
					} catch (error: any) {
						result.simulation = {
							error: error.message,
							success: false,
						};
					}
				} else {
					// Execute withdraw transaction
					// Use type(uint256).max for max withdrawal, otherwise use parsed amount
					const withdrawAmount =
						amountInput.toLowerCase() === 'max'
							? BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
							: parsedAmount;

					const withdrawHash = await poolContract.write.withdraw([
						assetAddress,
						withdrawAmount,
						(toAddress as `0x${string}`) || account.address,
					]);

					const withdrawReceipt = await publicClient.waitForTransactionReceipt({
						hash: withdrawHash,
					});

					result.transaction = {
						hash: withdrawHash,
						blockNumber: withdrawReceipt.blockNumber.toString(),
						gasUsed: withdrawReceipt.gasUsed.toString(),
						status: withdrawReceipt.status,
					};

					// Get updated balances
					const [newTokenBalance, newATokenBalance, updatedAccountData] = await Promise.all([
						tokenContract.read.balanceOf([(toAddress as `0x${string}`) || account.address]),
						aTokenContract.read.balanceOf([account.address]),
						poolContract.read.getUserAccountData([account.address]).catch(() => null),
					]);

					result.newTokenBalance = formatUnits(newTokenBalance, decimals);
					result.newTokenBalanceRaw = newTokenBalance.toString();
					result.newATokenBalance = formatUnits(newATokenBalance, decimals);
					result.newATokenBalanceRaw = newATokenBalance.toString();

					// Calculate actual withdrawn amount
					const actualWithdrawnAmount = aTokenBalance - newATokenBalance;
					result.actualWithdrawnAmount = formatUnits(actualWithdrawnAmount, decimals);
					result.actualWithdrawnAmountRaw = actualWithdrawnAmount.toString();

					if (updatedAccountData) {
						const [, , , , , newHealthFactor] = updatedAccountData;
						result.updatedHealthFactor = formatUnits(newHealthFactor, 18);
						result.healthFactorChange = result.accountData
							? (
									parseFloat(formatUnits(newHealthFactor, 18)) -
									parseFloat(result.accountData.healthFactorFormatted)
							  ).toFixed(4)
							: 'N/A';
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

// Helper function to assess risk level
function assessRiskLevel(healthFactor: number): string {
	if (healthFactor <= 0) return 'LIQUIDATED';
	if (healthFactor < 1) return 'LIQUIDATION_IMMINENT';
	if (healthFactor < 1.1) return 'CRITICAL';
	if (healthFactor < 1.5) return 'HIGH';
	if (healthFactor < 2) return 'MEDIUM';
	return 'LOW';
}
