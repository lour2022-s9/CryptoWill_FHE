pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";


contract CryptoWill_FHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    error NotOwner();
    error NotProvider();
    error Paused();
    error CooldownActive();
    error BatchNotOpen();
    error BatchAlreadyClosed();
    error InvalidAddress();
    error InvalidParameter();
    error ReplayAttempt();
    error StateMismatch();
    error DecryptionFailed();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event ContractPaused();
    event ContractUnpaused();
    event CooldownSecondsUpdated(uint256 oldCooldownSeconds, uint256 newCooldownSeconds);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event WillSubmitted(address indexed submitter, uint256 indexed batchId, uint256 willId);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId, uint256 willId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 willId, uint32 unlockTime, bool conditionsMet);

    address public owner;
    mapping(address => bool) public providers;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    struct Will {
        euint32 encryptedUnlockTime;
        ebool encryptedConditionsMet;
    }
    mapping(uint256 => mapping(uint256 => Will)) public wills; // batchId => willId => Will
    uint256 public currentBatchId;
    mapping(uint256 => bool) public batchClosed; // batchId => isClosed

    struct DecryptionContext {
        uint256 batchId;
        uint256 willId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!providers[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier checkSubmissionCooldown() {
        if (block.timestamp < lastSubmissionTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    modifier checkDecryptionRequestCooldown() {
        if (block.timestamp < lastDecryptionRequestTime[msg.sender] + cooldownSeconds) {
            revert CooldownActive();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        providers[msg.sender] = true;
        emit ProviderAdded(msg.sender);
        cooldownSeconds = 60; // Default cooldown
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function addProvider(address provider) external onlyOwner {
        if (provider == address(0)) revert InvalidAddress();
        if (!providers[provider]) {
            providers[provider] = true;
            emit ProviderAdded(provider);
        }
    }

    function removeProvider(address provider) external onlyOwner {
        if (providers[provider]) {
            delete providers[provider];
            emit ProviderRemoved(provider);
        }
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit ContractPaused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit ContractUnpaused();
    }

    function setCooldownSeconds(uint256 newCooldownSeconds) external onlyOwner {
        if (newCooldownSeconds == 0) revert InvalidParameter();
        emit CooldownSecondsUpdated(cooldownSeconds, newCooldownSeconds);
        cooldownSeconds = newCooldownSeconds;
    }

    function openBatch() external onlyOwner whenNotPaused {
        currentBatchId++;
        // Ensure batchClosed is false for the new batch
        batchClosed[currentBatchId] = false;
        emit BatchOpened(currentBatchId);
    }

    function closeBatch() external onlyOwner whenNotPaused {
        if (batchClosed[currentBatchId]) revert BatchAlreadyClosed();
        batchClosed[currentBatchId] = true;
        emit BatchClosed(currentBatchId);
    }

    function submitWill(
        euint32 encryptedUnlockTime,
        ebool encryptedConditionsMet
    ) external onlyProvider whenNotPaused checkSubmissionCooldown {
        if (batchClosed[currentBatchId]) revert BatchNotOpen();
        uint256 willId = wills[currentBatchId].length; // Use mapping to simulate array length
        wills[currentBatchId][willId] = Will(encryptedUnlockTime, encryptedConditionsMet);
        lastSubmissionTime[msg.sender] = block.timestamp;
        emit WillSubmitted(msg.sender, currentBatchId, willId);
    }

    function requestWillDecryption(uint256 batchId, uint256 willId) external onlyProvider whenNotPaused checkDecryptionRequestCooldown {
        if (batchClosed[batchId]) revert BatchNotOpen(); // Cannot request decryption for a closed batch
        Will storage will = wills[batchId][willId];

        euint32 memory unlockTime = will.encryptedUnlockTime;
        ebool memory conditionsMet = will.encryptedConditionsMet;

        // 1. Prepare Ciphertexts
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = unlockTime.toBytes32();
        cts[1] = conditionsMet.toBytes32();

        // 2. Compute State Hash
        bytes32 stateHash = _hashCiphertexts(cts);

        // 3. Request Decryption
        uint256 requestId = FHE.requestDecryption(cts, this.myCallback.selector);

        // 4. Store Context
        decryptionContexts[requestId] = DecryptionContext({
            batchId: batchId,
            willId: willId,
            stateHash: stateHash,
            processed: false
        });
        lastDecryptionRequestTime[msg.sender] = block.timestamp;
        emit DecryptionRequested(requestId, batchId, willId);
    }

    function myCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        DecryptionContext storage context = decryptionContexts[requestId];

        // a. Replay Guard
        if (context.processed) revert ReplayAttempt();

        // b. State Verification
        // Rebuild cts array from current contract storage in the exact same order
        Will storage will = wills[context.batchId][context.willId];
        euint32 memory currentUnlockTime = will.encryptedUnlockTime;
        ebool memory currentConditionsMet = will.encryptedConditionsMet;

        bytes32[] memory currentCts = new bytes32[](2);
        currentCts[0] = currentUnlockTime.toBytes32();
        currentCts[1] = currentConditionsMet.toBytes32();

        bytes32 currentStateHash = _hashCiphertexts(currentCts);
        if (currentStateHash != context.stateHash) {
            revert StateMismatch();
        }
        // Security Comment: State hash verification ensures that the ciphertexts being decrypted
        // are identical to those that were present when the decryption was requested.
        // This prevents scenarios where an attacker might alter the ciphertexts after
        // the request but before the decryption completes, leading to incorrect cleartexts.

        // c. Proof Verification
        if (!FHE.checkSignatures(requestId, cleartexts, proof)) {
            revert DecryptionFailed();
        }

        // d. Decode & Finalize
        // Cleartexts are expected in the same order as cts: [unlockTime, conditionsMet]
        uint32 unlockTimeCleartext = abi.decode(cleartexts[0:32], (uint32));
        bool conditionsMetCleartext = abi.decode(cleartexts[32:64], (bool));

        context.processed = true;
        // Security Comment: The `processed` flag acts as a replay protection mechanism.
        // It ensures that a successful decryption callback for a given `requestId`
        // cannot be executed more than once, even if an attacker somehow replays the transaction.
        emit DecryptionCompleted(requestId, context.batchId, context.willId, unlockTimeCleartext, conditionsMetCleartext);
    }

    function _hashCiphertexts(bytes32[] memory cts) internal pure returns (bytes32) {
        return keccak256(abi.encode(cts, address(this)));
    }
}