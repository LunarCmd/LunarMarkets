import { Connection, PublicKey, Transaction, TransactionInstruction, SYSVAR_CLOCK_PUBKEY, SystemProgram } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  Token
} from '@solana/spl-token';
import BN from 'bn.js';

// Instruction tags from percolator program
export const IX_TAG = {
  InitUser: 1,
  InitLP: 2,
  DepositCollateral: 3,
  WithdrawCollateral: 4,
  TradeNoCpi: 6,
  TradeCpi: 10,
} as const;

// Encoding utilities
function encU8(value: number): Buffer {
  const buf = Buffer.alloc(1);
  buf.writeUInt8(value, 0);
  return buf;
}

function encU16(value: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(value, 0);
  return buf;
}

function encU64(value: string | bigint): Buffer {
  const bn = typeof value === 'string' ? BigInt(value) : value;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(bn, 0);
  return buf;
}

function encI128(value: string | bigint): Buffer {
  const bn = typeof value === 'string' ? BigInt(value) : value;
  const buf = Buffer.alloc(16);
  const isNeg = bn < 0n;
  const abs = isNeg ? -bn : bn;
  buf.writeBigUInt64LE(abs & 0xFFFFFFFFFFFFFFFFn, 0);
  buf.writeBigUInt64LE(abs >> 64n, 8);
  if (isNeg) {
    // Two's complement
    for (let i = 0; i < 16; i++) {
      buf[i] = ~buf[i] & 0xff;
    }
    let carry = 1;
    for (let i = 0; i < 16 && carry; i++) {
      const sum = buf[i] + carry;
      buf[i] = sum & 0xff;
      carry = sum >> 8;
    }
  }
  return buf;
}

// Get PDA for vault
export function getVaultPda(slabAddress: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), slabAddress.toBuffer()],
    programId
  );
  return pda;
}

// Build init user transaction
export async function buildInitUserTransaction(params: {
  connection: Connection;
  userPublicKey: PublicKey;
  slabAddress: PublicKey;
  programId: PublicKey;
  collateralMint: PublicKey;
  vaultAddress: PublicKey;
  feePayment: BN;
}): Promise<Transaction> {
  const { connection, userPublicKey, slabAddress, programId, collateralMint, vaultAddress, feePayment } = params;

  const transaction = new Transaction();

  // Get user's ATA
  const userAta = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    collateralMint,
    userPublicKey
  );

  // Check if this is WSOL (native SOL)
  const isNativeSOL = collateralMint.equals(NATIVE_MINT);

  if (isNativeSOL) {
    // Check if ATA exists
    const ataInfo = await connection.getAccountInfo(userAta);

    if (!ataInfo) {
      // Create ATA if it doesn't exist
      transaction.add(
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          collateralMint,
          userAta,
          userPublicKey,
          userPublicKey
        )
      );
    }

    // Transfer SOL to the ATA
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: userAta,
        lamports: feePayment.toNumber(),
      })
    );

    // Sync native to wrap SOL
    transaction.add(
      Token.createSyncNativeInstruction(TOKEN_PROGRAM_ID, userAta)
    );
  }

  // Encode instruction data
  const data = Buffer.concat([
    encU8(IX_TAG.InitUser),
    encU64(feePayment.toString()),
  ]);

  // Build init user instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: userPublicKey, isSigner: true, isWritable: true },
      { pubkey: slabAddress, isSigner: false, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: vaultAddress, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  transaction.add(instruction);
  transaction.feePayer = userPublicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  return transaction;
}

// Build deposit transaction
export async function buildDepositTransaction(params: {
  connection: Connection;
  userPublicKey: PublicKey;
  slabAddress: PublicKey;
  programId: PublicKey;
  collateralMint: PublicKey;
  vaultAddress: PublicKey;
  userIdx: number;
  amount: BN;
}): Promise<Transaction> {
  const { connection, userPublicKey, slabAddress, programId, collateralMint, vaultAddress, userIdx, amount } = params;

  const transaction = new Transaction();

  // Get user's ATA
  const userAta = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    collateralMint,
    userPublicKey
  );

  // Check if this is WSOL (native SOL)
  const isNativeSOL = collateralMint.equals(NATIVE_MINT);

  if (isNativeSOL) {
    // Check if ATA exists
    const ataInfo = await connection.getAccountInfo(userAta);

    if (!ataInfo) {
      // Create ATA if it doesn't exist
      transaction.add(
        Token.createAssociatedTokenAccountInstruction(
          ASSOCIATED_TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          collateralMint,
          userAta,
          userPublicKey,
          userPublicKey
        )
      );
    }

    // Transfer SOL to the ATA
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: userAta,
        lamports: amount.toNumber(),
      })
    );

    // Sync native to wrap SOL
    transaction.add(
      Token.createSyncNativeInstruction(TOKEN_PROGRAM_ID, userAta)
    );
  }

  // Encode instruction data
  const data = Buffer.concat([
    encU8(IX_TAG.DepositCollateral),
    encU16(userIdx),
    encU64(amount.toString()),
  ]);

  // Build deposit instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: userPublicKey, isSigner: true, isWritable: true },
      { pubkey: slabAddress, isSigner: false, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: vaultAddress, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  transaction.add(instruction);
  transaction.feePayer = userPublicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  return transaction;
}

// Build withdraw transaction
export async function buildWithdrawTransaction(params: {
  connection: Connection;
  userPublicKey: PublicKey;
  slabAddress: PublicKey;
  programId: PublicKey;
  collateralMint: PublicKey;
  vaultAddress: PublicKey;
  oracleAddress: PublicKey;
  userIdx: number;
  amount: BN;
}): Promise<Transaction> {
  const { connection, userPublicKey, slabAddress, programId, collateralMint, vaultAddress, oracleAddress, userIdx, amount } = params;

  const transaction = new Transaction();

  // Get user's ATA
  const userAta = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    collateralMint,
    userPublicKey
  );

  // Get vault PDA
  const vaultPda = getVaultPda(slabAddress, programId);

  // Encode instruction data
  const data = Buffer.concat([
    encU8(IX_TAG.WithdrawCollateral),
    encU16(userIdx),
    encU64(amount.toString()),
  ]);

  // Build withdraw instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: userPublicKey, isSigner: true, isWritable: true },
      { pubkey: slabAddress, isSigner: false, isWritable: true },
      { pubkey: vaultAddress, isSigner: false, isWritable: true },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: oracleAddress, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  transaction.add(instruction);

  // Check if this is WSOL - if so, close the account to unwrap back to SOL
  const isNativeSOL = collateralMint.equals(NATIVE_MINT);
  if (isNativeSOL) {
    // Close the WSOL account to unwrap back to native SOL
    transaction.add(
      Token.createCloseAccountInstruction(
        TOKEN_PROGRAM_ID,
        userAta,
        userPublicKey, // Destination for remaining SOL
        userPublicKey, // Owner/authority
        []             // Multisig signers (empty for single signer)
      )
    );
  }

  transaction.feePayer = userPublicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  return transaction;
}

// Build trade transaction using TradeCpi
export async function buildTradeTransaction(params: {
  connection: Connection;
  userPublicKey: PublicKey;
  lpOwner: PublicKey;
  slabAddress: PublicKey;
  programId: PublicKey;
  oracleAddress: PublicKey;
  matcherProgram: PublicKey;
  matcherContext: PublicKey;
  lpIdx: number;
  userIdx: number;
  size: BN; // Signed i128 - positive for long, negative for short
}): Promise<Transaction> {
  const { connection, userPublicKey, lpOwner, slabAddress, programId, oracleAddress, matcherProgram, matcherContext, lpIdx, userIdx, size } = params;

  // Derive LP PDA: seeds = ["lp", slab, lpIdx as u16 LE]
  const lpIdxBuffer = Buffer.alloc(2);
  lpIdxBuffer.writeUInt16LE(lpIdx, 0);
  const [lpPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('lp'), slabAddress.toBuffer(), lpIdxBuffer],
    programId
  );

  // Encode instruction data for TradeCpi
  const data = Buffer.concat([
    encU8(IX_TAG.TradeCpi),
    encU16(lpIdx),
    encU16(userIdx),
    encI128(size.toString()),
  ]);

  // Build instruction with TradeCpi account layout
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: userPublicKey, isSigner: true, isWritable: false },
      { pubkey: lpOwner, isSigner: false, isWritable: false },
      { pubkey: slabAddress, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: oracleAddress, isSigner: false, isWritable: false },
      { pubkey: matcherProgram, isSigner: false, isWritable: false },
      { pubkey: matcherContext, isSigner: false, isWritable: true },
      { pubkey: lpPda, isSigner: false, isWritable: false },
    ],
    programId,
    data,
  });

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = userPublicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  return transaction;
}
