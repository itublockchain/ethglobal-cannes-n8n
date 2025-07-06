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

const AAVE_POOL_ABI = [
	{
		inputs: [
			{ name: 'asset', type: 'address' },
			{ name: 'amount', type: 'uint256' },
			{ name: 'interestRateMode', type: 'uint256' },
			{ name: 'referralCode', type: 'uint16' },
			{ name: 'onBehalfOf', type: 'address' },
		],
		name: 'borrow',
		outputs: [],
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
] as const;

export class AaveBorrow implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Aave: Borrow Assets',
		name: 'aaveBorrow',
		icon: { light: 'file:aave.svg', dark: 'file:aave.svg' },
		group: ['transform'],
		version: 1,
		description: 'Borrow assets from Aave V3 protocol',
		defaults: {
			name: 'Aave: Borrow Assets',
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
			categories: ['Aave', 'Blockchain', 'DeFi', 'Borrow'],
			alias: ['aave', 'blockchain', 'defi', 'borrow'],
			subcategories: {
				aave: ['Aave', 'Blockchain', 'DeFi', 'Borrow'],
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
				description: 'ERC20 token address to borrow (e.g., USDC, DAI, WETH)',
				placeholder: '0xA0b86a33E6441E2E552D4dd58D66f5D74aEeAdb1',
			},
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				default: '0',
				required: true,
				description: 'Amount to borrow in human readable format (e.g., "100" for 100 USDC)',
			},
			{
				displayName: 'Interest Rate Mode',
				name: 'interestRateMode',
				type: 'options',
				options: [
					{ name: 'Variable Rate', value: '2' },
					{ name: 'Stable Rate', value: '1' },
				],
				default: '2',
				description: 'Interest rate type (Variable is more common)',
			},
			{
				displayName: 'On Behalf Of',
				name: 'onBehalfOf',
				type: 'string',
				default: '',
				description: 'Address to borrow on behalf of (leave empty for your own address)',
			},
			{
				displayName: 'Referral Code',
				name: 'referralCode',
				type: 'number',
				default: 0,
				description: 'Referral code for the operation (usually 0)',
			},
			{
				displayName: 'Check Health Factor',
				name: 'checkHealthFactor',
				type: 'boolean',
				default: true,
				description: 'Verify health factor before borrowing to avoid liquidation risk',
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
				const interestRateMode = this.getNodeParameter('interestRateMode', i, '2') as string;
				const onBehalfOf = this.getNodeParameter('onBehalfOf', i, '') as string;
				const referralCode = this.getNodeParameter('referralCode', i, 0) as number;
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

				// Get token info
				const [decimals, tokenName, tokenSymbol] = await Promise.all([
					tokenContract.read.decimals(),
					tokenContract.read.name().catch(() => 'Unknown'),
					tokenContract.read.symbol().catch(() => 'Unknown'),
				]);

				// Parse the borrow amount
				const parsedAmount = parseUnits(amountInput, decimals);

				// If amount is 0, throw error
				if (parsedAmount === 0n) {
					throw new NodeOperationError(this.getNode(), `Cannot borrow 0 tokens.`);
				}

				const result: any = {
					success: true,
					operation: 'borrow',
					network: chain.name,
					poolAddress,
					assetAddress,
					tokenName,
					tokenSymbol,
					decimals,
					requestedAmount: amountInput,
					actualAmount: formatUnits(parsedAmount, decimals),
					parsedAmount: parsedAmount.toString(),
					interestRateMode: interestRateMode === '1' ? 'Stable' : 'Variable',
					walletAddress: account.address,
					timestamp: new Date().toISOString(),
				};

				// Get user account data (collateral, debt, health factor)
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
						const availableBorrowsFormatted = formatUnits(availableBorrowsBase, 8); // Aave uses 8 decimals for USD values

						result.accountData = {
							totalCollateralBase: totalCollateralBase.toString(),
							totalDebtBase: totalDebtBase.toString(),
							availableBorrowsBase: availableBorrowsBase.toString(),
							availableBorrowsUSD: availableBorrowsFormatted,
							currentLiquidationThreshold: currentLiquidationThreshold.toString(),
							ltv: ltv.toString(),
							healthFactor: healthFactor.toString(),
							healthFactorFormatted: healthFactorFormatted,
							riskLevel: AaveBorrow.assessRiskLevel(parseFloat(healthFactorFormatted)),
						};

						// Check if user has borrowing capacity
						if (availableBorrowsBase === 0n) {
							throw new NodeOperationError(
								this.getNode(),
								`No borrowing capacity available. You need to supply collateral first. Available borrows: $${availableBorrowsFormatted}`,
							);
						}

						// Check health factor if enabled
						if (checkHealthFactor && healthFactor > 0n && parseFloat(healthFactorFormatted) < 1.1) {
							throw new NodeOperationError(
								this.getNode(),
								`Health factor too low: ${healthFactorFormatted}. Risk of liquidation. Health factor should be above 1.1 for safety.`,
							);
						}
					} catch (error: any) {
						if (
							error.message.includes('Health factor') ||
							error.message.includes('borrowing capacity')
						) {
							throw error;
						}
						result.accountDataError = error.message;
					}
				}

				if (simulationOnly) {
					try {
						// Get current balance of the asset to be borrowed
						const currentBalance = await tokenContract.read.balanceOf([account.address]);

						result.simulation = {
							borrowAmount: parsedAmount.toString(),
							borrowAmountFormatted: formatUnits(parsedAmount, decimals),
							currentBalance: currentBalance.toString(),
							currentBalanceFormatted: formatUnits(currentBalance, decimals),
							interestRateMode: interestRateMode === '1' ? 'Stable' : 'Variable',
							estimatedGas: 'simulation_mode',
							canBorrow: result.accountData
								? result.accountData.availableBorrowsBase > 0n
								: 'unknown',
						};
					} catch (error: any) {
						result.simulation = {
							error: error.message,
							success: false,
						};
					}
				} else {
					// Execute borrow transaction
					const borrowHash = await poolContract.write.borrow([
						assetAddress,
						parsedAmount,
						BigInt(interestRateMode),
						referralCode,
						(onBehalfOf as `0x${string}`) || account.address,
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

					// Get updated balances
					const [newBalance, updatedAccountData] = await Promise.all([
						tokenContract.read.balanceOf([account.address]),
						poolContract.read.getUserAccountData([account.address]).catch(() => null),
					]);

					result.newTokenBalance = formatUnits(newBalance, decimals);
					result.newTokenBalanceRaw = newBalance.toString();

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

	private static assessRiskLevel(healthFactor: number): string {
		if (healthFactor <= 0) return 'LIQUIDATED';
		if (healthFactor < 1) return 'LIQUIDATION_IMMINENT';
		if (healthFactor < 1.1) return 'CRITICAL';
		if (healthFactor < 1.5) return 'HIGH';
		if (healthFactor < 2) return 'MEDIUM';
		return 'LOW';
	}
}
