import React from 'react';
import { X } from 'lucide-react';
import { TeacherAccount } from '../types';

function initials(name?: string): string {
  const n = (name || 'T').trim();
  return (n.charAt(0).toUpperCase() || 'T');
}

interface TeacherAvatarProps {
  account?: Pick<TeacherAccount, 'fullName' | 'photoUrl'>;
  size?: number;
  onClick?: () => void;
  className?: string;
}

export function TeacherAvatar({ account, size = 40, onClick, className = '' }: TeacherAvatarProps) {
  const style = { width: size, height: size };
  const interactive = onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : '';
  const base = `rounded-full object-cover border border-[#3d4d41] shrink-0 ${interactive} ${className}`;

  if (account?.photoUrl) {
    return (
      <img
        src={account.photoUrl}
        alt={account.fullName || 'Teacher'}
        style={style}
        className={base}
        onClick={onClick}
      />
    );
  }
  return (
    <div
      style={style}
      onClick={onClick}
      className={`rounded-full bg-[#4a5d4e] text-[#d9c5b2] flex items-center justify-center font-serif font-bold shrink-0 ${interactive} ${className}`}
    >
      {initials(account?.fullName)}
    </div>
  );
}

interface PhotoLightboxProps {
  src: string;
  name: string;
  onClose: () => void;
}

export function PhotoLightbox({ src, name, onClose }: PhotoLightboxProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white cursor-pointer transition-all"
        title="Close"
      >
        <X className="h-7 w-7" />
      </button>
      <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={name}
          className="max-w-[85vw] max-h-[80vh] rounded-2xl shadow-2xl border border-white/20"
        />
        <p className="text-white/80 text-sm font-bold">{name}</p>
      </div>
    </div>
  );
}
