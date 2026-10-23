import React, { useState } from 'react';
import { loginAdmin } from '../lib/auth';
import logo2 from '../assets/images/logo2.png';
import { Shield, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const session = await loginAdmin(email.trim(), password);
      if (session) {
        onLoginSuccess();
      } else {
        setError('Invalid email or password. Please try again.');
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden">
          <div className="bg-[#4a5d4e] p-6 text-center border-b border-[#3d4d41]">
            <div className="flex justify-center mb-3">
              <div className="bg-white p-2 rounded-xl shadow-sm border border-stone-200/50">
                <img src={logo2} alt="Samdania Madrasah Logo" style={{ width: 64, height: 64, objectFit: 'contain' }} />
              </div>
            </div>
            <h1 className="text-xl font-serif font-bold text-[#fdfbf7] tracking-tight">
              Samdania Talimul Islam Madrasah
            </h1>
            <p className="text-xs text-stone-200/80 mt-1 font-mono">
              Admin Management Portal
            </p>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-stone-100">
              <Shield className="h-5 w-5 text-[#4a5d4e]" />
              <div>
                <h2 className="text-sm font-bold text-[#2c332d]">Admin Login</h2>
                <p className="text-[10px] text-stone-500">Enter your credentials to access the dashboard</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="admin@madrasah.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 pr-10 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#4a5d4e] hover:bg-[#3d4d41] disabled:bg-[#6a7d6e] text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-all shadow active:scale-[0.98] cursor-pointer border border-[#3d4d41] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying...
                  </>
                ) : (
                  'Sign In to Dashboard'
                )}
              </button>
            </form>
          </div>

          <div className="bg-stone-50 px-6 py-3 border-t border-stone-100 text-center">
            <p className="text-[10px] text-stone-400 font-mono">
              Authorized Admin Access Only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
