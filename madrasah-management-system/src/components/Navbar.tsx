import React from 'react';
import { UserRole, UserProfile } from '../types';
import MadrasahLogo from './MadrasahLogo';
import { 
  BookOpen, 
  Shield, 
  User as UserIcon, 
  RefreshCw, 
  Database, 
  LogOut, 
  Users, 
  DollarSign, 
  LayoutDashboard,
  Wallet,
  GraduationCap,
  PiggyBank
} from 'lucide-react';

interface NavbarProps {
  user: UserProfile;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  onRoleChange: (role: UserRole) => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  isSyncing: boolean;
  sheetsLinked: boolean;
  onForceSync: () => void;
  syncError: string | null;
}

export default function Navbar({
  user,
  activeTab,
  setActiveTab,
  onRoleChange,
  onGoogleSignIn,
  onGoogleSignOut,
  isSyncing,
  sheetsLinked,
  onForceSync,
  syncError
}: NavbarProps) {
  return (
    <header className="bg-[#4a5d4e] text-white shadow-sm border-b border-[#3d4d41]">
      {/* Upper banner: Branding and Google Sync status */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between border-b border-white/10 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-lg shadow-sm border border-stone-200/50 flex items-center justify-center">
            <MadrasahLogo size={42} />
          </div>
          <div>
            <h1 className="text-xl font-serif font-bold tracking-tight text-[#fdfbf7]">
              SAMDANIA TALIMUL ISLAM MADRASAH
            </h1>
            <p className="text-xs text-stone-200/90 font-mono">
              Comprehensive Madrasah Management System (MMS)
            </p>
          </div>
        </div>

        {/* Google Sheets Synchronization Panel */}
        <div className="flex flex-wrap items-center gap-3 bg-black/15 px-4 py-2 rounded-lg border border-white/10 max-w-full">
          <div className="flex items-center gap-2 text-xs">
            <Database className="h-4 w-4 text-[#d9c5b2]" />
            <span className="font-semibold text-stone-100">Database:</span>
            {sheetsLinked ? (
              <span className="text-green-300 bg-emerald-950/80 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1.5 border border-green-800/45">
                ● Live Google Sheets
              </span>
            ) : (
              <span className="text-amber-200 bg-amber-950/60 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1.5 border border-amber-800/30">
                ● Sandbox Local Cache
              </span>
            )}
          </div>

          {sheetsLinked ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onForceSync}
                disabled={isSyncing}
                title="Force pull/push to Google Sheets"
                className="bg-[#3d4d41] hover:bg-[#2c382f] disabled:bg-[#4a5d4e] text-white text-xs px-2.5 py-1 rounded transition-all font-medium flex items-center gap-1.5 border border-white/10 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button
                onClick={onGoogleSignOut}
                title="Disconnect Google Account"
                className="text-red-300 hover:text-red-200 text-xs px-2 py-1 rounded flex items-center gap-1 transition-all hover:bg-red-950/20"
              >
                <LogOut className="h-3 w-3" />
                Unlink
              </button>
            </div>
          ) : (
            <button
              onClick={onGoogleSignIn}
              disabled={isSyncing}
              className="bg-[#d9c5b2] hover:bg-[#ceb59c] text-[#2c332d] text-xs font-bold px-3 py-1.5 rounded shadow-sm hover:shadow transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Link Google Sheets
            </button>
          )}
        </div>
      </div>

      {/* Main navigation and user role-picker */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-2 gap-3">
          {/* Navigation Tabs */}
          <nav className="flex space-x-1" aria-label="Tabs" id="nav-tabs">
            <button
              onClick={() => setActiveTab('dashboard')}
              id="tab-dashboard"
              className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#3d4d41] text-white shadow-sm border-b-2 border-[#d9c5b2]'
                  : 'text-stone-100 hover:bg-[#3d4d41]/60 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('finance')}
              id="tab-finance"
              className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                activeTab === 'finance'
                  ? 'bg-[#3d4d41] text-white shadow-sm border-b-2 border-[#d9c5b2]'
                  : 'text-stone-100 hover:bg-[#3d4d41]/60 hover:text-white'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              Income & Expense
            </button>
            <button
              onClick={() => setActiveTab('fees')}
              id="tab-fees"
              className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                activeTab === 'fees'
                  ? 'bg-[#3d4d41] text-white shadow-sm border-b-2 border-[#d9c5b2]'
                  : 'text-stone-100 hover:bg-[#3d4d41]/60 hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              Student Fees
            </button>
            <button
              onClick={() => setActiveTab('salaries')}
              id="tab-salaries"
              className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                activeTab === 'salaries'
                  ? 'bg-[#3d4d41] text-white shadow-sm border-b-2 border-[#d9c5b2]'
                  : 'text-stone-100 hover:bg-[#3d4d41]/60 hover:text-white'
              }`}
            >
              <Wallet className="h-4 w-4" />
              Salaries
            </button>
            <button
              onClick={() => setActiveTab('results')}
              id="tab-results"
              className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                activeTab === 'results'
                  ? 'bg-[#3d4d41] text-white shadow-sm border-b-2 border-[#d9c5b2]'
                  : 'text-stone-100 hover:bg-[#3d4d41]/60 hover:text-white'
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Student Results
            </button>
            <button
              onClick={() => setActiveTab('loans')}
              id="tab-loans"
              className={`px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                activeTab === 'loans'
                  ? 'bg-[#3d4d41] text-white shadow-sm border-b-2 border-[#d9c5b2]'
                  : 'text-stone-100 hover:bg-[#3d4d41]/60 hover:text-white'
              }`}
            >
              <PiggyBank className="h-4 w-4" />
              Loan Fund (ঋণ)
            </button>
          </nav>

          {/* User Role Selector and Profile */}
          <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-white/10 md:border-t-0 pt-2 md:pt-0">
            {/* Quick switcher to test roles */}
            <div className="flex items-center gap-1.5 bg-black/15 p-1 rounded-md border border-white/10 text-xs">
              <span className="text-stone-200 px-1 font-mono text-[10px]">TEST ROLE:</span>
              {(['Admin', 'Accountant', 'Teacher'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => onRoleChange(r)}
                  className={`px-2 py-1 rounded font-medium transition-all cursor-pointer ${
                    user.role === r
                      ? 'bg-[#d9c5b2] text-[#2c332d] font-bold shadow-sm'
                      : 'text-stone-100 hover:bg-white/10'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Authenticated Account Info */}
            <div className="flex items-center gap-2">
              <div className="bg-[#3d4d41] h-8 w-8 rounded-full border border-white/10 flex items-center justify-center text-[#d9c5b2] font-bold text-sm shadow overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="h-4 w-4 text-[#d9c5b2]" />
                )}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold leading-none">{user.name}</p>
                <p className="text-[10px] text-stone-200 font-semibold uppercase mt-0.5 flex items-center gap-0.5">
                  <Shield className="h-2.5 w-2.5 text-[#d9c5b2]" />
                  {user.role} VIEW
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Synchronization alert banner if sync error occurred */}
      {syncError && (
        <div className="bg-red-800/90 text-white text-xs text-center py-1 px-4 border-t border-red-700 flex items-center justify-center gap-2 animate-pulse">
          <span>⚠️ Google Sheets sync issue: {syncError}. Working with local cache.</span>
          <button onClick={onForceSync} className="underline font-bold hover:text-amber-300">Retry Sync</button>
        </div>
      )}
    </header>
  );
}
