import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import BN from 'bn.js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatAmount(amount: BN | number | string, decimals: number = 6): string {
  let value: BN;
  
  if (BN.isBN(amount)) {
    value = amount;
  } else if (typeof amount === 'string') {
    value = new BN(amount);
  } else {
    value = new BN(amount);
  }

  // Handle negative numbers
  const isNegative = value.isNeg();
  const absValue = isNegative ? value.neg() : value;

  const divisor = new BN(10).pow(new BN(decimals));
  const integerPart = absValue.div(divisor).toString();
  const fractionalPart = absValue.mod(divisor).toString().padStart(decimals, '0');
  
  // Trim trailing zeros
  const trimmedFractional = fractionalPart.replace(/0+$/, '');
  
  const sign = isNegative ? '-' : '';
  
  if (trimmedFractional.length === 0) {
    return sign + integerPart;
  }
  
  return `${sign}${integerPart}.${trimmedFractional}`;
}

export function formatUSD(amount: BN | number | string, decimals: number = 6): string {
  const formatted = formatAmount(amount, decimals);
  return `$${formatted}`;
}

export function formatNumber(num: number | string | BN, precision: number = 2): string {
  let n: number;
  
  if (BN.isBN(num)) {
    // For BN, convert to string first, then use simple comparison
    const numStr = num.toString();
    // Check if it's a large number that would overflow
    if (numStr.length > 15) {
      // Use string length to estimate magnitude
      if (numStr.length > 18) {
        return numStr.slice(0, -9) + '.' + numStr.slice(-9, -9 + precision) + 'B';
      } else if (numStr.length > 12) {
        return numStr.slice(0, -6) + '.' + numStr.slice(-6, -6 + precision) + 'M';
      } else if (numStr.length > 9) {
        return numStr.slice(0, -3) + '.' + numStr.slice(-3, -3 + precision) + 'K';
      }
      return numStr;
    }
    n = parseFloat(numStr);
  } else if (typeof num === 'string') {
    n = parseFloat(num);
  } else {
    n = num;
  }
  
  if (isNaN(n)) return '0';
  
  if (Math.abs(n) >= 1e9) {
    return (n / 1e9).toFixed(precision) + 'B';
  } else if (Math.abs(n) >= 1e6) {
    return (n / 1e6).toFixed(precision) + 'M';
  } else if (Math.abs(n) >= 1e3) {
    return (n / 1e3).toFixed(precision) + 'K';
  }
  
  return n.toFixed(precision);
}

export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function getSlotTime(slot: number): string {
  // Approximate: Solana produces slots at ~400ms intervals
  const slotTimeMs = slot * 400;
  const now = Date.now();
  const slotDate = new Date(now - (Date.now() % 86400000) + slotTimeMs);
  return slotDate.toLocaleString();
}

export function shortenPublicKey(key: string, chars: number = 4): string {
  return formatAddress(key, chars);
}

export function classNames(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
