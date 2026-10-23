import React, { useState, useEffect } from 'react';
import { sha256Hex } from '../lib/sha256';
import { dbGet, dbSet } from '../lib/localDb';
import { verifyAdminPassword } from '../lib/auth';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, KeyRound } from 'lucide-react';

// A dedicated, separate password for the Settings area. It is intentionally
// distinct from the admin login password so that opening Settings requires its
// own credential. The hash is stored through the Supabase-backed db layer
// (local fallback included), so it survives refreshes and syncs online.
const SETTINGS_SALT = 'SamdaniaSettingsGate2026';
const HASH_KEY = 'samdani_settings_password_hash';

interface SettingsGateProps {
  onUnlocked: () => void;
}

export default function SettingsGate({ onUnlocked }: SettingsGateProps) {
  const [mode, setMode] = useState<'create' | 'unlock'>('unlock');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = dbGet(HASH_KEY);
    setMode(existing ? 'unlock' : 'create');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (mode === 'create') {
      if (!password.trim()) {
        setMsg({ type: 'error', text: 'Please enter a settings password.' });
        return;
      }
      if (password.length < 6) {
        setMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
        return;
      }
      if (password !== confirm) {
        setMsg({ type: 'error', text: 'Passwords do not match.' });
        return;
      }
      setLoading(true);
      dbSet(HASH_KEY, sha256Hex(password + SETTINGS_SALT));
      setLoading(false);
      onUnlocked();
      return;
    }

    // unlock mode
    if (!password) {
      setMsg({ type: 'error', text: 'Please enter the settings password.' });
      return;
    }
    setLoading(true);
    try {
      const stored = dbGet(HASH_KEY);
      const matchesSettingsPassword = typeof stored === 'string'
        && stored === sha256Hex(password + SETTINGS_SALT);
      const matchesAdminPassword = await verifyAdminPassword(password);
      if (!matchesSettingsPassword && !matchesAdminPassword) {
        setMsg({ type: 'error', text: 'Incorrect password. Enter the Settings password or your current admin password.' });
        return;
      }
      onUnlocked();
    } catch {
      setMsg({ type: 'error', text: 'Password verification failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-[#4a5d4e] to-[#3d4d41] text-stone-100 px-5 py-4 flex items-center gap-2.5">
          <KeyRound className="h-5 w-5 text-[#d9c5b2]" />
          <div>
            <h3 className="text-sm font-serif font-bold">
              {mode === 'create' ? 'Set Settings Password' : 'Settings Locked'}
            </h3>
            <p className="text-[10px] text-[#d9c5b2]">
              {mode === 'create' ? 'إنشاء كلمة مرور للإعدادات' : 'الإعدادات مقفلة — أدخل كلمة المرور'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-[11px] text-stone-500 leading-relaxed">
            {mode === 'create'
              ? 'This password protects the Settings area and is separate from your admin login. Choose a strong password — it will be saved securely.'
              : 'Enter the settings password to open the Settings area.'}
          </p>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              {mode === 'create' ? 'New Settings Password' : 'Settings Password'}
            </label>
            <div className="relative">
              <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type={show ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm pl-9 pr-10 py-2.5 focus:outline-none focus:border-[#4a5d4e]"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mode === 'create' && (
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                <input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••"
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#4a5d4e]"
                />
              </div>
            </div>
          )}

          {msg && (
            <div className={`flex items-start gap-2 rounded-lg p-2.5 text-[11px] ${msg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
              {msg.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> : <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{msg.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-sm font-bold py-2.5 rounded-lg shadow active:scale-[0.98] cursor-pointer border border-[#3d4d41] flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? 'Please wait...' : mode === 'create' ? 'Save & Open Settings' : 'Unlock Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
