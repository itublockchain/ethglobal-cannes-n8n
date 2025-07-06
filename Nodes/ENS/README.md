# n8n-nodes-ens

This is an n8n community node. It lets you use Ethereum Name Service (ENS) for domain name resolution in your n8n workflows.

ENS is a distributed, open, and extensible naming system based on the Ethereum blockchain. These nodes enable you to resolve ENS domains to addresses and vice versa, making blockchain interactions more user-friendly.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Compatibility](#compatibility)  
[Usage](#usage)  
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

## Operations

This node package supports the following operations:

### ENS: Get Address from ENS

- **Resolve ENS domains** to Ethereum addresses
- **Subdomain support** for complex domain structures
- **Multi-chain compatibility** across EVM networks
- **Automatic normalization** of domain names
- **Error handling** for invalid or unregistered domains

**Input Parameters:**

```
ENS Name: string (ENS domain name - e.g., "vitalik.eth")
Chain: string (Blockchain network name - default: "Ethereum")
```

### ENS: Get ENS from Address

- **Reverse resolution** from addresses to ENS names
- **Primary name lookup** for addresses
- **Multi-chain support** for resolution
- **Validation** of resolved names
- **Error handling** for addresses without ENS

**Input Parameters:**

```
Address: string (Ethereum wallet address - e.g., "0x1234...")
Chain: string (Blockchain network name - default: "Ethereum")
```

## Compatibility

- **Minimum n8n version**: 1.82.0
- **Node.js version**: 20.15 and above
- **Supported Networks**: All EVM-compatible blockchains with ENS support
- **Primary Network**: Ethereum Mainnet (recommended)

## Usage

### Resolve ENS Domain to Address

1. Add the ENS: Get Address from ENS node
2. Enter the ENS domain (e.g., "vitalik.eth")
3. Select the blockchain network (Ethereum recommended)
4. Get the resolved Ethereum address

### Get ENS Name from Address

1. Add the ENS: Get ENS from Address node
2. Enter the Ethereum address
3. Select the blockchain network
4. Get the primary ENS name for that address

### Example Use Cases

#### User-Friendly Payments

```
Input: "alice.eth"
Output: "0x1234...5678"
Use: Send payments to readable names instead of addresses
```

#### Address Verification

```
Input: "0x1234...5678"
Output: "alice.eth"
Use: Verify if an address has a registered ENS name
```

#### Wallet Integration

- Resolve user inputs from domain names
- Display friendly names instead of addresses
- Validate ENS ownership
- Create address books with ENS names

### Best Practices

- Always use Ethereum Mainnet for production ENS resolution
- Handle cases where ENS names don't exist
- Validate resolved addresses before using them
- Cache results to avoid repeated lookups
- Use proper error handling for network issues

### Error Handling

The nodes handle common scenarios:

- **Invalid ENS format**: Returns clear error message
- **Unregistered domains**: Indicates domain not found
- **Network issues**: Provides connection error details
- **Invalid addresses**: Validates address format

### Integration Examples

1. **Payment Systems**: Resolve recipient ENS to address
2. **User Profiles**: Display ENS names instead of addresses
3. **Address Validation**: Check if address has ENS name
4. **Domain Monitoring**: Track ENS registrations
5. **Wallet Integrations**: User-friendly address input

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [ENS documentation](https://docs.ens.domains/)
- [ENS app](https://app.ens.domains/)
