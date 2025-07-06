# ITU Blockchain x n8n: n3XUS

![Banner](./Assets/banner.png)

## 🚀 Overview

n3XUS is an open-source node suite designed for n8n, the popular workflow automation engine. It seamlessly bridges the gap between Web3 functionalities and traditional commerce, empowering users to integrate advanced crypto operations into their automated workflows with unprecedented ease. Say goodbye to complex coding and hello to drag-and-drop simplicity!

## ✨ What Problem Does n3XUS Solve?

The world of Web3, with its decentralized applications, cryptocurrencies, and NFTs, often presents a steep learning curve and significant technical barriers for businesses and individuals looking to leverage its power. Integrating on-chain and off-chain data, triggering transactions, or managing digital assets typically requires specialized development skills and extensive time.

n3XUS eliminates this complexity. It transforms intricate Web3 interactions into simple, visually connectable modules within n8n, allowing anyone to build sophisticated crypto-integrations without writing a single line of code.

## 💡 Key Features & Capabilities

n3XUS empowers you to build powerful, automated logic in minutes, not months, by offering:

**Effortless Web3 Integration:** Drag-and-drop nodes make complex crypto operations accessible to everyone.

**On-Chain & Off-Chain Triggers:** Listen for specific events on various blockchains or external Web2 platforms to initiate workflows.

**Customizable Actions:** Execute a wide range of actions based on your triggers.

**Visual Workflow Builder:** Connect modules intuitively within n8n's visual interface.

Seamless Web2 & Web3 Synergy: Combine Web3 nodes with existing Web2 nodes for comprehensive automation.

## Examples of What You Can Build:

With n3XUS, you can visually connect modules to create powerful, automated workflows, such as:

**Get Liquidity Pools:** Retrieve real-time data from decentralized exchanges.

**Trigger a Transaction:** Automate cryptocurrency transfers or smart contract interactions.

**Mint an NFT:** Programmatically create and deploy non-fungible tokens.

**Send Message to Discord:** Notify your community about on-chain events.

**Post in X (formerly Twitter):** Announce new NFT sales or significant transactions.

## 🛠️ Getting Started

1. Install n8n

```bash
npm install n8n -g
```

2. Install n3XUS

```bash
npm install n3xus -g
```

3. Initialize n3XUS

```bash
npx n3xus init
```

4. (Final step) Choose the nodes you want to install and start n8n

```bash
n8n start
```

## Node Specifications

 ### [Aave](./Nodes/AaveNode/README.md#Nodes)
>  - [Aave: Supply Assets](./Nodes/AaveNode/README.md#Aave-Supply-Assets)
 > - [Aave: Borrow Assets](./Nodes/AaveNode/README.md#Aave-Borrow-Assets)
  >- [Aave: Repay Assets](./Nodes/AaveNode/README.md#Aave-Repay-Assets)
 > - [Aave: Withdraw Assets](./Nodes/AaveNode/README.md#Aave-Withdraw-Assets)
 > - [Aave: Status](./Nodes/AaveNode/README.md#Aave-Status)
>
### [The Graph](./Nodes/TheGraph/README.md#Nodes) 
 > - [The Graph: Get Liquidity Pools](./Nodes/TheGraph/README.md#The-Graph-Get-Liquidity-Pools)
 > - [The Graph: Get Token Holders](./Nodes/TheGraph/README.md#The-Graph-Get-Token-Holders)
> - [The Graph: View Wallet Balances](./Nodes/TheGraph/README.md#The-Graph-View-Wallet-Balances)
 > - [The Graph: Fetch NFT Events](./Nodes/TheGraph/README.md#The-Graph-Fetch-NFT-Events)
 > - [The Graph: Fetch Token Events](./Nodes/TheGraph/README.md#The-Graph-Fetch-Token-Events)


 ### [ENS](./Nodes/ENS/README.md#Nodes) 
>  - [ENS: Address to ENS](./Nodes/ENS/README.md#ENS-Address-to-ENS)
 > - [ENS: ENS to Address](./Nodes/ENS/README.md#ENS-ENS-to-Address)
>
### [Viem](./Nodes/Viem/README.md#Nodes) 
>  - [Viem: Transaction](./Nodes/Viem/README.md#Viem-Transaction)
 > - [Viem: Contract](./Nodes/Viem/README.md#Viem-Contract)
 > - [Viem: Get Chain](./Nodes/Viem/README.md#Viem-Get-Chain)
>
### [Relay](./Nodes/RelayNode/README.md#Nodes) 
 > - [Relay: Get Quote](./Nodes/RelayNode/README.md#Relay-Get-Quote)
  >- [Relay: Execute Swap](./Nodes/RelayNode/README.md#Relay-Execute-Swap)
  >- [Relay: Complete Swap](./Nodes/RelayNode/README.md#Relay-Complete-Swap)
>

## 🤝 Contribution

n3XUS is an open-source project, and we welcome contributions from the community. Whether it's bug fixes, new features, or documentation improvements, your help is invaluable. Please refer to our CONTRIBUTING.md (coming soon) for guidelines.
