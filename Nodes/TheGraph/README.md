# n8n-nodes-thegraph

This is an n8n community node. It lets you use The Graph protocol for blockchain data indexing and querying in your n8n workflows.

The Graph is a decentralized protocol for indexing and querying blockchain data. These nodes enable you to fetch NFT events, token transfers, wallet balances, and liquidity pool data across multiple blockchains.

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

This node package supports the following operations:

### The Graph: Fetch NFT Events

- **Monitor NFT activities** across multiple chains
- **Real-time event tracking** with hash-based change detection
- **Activity filtering** by contract address
- **Historical data** access

**Input Parameters:**

```
NFT Contract Address: string (NFT contract address to monitor)
Chain: string (arbitrum-one, avalanche, base, bsc, mainnet, matic, optimism, unichain)
```

### The Graph: Fetch Token Events

- **Track token transfers** and transactions
- **ERC20 token monitoring** across networks
- **Transfer history** with pagination
- **Change detection** to avoid duplicate processing

**Input Parameters:**

```
Token Contract Address: string (ERC20 token contract address to monitor)
Chain: string (arbitrum-one, avalanche, base, bsc, mainnet, matic, optimism, unichain)
```

### The Graph: Get Token Holders

- **Analyze token distribution** across addresses
- **Multi-network holder data** aggregation
- **Top holders** ranking by balance
- **Network-specific** holder breakdown

**Input Parameters:**

```
Token Address: string (ERC20 token contract address to analyze)
```

### The Graph: Get Liquidity Pools

- **Discover liquidity pools** for specific tokens
- **Cross-chain pool data** aggregation
- **Pool metadata** and statistics
- **DEX integration** information

**Input Parameters:**

```
Token Address: string (Token contract address to find pools for)
```

### The Graph: View Wallet Balances

- **Multi-chain wallet analysis**
- **Token balance tracking** across networks
- **Portfolio overview** for any address
- **Network-grouped** balance data

**Input Parameters:**

```
EVM Address: string (Ethereum wallet address to analyze)
```

## Credentials

To use these nodes, you need The Graph credentials:

1. **The Graph Account**: Sign up at [The Graph Studio](https://thegraph.com/studio/)
2. **API Key**: Generate an API key from your dashboard
3. **API Token**: Create an access token for authentication
4. **The Graph Credentials**: Add both API key and token to n8n credentials

## Compatibility

- **Minimum n8n version**: 1.82.0
- **Node.js version**: 20.15 and above
- **Supported Networks**:
  - Ethereum Mainnet
  - Arbitrum One
  - Polygon (Matic)
  - Optimism
  - Base, BSC, Avalanche
  - Unichain

## Usage

### Monitor NFT Collection Activity

1. Add The Graph: Fetch NFT Events node
2. Enter the NFT contract address
3. Select the blockchain network
4. The node will track new activities automatically

### Track Token Transfers

1. Add The Graph: Fetch Token Events node
2. Specify the token contract address
3. Choose the network
4. Monitor real-time transfer events

### Analyze Token Distribution

1. Add The Graph: Get Token Holders node
2. Enter the token address
3. Get top holders across all supported networks
4. Analyze distribution patterns

### Find Liquidity Pools

1. Add The Graph: Get Liquidity Pools node
2. Specify the token address
3. Discover available pools across DEXs
4. Analyze liquidity distribution

### Check Wallet Portfolio

1. Add The Graph: View Wallet Balances node
2. Enter the wallet address
3. Get complete portfolio across all networks
4. Monitor balance changes

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [The Graph documentation](https://thegraph.com/docs/)
- [The Graph Studio](https://thegraph.com/studio/)
