# n8n-nodes-hardhat

This is an n8n community node. It lets you use Hardhat for smart contract compilation and deployment in your n8n workflows.

Hardhat is a development environment for Ethereum that helps developers compile, deploy, test, and debug smart contracts. These nodes enable you to compile Solidity contracts and deploy them to any EVM-compatible blockchain directly from n8n.

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

### Hardhat: Compile

- **Compile Solidity contracts** from source code
- **Multi-contract support** in single compilation
- **ABI and bytecode generation** for deployment
- **Automatic dependency resolution**
- **Error handling** with detailed compilation feedback
- **Temporary project management** with cleanup

**Input Parameters:**

```
Contract Code: string (Complete Solidity contract source code)
```

### Hardhat: Deploy

- **Deploy compiled contracts** to any EVM chain
- **Constructor argument support** for complex contracts
- **Multi-chain deployment** with automatic chain detection
- **Transaction receipt tracking**
- **Contract verification** data output
- **Gas estimation** and optimization

**Input Parameters:**

```
Contract Code: string (Complete Solidity contract source code)
Chain ID: number (Target blockchain chain ID - e.g., 11155111 for Sepolia)
Constructor Arguments: json (Array of constructor arguments)
Contract Name: string (Name of the contract to deploy from compilation output)
```

## Credentials

To use the deployment node, you need credentials:

1. **Ethereum Wallet**: Create an Ethereum-compatible wallet
2. **Private Key**: Get your wallet's private key
3. **Viem Credentials**: Create Viem credentials in n8n with your private key

⚠️ **Security Warning**: Never share your private key and store it securely.

## Compatibility

- **Minimum n8n version**: 1.82.0
- **Node.js version**: 20.15 and above
- **Solidity version**: 0.8.28 (configurable)
- **Supported Networks**: All EVM-compatible blockchains

## Usage

### Compile a Smart Contract

1. Add the Hardhat: Compile node
2. Paste your Solidity contract code
3. The node will automatically:
   - Set up a temporary Hardhat project
   - Install dependencies
   - Compile the contract
   - Return ABI and bytecode
   - Clean up temporary files

### Deploy a Compiled Contract

1. Connect Hardhat: Compile to Hardhat: Deploy
2. Specify the contract name to deploy
3. Set the target chain ID
4. Provide constructor arguments (if any)
5. Execute to deploy and get transaction details

### Example Workflow

```solidity
// Example contract code
pragma solidity ^0.8.28;

contract SimpleStorage {
    uint256 public storedData;

    constructor(uint256 _initialValue) {
        storedData = _initialValue;
    }

    function set(uint256 _value) public {
        storedData = _value;
    }

    function get() public view returns (uint256) {
        return storedData;
    }
}
```

1. **Compile**: Paste the contract code into Hardhat: Compile
2. **Deploy**: Use Hardhat: Deploy with:
   - Contract Name: "SimpleStorage"
   - Chain ID: 11155111 (Sepolia)
   - Constructor Arguments: [42]

### Advanced Features

- **Multiple contracts** in one file are supported
- **Import statements** work with standard libraries
- **Complex constructor arguments** with arrays and structs
- **Custom Hardhat configuration** through template modification
- **Automatic cleanup** prevents disk space issues

### Best Practices

- Test contracts on testnets first
- Use meaningful constructor arguments
- Verify contract source code after deployment
- Keep private keys secure
- Monitor gas costs for deployment

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Hardhat documentation](https://hardhat.org/docs)
- [Solidity documentation](https://docs.soliditylang.org/)
