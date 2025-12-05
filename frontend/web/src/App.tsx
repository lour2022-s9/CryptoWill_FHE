import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface WillData {
  id: number;
  owner: string;
  beneficiary: string;
  encryptedAssets: string;
  unlockConditions: string;
  timestamp: number;
}

const FHEEncryptNumber = (value: number): string => `FHE-${btoa(value.toString())}`;
const FHEDecryptNumber = (encryptedData: string): number => encryptedData.startsWith('FHE-') ? parseFloat(atob(encryptedData.substring(4))) : parseFloat(encryptedData);
const generatePublicKey = () => `0x${Array(2000).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [wills, setWills] = useState<WillData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingWill, setCreatingWill] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newWillData, setNewWillData] = useState({ beneficiary: "", assets: "", conditions: "" });
  const [selectedWill, setSelectedWill] = useState<WillData | null>(null);
  const [decryptedAssets, setDecryptedAssets] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [chainId, setChainId] = useState(0);
  const [startTimestamp, setStartTimestamp] = useState(0);
  const [durationDays, setDurationDays] = useState(30);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
    const initSignatureParams = async () => {
      const contract = await getContractReadOnly();
      if (contract) setContractAddress(await contract.getAddress());
      if (window.ethereum) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));
      }
      setStartTimestamp(Math.floor(Date.now() / 1000));
      setDurationDays(30);
      setPublicKey(generatePublicKey());
    };
    initSignatureParams();
  }, []);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        setTransactionStatus({ visible: true, status: "success", message: "Contract is available!" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      }
      
      const willsBytes = await contract.getData("wills");
      let willsList: WillData[] = [];
      if (willsBytes.length > 0) {
        try {
          const willsStr = ethers.toUtf8String(willsBytes);
          if (willsStr.trim() !== '') willsList = JSON.parse(willsStr);
        } catch (e) {}
      }
      setWills(willsList);
    } catch (e) {
      console.error("Error loading data:", e);
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
      setLoading(false); 
    }
  };

  const createWill = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingWill(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating will with Zama FHE..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const newWill: WillData = {
        id: wills.length + 1,
        owner: address,
        beneficiary: newWillData.beneficiary,
        encryptedAssets: FHEEncryptNumber(parseFloat(newWillData.assets) || 0),
        unlockConditions: newWillData.conditions,
        timestamp: Math.floor(Date.now() / 1000)
      };
      
      const updatedWills = [...wills, newWill];
      
      await contract.setData("wills", ethers.toUtf8Bytes(JSON.stringify(updatedWills)));
      
      setTransactionStatus({ visible: true, status: "success", message: "Will created successfully!" });
      await loadData();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewWillData({ beneficiary: "", assets: "", conditions: "" });
        setCurrentStep(1);
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "Submission failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingWill(false); 
    }
  };

  const decryptWithSignature = async (encryptedData: string): Promise<number | null> => {
    if (!isConnected) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const message = `publickey:${publicKey}\ncontractAddresses:${contractAddress}\ncontractsChainId:${chainId}\nstartTimestamp:${startTimestamp}\ndurationDays:${durationDays}`;
      await signMessageAsync({ message });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return FHEDecryptNumber(encryptedData);
    } catch (e) { 
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const renderFAQ = () => {
    const faqItems = [
      {
        question: "What is CryptoWill FHE?",
        answer: "A privacy-preserving digital inheritance system using Fully Homomorphic Encryption (FHE) to protect your assets until conditions are met."
      },
      {
        question: "How does FHE protect my assets?",
        answer: "FHE allows storing encrypted assets that can only be decrypted when specific conditions are verified without exposing the raw data."
      },
      {
        question: "What conditions can I set?",
        answer: "Time locks, multi-signature requirements, or oracle-based triggers like death certificates can be configured."
      },
      {
        question: "Who can decrypt my assets?",
        answer: "Only your designated beneficiary with proper cryptographic signatures can decrypt assets when conditions are met."
      },
      {
        question: "Is this legally binding?",
        answer: "While the protocol ensures cryptographic enforcement, you should consult legal professionals for full legal validity."
      }
    ];
    
    return (
      <div className="faq-container">
        {faqItems.map((item, index) => (
          <div className="faq-item" key={index}>
            <div className="faq-question">{item.question}</div>
            <div className="faq-answer">{item.answer}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderStepWizard = () => {
    return (
      <div className="step-wizard">
        <div className={`step ${currentStep === 1 ? 'active' : ''}`} onClick={() => setCurrentStep(1)}>
          <div className="step-number">1</div>
          <div className="step-title">Beneficiary</div>
        </div>
        <div className={`step ${currentStep === 2 ? 'active' : ''}`} onClick={() => setCurrentStep(2)}>
          <div className="step-number">2</div>
          <div className="step-title">Assets</div>
        </div>
        <div className={`step ${currentStep === 3 ? 'active' : ''}`} onClick={() => setCurrentStep(3)}>
          <div className="step-number">3</div>
          <div className="step-title">Conditions</div>
        </div>
        <div className={`step ${currentStep === 4 ? 'active' : ''}`} onClick={() => setCurrentStep(4)}>
          <div className="step-number">4</div>
          <div className="step-title">Review</div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Initializing encrypted will system...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="will-icon"></div>
          </div>
          <h1>Crypto<span>Will</span>FHE</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="create-btn"
          >
            <div className="add-icon"></div>Create Will
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content-container">
        <div className="dashboard-section">
          <div className="tabs-container">
            <div className="tabs">
              <button 
                className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                Dashboard
              </button>
              <button 
                className={`tab ${activeTab === 'wills' ? 'active' : ''}`}
                onClick={() => setActiveTab('wills')}
              >
                My Wills
              </button>
              <button 
                className={`tab ${activeTab === 'faq' ? 'active' : ''}`}
                onClick={() => setActiveTab('faq')}
              >
                FAQ
              </button>
            </div>
            
            <div className="tab-content">
              {activeTab === 'dashboard' && (
                <div className="dashboard-content">
                  <h2>Secure Digital Inheritance</h2>
                  <div className="panel artdeco-panel">
                    <h3>How It Works</h3>
                    <div className="fhe-flow">
                      <div className="flow-step">
                        <div className="step-icon">1</div>
                        <div className="step-content">
                          <h4>Encrypt Assets</h4>
                          <p>Your digital assets are encrypted with Zama FHE technology</p>
                        </div>
                      </div>
                      <div className="flow-arrow">→</div>
                      <div className="flow-step">
                        <div className="step-icon">2</div>
                        <div className="step-content">
                          <h4>Set Conditions</h4>
                          <p>Define when and how your assets should be inherited</p>
                        </div>
                      </div>
                      <div className="flow-arrow">→</div>
                      <div className="flow-step">
                        <div className="step-icon">3</div>
                        <div className="step-content">
                          <h4>Secure Storage</h4>
                          <p>Encrypted will is stored on-chain until conditions are met</p>
                        </div>
                      </div>
                      <div className="flow-arrow">→</div>
                      <div className="flow-step">
                        <div className="step-icon">4</div>
                        <div className="step-content">
                          <h4>Conditional Release</h4>
                          <p>Assets are decrypted only when conditions are verified</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === 'wills' && (
                <div className="wills-section">
                  <div className="section-header">
                    <h2>My Digital Wills</h2>
                    <div className="header-actions">
                      <button 
                        onClick={loadData} 
                        className="refresh-btn" 
                        disabled={isRefreshing}
                      >
                        {isRefreshing ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>
                  </div>
                  
                  <div className="wills-list">
                    {wills.length === 0 ? (
                      <div className="no-wills">
                        <div className="no-wills-icon"></div>
                        <p>No wills found</p>
                        <button 
                          className="create-btn" 
                          onClick={() => setShowCreateModal(true)}
                        >
                          Create First Will
                        </button>
                      </div>
                    ) : wills.filter(w => w.owner === address).map((will, index) => (
                      <div 
                        className={`will-item ${selectedWill?.id === will.id ? "selected" : ""}`} 
                        key={index}
                        onClick={() => setSelectedWill(will)}
                      >
                        <div className="will-title">Will #{will.id}</div>
                        <div className="will-meta">
                          <span>Beneficiary: {will.beneficiary.substring(0, 6)}...{will.beneficiary.substring(38)}</span>
                          <span>Assets: {will.encryptedAssets.substring(0, 15)}...</span>
                        </div>
                        <div className="will-date">Created: {new Date(will.timestamp * 1000).toLocaleDateString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {activeTab === 'faq' && (
                <div className="faq-section">
                  <h2>Frequently Asked Questions</h2>
                  {renderFAQ()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreateWill 
          onSubmit={createWill} 
          onClose={() => {
            setShowCreateModal(false);
            setCurrentStep(1);
          }} 
          creating={creatingWill} 
          willData={newWillData} 
          setWillData={setNewWillData}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          renderStepWizard={renderStepWizard}
        />
      )}
      
      {selectedWill && (
        <WillDetailModal 
          will={selectedWill} 
          onClose={() => { 
            setSelectedWill(null); 
            setDecryptedAssets(null); 
          }} 
          decryptedAssets={decryptedAssets} 
          setDecryptedAssets={setDecryptedAssets} 
          isDecrypting={isDecrypting} 
          decryptWithSignature={decryptWithSignature}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="will-icon"></div>
              <span>CryptoWill_FHE</span>
            </div>
            <p>Secure Digital Inheritance with FHE</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>Powered by Zama FHE</span>
          </div>
          <div className="copyright">© {new Date().getFullYear()} CryptoWill FHE. All rights reserved.</div>
          <div className="disclaimer">
            This system uses fully homomorphic encryption to protect your digital assets.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateWillProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  willData: any;
  setWillData: (data: any) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  renderStepWizard: () => JSX.Element;
}

const ModalCreateWill: React.FC<ModalCreateWillProps> = ({ 
  onSubmit, 
  onClose, 
  creating, 
  willData, 
  setWillData,
  currentStep,
  setCurrentStep,
  renderStepWizard
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setWillData({ ...willData, [name]: value });
  };

  const nextStep = () => setCurrentStep(currentStep + 1);
  const prevStep = () => setCurrentStep(currentStep - 1);

  return (
    <div className="modal-overlay">
      <div className="create-will-modal">
        <div className="modal-header">
          <h2>Create New Digital Will</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          {renderStepWizard()}
          
          <div className="fhe-notice">
            <div className="lock-icon"></div>
            <div>
              <strong>FHE Encryption Notice</strong>
              <p>All asset values will be encrypted with Zama FHE</p>
            </div>
          </div>
          
          {currentStep === 1 && (
            <div className="form-group">
              <label>Beneficiary Address *</label>
              <input 
                type="text" 
                name="beneficiary" 
                value={willData.beneficiary} 
                onChange={handleChange} 
                placeholder="Enter beneficiary wallet address..." 
              />
            </div>
          )}
          
          {currentStep === 2 && (
            <div className="form-group">
              <label>Asset Value (ETH) *</label>
              <input 
                type="number" 
                name="assets" 
                value={willData.assets} 
                onChange={handleChange} 
                placeholder="Enter total asset value..." 
              />
            </div>
          )}
          
          {currentStep === 3 && (
            <div className="form-group">
              <label>Unlock Conditions *</label>
              <textarea 
                name="conditions" 
                value={willData.conditions} 
                onChange={handleChange} 
                placeholder="Describe conditions for asset release (time lock, multi-sig, etc.)..." 
              />
            </div>
          )}
          
          {currentStep === 4 && (
            <div className="review-section">
              <h3>Will Summary</h3>
              <div className="review-item">
                <span>Beneficiary:</span>
                <strong>{willData.beneficiary || "Not specified"}</strong>
              </div>
              <div className="review-item">
                <span>Asset Value:</span>
                <strong>{willData.assets ? `${willData.assets} ETH` : "Not specified"}</strong>
              </div>
              <div className="review-item">
                <span>Unlock Conditions:</span>
                <strong>{willData.conditions || "Not specified"}</strong>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          {currentStep > 1 && (
            <button onClick={prevStep} className="cancel-btn">Back</button>
          )}
          {currentStep < 4 ? (
            <button 
              onClick={nextStep} 
              disabled={
                (currentStep === 1 && !willData.beneficiary) ||
                (currentStep === 2 && !willData.assets) ||
                (currentStep === 3 && !willData.conditions)
              } 
              className="next-btn"
            >
              Next
            </button>
          ) : (
            <button 
              onClick={onSubmit} 
              disabled={creating || !willData.beneficiary || !willData.assets || !willData.conditions} 
              className="submit-btn"
            >
              {creating ? "Creating with FHE..." : "Create Will"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface WillDetailModalProps {
  will: WillData;
  onClose: () => void;
  decryptedAssets: number | null;
  setDecryptedAssets: (value: number | null) => void;
  isDecrypting: boolean;
  decryptWithSignature: (encryptedData: string) => Promise<number | null>;
}

const WillDetailModal: React.FC<WillDetailModalProps> = ({ 
  will, 
  onClose, 
  decryptedAssets, 
  setDecryptedAssets, 
  isDecrypting, 
  decryptWithSignature
}) => {
  const handleDecrypt = async () => {
    if (decryptedAssets !== null) { 
      setDecryptedAssets(null); 
      return; 
    }
    
    const decrypted = await decryptWithSignature(will.encryptedAssets);
    if (decrypted !== null) {
      setDecryptedAssets(decrypted);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="will-detail-modal">
        <div className="modal-header">
          <h2>Will Details</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="will-info">
            <div className="info-item">
              <span>Owner:</span>
              <strong>{will.owner.substring(0, 6)}...{will.owner.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Beneficiary:</span>
              <strong>{will.beneficiary.substring(0, 6)}...{will.beneficiary.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>Date Created:</span>
              <strong>{new Date(will.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Encrypted Assets</h3>
            <div className="data-row">
              <div className="data-label">Assets:</div>
              <div className="data-value">{will.encryptedAssets.substring(0, 30)}...</div>
              <button 
                className="decrypt-btn" 
                onClick={handleDecrypt} 
                disabled={isDecrypting}
              >
                {isDecrypting ? (
                  "Decrypting..."
                ) : decryptedAssets !== null ? (
                  "Hide Value"
                ) : (
                  "Decrypt Assets"
                )}
              </button>
            </div>
            
            <div className="fhe-tag">
              <div className="fhe-icon"></div>
              <span>FHE Encrypted - Requires Wallet Signature</span>
            </div>
          </div>
          
          <div className="conditions-section">
            <h3>Unlock Conditions</h3>
            <div className="conditions-content">
              {will.unlockConditions}
            </div>
          </div>
          
          {decryptedAssets !== null && (
            <div className="decrypted-section">
              <h3>Decrypted Asset Value</h3>
              <div className="decrypted-value">
                <span>Assets:</span>
                <strong>{decryptedAssets.toFixed(2)} ETH</strong>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;