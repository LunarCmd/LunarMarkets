'use client';

import { useState, useEffect } from 'react';
import { X, Delete } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
  title: string;
  message?: string;
  error?: string;
  attemptsRemaining?: number;
  requireMathChallenge?: boolean;
  mathProblem?: string;
  onMathSubmit?: (answer: string) => boolean;
}

export function PinModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  error: externalError,
  attemptsRemaining,
  requireMathChallenge,
  mathProblem,
  onMathSubmit
}: PinModalProps) {
  const [pin, setPin] = useState('');
  const [mathAnswer, setMathAnswer] = useState('');
  const [mathError, setMathError] = useState('');
  const [mathSolved, setMathSolved] = useState(false);
  const error = externalError || '';

  // Handle keyboard input
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block keyboard input if math challenge is required and not solved
      if (requireMathChallenge && !mathSolved) {
        return;
      }

      // Handle number keys (both main keyboard and numpad)
      if ((e.key >= '0' && e.key <= '9') || (e.code >= 'Numpad0' && e.code <= 'Numpad9')) {
        e.preventDefault();
        const num = e.key;
        if (pin.length < 4) {
          const newPin = pin + num;
          setPin(newPin);
          if (newPin.length === 4) {
            setTimeout(() => onSubmit(newPin), 100);
          }
        }
      }
      // Handle backspace
      else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin(pin.slice(0, -1));
      }
      // Handle escape
      else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, onClose, onSubmit, requireMathChallenge, mathSolved]);

  // Reset pin when modal opens or when there's an error
  useEffect(() => {
    if (isOpen) {
      setPin('');
    }
  }, [isOpen]);

  // Reset pin when error occurs
  useEffect(() => {
    if (error) {
      setPin('');
    }
  }, [error]);

  // Reset math challenge when modal opens
  useEffect(() => {
    if (isOpen) {
      setMathAnswer('');
      setMathError('');
      setMathSolved(false);
    }
  }, [isOpen]);

  const handleMathSubmit = () => {
    if (onMathSubmit && onMathSubmit(mathAnswer)) {
      setMathSolved(true);
      setMathError('');
    } else {
      setMathError('Incorrect answer. Try again.');
      setMathAnswer('');
    }
  };

  if (!isOpen) return null;

  const handleNumberClick = (num: string) => {
    // Block PIN entry if math challenge is required and not solved
    if (requireMathChallenge && !mathSolved) {
      return;
    }

    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        // Auto-submit when 4 digits entered
        setTimeout(() => {
          onSubmit(newPin);
        }, 100);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-800 rounded-xl border border-dark-700 w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {message && (
            <p className="text-sm text-gray-400 text-center">{message}</p>
          )}

          {/* Attempts Warning */}
          {attemptsRemaining !== undefined && attemptsRemaining <= 2 && (
            <div className={`p-4 rounded-lg border-2 ${
              attemptsRemaining === 1
                ? 'bg-red-950/50 border-red-500'
                : 'bg-orange-950/50 border-orange-500'
            }`}>
              <p className={`text-sm font-bold text-center mb-2 ${
                attemptsRemaining === 1 ? 'text-red-400' : 'text-orange-400'
              }`}>
                ⚠️ CRITICAL WARNING ⚠️
              </p>
              <p className={`text-xs text-center ${
                attemptsRemaining === 1 ? 'text-red-300' : 'text-orange-300'
              }`}>
                {attemptsRemaining === 1
                  ? 'FINAL ATTEMPT! All wallet keys will be PERMANENTLY DELETED if you enter the wrong PIN again!'
                  : `${attemptsRemaining} attempts remaining before ALL wallet keys are permanently deleted!`
                }
              </p>
            </div>
          )}

          {/* Math Challenge */}
          {requireMathChallenge && !mathSolved && (
            <div className="p-4 rounded-lg border-2 bg-red-950/50 border-red-500">
              <p className="text-sm font-bold text-red-400 text-center mb-3">
                🛡️ SECURITY CHALLENGE REQUIRED 🛡️
              </p>
              <p className="text-xs text-red-300 text-center mb-4">
                This is your LAST attempt before all keys are wiped. Solve this problem to continue:
              </p>
              <div className="space-y-3">
                <p className="text-lg font-bold text-white text-center">
                  {mathProblem}
                </p>
                <input
                  type="text"
                  value={mathAnswer}
                  onChange={(e) => setMathAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleMathSubmit();
                    }
                  }}
                  placeholder="Enter answer"
                  className="w-full px-4 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-center text-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  autoFocus
                />
                <button
                  onClick={handleMathSubmit}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors"
                >
                  Submit Answer
                </button>
                {mathError && (
                  <p className="text-xs text-red-400 text-center">{mathError}</p>
                )}
              </div>
            </div>
          )}

          {mathSolved && (
            <div className="p-3 rounded-lg bg-green-950/50 border border-green-600">
              <p className="text-sm text-green-400 text-center">
                ✓ Challenge passed. You may attempt your PIN one final time.
              </p>
            </div>
          )}

          {/* PIN Display */}
          <div className="flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                  pin.length > i
                    ? 'border-primary-500 bg-primary-900/30 text-white'
                    : 'border-dark-600 bg-dark-900 text-transparent'
                }`}
              >
                {pin.length > i ? '•' : '0'}
              </div>
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                disabled={pin.length >= 4 || (requireMathChallenge && !mathSolved)}
                className="h-14 bg-dark-700 hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-xl font-semibold transition-colors active:scale-95"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              disabled={requireMathChallenge && !mathSolved}
              className="h-14 bg-dark-700 hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-gray-400 hover:text-white text-sm transition-colors active:scale-95"
            >
              Clear
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              disabled={pin.length >= 4 || (requireMathChallenge && !mathSolved)}
              className="h-14 bg-dark-700 hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-xl font-semibold transition-colors active:scale-95"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              disabled={requireMathChallenge && !mathSolved}
              className="h-14 bg-dark-700 hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-gray-400 hover:text-white transition-colors active:scale-95 flex items-center justify-center"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Enter your 4-digit PIN to encrypt/decrypt wallet keys
          </p>
        </div>
      </div>
    </div>
  );
}
