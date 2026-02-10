'use client';

import { useState, useRef, ChangeEvent, useMemo, useEffect } from 'react';
import { MarketConfig, AccountData } from '@/types';
import { cn, formatAmount } from '@/lib/utils';
import { saveEntryPrice } from '@/lib/entryPriceCache';
import { savePositionMarker } from '@/lib/positionMarkers';
import { useWallet } from '@/contexts/WalletContext';
import { PublicKey } from '@solana/web3.js';
import { buildInitUserTransaction, buildDepositTransaction, buildWithdrawTransaction, buildTradeTransaction } from '@/lib/transactions';
import { encryptData, decryptData } from '@/lib/crypto';
import { PinModal } from '@/components/PinModal';
import BN from 'bn.js';
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calculator,
  BarChart3,
  Power,
  FileJson,
  Key,
  Check,
  X,
  Shield,
  ShieldOff,
  LogOut,
  ArrowDownToLine,
  ArrowUpFromLine
} from 'lucide-react';

interface TradingPanelProps {
  market: MarketConfig | null;
  accounts: AccountData[];
  vaultBalance: BN;
  vaultAddress?: string;
  vaultAuthorityBump?: number;
  unitScale?: number;           // Unit scale from slab config
  totalOpenInterest: BN;
  oraclePriceE6: BN;            // Oracle price in E6 format
  initialMarginBps: BN;         // Initial margin requirement in basis points (e.g., 1000 = 10% = 10x max leverage)
  baseSymbol: string;           // Base token symbol (e.g., LIQUID)
  baseDecimals: number;         // Base token decimals (e.g., 6)
  collateralSymbol: string;     // Collateral token symbol (e.g., SOL)
  collateralDecimals: number;   // Collateral token decimals (e.g., 9)
  className?: string;
}

type OrderSide = 'long' | 'short';
type OrderType = 'market' | 'limit';
type WalletTab = 'browser' | 'keypair' | 'json';
type ActionTab = 'trade' | 'deposit' | 'withdraw';

export function TradingPanel({
  market,
  accounts,
  vaultBalance,
  vaultAddress,
  vaultAuthorityBump,
  unitScale,
  totalOpenInterest,
  oraclePriceE6,
  initialMarginBps,
  baseSymbol,
  baseDecimals,
  collateralSymbol,
  collateralDecimals,
  className
}: TradingPanelProps) {
  const [actionTab, setActionTab] = useState<ActionTab>('trade');
  const [side, setSide] = useState<OrderSide>('long');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [leverage, setLeverage] = useState('2');
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletTab, setWalletTab] = useState<WalletTab>('browser');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [saveKeypair, setSaveKeypair] = useState(false);
  const [keypairLabel, setKeypairLabel] = useState('');
  const [savedKeypairs, setSavedKeypairs] = useState<Array<{label: string; key: string; publicKey: string}>>([]);
  const [showGeneratedKey, setShowGeneratedKey] = useState(false);
  const [generatedKeypair, setGeneratedKeypair] = useState<{secretKey: string; publicKey: string} | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'set' | 'unlock' | 'change-verify' | 'change-new'>('set');
  const [pinError, setPinError] = useState('');
  const [oldPin, setOldPin] = useState<string | null>(null);
  const [keypairError, setKeypairError] = useState('');
  const [deleteConfirmPublicKey, setDeleteConfirmPublicKey] = useState<string | null>(null);
  const [pendingKeypair, setPendingKeypair] = useState<{label: string; key: string; publicKey: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>('0');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [mathProblem, setMathProblem] = useState<{question: string; answer: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    connection,
    isConnected,
    isConnecting,
    publicKey,
    walletType,
    autoSign,
    setAutoSign,
    connectPhantom,
    connectSolflare,
    connectKeypair,
    connectFromJson,
    disconnect,
    signAndSendTransaction,
    error: walletError,
    clearError,
  } = useWallet();

  // Get or prompt for PIN
  const getPin = async (): Promise<string> => {
    return new Promise((resolve) => {
      // Check session storage first
      const sessionPin = sessionStorage.getItem('wallet-pin');
      if (sessionPin) {
        resolve(sessionPin);
        return;
      }

      // Show PIN modal
      setPinModalMode('unlock');
      setShowPinModal(true);

      // Wait for PIN submission (will be handled in handlePinSubmit)
      const checkPin = setInterval(() => {
        const pin = sessionStorage.getItem('wallet-pin');
        if (pin) {
          clearInterval(checkPin);
          resolve(pin);
        }
      }, 100);
    });
  };

  // Load failed attempts from localStorage
  useEffect(() => {
    const attempts = localStorage.getItem('pin-failed-attempts');
    if (attempts) {
      setFailedAttempts(parseInt(attempts, 10));
    }
  }, []);

  // Generate math problem for challenge
  const generateMathProblem = () => {
    const operations = [
      { op: '+', fn: (a: number, b: number) => a + b },
      { op: '-', fn: (a: number, b: number) => a - b },
      { op: '×', fn: (a: number, b: number) => a * b },
    ];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const answer = operation.fn(a, b);
    return {
      question: `${a} ${operation.op} ${b} = ?`,
      answer
    };
  };

  // Wipe all saved keypairs
  const wipeAllKeypairs = () => {
    localStorage.removeItem('saved-keypairs-encrypted');
    localStorage.removeItem('pin-failed-attempts');
    sessionStorage.removeItem('wallet-pin');
    setSavedKeypairs([]);
    setFailedAttempts(0);
    if (wallet) {
      disconnectWallet();
    }
    setKeypairError('🚨 SECURITY LOCKOUT: All wallet keys have been permanently deleted due to too many failed PIN attempts. 🚨');
  };

  // Validate math answer
  const validateMathAnswer = (answer: string): boolean => {
    if (!mathProblem) return false;
    const numAnswer = parseInt(answer, 10);
    return numAnswer === mathProblem.answer;
  };

  // Load saved keypairs from localStorage
  useEffect(() => {
    const loadKeypairs = async () => {
      try {
        const saved = localStorage.getItem('saved-keypairs-encrypted');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Check if we have encrypted data
          if (parsed.encrypted && parsed.data) {
            // Load the keypair metadata (label, publicKey) but keep keys encrypted
            // This allows the list to show up without requiring PIN immediately
            setSavedKeypairs(parsed.data.map((kp: any) => ({
              label: kp.label,
              publicKey: kp.publicKey,
              key: kp.key, // Encrypted key
              encrypted: true
            })));
          } else {
            // Legacy unencrypted data
            setSavedKeypairs(parsed);
          }
        }
      } catch (err) {
        console.error('Error loading saved keypairs:', err);
      }
    };
    loadKeypairs();
  }, []);

  // Close modal when wallet connects successfully
  useEffect(() => {
    if (isConnected && showWalletModal) {
      setShowWalletModal(false);
      setPrivateKeyInput('');
      setSaveKeypair(false);
      setKeypairLabel('');
    }
  }, [isConnected, showWalletModal]);

  // Find user's account index and data in the slab
  const userAccountIdx = useMemo(() => {
    if (!publicKey || !accounts.length) return null;
    const userAccount = accounts.find(a => a.owner.equals(publicKey));
    return userAccount ? userAccount.accountId.toNumber() : null;
  }, [publicKey, accounts]);

  const userAccount = useMemo(() => {
    if (!publicKey || !accounts.length) return null;
    return accounts.find(a => a.owner.equals(publicKey));
  }, [publicKey, accounts]);

  // Fetch wallet balance
  useEffect(() => {
    if (!publicKey || !connection) return;

    const fetchBalance = async () => {
      try {
        const balance = await connection.getBalance(publicKey);
        setWalletBalance((balance / 1e9).toFixed(4));
      } catch (err) {
        console.error('Error fetching wallet balance:', err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [publicKey, connection]);


  // Calculate estimated position size for display only
  // The protocol converts SOL to base tokens internally using its oracle
  // We just estimate using current exchange rate for UI display
  const notionalValue = useMemo(() => {
    if (!collateralAmount || parseFloat(collateralAmount) <= 0 || !oraclePriceE6 || oraclePriceE6.isZero()) {
      return 0;
    }

    const collateralFloat = parseFloat(collateralAmount);
    const leverageFloat = parseFloat(leverage);
    const positionValueInSOL = collateralFloat * leverageFloat;

    // Use Percolator's formula: position_size = notional_lamports × 1,000,000 / oracle_price_e6
    const positionValueLamports = positionValueInSOL * Math.pow(10, collateralDecimals);
    const positionSize = (positionValueLamports * 1_000_000) / oraclePriceE6.toNumber();
    const estimatedBaseTokens = positionSize / Math.pow(10, baseDecimals);

    return estimatedBaseTokens;
  }, [collateralAmount, leverage, oraclePriceE6, collateralDecimals, baseDecimals]);

  // Calculate estimated liquidation price (simplified)
  // Assumes ~10% maintenance margin requirement
  const estimatedLiqPrice = useMemo(() => {
    if (!collateralAmount || parseFloat(collateralAmount) <= 0 || !oraclePriceE6 || oraclePriceE6.isZero()) {
      return null;
    }

    // Oracle price is in E6 format (6 decimals)
    const entryPrice = oraclePriceE6.toNumber() / 1e6;
    const leverageNum = parseFloat(leverage);
    const maintenanceMargin = 0.10; // 10% maintenance margin

    if (side === 'long') {
      // Long liquidation = Entry * (1 - (1 - maintenanceMargin) / leverage)
      return entryPrice * (1 - (1 - maintenanceMargin) / leverageNum);
    } else {
      // Short liquidation = Entry * (1 + (1 - maintenanceMargin) / leverage)
      return entryPrice * (1 + (1 - maintenanceMargin) / leverageNum);
    }
  }, [collateralAmount, leverage, side, oraclePriceE6]);

  // Check if collateral exceeds available capital
  // Reserve 3% buffer for fees, funding payments, and margin safety
  const CAPITAL_BUFFER_PERCENT = 0.03;
  const SAFETY_MARGIN_SOL = 0.0001; // Extra safety margin to prevent floating point precision issues

  const availableCapital = useMemo(() => {
    if (!userAccount) return 0;
    const totalCapital = parseFloat(formatAmount(userAccount.capital, collateralDecimals));
    // Reserve 3% for protocol overhead plus small safety margin
    const buffered = totalCapital * (1 - CAPITAL_BUFFER_PERCENT) - SAFETY_MARGIN_SOL;
    // Round down to 4 decimal places to avoid floating point issues
    return Math.floor(buffered * 10000) / 10000;
  }, [userAccount, collateralDecimals]);

  // Calculate max leverage from market's initial margin requirement
  // initial_margin_bps = 1000 (10%) → max leverage = 10x
  // initial_margin_bps = 5000 (50%) → max leverage = 2x
  const protocolMaxLeverage = 10000 / initialMarginBps.toNumber();
  // Apply small safety buffer to stay below the absolute max
  const PROTOCOL_MAX_LEVERAGE = protocolMaxLeverage * 0.95;

  // Dynamic max leverage based on collateral amount
  // If using 50% of capital, can only achieve 5x effective leverage (50% × 10x = 5x)
  // This keeps the slider realistic based on capital allocation
  const maxLeverage = useMemo(() => {
    if (!collateralAmount || availableCapital === 0) return PROTOCOL_MAX_LEVERAGE;

    const collateralFloat = parseFloat(collateralAmount);
    if (collateralFloat <= 0 || collateralFloat > availableCapital) return PROTOCOL_MAX_LEVERAGE;

    // Calculate max effective leverage based on capital percentage being used
    const capitalPercentage = collateralFloat / availableCapital;
    const dynamicMaxLeverage = capitalPercentage * PROTOCOL_MAX_LEVERAGE;

    // Return the lesser of protocol max or dynamic max
    return Math.min(dynamicMaxLeverage, PROTOCOL_MAX_LEVERAGE);
  }, [collateralAmount, availableCapital]);

  // Auto-adjust leverage if it exceeds the new max
  useEffect(() => {
    const currentLeverage = parseFloat(leverage);
    if (currentLeverage > maxLeverage) {
      setLeverage(maxLeverage.toFixed(1));
    }
  }, [maxLeverage, leverage]);

  // Calculate position value for display
  const positionValue = useMemo(() => {
    if (!collateralAmount) return 0;
    return parseFloat(collateralAmount) * parseFloat(leverage);
  }, [collateralAmount, leverage]);

  const collateralError = useMemo(() => {
    if (!collateralAmount || availableCapital === 0) return null;
    if (parseFloat(collateralAmount) > availableCapital) {
      return `Insufficient capital. Available: ${availableCapital.toFixed(4)} ${collateralSymbol}`;
    }
    return null;
  }, [collateralAmount, availableCapital, collateralSymbol]);


  if (!market) {
    return (
      <div className={cn(
        "bg-dark-800 rounded-xl border border-dark-700 p-6 flex items-center justify-center",
        className
      )}>
        <div className="text-center text-gray-500">
          <Wallet className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select a market to trade</p>
        </div>
      </div>
    );
  }

  const handlePrivateKeyConnect = async () => {
    try {
      // Remove brackets if present
      let input = privateKeyInput.trim();
      if (input.startsWith('[') && input.endsWith(']')) {
        input = input.slice(1, -1);
      }

      // Parse private key from comma-separated bytes
      let decoded: Uint8Array;
      if (input.includes(',')) {
        decoded = new Uint8Array(
          input.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        );
      } else {
        // Try base58 decode
        const { bs58 } = require('@solana/web3.js');
        decoded = bs58.decode(input);
      }

      if (decoded.length === 64) {
        // Save keypair if requested
        if (saveKeypair && keypairLabel.trim()) {
          const { Keypair } = require('@solana/web3.js');
          const kp = Keypair.fromSecretKey(decoded);
          const publicKeyStr = kp.publicKey.toString();

          const newKeypair = {
            label: keypairLabel.trim(),
            key: privateKeyInput.trim(),
            publicKey: publicKeyStr
          };

          // Store pending keypair and show PIN modal if not set
          setPendingKeypair(newKeypair);
          if (!sessionStorage.getItem('wallet-pin')) {
            setPinModalMode('set');
            setShowPinModal(true);
            return; // Will continue after PIN is set
          } else {
            await saveEncryptedKeypair(newKeypair);
          }
        }

        connectKeypair(decoded);
        setShowWalletModal(false);
        setPrivateKeyInput('');
        setSaveKeypair(false);
        setKeypairLabel('');
      } else {
        throw new Error('Invalid key length');
      }
    } catch (err) {
      setKeypairError('Invalid private key format. Enter comma-separated bytes (with or without brackets) or base58 string.');
    }
  };

  const saveEncryptedKeypair = async (keypair: {label: string; key: string; publicKey: string}) => {
    try {
      const pin = sessionStorage.getItem('wallet-pin');
      if (!pin) {
        setPendingKeypair(keypair);
        setPinModalMode('set');
        setShowPinModal(true);
        return;
      }

      // Encrypt the private key
      const encryptedKey = await encryptData(keypair.key, pin);
      const encryptedKeypair = {
        ...keypair,
        key: encryptedKey,
        encrypted: true
      };

      // Load existing keypairs
      const existing = await loadDecryptedKeypairs();
      const updated = [...existing.filter(k => k.publicKey !== keypair.publicKey), encryptedKeypair];

      // Save encrypted
      localStorage.setItem('saved-keypairs-encrypted', JSON.stringify({
        encrypted: true,
        data: updated
      }));

      // Update state with decrypted version for display
      setSavedKeypairs(updated);
    } catch (err) {
      console.error('Error saving keypair:', err);
      setKeypairError('Error saving keypair. Please try again.');
    }
  };

  const loadDecryptedKeypairs = async (): Promise<any[]> => {
    try {
      const saved = localStorage.getItem('saved-keypairs-encrypted');
      if (!saved) return [];

      const parsed = JSON.parse(saved);
      if (parsed.encrypted && parsed.data) {
        return parsed.data;
      }
      return parsed;
    } catch (err) {
      return [];
    }
  };

  const handleLoadSavedKeypair = async (encryptedKey: string, isEncrypted: boolean, publicKey?: string) => {
    try {
      let decryptedKey = encryptedKey;

      // Always require PIN for encrypted keys
      if (isEncrypted) {
        // Store the keypair we're trying to load
        setPendingKeypair({ label: '', key: encryptedKey, publicKey: publicKey || '' });
        setPinModalMode('unlock');
        setShowPinModal(true);
        return;
      }

      // Parse and connect (don't show in UI)
      let input = decryptedKey.trim();
      if (input.startsWith('[') && input.endsWith(']')) {
        input = input.slice(1, -1);
      }

      let decoded: Uint8Array;
      if (input.includes(',')) {
        decoded = new Uint8Array(
          input.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        );
      } else {
        const { bs58 } = require('@solana/web3.js');
        decoded = bs58.decode(input);
      }

      if (decoded.length === 64) {
        connectKeypair(decoded);
        setShowWalletModal(false);
      }
    } catch (err) {
      setKeypairError('Error loading keypair. Invalid PIN or corrupted data.');
    }
  };

  const handleDeleteSavedKeypair = async (publicKey: string) => {
    const updated = savedKeypairs.filter(k => k.publicKey !== publicKey);
    setSavedKeypairs(updated);

    // Update localStorage
    try {
      const existing = await loadDecryptedKeypairs();
      const updatedEncrypted = existing.filter(k => k.publicKey !== publicKey);
      localStorage.setItem('saved-keypairs-encrypted', JSON.stringify({
        encrypted: true,
        data: updatedEncrypted
      }));
    } catch (err) {
      console.error('Error deleting keypair:', err);
    }

    setDeleteConfirmPublicKey(null);
  };

  const handleGenerateKeypair = () => {
    const { Keypair } = require('@solana/web3.js');
    const newKeypair = Keypair.generate();
    const secretKeyArray = Array.from(newKeypair.secretKey);

    setGeneratedKeypair({
      secretKey: JSON.stringify(secretKeyArray),
      publicKey: newKeypair.publicKey.toString()
    });
    setShowGeneratedKey(true);
  };

  const handleChangePin = () => {
    if (savedKeypairs.length === 0) {
      setKeypairError('No saved keypairs to protect with a PIN');
      return;
    }
    setPinModalMode('change-verify');
    setShowPinModal(true);
  };

  const reencryptAllKeypairs = async (oldPin: string, newPin: string) => {
    try {
      const encrypted = localStorage.getItem('saved-keypairs-encrypted');
      if (!encrypted) return;

      const parsed = JSON.parse(encrypted);
      if (!parsed.encrypted || !parsed.data) return;

      // Decrypt all with old PIN and re-encrypt with new PIN
      const reencrypted = await Promise.all(
        parsed.data.map(async (kp: any) => {
          if (kp.encrypted) {
            const decrypted = await decryptData(kp.key, oldPin);
            const reenc = await encryptData(decrypted, newPin);
            return { ...kp, key: reenc };
          }
          return kp;
        })
      );

      localStorage.setItem('saved-keypairs-encrypted', JSON.stringify({
        encrypted: true,
        data: reencrypted
      }));

      setSavedKeypairs(reencrypted);
    } catch (err) {
      throw new Error('Failed to re-encrypt keypairs');
    }
  };

  const handleSaveGeneratedKeypair = async () => {
    if (!generatedKeypair || !keypairLabel.trim()) return;

    const newSaved = {
      label: keypairLabel.trim(),
      key: generatedKeypair.secretKey,
      publicKey: generatedKeypair.publicKey
    };

    // Save with encryption
    await saveEncryptedKeypair(newSaved);

    // Auto-connect
    await handleLoadSavedKeypair(generatedKeypair.secretKey, false);

    setShowGeneratedKey(false);
    setGeneratedKeypair(null);
    setKeypairLabel('');
  };

  const handlePinSubmit = async (pin: string) => {
    try {
      setPinError(''); // Clear any previous errors

      // Check if we need to generate math problem for 9th attempt
      if (failedAttempts === 9 && !mathProblem && pinModalMode === 'unlock') {
        const problem = generateMathProblem();
        setMathProblem(problem);
        return;
      }

      if (pinModalMode === 'change-verify') {
        // Verify old PIN by trying to decrypt a keypair
        const encrypted = localStorage.getItem('saved-keypairs-encrypted');
        if (encrypted) {
          const parsed = JSON.parse(encrypted);
          if (parsed.encrypted && parsed.data && parsed.data.length > 0) {
            try {
              await decryptData(parsed.data[0].key, pin);
              setOldPin(pin);
              setPinModalMode('change-new');
              // Modal stays open for new PIN
              return; // Important: return here to keep modal open
            } catch (err) {
              // Increment failed attempts for PIN changes too
              const newAttempts = failedAttempts + 1;
              setFailedAttempts(newAttempts);
              localStorage.setItem('pin-failed-attempts', newAttempts.toString());

              if (newAttempts >= 10) {
                wipeAllKeypairs();
                setShowPinModal(false);
                return;
              }

              setPinError('Incorrect PIN. Please try again.');
              return; // Return on error too
            }
          }
        }
        return; // Return if no saved keypairs found
      } else if (pinModalMode === 'change-new') {
        // Set new PIN and re-encrypt all keys
        if (oldPin) {
          try {
            await reencryptAllKeypairs(oldPin, pin);
            sessionStorage.setItem('wallet-pin', pin);
            // Reset failed attempts on successful PIN change
            setFailedAttempts(0);
            localStorage.setItem('pin-failed-attempts', '0');
            setShowPinModal(false);
            setOldPin(null);
            setKeypairError('');
            // Success message
            setKeypairError('PIN changed successfully!');
            setTimeout(() => setKeypairError(''), 3000);
          } catch (err) {
            setPinError('Failed to change PIN. Please try again.');
          }
        }
      } else if (pinModalMode === 'set') {
        // Store PIN in session
        sessionStorage.setItem('wallet-pin', pin);
        setShowPinModal(false);

        // Reset attempts when setting new PIN
        setFailedAttempts(0);
        localStorage.setItem('pin-failed-attempts', '0');

        // Save pending keypair if exists
        if (pendingKeypair) {
          await saveEncryptedKeypair(pendingKeypair);
          setPendingKeypair(null);

          // Continue with connection
          if (privateKeyInput) {
            const input = privateKeyInput.trim();
            let decoded: Uint8Array;
            if (input.startsWith('[') && input.endsWith(']')) {
              const cleaned = input.slice(1, -1);
              decoded = new Uint8Array(
                cleaned.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
              );
            } else if (input.includes(',')) {
              decoded = new Uint8Array(
                input.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
              );
            } else {
              const { bs58 } = require('@solana/web3.js');
              decoded = bs58.decode(input);
            }

            connectKeypair(decoded);
            setShowWalletModal(false);
            setPrivateKeyInput('');
            setSaveKeypair(false);
            setKeypairLabel('');
          }
        }
      } else {
        // Unlock mode - decrypt and connect to pending keypair
        if (pendingKeypair) {
          try {
            const decryptedKey = await decryptData(pendingKeypair.key, pin);

            // Success! Reset failed attempts
            setFailedAttempts(0);
            localStorage.setItem('pin-failed-attempts', '0');
            setMathProblem(null);
            setShowPinModal(false);
            setPendingKeypair(null);
            sessionStorage.setItem('wallet-pin', pin);

            // Parse and connect
            let input = decryptedKey.trim();
            if (input.startsWith('[') && input.endsWith(']')) {
              input = input.slice(1, -1);
            }

            let decoded: Uint8Array;
            if (input.includes(',')) {
              decoded = new Uint8Array(
                input.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
              );
            } else {
              const { bs58 } = require('@solana/web3.js');
              decoded = bs58.decode(input);
            }

            if (decoded.length === 64) {
              connectKeypair(decoded);
              setShowWalletModal(false);
            }
          } catch (err) {
            // Failed attempt - increment counter
            const newAttempts = failedAttempts + 1;
            setFailedAttempts(newAttempts);
            localStorage.setItem('pin-failed-attempts', newAttempts.toString());

            // Check if we've hit the limit
            if (newAttempts >= 10) {
              wipeAllKeypairs();
              setShowPinModal(false);
              return;
            }

            // Generate math problem at 9 attempts
            if (newAttempts === 9) {
              const problem = generateMathProblem();
              setMathProblem(problem);
            }

            setPinError('Invalid PIN or corrupted data');
          }
        }
      }
    } catch (err) {
      setPinError('Invalid PIN. Please try again.');
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        connectFromJson(content);
        setShowWalletModal(false);
      } catch (err) {
        setKeypairError('Invalid keyfile format. Please check the file and try again.');
      }
    };
    reader.readAsText(file);
  };

  const executeInitUser = async () => {
    if (!isConnected || !publicKey || !market) {
      setTxStatus('Please connect your wallet first');
      return;
    }

    if (!vaultAddress) {
      setTxStatus('Vault address not available. Please refresh the market data.');
      return;
    }

    setIsLoading(true);
    setTxStatus('Initializing account...');

    try {
      // Fee payment is typically 0.01 SOL (10000000 lamports)
      const feePayment = new BN(10000000);

      const transaction = await buildInitUserTransaction({
        connection,
        userPublicKey: publicKey,
        slabAddress: new PublicKey(market.slabAddress),
        programId: new PublicKey(market.programId),
        collateralMint: new PublicKey(market.tokenAddress),
        vaultAddress: new PublicKey(vaultAddress),
        feePayment,
      });

      setTxStatus('Sending transaction...');
      const signature = await signAndSendTransaction(transaction);

      setTxStatus(`Account initialized! ${signature.slice(0, 8)}... Please refresh to see your account.`);
      setTimeout(() => {
        setTxStatus(null);
      }, 5000);
    } catch (err) {
      setTxStatus('Init failed: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const executeDeposit = async () => {
    if (!isConnected || !publicKey || !market || !depositAmount || parseFloat(depositAmount) <= 0 || userAccountIdx === null) {
      setTxStatus('Please ensure wallet is connected and account is initialized');
      return;
    }

    if (!vaultAddress) {
      setTxStatus('Vault address not available. Please refresh the market data.');
      return;
    }

    setIsLoading(true);
    setTxStatus('Building deposit transaction...');

    try {
      const amountBN = new BN(parseFloat(depositAmount) * Math.pow(10, collateralDecimals));

      const transaction = await buildDepositTransaction({
        connection,
        userPublicKey: publicKey,
        slabAddress: new PublicKey(market.slabAddress),
        programId: new PublicKey(market.programId),
        collateralMint: new PublicKey(market.tokenAddress),
        vaultAddress: new PublicKey(vaultAddress),
        userIdx: userAccountIdx,
        amount: amountBN,
      });

      setTxStatus('Sending transaction...');
      const signature = await signAndSendTransaction(transaction);

      setTxStatus(`Deposit successful! ${signature.slice(0, 8)}...`);
      setTimeout(() => {
        setTxStatus(null);
        setDepositAmount('');
      }, 3000);
    } catch (err) {
      setTxStatus('Deposit failed: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const executeWithdraw = async () => {
    if (!isConnected || !publicKey || !market || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || userAccountIdx === null) {
      setTxStatus('Please ensure wallet is connected and account is initialized');
      return;
    }

    if (!vaultAddress) {
      setTxStatus('Vault address not available. Please refresh the market data.');
      return;
    }

    setIsLoading(true);
    setTxStatus('Building withdraw transaction...');

    try {
      const amountBN = new BN(parseFloat(withdrawAmount) * Math.pow(10, collateralDecimals));

      const transaction = await buildWithdrawTransaction({
        connection,
        userPublicKey: publicKey,
        slabAddress: new PublicKey(market.slabAddress),
        programId: new PublicKey(market.programId),
        collateralMint: new PublicKey(market.tokenAddress),
        vaultAddress: new PublicKey(vaultAddress),
        oracleAddress: market.oracleAddress ? new PublicKey(market.oracleAddress) : PublicKey.default,
        userIdx: userAccountIdx,
        amount: amountBN,
      });

      setTxStatus('Sending transaction...');
      const signature = await signAndSendTransaction(transaction);

      setTxStatus(`Withdrawal successful! ${signature.slice(0, 8)}...`);
      setTimeout(() => {
        setTxStatus(null);
        setWithdrawAmount('');
      }, 3000);
    } catch (err) {
      setTxStatus('Withdraw failed: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const executeTrade = async () => {
    if (!isConnected || !publicKey || !market || !collateralAmount || parseFloat(collateralAmount) <= 0 || userAccountIdx === null) {
      setTxStatus('Please ensure wallet is connected and account is initialized');
      return;
    }

    if (!userAccount || userAccount.capital.isZero()) {
      setTxStatus('Please deposit capital into your account first (use Deposit tab)');
      return;
    }

    setIsLoading(true);
    setTxStatus('Calculating position size...');

    try {
      // CRITICAL: Percolator position sizing formula
      // From percolator.rs: notional_e6 = position_size × oracle_price_e6 / 1,000,000
      // Therefore: position_size = notional_lamports × 1,000,000 / oracle_price_e6
      //
      // The oracle_price_e6 is in "collateral per base token × 1e6" format
      // Position sizes are calculated directly - NO exchange rate conversion needed!

      const oraclePriceE6Num = oraclePriceE6.toNumber();

      console.log('Oracle Price:', {
        oraclePriceE6: oraclePriceE6Num,
        interpretation: `${(oraclePriceE6Num / 1e6).toFixed(9)} ${collateralSymbol} per ${baseSymbol}`,
        formula: 'position_size = notional_lamports × 1,000,000 / oracle_price_e6'
      });

      setTxStatus('Building trade transaction...');

      // Calculate position size in BASE TOKEN units (BUTTCOIN with 6 decimals)
      // IMPORTANT: Leverage slider represents EFFECTIVE leverage (relative to TOTAL capital)
      // Not position leverage (relative to collateral amount entered)
      const collateralFloat = parseFloat(collateralAmount);
      const leverageFloat = parseFloat(leverage);

      // Use total available capital for leverage calculation, not just collateral
      // This ensures slider value matches the effective leverage shown in the positions table
      const totalCapitalForLeverage = availableCapital; // Use full available capital
      const positionValueInSOL = totalCapitalForLeverage * leverageFloat;

      // Apply safety reduction to position size to account for:
      // - Protocol margin requirements
      // - Trading fees
      // - Potential price movement between calculation and execution
      // Dynamic buffer based on market's max leverage:
      // - High leverage markets (10x): ~6% buffer
      // - Medium leverage markets (5x): ~8% buffer
      // - Low leverage markets (2x): ~12% buffer
      const bufferPercent = 5 + Math.min(15, 15 / protocolMaxLeverage);
      const POSITION_SAFETY_BUFFER = 1 - (bufferPercent / 100);
      const safePositionValueInSOL = positionValueInSOL * POSITION_SAFETY_BUFFER;

      // Calculate position_size using Percolator's formula:
      // position_size = notional_lamports × 1,000,000 / oracle_price_e6
      const safePositionValueLamports = safePositionValueInSOL * Math.pow(10, collateralDecimals);
      const positionSizeFloat = (safePositionValueLamports * 1_000_000) / oraclePriceE6Num;

      const sizeBN = side === 'long'
        ? new BN(Math.floor(positionSizeFloat))
        : new BN(Math.floor(positionSizeFloat)).neg();

      // Calculate display amount in base token
      const positionInBaseToken = positionSizeFloat / Math.pow(10, baseDecimals);

      console.log('📊 Trade Summary:', {
        collateral: `${collateralAmount} ${collateralSymbol}`,
        requestedLeverage: `${leverage}x`,
        totalCapital: `${totalCapitalForLeverage.toFixed(4)} ${collateralSymbol}`,
        rawPositionValue: `${positionValueInSOL.toFixed(4)} ${collateralSymbol}`,
        safePositionValue: `${safePositionValueInSOL.toFixed(4)} ${collateralSymbol} (${POSITION_SAFETY_BUFFER * 100}% of requested)`,
        safePositionValueLamports: `${safePositionValueLamports.toFixed(0)} lamports`,
        oraclePriceE6: oraclePriceE6Num,
        positionInBaseToken: `${positionInBaseToken.toFixed(2)} ${baseSymbol}`,
        positionSize: sizeBN.toString() + ' units',
        side,
        note: `${(1 - POSITION_SAFETY_BUFFER) * 100}% safety buffer applied`
      });

      // Find an LP to trade against (use first LP account)
      const lpAccount = accounts.find(a => a.kind === 1); // 1 = LP
      if (!lpAccount) {
        throw new Error('No LP available to trade against');
      }

      const transaction = await buildTradeTransaction({
        connection,
        userPublicKey: publicKey,
        lpOwner: lpAccount.owner,
        slabAddress: new PublicKey(market.slabAddress),
        programId: new PublicKey(market.programId),
        oracleAddress: market.oracleAddress ? new PublicKey(market.oracleAddress) : PublicKey.default,
        matcherProgram: lpAccount.matcherProgram,
        matcherContext: lpAccount.matcherContext,
        lpIdx: lpAccount.accountId.toNumber(),
        userIdx: userAccountIdx,
        size: sizeBN,
      });

      setTxStatus('Sending transaction...');
      const signature = await signAndSendTransaction(transaction);

      // Cache entry price for PnL calculation
      if (market && userAccountIdx !== null) {
        saveEntryPrice(
          market.id,
          userAccountIdx.toString(),
          oraclePriceE6Num,
          sizeBN.toString(),
          side
        );

        // Save position marker for chart display
        savePositionMarker({
          marketId: market.id,
          accountId: userAccountIdx.toString(),
          walletAddress: publicKey.toBase58(),
          entryPrice: oraclePriceE6Num / 1e6, // Convert E6 to decimal
          entryTime: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
          side,
          positionSize: positionInBaseToken.toFixed(2), // Display value
          collateralAmount: collateralAmount,
        });
      }

      setTxStatus(`Trade successful! ${signature.slice(0, 8)}...`);
      setTimeout(() => {
        setTxStatus(null);
        setCollateralAmount('');
      }, 3000);
    } catch (err) {
      setTxStatus('Trade failed: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className={cn(
      "bg-dark-800 rounded-xl border border-dark-700 flex flex-col",
      className
    )}>
      {/* Header with Wallet Status */}
      <div className="px-4 py-3 border-b border-dark-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary-400" />
            <h3 className="font-medium text-white">Trading Panel</h3>
          </div>
          
          {/* Wallet Connection Button */}
          {isConnected ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-green-900/30 rounded text-xs">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-green-400 font-mono">
                  {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                </span>
              </div>
              <button
                onClick={disconnect}
                className="p-1.5 rounded hover:bg-dark-700 text-gray-400 hover:text-red-400"
                title="Disconnect"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                clearError();
                setShowWalletModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 rounded text-xs text-white font-medium transition-colors"
            >
              <Wallet className="w-3.5 h-3.5" />
              Connect Wallet
            </button>
          )}
        </div>
        
        <p className="text-xs text-gray-500 mt-1">
          {market.name} • {baseSymbol}/{collateralSymbol}
        </p>
      </div>

      {/* Transaction Status */}
      {txStatus && (
        <div className={cn(
          "px-4 py-2 text-xs border-b border-dark-700",
          txStatus.includes('failed') ? "bg-red-900/20 text-red-400" : "bg-green-900/20 text-green-400"
        )}>
          {txStatus}
        </div>
      )}

      {/* Order Form */}
      <div className="p-4 space-y-4">
        {!isConnected ? (
          <div className="text-center py-8">
            <Wallet className="w-12 h-12 mx-auto mb-3 text-gray-600" />
            <p className="text-sm text-gray-500 mb-3">Connect a wallet to trade</p>
            <button
              onClick={() => setShowWalletModal(true)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <>
            {/* Action Tab Selector */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-dark-900 rounded-lg">
              <button
                onClick={() => setActionTab('deposit')}
                className={cn(
                  "py-2 px-3 rounded-md font-medium text-xs transition-colors flex items-center justify-center gap-1.5",
                  actionTab === 'deposit'
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-gray-300"
                )}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                Deposit
              </button>
              <button
                onClick={() => setActionTab('trade')}
                className={cn(
                  "py-2 px-3 rounded-md font-medium text-xs transition-colors flex items-center justify-center gap-1.5",
                  actionTab === 'trade'
                    ? "bg-primary-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-gray-300"
                )}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Trade
              </button>
              <button
                onClick={() => setActionTab('withdraw')}
                className={cn(
                  "py-2 px-3 rounded-md font-medium text-xs transition-colors flex items-center justify-center gap-1.5",
                  actionTab === 'withdraw'
                    ? "bg-orange-600 text-white shadow-lg"
                    : "text-gray-400 hover:text-gray-300"
                )}
              >
                <ArrowUpFromLine className="w-3.5 h-3.5" />
                Withdraw
              </button>
            </div>

            {/* Deposit Form */}
            {actionTab === 'deposit' && (
              <>
                {userAccountIdx === null ? (
                  <>
                    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 text-center">
                      <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                      <p className="text-sm text-yellow-300 font-medium mb-1">Account Not Initialized</p>
                      <p className="text-xs text-yellow-300/70">
                        You need to initialize your account before depositing. This will cost ~0.01 {collateralSymbol}.
                      </p>
                    </div>

                    <button
                      onClick={executeInitUser}
                      disabled={isLoading}
                      className={cn(
                        "w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2",
                        "bg-yellow-600 hover:bg-yellow-500 text-white",
                        isLoading && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      {isLoading ? 'Processing...' : 'Initialize Account'}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs text-gray-400">
                          Amount ({collateralSymbol})
                        </label>
                        <button
                          onClick={() => {
                            // Keep 0.05 SOL buffer for transaction fees
                            const maxDeposit = Math.max(0, parseFloat(walletBalance) - 0.05);
                            setDepositAmount(maxDeposit.toFixed(4));
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Available: {walletBalance} {collateralSymbol}
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                          {collateralSymbol}
                        </span>
                      </div>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 text-xs text-blue-300">
                      Deposit collateral to your account to open positions or provide liquidity.
                    </div>

                    <button
                      onClick={executeDeposit}
                      disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isLoading}
                      className={cn(
                        "w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2",
                        "bg-blue-600 hover:bg-blue-500 text-white",
                        (!depositAmount || parseFloat(depositAmount) <= 0 || isLoading) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <ArrowDownToLine className="w-4 h-4" />
                      )}
                      {isLoading ? 'Processing...' : 'Deposit'}
                    </button>
                  </>
                )}
              </>
            )}

            {/* Withdraw Form */}
            {actionTab === 'withdraw' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs text-gray-400">
                      Amount ({collateralSymbol})
                    </label>
                    {userAccount && (
                      <button
                        onClick={() => setWithdrawAmount(formatAmount(userAccount.capital, collateralDecimals))}
                        className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                      >
                        Available: {formatAmount(userAccount.capital, collateralDecimals)} {collateralSymbol}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:border-orange-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                      {collateralSymbol}
                    </span>
                  </div>
                </div>

                <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-3 text-xs text-orange-300">
                  Withdraw available collateral from your account. Cannot withdraw if you have open positions.
                </div>

                <button
                  onClick={executeWithdraw}
                  disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isLoading}
                  className={cn(
                    "w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2",
                    "bg-orange-600 hover:bg-orange-500 text-white",
                    (!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isLoading) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ArrowUpFromLine className="w-4 h-4" />
                  )}
                  {isLoading ? 'Processing...' : 'Withdraw'}
                </button>
              </>
            )}

            {/* Trade Form */}
            {actionTab === 'trade' && (
              <>
                {/* Side Selector */}
                <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide('long')}
                className={cn(
                  "py-2 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2",
                  side === 'long' 
                    ? "bg-green-600 text-white" 
                    : "bg-dark-700 text-gray-400 hover:bg-dark-600"
                )}
              >
                <TrendingUp className="w-4 h-4" />
                Long
              </button>
              <button
                onClick={() => setSide('short')}
                className={cn(
                  "py-2 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2",
                  side === 'short' 
                    ? "bg-red-600 text-white" 
                    : "bg-dark-700 text-gray-400 hover:bg-dark-600"
                )}
              >
                <TrendingDown className="w-4 h-4" />
                Short
              </button>
            </div>

            {/* Auto-Sign Toggle - Only for keypair wallets */}
            {walletType === 'keypair' && (
              <div className="flex items-center justify-between p-2 bg-dark-700/30 rounded-lg">
                <div className="flex items-center gap-2">
                  {autoSign ? (
                    <Shield className="w-4 h-4 text-green-400" />
                  ) : (
                    <ShieldOff className="w-4 h-4 text-yellow-400" />
                  )}
                  <span className="text-xs text-gray-400">Auto-sign transactions</span>
                </div>
                <button
                  onClick={() => setAutoSign(!autoSign)}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    autoSign ? "bg-green-600" : "bg-gray-600"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                    autoSign ? "left-5" : "left-0.5"
                  )} />
                </button>
              </div>
            )}

            {/* Collateral Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-gray-400">
                  Collateral ({collateralSymbol})
                </label>
                {userAccount && (
                  <button
                    onClick={() => setCollateralAmount(availableCapital.toFixed(4))}
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                    title={`Click to use max available (${availableCapital.toFixed(4)} ${collateralSymbol} after 3% buffer)`}
                  >
                    Available: {formatAmount(userAccount.capital, collateralDecimals)} {collateralSymbol}
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={collateralAmount}
                  onChange={(e) => setCollateralAmount(e.target.value)}
                  placeholder="0.00"
                  className={cn(
                    "w-full bg-dark-900 border rounded-lg px-3 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none",
                    collateralError ? "border-red-500 focus:border-red-500" : "border-dark-600 focus:border-primary-500"
                  )}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  {collateralSymbol}
                </span>
              </div>
              {collateralError && (
                <p className="text-xs text-red-400 mt-1">{collateralError}</p>
              )}
            </div>

            {/* Leverage Slider */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs text-gray-400">Leverage</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-primary-400 font-medium">{leverage}x</span>
                  {maxLeverage < PROTOCOL_MAX_LEVERAGE && (
                    <span className="text-xs text-yellow-400">
                      (max {maxLeverage.toFixed(1)}x)
                    </span>
                  )}
                </div>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="1"
                  max={PROTOCOL_MAX_LEVERAGE}
                  step="0.1"
                  value={Math.min(parseFloat(leverage), maxLeverage)}
                  onChange={(e) => {
                    const newValue = parseFloat(e.target.value);
                    // Cap at dynamic max leverage
                    setLeverage(Math.min(newValue, maxLeverage).toFixed(1));
                  }}
                  className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  style={{
                    background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${((maxLeverage - 1) / (PROTOCOL_MAX_LEVERAGE - 1)) * 100}%, rgb(55 65 81) ${((maxLeverage - 1) / (PROTOCOL_MAX_LEVERAGE - 1)) * 100}%, rgb(55 65 81) 100%)`
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-600">
                <span>1x</span>
                <span>{(protocolMaxLeverage / 2).toFixed(1)}x</span>
                <span className={maxLeverage < PROTOCOL_MAX_LEVERAGE ? "text-gray-700" : "text-primary-400"}>
                  {protocolMaxLeverage.toFixed(1)}x max
                </span>
              </div>
              {maxLeverage < PROTOCOL_MAX_LEVERAGE && collateralAmount && (
                <p className="mt-2 text-xs text-yellow-400/80">
                  Using {((parseFloat(collateralAmount) / availableCapital) * 100).toFixed(0)}% of capital • Max leverage: {maxLeverage.toFixed(1)}x with this capital
                </p>
              )}
            </div>

            {/* Order Summary */}
            <div className="bg-dark-900/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Margin</span>
                <span className="text-white">{collateralAmount || '0'} {collateralSymbol}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Position Size</span>
                <span className="text-white font-medium">
                  {positionValue.toFixed(4)} {collateralSymbol}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Direction</span>
                <span className={cn(
                  "font-medium",
                  side === 'long' ? "text-green-400" : "text-red-400"
                )}>
                  {side === 'long' ? 'Long' : 'Short'} {leverage}x
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Est. {baseSymbol} Size</span>
                <span className="text-gray-400">
                  ~{notionalValue.toFixed(2)} {baseSymbol}
                </span>
              </div>
              {estimatedLiqPrice !== null && (
                <div className="flex justify-between text-xs border-t border-dark-700 pt-2 mt-2">
                  <span className="text-gray-500">Est. Liquidation Price</span>
                  <span className="text-red-400">
                    ${estimatedLiqPrice.toFixed(6)}
                  </span>
                </div>
              )}
            </div>

            {/* Capital Usage Info */}
            {collateralAmount && parseFloat(collateralAmount) > 0 && availableCapital > 0 && (
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  <span className="font-medium">Available Capital:</span> {availableCapital.toFixed(4)} {collateralSymbol} •
                  Using {((parseFloat(collateralAmount) / availableCapital) * 100).toFixed(0)}% as margin for this position
                </p>
              </div>
            )}

            {/* LP Liquidity Warning */}
            {(() => {
              const lpAccounts = accounts.filter(a => a.kind === 1);
              if (lpAccounts.length === 0) {
                return (
                  <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
                    <p className="text-xs text-red-300">
                      ⚠️ <span className="font-medium">No LPs available</span> - Trades require an LP to take the opposite side
                    </p>
                  </div>
                );
              }

              const maxLPCapital = lpAccounts.reduce((max, lp) =>
                lp.capital.gt(max) ? lp.capital : max,
                new BN(0)
              ).toNumber() / Math.pow(10, collateralDecimals);

              const positionValue = parseFloat(collateralAmount || '0') * parseFloat(leverage);
              const positionTooLarge = positionValue > maxLPCapital * protocolMaxLeverage;

              if (positionTooLarge) {
                return (
                  <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3">
                    <p className="text-xs text-yellow-300">
                      ⚠️ <span className="font-medium">Low LP liquidity</span> - Largest LP has {maxLPCapital.toFixed(2)} {collateralSymbol} capital.
                      Large positions may fail if no LP can take the trade.
                    </p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Submit Button */}
            <button
              onClick={executeTrade}
              disabled={!collateralAmount || parseFloat(collateralAmount) <= 0 || !!collateralError || isLoading}
              className={cn(
                "w-full py-3 px-4 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2",
                side === 'long'
                  ? "bg-green-600 hover:bg-green-500 text-white"
                  : "bg-red-600 hover:bg-red-500 text-white",
                (!collateralAmount || parseFloat(collateralAmount) <= 0 || !!collateralError || isLoading) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : side === 'long' ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              {isLoading ? 'Processing...' : `Open ${side === 'long' ? 'Long' : 'Short'}`}
            </button>
              </>
            )}
          </>
        )}
      </div>


      {/* Wallet Modal */}
      {showWalletModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowWalletModal(false)}
        >
          <div
            className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <h3 className="font-medium text-white">Connect Wallet</h3>
              <button
                onClick={() => setShowWalletModal(false)}
                className="p-1 rounded hover:bg-dark-700 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-dark-700">
              {(['browser', 'keypair', 'json'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setWalletTab(tab)}
                  className={cn(
                    "flex-1 py-3 text-xs font-medium transition-colors capitalize",
                    walletTab === tab
                      ? "text-primary-400 border-b-2 border-primary-400"
                      : "text-gray-400 hover:text-gray-300"
                  )}
                >
                  {tab === 'json' ? 'JSON File' : tab}
                </button>
              ))}
            </div>

            <div className="p-4">
              {walletError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-xs text-red-400">
                  {walletError}
                </div>
              )}

              {keypairError && (
                <div className="mb-4 p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-xs text-red-400 flex items-center justify-between">
                  <span>{keypairError}</span>
                  <button
                    onClick={() => setKeypairError('')}
                    className="text-red-300 hover:text-red-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {walletTab === 'browser' && (
                <div className="space-y-3">
                  <button
                    onClick={connectPhantom}
                    disabled={isConnecting}
                    className="w-full flex items-center gap-3 p-4 bg-dark-700/50 hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center shadow-lg">
                      <svg viewBox="0 0 128 128" className="w-6 h-6">
                        <defs>
                          <linearGradient id="phantom-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style={{stopColor: '#AB9FF2'}} />
                            <stop offset="100%" style={{stopColor: '#6F4FF2'}} />
                          </linearGradient>
                        </defs>
                        <path fill="url(#phantom-gradient)" d="M102.5 64.5c0 21.2-17.2 38.5-38.5 38.5S25.5 85.7 25.5 64.5C25.5 43.3 42.7 26 64 26s38.5 17.3 38.5 38.5z"/>
                        <circle fill="white" cx="52" cy="58" r="4"/>
                        <circle fill="white" cx="76" cy="58" r="4"/>
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">Phantom</p>
                      <p className="text-xs text-gray-500">Connect with browser extension</p>
                    </div>
                  </button>

                  <button
                    onClick={connectSolflare}
                    disabled={isConnecting}
                    className="w-full flex items-center gap-3 p-4 bg-dark-700/50 hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-700 rounded-lg flex items-center justify-center shadow-lg">
                      <svg viewBox="0 0 128 128" className="w-6 h-6">
                        <circle fill="white" cx="64" cy="64" r="32" opacity="0.9"/>
                        <path fill="#FF6B35" d="M64 40 L88 64 L64 88 L40 64 Z"/>
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">Solflare</p>
                      <p className="text-xs text-gray-500">Connect with browser extension</p>
                    </div>
                  </button>
                </div>
              )}

              {walletTab === 'keypair' && (
                <div className="space-y-4">
                  {/* Experimental Warning */}
                  <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                    <p className="text-xs text-yellow-300 font-medium mb-1">⚠️ Experimental Feature</p>
                    <p className="text-xs text-yellow-200/70">
                      Keypair save functionality is experimental and provided for ease of use during testing.
                      Keys are encrypted with your PIN but stored locally. Use at your own risk.
                      Never use this with mainnet funds or production wallets.
                    </p>
                  </div>

                  {/* Generate New Keypair Section */}
                  {!showGeneratedKey ? (
                    <div className="p-3 bg-primary-900/20 border border-primary-700/50 rounded-lg">
                      <button
                        onClick={handleGenerateKeypair}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-sm text-white font-medium transition-colors"
                      >
                        <Key className="w-4 h-4" />
                        Generate New Keypair
                      </button>
                      <p className="text-xs text-gray-400 text-center mt-2">
                        Create a new wallet for testing
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-green-300">New Keypair Generated!</h4>
                        <button
                          onClick={() => {
                            setShowGeneratedKey(false);
                            setGeneratedKeypair(null);
                            setKeypairLabel('');
                          }}
                          className="p-1 rounded hover:bg-dark-700 text-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Public Key</label>
                        <div className="p-2 bg-dark-900 rounded border border-dark-700 text-xs font-mono text-white break-all">
                          {generatedKeypair?.publicKey}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Private Key (Keep Secret!)</label>
                        <textarea
                          value={generatedKeypair?.secretKey}
                          readOnly
                          rows={3}
                          className="w-full p-2 bg-dark-900 rounded border border-dark-700 text-xs font-mono text-yellow-300 break-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Label for this wallet</label>
                        <input
                          type="text"
                          value={keypairLabel}
                          onChange={(e) => setKeypairLabel(e.target.value)}
                          placeholder="e.g., 'Test Wallet 1'"
                          className="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-white text-xs focus:border-primary-500 focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={handleSaveGeneratedKeypair}
                        disabled={!keypairLabel.trim()}
                        className="w-full py-2 bg-green-600 hover:bg-green-500 disabled:bg-dark-700 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors"
                      >
                        Save & Connect
                      </button>

                      <p className="text-xs text-yellow-400 text-center">
                        ⚠️ Copy your private key! It will only be shown once.
                      </p>
                    </div>
                  )}

                  {/* Saved Keypairs */}
                  {!showGeneratedKey && savedKeypairs.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs text-gray-400 font-medium">
                          Saved Keypairs ({savedKeypairs.length})
                        </label>
                        <button
                          onClick={handleChangePin}
                          className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                        >
                          Change PIN
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {savedKeypairs.map((saved) => (
                          <div
                            key={saved.publicKey}
                            className={`p-2.5 rounded-lg transition-colors ${
                              deleteConfirmPublicKey === saved.publicKey
                                ? 'bg-red-900/20 border border-red-700/50'
                                : 'bg-dark-900/50 hover:bg-dark-800/50'
                            }`}
                          >
                            {deleteConfirmPublicKey === saved.publicKey ? (
                              <div className="space-y-2">
                                <p className="text-xs text-red-300">Delete "{saved.label}"?</p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleDeleteSavedKeypair(saved.publicKey)}
                                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmPublicKey(null)}
                                    className="flex-1 py-1.5 bg-dark-700 hover:bg-dark-600 text-gray-300 text-xs rounded transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between group">
                                <button
                                  onClick={() => handleLoadSavedKeypair(saved.key, saved.encrypted || false, saved.publicKey)}
                                  className="flex-1 text-left"
                                >
                                  <div className="text-xs text-white font-medium">{saved.label}</div>
                                  <div className="text-[10px] text-gray-500 font-mono">{saved.publicKey.slice(0, 8)}...{saved.publicKey.slice(-6)}</div>
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmPublicKey(saved.publicKey)}
                                  className="p-1 rounded hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                  title="Delete"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t border-dark-700"></div>
                    </div>
                  )}

                  {/* Private Key Input - Only show when not generating */}
                  {!showGeneratedKey && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          Import Private Key (comma-separated bytes or base58)
                        </label>
                        <textarea
                          value={privateKeyInput}
                          onChange={(e) => setPrivateKeyInput(e.target.value)}
                          placeholder="[123, 45, 67, ...] or 123, 45, 67, ..."
                          rows={3}
                          className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-xs focus:border-primary-500 focus:outline-none font-mono"
                        />
                      </div>

                      {/* Save Keypair Option */}
                      {privateKeyInput && (
                        <div className="space-y-2 p-3 bg-dark-900/50 rounded-lg border border-dark-700">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={saveKeypair}
                              onChange={(e) => setSaveKeypair(e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                            <span className="text-xs text-gray-300">Save this keypair for quick access</span>
                          </label>
                          {saveKeypair && (
                            <input
                              type="text"
                              value={keypairLabel}
                              onChange={(e) => setKeypairLabel(e.target.value)}
                              placeholder="Label (e.g., 'Trading Wallet', 'LP Wallet')"
                              className="w-full bg-dark-800 border border-dark-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-primary-500 focus:outline-none"
                            />
                          )}
                        </div>
                      )}

                      <button
                        onClick={handlePrivateKeyConnect}
                        disabled={!privateKeyInput || isConnecting || (saveKeypair && !keypairLabel.trim())}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-500 disabled:bg-dark-700 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors"
                      >
                        <Key className="w-4 h-4" />
                        Connect {saveKeypair && '& Save'}
                      </button>
                      <p className="text-xs text-yellow-500/70 text-center">
                        ⚠️ Keys are saved in your browser. Keep your device secure!
                      </p>
                    </>
                  )}
                </div>
              )}

              {walletTab === 'json' && (
                <div className="space-y-3">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-dark-600 rounded-lg p-6 text-center cursor-pointer hover:border-primary-500 transition-colors"
                  >
                    <FileJson className="w-8 h-8 mx-auto mb-2 text-gray-500" />
                    <p className="text-sm text-gray-400">Click to upload keypair JSON</p>
                    <p className="text-xs text-gray-600 mt-1">Supports Solana CLI format</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-yellow-500/70 text-center">
                    Warning: Uploading keyfiles is insecure. Use only for testing.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      <PinModal
        key={pinModalMode}
        isOpen={showPinModal}
        onClose={() => {
          setShowPinModal(false);
          setPinError('');
          setOldPin(null);
          setPinModalMode('set');
          setMathProblem(null);
        }}
        onSubmit={handlePinSubmit}
        title={
          pinModalMode === 'set' ? 'Set Wallet PIN' :
          pinModalMode === 'change-verify' ? 'Verify Current PIN' :
          pinModalMode === 'change-new' ? 'Set New PIN' :
          'Enter Wallet PIN'
        }
        message={
          pinModalMode === 'set' ? 'Create a 4-digit PIN to encrypt your wallet keys' :
          pinModalMode === 'change-verify' ? 'Enter your current PIN to verify' :
          pinModalMode === 'change-new' ? 'Enter your new 4-digit PIN' :
          'Enter your PIN to decrypt wallet keys'
        }
        error={pinError}
        attemptsRemaining={failedAttempts >= 8 ? 10 - failedAttempts : undefined}
        requireMathChallenge={failedAttempts === 9 && mathProblem !== null}
        mathProblem={mathProblem?.question}
        onMathSubmit={validateMathAnswer}
      />
    </div>
  );
}
