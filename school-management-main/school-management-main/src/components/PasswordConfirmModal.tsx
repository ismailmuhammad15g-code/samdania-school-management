import React, { useState, useRef, useEffect } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert, X, CheckCircle } from 'lucide-react';
import { hashPassword } from '../lib/auth';

interface PasswordConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  actionLabel: string;
}

export default function PasswordConfirmModal({ isOpen, onClose, onConfirm, actionLabel }: PasswordConfirmModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError('');
      setSuccess(false);
      setShowPassword(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleVerify = async () => {
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const stored = localStorage.getItem('samdani_admin_credentials');
      const creds = stored ? JSON.parse(stored) : { email: 'admin@madrasah.com', passwordHash: '6e4a6b19ced2b0c7d0c76a145ab82e2b33d2101b56dc640572efcb2b8f26d48d' };
      const hash = await hashPassword(password);

      if (hash !== creds.passwordHash) {
        setError('Incorrect password. Try again.');
        setLoading(false);
        setPassword('');
        inputRef.current?.focus();
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onConfirm();
        onClose();
      }, 500);
    } catch {
      setError('Verification failed. Please try again.');
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && !success) {
      handleVerify();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#2c332d]/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-sm overflow-hidden animate-[slideUp_0.25s_ease-out]">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#2c332d] via-[#3d4d41] to-[#4a5d4e] px-6 py-5 text-center">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-stone-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-3">
            {success ? (
              <CheckCircle className="h-7 w-7 text-emerald-300" />
            ) : (
              <Lock className="h-7 w-7 text-[#d9c5b2]" />
            )}
          </div>

          <h3 className="text-sm font-serif font-bold text-white tracking-wide">
            {success ? 'Verified!' : 'Password Required'}
          </h3>
          <p className="text-[10px] text-stone-300 mt-1">
            {success ? 'Action authorized.' : actionLabel}
          </p>
        </div>

        {/* Body */}
        {!success && (
          <div className="px-6 py-5 space-y-4">
            {/* Action label badge */}
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-100 rounded-lg px-3 py-2">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-[10px] font-bold text-stone-600 truncate">{actionLabel}</span>
            </div>

            {/* Password input */}
            <div>
              <label className="block text-[10px] font-bold text-stone-500 mb-1.5 uppercase tracking-wider">
                Enter Admin Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  disabled={loading}
                  className="w-full bg-white border-2 border-stone-200 rounded-lg text-sm pl-9 pr-10 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]/30 font-mono disabled:bg-stone-50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2 animate-[shakeX_0.3s_ease]">
                <ShieldAlert className="h-3.5 w-3.5 text-red-500 shrink-0" />
                <span className="text-[11px] font-medium text-red-600">{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading || !password.trim()}
                className="flex-1 bg-[#4a5d4e] hover:bg-[#3d4d41] disabled:bg-[#6a7d6e] text-white text-xs font-bold py-2.5 rounded-lg shadow-sm transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" />
                    Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Success flash */}
        {success && (
          <div className="px-6 py-5 text-center">
            <p className="text-xs text-emerald-600 font-bold">Password verified. Executing action...</p>
          </div>
        )}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes shakeX { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
      `}</style>
    </div>
  );
}
