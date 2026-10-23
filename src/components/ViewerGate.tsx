import React, { useState, useEffect } from 'react';
import { sha256Hex } from '../lib/sha256';
import { dbGet, dbSet } from '../lib/localDb';
import logo2 from '../assets/images/logo2.png';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, KeyRound, ArrowLeft } from 'lucide-react';

// Dedicated password for the read-only "Viewer Admin" role. Stored through the
// Supabase-backed db layer (with local fallback). The first time it is opened a
// password is created; afterwards it is required to enter the view-only console.
const VIEWER_SALT = 'SamdaniaViewerAdmin2026';
const HASH_KEY = 'samdani_viewer_password_hash';

interface ViewerGateProps {
  onSuccess: () => void;
  onBack: () => void;
}

export default function ViewerGate({ onSuccess, onBack }: ViewerGateProps) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (mode === 'create') {
      if (!password.trim()) {
        setMsg({ type: 'error', text: 'Please enter a viewer password.' });
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
      dbSet(HASH_KEY, sha256Hex(password + VIEWER_SALT));
      setLoading(false);
      onSuccess();
      return;
    }

    if (!password) {
      setMsg({ type: 'error', text: 'Please enter the viewer password.' });
      return;
    }
    setLoading(true);
    const stored = dbGet(HASH_KEY);
    const ok = Boolean(stored) && stored === sha256Hex(password + VIEWER_SALT);
    setLoading(false);
    if (ok) {
      onSuccess();
    } else {
      setMsg({ type: 'error', text: 'Incorrect viewer password.' });
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-br from-[#2c332d] via-[#3d4d41] to-[#4a5d4e] relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#d9c5b2]/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-[#d9c5b2]/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg">
            <img src={logo2} alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow" />
          </div>
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-stone-100 tracking-tight">
            {mode === 'create' ? 'Create Viewer Password' : 'Viewer Admin'}
          </h1>
          <p className="text-[11px] text-stone-300/80 font-light tracking-wide">
            {mode === 'create' ? 'ভিউয়ার পাসওয়ার্ড তৈরি করুন' : 'শুধু দেখার মোড · View-only console'}
          </p>
        </div>

        <div className="w-full bg-white/95 backdrop-blur rounded-2xl border border-white/30 shadow-2xl p-5 space-y-4 animate-[fadeIn_0.8s_ease]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                {mode === 'create' ? 'New Viewer Password' : 'Viewer Password'}
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
              className="w-full bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-sm font-bold py-2.5 rounded-lg shadow active:scale-[0.98] cursor-pointer border border-[#3d4d41] flex items-center justify-center gap-2"
            >
              {loading ? 'Please wait...' : mode === 'create' ? 'Create & Enter' : 'Enter Viewer Console'}
            </button>
          </form>

          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-1.5 text-stone-500 hover:text-stone-700 text-xs font-bold py-1 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>
      </div>
    </div>
  );
}
