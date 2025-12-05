# CryptoWill: The Private Digital Inheritance & Will Protocol

CryptoWill is a groundbreaking solution allowing users to create encrypted digital inheritance plans powered by **Zama's Fully Homomorphic Encryption (FHE) technology**. This innovative protocol ensures that assets can only be decrypted and accessed by heirs under specific conditions, such as time locks and multi-signature confirmations.

## The Pain Point: Navigating Inheritance Challenges

The process of managing digital assets post-death is fraught with challenges. Heirs often face difficulties in accessing assets due to legal complications, lack of clarity in asset ownership, and privacy concerns surrounding sensitive information. Existing solutions often fail to provide the necessary security and privacy that individuals require when planning for their digital legacies. As digital wealth continues to grow, there is a pressing need for a reliable, secure, and legally compliant manner for individuals to manage their digital inheritance.

## Zama's FHE Solution

CryptoWill leverages **Zama's open-source libraries**, such as **Concrete** and **TFHE-rs**, to implement Fully Homomorphic Encryption, ensuring that all conditions related to asset decryption are met without compromising privacy. By utilizing FHE, CryptoWill allows for secure interactions with sensitive data, enabling the verification of conditions like proof of death without exposing the underlying information. This not only preserves the confidentiality of the user's wishes but also enhances the overall security of the entire digital inheritance process.

## Key Features

- **Encrypted Asset Management**: Users can list their digital assets and specify inheritance rules securely.
- **FHE-Based Trigger Conditions**: Inheritance conditions based on oracles (e.g., proof of death) ensure that assets are only accessible when the requirements are fulfilled.
- **Homomorphic Validation of Decryption Conditions**: The protocol verifies unlocking conditions without exposing sensitive information.
- **Privacy Compliance**: Users have complete control over their data and can ensure their asset management adheres to privacy regulations.

## Technology Stack

- **Zama SDK**: Incorporates Zama’s Fully Homomorphic Encryption libraries.
- **Solidity**: Smart contract programming language for Ethereum-based asset management.
- **Node.js**: JavaScript runtime for building the backend.
- **Hardhat**: For Ethereum smart contract development and testing.
- **React**: Frontend framework for user interaction.

## Directory Structure

Here's a quick look at the project's structure:

```
CryptoWill_FHE/
├── contracts/
│    └── CryptoWill.sol
├── scripts/
│    └── deploy.js
├── test/
│    └── testCryptoWill.js
├── .env
├── package.json
├── hardhat.config.js
└── README.md
```

## Installation Guide

To get started with CryptoWill, follow these installation steps:

1. Ensure you have **Node.js** installed on your machine. You can download it from the official Node.js website.
2. Install **Hardhat** by running the command `npm install --save-dev hardhat` in your project directory.
3. Navigate to your project folder and run `npm install` to fetch the required Zama FHE libraries and other dependencies.

**Important**: Please do not use `git clone` or any URLs to obtain this project. Follow the installation instructions strictly.

## Build & Run Guide

After setting up the project, follow these commands to build and test it:

### 1. Compile the Smart Contracts

```bash
npx hardhat compile
```

### 2. Run the Tests

Ensure that your contracts are working correctly by running the test suite:

```bash
npx hardhat test
```

### 3. Deploy the Contract

To deploy the contract to your chosen network, use the following command:

```bash
npx hardhat run scripts/deploy.js --network yourNetwork
```

### Example Code Snippet

Here’s a simplified example of how you might create an inheritance plan using the CryptoWill protocol:

```solidity
pragma solidity ^0.8.0;

import "./CryptoWill.sol";

contract InheritanceExample {
    CryptoWill will;

    // Function to create a new will
    function createWill(address _heir, uint256 _assetValue, uint256 _timeLock) public {
        will = new CryptoWill(_heir, _assetValue, _timeLock);
        // Additional logic for setting conditions
    }
}
```

This example demonstrates how users can create a new will by defining the heir, asset value, and conditions like time locks within the CryptoWill protocol.

## Acknowledgements

### Powered by Zama

We extend our heartfelt gratitude to the **Zama team** for their pioneering work in Fully Homomorphic Encryption and their commitment to developing open-source tools that empower confidential blockchain applications. Their innovative technology underpins the CryptoWill protocol, making secure and private digital inheritance planning a reality. Thank you for supporting the evolution of secure asset management!

---

With CryptoWill, planning for your digital legacy has never been more secure or straightforward! Experience the future of inheritance today.
