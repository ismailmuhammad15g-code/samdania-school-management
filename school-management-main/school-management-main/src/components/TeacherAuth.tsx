import React, { useState } from 'react';
import logo2 from '../assets/images/logo2.png';
import { Mail, Lock, User, BadgeCheck, FileText, ArrowLeft, LogIn, UserPlus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TeacherAccount, TeacherPortalSession } from '../types';
import { createTeacherPortalSession } from '../lib/teacherSessions';

interface TeacherAuthProps {
  accounts: TeacherAccount[];
  onCreateAccount: (acc: Omit<TeacherAccount, 'registered' | 'createdAt' | 'status'>) => TeacherAccount;
  onLogin: (session: TeacherPortalSession) => void;
  onBack: () => void;
}

type Mode = 'login' | 'create';

export default function TeacherAuth({ accounts, onCreateAccount, onLogin, onBack }: TeacherAuthProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [bio, setBio] = useState('');

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  // UUID generator that works in every context (crypto.randomUUID is undefined
  // on plain-HTTP / insecure origins, which would otherwise crash account creation).
  const safeUuid = (): string =>
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const match = accounts.find(
        (a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password
      );
      if (!match) {
        setLoading(false);
        setError('Invalid email or password. Please try again.');
        return;
      }
      const portalSession = createTeacherPortalSession(match);
      onLogin(portalSession);
    }, 600);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) return setError('Full Name (পুরো নাম) is required.');
    if (!designation.trim()) return setError('Designation (পদবি) is required.');
    if (!isValidEmail(email)) return setError('Please enter a valid email address.');
    if (accounts.some((a) => a.email.toLowerCase() === email.trim().toLowerCase())) {
      return setError('This email is already registered. Please switch to Login.');
    }
    if (!password || password.length < 4) return setError('Password must be at least 4 characters.');

    setLoading(true);
    setTimeout(() => {
      const id = safeUuid();
      const createdAccount = onCreateAccount({ id, fullName: fullName.trim(), designation: designation.trim(), email: email.trim(), password, bio: bio.trim() });
      const portalSession = createTeacherPortalSession(createdAccount);
      onLogin(portalSession);
    }, 600);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-[#2c332d] via-[#3d4d41] to-[#4a5d4e] relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#d9c5b2]/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-[#d9c5b2]/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Header */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-stone-200/80 hover:text-white text-xs mb-4 cursor-pointer transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <img src={logo2} alt="Samdania Madrasah Logo" className="w-16 h-16 object-contain drop-shadow" />
          <div>
            <h1 className="text-xl font-serif font-bold text-stone-100">Teacher Portal</h1>
            <p className="text-[11px] text-stone-300/80">শিক্ষক পোর্টাল · Samdania Madrasah</p>
          </div>
        </div>

        {/* Toggle */}
        <div className="flex bg-white/10 backdrop-blur rounded-xl p-1 mb-4 border border-white/20">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'login' ? 'bg-[#4a5d4e] text-white shadow' : 'text-stone-200 hover:text-white'
            }`}
          >
            <LogIn className="h-4 w-4" /> Login
          </button>
          <button
            onClick={() => { setMode('create'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'create' ? 'bg-[#4a5d4e] text-white shadow' : 'text-stone-200 hover:text-white'
            }`}
          >
            <UserPlus className="h-4 w-4" /> Create Account
          </button>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl p-5 sm:p-6">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-[11px] rounded-lg p-2.5 mb-4">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <p className="text-sm font-bold text-[#2c332d] mb-1">Sign in to your account</p>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Email (ইমেইল)</label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@example.com"
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-sm font-bold py-3 rounded-lg shadow active:scale-[0.98] cursor-pointer border border-[#3d4d41] flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                {loading ? 'Signing in...' : 'Login'}
              </button>
              <p className="text-center text-[11px] text-stone-500">
                New here?{' '}
                <button type="button" onClick={() => { setMode('create'); setError(''); }} className="text-[#4a5d4e] font-bold cursor-pointer">
                  Create an account
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleCreate} className="space-y-3.5">
              <p className="text-sm font-bold text-[#2c332d] mb-1">Create your teacher account</p>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Full Name (পুরো নাম) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Mawlana Masood"
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Designation (পদবি) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <BadgeCheck className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Hifz Muallim"
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Email (ইমেইল)</label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@example.com"
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="min 4 characters"
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Bio / Notes (সংক্ষিপ্ত বিবরণ)</label>
                <div className="relative">
                  <FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Brief description about yourself..."
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] h-20 resize-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-sm font-bold py-3 rounded-lg shadow active:scale-[0.98] cursor-pointer border border-[#3d4d41] flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {loading ? 'Creating...' : 'Create Account'}
              </button>
              <p className="text-center text-[11px] text-stone-500">
                Already have an account?{' '}
                <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-[#4a5d4e] font-bold cursor-pointer">
                  Login here
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
