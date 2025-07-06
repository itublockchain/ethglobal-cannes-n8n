# n8n-nodes-aave

This is an n8n community node. It lets you use Aave protocol for DeFi lending operations in your n8n workflows.

Aave is a decentralized lending protocol that allows users to supply, borrow, and manage crypto assets across multiple blockchains. These nodes enable you to interact with Aave V3 protocol directly within n8n.

## Nodes

- Aave: Supply Assets

```
  Network: string
  Asset Address: string
  Amount: string
  On Behalf Of: string
  Referral Code: number
  Simulation Only: boolean
```

- Aave: Borrow Assets
- Aave: Repay Assets
- Aave: Withdraw Assets
- Aave: Status

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

This node package supports the following Aave V3 operations:

### Aave: Supply Assets

- **Deposit tokens** to earn interest
- **Automatic approval** handling for ERC20 tokens
- **Max amount** support for full balance deposits
- **Health factor** monitoring
- **Simulation mode** for testing without execution

**Input Parameters:**

```
Network: options (mainnet, sepolia, polygon, arbitrum, base, optimism, avalanche)
Asset Address: string (ERC20 token contract address)
Amount: string (Amount to supply or "max" for full balance)
On Behalf Of: string (optional - Address to supply on behalf of)
Referral Code: number (default: 0)
Simulation Only: boolean (default: false)
```

### Aave: Borrow Assets

- **Variable and stable rate** borrowing
- **Health factor** validation to prevent liquidation
- **Borrowing capacity** checks
- **Risk assessment** warnings
- **Simulation mode** for safe testing

**Input Parameters:**

```
Network: options (sepolia, polygon, arbitrum, base, optimism, avalanche)
Asset Address: string (ERC20 token contract address to borrow)
Amount: string (Amount to borrow in human readable format)
Interest Rate Mode: options (Variable Rate, Stable Rate)
On Behalf Of: string (optional - Address to borrow on behalf of)
Referral Code: number (default: 0)
Check Health Factor: boolean (default: true)
Simulation Only: boolean (default: false)
```

### Aave: Repay Assets

- **Full or partial** debt repayment
- **Max amount** support for complete repayment
- **Automatic approval** for repayment tokens
- **Debt tracking** and balance updates

**Input Parameters:**

```
Network: options (sepolia, polygon, arbitrum, base, optimism, avalanche)
Asset Address: string (ERC20 token contract address to repay)
Amount: string (Amount to repay or "max" for full repayment)
```

### Aave: Withdraw Assets

- **Withdraw supplied assets** with interest
- **Health factor** protection
- **Max amount** support for full withdrawal
- **Collateral safety** checks

**Input Parameters:**

```
Network: options (sepolia, polygon, arbitrum, base, optimism, avalanche)
Asset Address: string (ERC20 token contract address to withdraw)
Amount: string (Amount to withdraw or "max" for full withdrawal)
Check Health Factor: boolean (default: true)
Simulation Only: boolean (default: false)
```

### Aave: Status

- **Account health monitoring**
- **Collateral and debt** overview
- **Risk level assessment**
- **Multi-network** support

**Input Parameters:**

```
Network: options (ethereum-sepolia, arbitrum-sepolia, optimism-sepolia, base-sepolia)
User Address: string (Ethereum address to check status for)
Custom RPC URL: string (optional - Custom RPC endpoint)
Timeout: number (default: 15000 - Request timeout in milliseconds)
```

## Credentials

To use these nodes, you need Aave credentials:

1. **Ethereum Wallet**: Create an Ethereum-compatible wallet
2. **Private Key**: Get your wallet's private key
3. **RPC URL** (optional): Custom RPC endpoint for better performance
4. **Aave Credentials**: Create Aave credentials in n8n with your private key

⚠️ **Security Warning**: Never share your private key and store it securely.

## Compatibility

- **Minimum n8n version**: 1.82.0
- **Node.js version**: 20.15 and above
- **Supported Networks**:
  - Ethereum Mainnet & Sepolia
  - Polygon, Arbitrum, Base, Optimism
  - Avalanche

## Usage

### Supply Assets to Earn Interest

1. Add the Aave: Supply Assets node
2. Select your network
3. Enter the token contract address (e.g., USDC, DAI)
4. Specify amount or use "max" for full balance
5. Enable simulation mode to test first

### Borrow Against Collateral

1. Add the Aave: Borrow Assets node
2. Ensure you have supplied collateral first
3. Select the asset to borrow
4. Choose interest rate mode (Variable recommended)
5. Monitor health factor to avoid liquidation

### Monitor Your Position

1. Add the Aave: Status node
2. Enter your wallet address
3. Check health factor and risk level
4. Monitor collateral and debt ratios

### Safety Tips

- Always check health factor before borrowing/withdrawing
- Use simulation mode to test operations
- Monitor liquidation risk regularly
- Keep health factor above 1.5 for safety

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Aave protocol documentation](https://docs.aave.com/)
- [Aave V3 technical documentation](https://docs.aave.com/developers/)
