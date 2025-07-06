# n8n-nodes-viem

This is an n8n community node. It lets you use Viem for blockchain interactions in your n8n workflows.

Viem is a modern TypeScript library for interacting with Ethereum and other EVM-compatible blockchains. These nodes enable you to interact with smart contracts, send transactions, and read blockchain data directly within n8n.

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

### Viem: Contract

- **Smart Contract Reading**: Read data from smart contracts on the blockchain
- **Smart Contract Writing**: Send transactions and call functions on smart contracts
- ABI (Application Binary Interface) support
- Multi-chain support

**Input Parameters:**

```
Chain ID: number (Blockchain chain ID - default: 11155111 for Sepolia)
Contract Address: string (Smart contract address on the blockchain)
ABI: json (Contract Application Binary Interface)
Function Name: string (Name of the contract function to call)
Contract Type (read/write): string (Operation type - default: "read")
```

### Viem: Transaction

- **Native Token Transfer**: Send ETH and other native tokens
- **ERC20 Token Transfer**: Send ERC20 tokens
- Automatic balance checking
- Transaction receipt tracking

**Input Parameters:**

```
Chain: json (Blockchain chain configuration - default: sepolia)
Recipient Address: string (Ethereum address of the recipient)
Value: number (Value in ETH - default: 0)
Choose Token or Native Currency: options (Token, Native Currency - default: "native")
ERC20 Token Address (Optional): string (Token contract address for ERC20 transfers)
```

### Viem: Get Chain

- **Chain Information**: Get blockchain information by Chain ID or chain name
- Support for all EVM chains
- Chain metadata and RPC information

**Input Parameters:**

```
Chain Name (if not provided, chain ID is required): string (Blockchain name - default: "Sepolia")
Chain ID (if not provided, chain name is required): number (Blockchain chain ID - default: 11155111)
```

## Credentials

To use these nodes, you need a private key:

1. **Ethereum Wallet**: Create an Ethereum-compatible wallet
2. **Private Key**: Get your wallet's private key
3. **Viem Credentials**: Create Viem credentials in n8n and add your private key

⚠️ **Security Warning**: Never share your private key and store it securely.

## Compatibility

- **Minimum n8n version**: 1.82.0
- **Node.js version**: 20.15 and above
- **Supported Blockchains**: All EVM-compatible blockchains (Ethereum, Polygon, Arbitrum, etc.)

## Usage

### Basic Smart Contract Reading

1. Add the Viem: Contract node
2. Enter the contract address and ABI
3. Set Contract Type to "read"
4. Enter the function name you want to call

### Token Transfer Operation

1. Add the Viem: Transaction node
2. Enter recipient address and amount
3. Choose token type (Native or ERC20)
4. For ERC20, add the token address

### Getting Chain Information

1. Add the Viem: Get Chain node
2. Enter Chain ID or chain name
3. Retrieve blockchain information

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Viem documentation](https://viem.sh/)
- [Ethereum developer resources](https://ethereum.org/developers/)
