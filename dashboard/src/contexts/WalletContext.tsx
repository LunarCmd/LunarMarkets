'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Connection, PublicKey, Transaction, Keypair, VersionedTransaction } from '@solana/web3.js';
import { getConfig } from '@/lib/config';

type WalletType = 'phantom' | 'solflare' | 'keypair' | null;

interface WalletContextType {
  // Connection
  connection: Connection;
  
  // Wallet state
  walletType: WalletType;
  publicKey: PublicKey | null;
  isConnected: boolean;
  isConnecting: boolean;
  
  // Auto-sign setting
  autoSign: boolean;
  setAutoSign: (value: boolean) => void;
  
  // Connection methods
  connectPhantom: () => Promise<void>;
  connectSolflare: () => Promise<void>;
  connectKeypair: (secretKey: Uint8Array) => void;
  connectFromJson: (jsonContent: string) => void;
  disconnect: () => void;
  
  // Transaction signing
  signAndSendTransaction: (transaction: Transaction | VersionedTransaction) => Promise<string>;
  
  // Error state
  error: string | null;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Window type extensions for wallet adapters
declare global {
  interface Window {
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        connect: () => Promise<{ publicKey: { toBytes: () => Uint8Array } }>;
        disconnect: () => Promise<void>;
        signAndSendTransaction: (transaction: Transaction | VersionedTransaction) => Promise<{ signature: string }>;
        signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
        publicKey?: { toBytes: () => Uint8Array };
        isConnected?: boolean;
      };
    };
    solflare?: {
      isSolflare?: boolean;
      connect: () => Promise<{ publicKey: { toBytes: () => Uint8Array } }>;
      disconnect: () => Promise<void>;
        signAndSendTransaction: (transaction: Transaction | VersionedTransaction) => Promise<{ signature: string }>;
        signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
      publicKey?: { toBytes: () => Uint8Array };
      isConnected?: boolean;
    };
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { rpcUrl } = getConfig();
  const [connection] = useState(() => new Connection(rpcUrl, 'confirmed'));
  
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [autoSign, setAutoSign] = useState(true); // Default to auto-sign for convenience
  const [error, setError] = useState<string | null>(null);
  
  // Keypair storage (for keypair wallet)
  const [keypair, setKeypair] = useState<Keypair | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Check for existing connection on mount
  useEffect(() => {
    const checkExistingConnection = async () => {
      // Only auto-reconnect if user explicitly chose to stay connected
      const shouldAutoReconnect = localStorage.getItem('wallet-auto-reconnect') === 'true';

      if (!shouldAutoReconnect) {
        return;
      }

      // Check Phantom
      if (window.phantom?.solana?.isConnected && window.phantom.solana.publicKey) {
        try {
          const pubkeyBytes = window.phantom.solana.publicKey.toBytes();
          setPublicKey(new PublicKey(pubkeyBytes));
          setWalletType('phantom');
          setIsConnected(true);
          return;
        } catch (e) {
          // Silent fail on restore
          localStorage.removeItem('wallet-auto-reconnect');
        }
      }

      // Check Solflare
      if (window.solflare?.isConnected && window.solflare.publicKey) {
        try {
          let pubkey: PublicKey;
          if (window.solflare.publicKey instanceof PublicKey) {
            pubkey = window.solflare.publicKey;
          } else if (typeof window.solflare.publicKey === 'string') {
            pubkey = new PublicKey(window.solflare.publicKey);
          } else if (window.solflare.publicKey?.toBytes) {
            const pubkeyBytes = window.solflare.publicKey.toBytes();
            pubkey = new PublicKey(pubkeyBytes);
          } else if (window.solflare.publicKey?.toString) {
            pubkey = new PublicKey(window.solflare.publicKey.toString());
          } else {
            throw new Error('Invalid format');
          }
          setPublicKey(pubkey);
          setWalletType('solflare');
          setIsConnected(true);
          return;
        } catch (e) {
          // Silent fail on restore
          localStorage.removeItem('wallet-auto-reconnect');
        }
      }

      // If we got here, couldn't reconnect - clear the flag
      localStorage.removeItem('wallet-auto-reconnect');
    };

    checkExistingConnection();
  }, []);

  const connectPhantom = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const provider = window.phantom?.solana;
      
      if (!provider?.isPhantom) {
        throw new Error('Phantom wallet not installed. Please install it from phantom.app');
      }
      
      const response = await provider.connect();
      const pubkeyBytes = response.publicKey.toBytes();
      const pubkey = new PublicKey(pubkeyBytes);
      
      setPublicKey(pubkey);
      setWalletType('phantom');
      setIsConnected(true);
      // Set auto-reconnect flag for browser wallets only
      localStorage.setItem('wallet-auto-reconnect', 'true');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to Phantom';
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectSolflare = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const provider = window.solflare;

      if (!provider?.isSolflare) {
        throw new Error('Solflare wallet not installed. Please install it from solflare.com');
      }

      // Try to connect
      await provider.connect();

      // After connection, the publicKey should be available on the provider
      const pkSource = provider.publicKey;

      if (!pkSource) {
        throw new Error('No publicKey returned from Solflare after connection');
      }

      // Solflare returns publicKey in various formats - handle all cases
      let pubkey: PublicKey;

      // Check if it's already a PublicKey instance
      if (pkSource instanceof PublicKey) {
        pubkey = pkSource;
      }
      // Check if it has _bn property (Solflare's internal format)
      else if ((pkSource as any)._bn) {
        // Create from the internal BN representation
        pubkey = new PublicKey((pkSource as any)._bn.toArray());
      }
      // Check if it's a string (base58)
      else if (typeof pkSource === 'string') {
        pubkey = new PublicKey(pkSource);
      }
      // Check if it has toBase58 method
      else if (typeof (pkSource as any).toBase58 === 'function') {
        pubkey = new PublicKey((pkSource as any).toBase58());
      }
      // Check if it has toString method
      else if (typeof (pkSource as any).toString === 'function') {
        pubkey = new PublicKey((pkSource as any).toString());
      }
      // Check if it has toBytes method
      else if (typeof (pkSource as any).toBytes === 'function') {
        const bytes = (pkSource as any).toBytes();
        pubkey = new PublicKey(bytes);
      }
      // Check if it's an array
      else if (Array.isArray(pkSource)) {
        pubkey = new PublicKey(new Uint8Array(pkSource));
      }
      // Check if it's a Uint8Array
      else if (pkSource instanceof Uint8Array) {
        pubkey = new PublicKey(pkSource);
      }
      else {
        // Last resort: try to extract any byte array or string representation
        const str = JSON.stringify(pkSource);
        throw new Error(`Unhandled Solflare publicKey format. Type: ${typeof pkSource}, Value: ${str.slice(0, 100)}`);
      }

      setPublicKey(pubkey);
      setWalletType('solflare');
      setIsConnected(true);
      // Set auto-reconnect flag for browser wallets only
      localStorage.setItem('wallet-auto-reconnect', 'true');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to Solflare';
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const connectKeypair = useCallback((secretKey: Uint8Array) => {
    setError(null);

    try {
      const kp = Keypair.fromSecretKey(secretKey);
      setKeypair(kp);
      setPublicKey(kp.publicKey);
      setWalletType('keypair');
      setIsConnected(true);
      // DON'T set auto-reconnect for keypairs - they should not persist across refreshes
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid secret key';
      setError(message);
    }
  }, []);

  const connectFromJson = useCallback((jsonContent: string) => {
    setError(null);
    
    try {
      // Try parsing as array of numbers
      const parsed = JSON.parse(jsonContent);
      
      let secretKey: Uint8Array;
      
      if (Array.isArray(parsed)) {
        // Array format: [1, 2, 3, ...]
        secretKey = new Uint8Array(parsed);
      } else if (parsed.secretKey && Array.isArray(parsed.secretKey)) {
        // Object format: { secretKey: [1, 2, 3, ...] }
        secretKey = new Uint8Array(parsed.secretKey);
      } else if (parsed._keypair?.secretKey) {
        // Keypair object format
        secretKey = new Uint8Array(parsed._keypair.secretKey);
      } else {
        throw new Error('Invalid JSON format. Expected array of bytes or keypair object');
      }
      
      if (secretKey.length !== 64) {
        throw new Error(`Invalid secret key length: ${secretKey.length}. Expected 64 bytes.`);
      }
      
      connectKeypair(secretKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to parse JSON keyfile';
      setError(message);
    }
  }, [connectKeypair]);

  const disconnect = useCallback(async () => {
    try {
      if (walletType === 'phantom' && window.phantom?.solana) {
        await window.phantom.solana.disconnect();
      } else if (walletType === 'solflare' && window.solflare) {
        await window.solflare.disconnect();
      }
    } catch (e) {
      // Silent fail on disconnect
    }

    // Clear auto-reconnect flag so wallet won't reconnect on refresh
    localStorage.removeItem('wallet-auto-reconnect');

    setPublicKey(null);
    setWalletType(null);
    setIsConnected(false);
    setKeypair(null);
    setError(null);
  }, [walletType]);

  const signAndSendTransaction = useCallback(async (
    transaction: Transaction | VersionedTransaction
  ): Promise<string> => {
    if (!isConnected || !publicKey) {
      throw new Error('Wallet not connected');
    }

    // For keypair wallet, sign and send directly
    if (walletType === 'keypair' && keypair) {
      if (transaction instanceof Transaction) {
        transaction.sign(keypair);
        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
        return signature;
      } else {
        // VersionedTransaction
        transaction.sign([keypair]);
        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature, 'confirmed');
        return signature;
      }
    }

    // For browser wallets
    const provider = walletType === 'phantom' 
      ? window.phantom?.solana 
      : walletType === 'solflare' 
        ? window.solflare 
        : null;

    if (!provider) {
      throw new Error('Wallet provider not available');
    }

    // Auto-sign: use signAndSendTransaction directly
    if (autoSign) {
      const { signature } = await provider.signAndSendTransaction(transaction);
      return signature;
    } else {
      // Manual sign: sign first, then send
      const signed = await provider.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
      return signature;
    }
  }, [isConnected, publicKey, walletType, keypair, connection, autoSign]);

  const value: WalletContextType = {
    connection,
    walletType,
    publicKey,
    isConnected,
    isConnecting,
    autoSign,
    setAutoSign,
    connectPhantom,
    connectSolflare,
    connectKeypair,
    connectFromJson,
    disconnect,
    signAndSendTransaction,
    error,
    clearError,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
