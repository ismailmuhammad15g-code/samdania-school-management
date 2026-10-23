import React, { useState } from 'react';
import logo2 from '../assets/images/logo2.png';
import { tabToPath, type AppTab } from '../lib/routes';
import {
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  DollarSign,
  Users,
  Wallet,
  GraduationCap,
  PiggyBank,
  Settings,
  Menu,
  X,
  ChevronDown,
  ChevronsDown,
  BookOpenCheck,
  FileStack,
  ClipboardList,
  Eye,
  Bot
  ,Megaphone
  ,FileWarning
} from 'lucide-react';
import NotificationBell from './NotificationBell';

interface NavbarProps {
  adminName: string;
  activeTab: string;
  navigate: (tab: AppTab) => void;
  onLogout: () => void;
  readOnly?: boolean;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'fees', label: 'Students', icon: Users },
  { id: 'salaries', label: 'Teachers (শিক্ষক)', icon: Wallet },
  { id: 'results', label: 'Results', icon: GraduationCap },
  { id: 'loans', label: 'Loans', icon: PiggyBank },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'assitant', label: 'Assistant', icon: Bot },
  { id: 'appManagement', label: 'App Management', icon: Megaphone },
  { id: 'missingFillouts', label: 'Missing Fillouts', icon: FileWarning },
];

export default function Navbar({
  adminName,
  activeTab,
  navigate,
  onLogout,
  readOnly
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Navigate to a top-level section, updating the real URL in the address bar.
  const handleNav = (tab: AppTab) => {
    navigate(tab);
    setMobileOpen(false);
  };

  // Anchor click handler: prevent the full-page reload and use client-side
  // navigation so the address bar shows the proper route (e.g. /students).
  const handleAnchor = (tab: AppTab) => (e: React.MouseEvent) => {
    e.preventDefault();
    handleNav(tab);
  };

  return (
    <header className="bg-gradient-to-r from-[#1e2a20] via-[#253328] to-[#1e2a20] text-white sticky top-0 z-40 shadow-lg">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Left: Logo + Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-white/10 p-1 rounded-lg backdrop-blur-sm border border-white/5">
              <img src={logo2} alt="Samdania Madrasah Logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold tracking-wide text-white/95 leading-tight">
                SAMDANIA TALIMUL ISLAM
              </h1>
              <p className="text-[10px] text-white/40 font-medium tracking-wider uppercase">
                Madrasah Management
              </p>
            </div>
          </div>

          {/* Center: Nav Tabs (desktop) */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <a
                  key={item.id}
                  href={tabToPath(item.id as AppTab)}
                  onClick={handleAnchor(item.id as AppTab)}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer no-underline ${
                    isActive
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#d9c5b2] rounded-full" />
                  )}
                </a>
              );
            })}

            {/* More dropdown (Closing / Hifz) */}
            <div className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'closing' || activeTab === 'hifz' || activeTab === 'summary' || activeTab === 'pending'
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                <ChevronsDown className="h-3.5 w-3.5" />
                More
                <ChevronDown className={`h-3 w-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                {(activeTab === 'closing' || activeTab === 'hifz' || activeTab === 'summary') && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#d9c5b2] rounded-full" />
                )}
              </button>

              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 w-56 bg-[#1e2a20] border border-white/10 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden">
                  <button
                    onClick={() => { handleNav('summary'); setMoreOpen(false); }}
                    className="w-full px-3 py-2.5 text-left text-xs text-white/80 hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <ClipboardList className="h-4 w-4 text-[#d9c5b2]" />
                    <span>
                      <span className="block font-semibold">Student Summary</span>
                      <span className="block text-[10px] text-white/40">Profile &amp; Results (সারসংক্ষেপ)</span>
                    </span>
                  </button>
                  <button
                    onClick={() => { handleNav('pending'); setMoreOpen(false); }}
                    className="w-full px-3 py-2.5 text-left text-xs text-white/80 hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <ClipboardList className="h-4 w-4 text-[#d9c5b2]" />
                    <span>
                      <span className="block font-semibold">Pending (অপেক্ষমাণ)</span>
                      <span className="block text-[10px] text-white/40">Teacher resignations &amp; requests</span>
                    </span>
                  </button>
                    <button
                      onClick={() => { handleNav('closing'); setMoreOpen(false); }}
                      className="w-full px-3 py-2.5 text-left text-xs text-white/80 hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FileStack className="h-4 w-4 text-[#d9c5b2]" />
                      <span>
                        <span className="block font-semibold">Closing</span>
                        <span className="block text-[10px] text-white/40">Monthly &amp; Yearly ختام</span>
                      </span>
                    </button>
                    <button
                      onClick={() => { handleNav('hifz'); setMoreOpen(false); }}
                      className="w-full px-3 py-2.5 text-left text-xs text-white/80 hover:bg-white/10 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <BookOpenCheck className="h-4 w-4 text-[#d9c5b2]" />
                      <span>
                        <span className="block font-semibold">Hifz</span>
                        <span className="block text-[10px] text-white/40">حفظ progress</span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </nav>

          {/* Right: User + live notifications (far right) */}
          <div className="flex items-center gap-2">
            {/* User dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              >
                <div className="h-7 w-7 rounded-full bg-[#d9c5b2]/20 border border-[#d9c5b2]/30 flex items-center justify-center">
                  <UserIcon className="h-3.5 w-3.5 text-[#d9c5b2]" />
                </div>
                <span className="hidden md:block text-xs font-semibold text-white/90 max-w-[100px] truncate">
                  {adminName}
                </span>
                {readOnly && (
                  <span className="hidden md:inline-flex items-center gap-1 bg-amber-500/20 text-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-400/30">
                    <Eye className="h-2.5 w-2.5" /> Viewer
                  </span>
                )}
                <ChevronDown className={`hidden md:block h-3 w-3 text-white/40 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown menu */}
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-[#1e2a20] border border-white/10 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/10">
                      <p className="text-xs font-bold text-white/90">{adminName}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">Administrator</p>
                    </div>

                    <div className="border-t border-white/10 mt-1 pt-1">
                      <button
                        onClick={() => { onLogout(); setUserMenuOpen(false); }}
                        className="w-full px-3 py-2 text-left text-xs text-red-400/80 hover:bg-red-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Logout
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Live activity notifications — far right end */}
            <NotificationBell />

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#1a2620]/95 backdrop-blur-sm">
          <nav className="max-w-7xl mx-auto px-4 py-2 space-y-0.5">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <a
                  key={item.id}
                  href={tabToPath(item.id as AppTab)}
                  onClick={handleAnchor(item.id as AppTab)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer no-underline ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              );
            })}

            {/* More items (Summary / Closing / Hifz) for mobile */}
            <a
              href={tabToPath('summary')}
              onClick={handleAnchor('summary')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer no-underline ${
                activeTab === 'summary'
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Student Summary
            </a>
            <a
              href={tabToPath('pending')}
              onClick={handleAnchor('pending')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer no-underline ${
                activeTab === 'pending'
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              Pending (অপেক্ষমাণ)
            </a>
            <a
              href={tabToPath('closing')}
              onClick={handleAnchor('closing')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer no-underline ${
                activeTab === 'closing'
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <FileStack className="h-4 w-4" />
              Closing
            </a>
            <a
              href={tabToPath('hifz')}
              onClick={handleAnchor('hifz')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer no-underline ${
                activeTab === 'hifz'
                  ? 'bg-white/15 text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <BookOpenCheck className="h-4 w-4" />
              Hifz
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
