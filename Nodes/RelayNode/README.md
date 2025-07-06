# n8n-nodes-relay

This is an n8n community node. It lets you use Relay Protocol for cross-chain swaps and bridging in your n8n workflows.

Relay Protocol enables instant, gas-free bridging and swapping across multiple blockchains. These nodes allow you to get quotes, execute swaps, and perform cross-chain operations seamlessly within n8n.

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

### Relay: Get Quote

- **Cross-chain swap quotes** with real-time pricing
- **Multi-chain support** across major networks
- **Token-to-token** and **native currency** swaps
- **Detailed cost breakdown** and routing information
- **Recipient specification** for flexible workflows

**Input Parameters:**

```
Input Chain: options (abstractTestnet, polygonAmoy, arbitrumSepolia, baseSepolia, sepolia, holesky, optimismSepolia)
Output Chain: options (abstractTestnet, polygonAmoy, arbitrumSepolia, baseSepolia, sepolia, holesky, optimismSepolia)
Input Currency Address: string (Token contract address or 0x0000... for native)
Output Currency Address: string (Token contract address or 0x0000... for native)
Amount: string (Amount in smallest unit - wei for ETH)
Recipient Address: string (Wallet address to receive output tokens)
```

### Relay: Execute Swap

- **Execute cross-chain swaps** from quotes
- **Progress tracking** with detailed status updates
- **Transaction monitoring** and receipt handling
- **Flexible execution** with wait/no-wait options
- **Error handling** and retry mechanisms

**Input Parameters:**

```
Quote Source: options (From Previous Node, Manual Input)
Quote Data: string (Complete quote object JSON - only for Manual Input)
Input Chain: options (abstractTestnet, polygonAmoy, arbitrumSepolia, baseSepolia, sepolia, holesky, optimismSepolia - only for Manual Input)
Enable Progress Tracking: boolean (default: true)
Wait for Completion: boolean (default: true)
```

### Relay: Complete Swap

- **End-to-end swap execution** in one operation
- **Quote generation and execution** combined
- **Slippage protection** with configurable limits
- **Quote-only mode** for price checking
- **Automated approval** handling

**Input Parameters:**

```
Input Chain: options (abstractTestnet, polygonAmoy, arbitrumSepolia, baseSepolia, sepolia, holesky, optimismSepolia)
Output Chain: options (abstractTestnet, polygonAmoy, arbitrumSepolia, baseSepolia, sepolia, holesky, optimismSepolia)
Input Token Address: string (Token contract address or 0x0000... for native)
Output Token Address: string (Token contract address or 0x0000... for native)
Amount: string (Amount in smallest unit - wei for ETH)
Recipient Address: string (optional - defaults to wallet address)
Quote Only: boolean (default: false)
Max Slippage (%): number (default: 3)
```

## Credentials

To use these nodes, you need Relay credentials:

1. **Ethereum Wallet**: Create an Ethereum-compatible wallet
2. **Private Key**: Get your wallet's private key
3. **Relay Credentials**: Create Relay credentials in n8n with your private key

⚠️ **Security Warning**: Never share your private key and store it securely.

## Compatibility

- **Minimum n8n version**: 1.82.0
- **Node.js version**: 20.15 and above
- **Supported Networks**:
  - Ethereum Sepolia & Holesky
  - Arbitrum Sepolia
  - Base Sepolia
  - Optimism Sepolia
  - Polygon Amoy
  - Abstract Testnet

## Usage

### Get Cross-Chain Swap Quote

1. Add the Relay: Get Quote node
2. Select input and output chains
3. Enter token contract addresses (use 0x0000... for native tokens)
4. Specify amount in smallest unit (wei)
5. Set recipient address

### Execute a Swap

1. Connect Relay: Get Quote to Relay: Execute Swap
2. Enable progress tracking for detailed updates
3. Choose whether to wait for completion
4. Monitor transaction status and receipts

### Complete Swap in One Step

1. Add the Relay: Complete Swap node
2. Configure all swap parameters
3. Set slippage tolerance (default: 3%)
4. Use quote-only mode to check prices first
5. Execute when ready

### Best Practices

- Always get a quote first to check feasibility
- Use appropriate slippage settings (3-5% recommended)
- Monitor gas costs across different chains
- Test with small amounts first
- Enable progress tracking for transparency

### Example Workflow

1. **Get Quote**: ETH on Sepolia → USDC on Polygon Amoy
2. **Review Quote**: Check rates, fees, and routing
3. **Execute Swap**: Process the cross-chain transaction
4. **Monitor Progress**: Track execution status
5. **Confirm Receipt**: Verify tokens received on destination

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Relay Protocol documentation](https://docs.relay.link/)
- [Relay SDK documentation](https://docs.relay.link/sdk)
