import React from 'react';

interface MadrasahLogoProps {
  className?: string;
  size?: number;
}

export default function MadrasahLogo({ className = '', size = 120 }: MadrasahLogoProps) {
  // We use viewBox="0 0 400 600" to maintain the perfect original vertical aspect ratio of the logo
  return (
    <svg
      viewBox="0 0 400 600"
      width={size}
      height={size * (600 / 400)}
      className={`select-none ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Soft radial glow to elevate the background */}
        <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f7f5f0" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>

        {/* Traditional yellow-orange-gold gradients for the book stand / rehal */}
        <linearGradient id="rehalGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="rehalGradRight" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>

        {/* Vivid emerald green gradient for the dome */}
        <linearGradient id="domeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        
        {/* Soft shadow for depth */}
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* 1. BACKGROUND GLOW */}
      <circle cx="200" cy="280" r="190" fill="url(#bgGlow)" />

      {/* 2. MADRASAH BUILDING BACKGROUND SKETCH (Precise semi-transparent layout) */}
      <g opacity="0.3" stroke="#475569" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Three-story Building Outline */}
        <rect x="80" y="110" width="240" height="280" rx="4" fill="#ffffff" fillOpacity="0.8" />
        
        {/* Floor divisions */}
        <line x1="80" y1="180" x2="320" y2="180" />
        <line x1="80" y1="250" x2="320" y2="250" />
        <line x1="80" y1="320" x2="320" y2="320" />

        {/* Structural pillars */}
        <line x1="125" y1="110" x2="125" y2="390" />
        <line x1="180" y1="110" x2="180" y2="390" />
        <line x1="235" y1="110" x2="235" y2="390" />
        <line x1="280" y1="110" x2="280" y2="390" />

        {/* Window structures across floors */}
        {[140, 210, 280, 350].map((y, idx) => (
          <g key={idx}>
            <rect x="90" y={y - 18} width="25" height="24" rx="2" fill="#f1f5f9" fillOpacity="0.5" />
            <rect x="135" y={y - 18} width="35" height="24" rx="2" fill="#f1f5f9" fillOpacity="0.5" />
            <rect x="190" y={y - 18} width="35" height="24" rx="2" fill="#f1f5f9" fillOpacity="0.5" />
            <rect x="245" y={y - 18} width="25" height="24" rx="2" fill="#f1f5f9" fillOpacity="0.5" />
            <rect x="290" y={y - 18} width="20" height="24" rx="2" fill="#f1f5f9" fillOpacity="0.5" />
            {/* Window glass panes split lines */}
            <line x1="102.5" y1={y - 18} x2="102.5" y2={y + 6} strokeWidth="0.8" />
            <line x1="152.5" y1={y - 18} x2="152.5" y2={y + 6} strokeWidth="0.8" />
            <line x1="207.5" y1={y - 18} x2="207.5" y2={y + 6} strokeWidth="0.8" />
            <line x1="257.5" y1={y - 18} x2="257.5" y2={y + 6} strokeWidth="0.8" />
          </g>
        ))}
      </g>

      {/* 3. GREEN ISLAMIC DOME AT THE TOP */}
      <g filter="url(#shadow)">
        {/* Dome Spire / Finial */}
        <path
          d="M 200 12 L 200 48"
          stroke="#047857"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Crescent accents on spire */}
        <path
          d="M 195 24 C 195 20 205 20 205 24 C 205 28 195 28 195 24 Z"
          fill="#047857"
        />
        <circle cx="200" cy="18" r="4.5" fill="#10b981" />

        {/* Dome Body */}
        <path
          d="M 140 110 C 140 110 140 70 170 55 C 185 45 195 32 200 32 C 205 32 215 45 230 55 C 260 70 260 110 260 110 Z"
          fill="url(#domeGrad)"
        />
        
        {/* Dome Highlights & Shading */}
        <path
          d="M 200 32 C 204 45 215 56 228 66 C 248 81 253 110 253 110"
          fill="none"
          stroke="#065f46"
          strokeWidth="2"
          opacity="0.3"
        />
        <path
          d="M 200 32 C 196 45 185 56 172 66 C 152 81 147 110 147 110"
          fill="none"
          stroke="#6ee7b7"
          strokeWidth="2"
          opacity="0.4"
        />

        {/* Base Rim of Dome */}
        <rect x="132" y="106" width="136" height="9" rx="3" fill="#047857" />
        <rect x="142" y="103" width="116" height="3" rx="1.5" fill="#34d399" />
      </g>

      {/* 4. VERTICAL BENGALI TEXT ON THE LEFT */}
      {/* "সামদানীয়া তা'লীমুল ইসলাম মাদ্রাসা," */}
      <g>
        <text
          x="-340"
          y="56"
          fill="#701a75"
          fontSize="24"
          fontWeight="bold"
          fontFamily="Siyam Rupali, SolaimanLipi, Inter, Arial, sans-serif"
          transform="rotate(-90)"
          letterSpacing="0.5"
        >
          সামদানীয়া তা'লীমুল ইসলাম মাদ্রাসা,
        </text>
      </g>

      {/* 5. BLACK ARABIC CALLIGRAPHY OVERLAY */}
      <g fill="#111827" filter="url(#shadow)">
        {/* Beautiful, authentic calligraphy bezier representations matching the original logo */}
        {/* Main tall Alif/Lam stroke */}
        <path d="M 115 120 C 110 120 120 290 112 330 C 105 360 90 368 82 372 C 88 374 128 372 138 365 C 148 358 131 290 131 120 Z" />
        
        {/* Second curvy vertical stroke */}
        <path d="M 178 145 C 175 145 168 240 165 270 C 161 300 151 318 145 322 C 150 323 178 321 185 312 C 191 302 188 240 188 145 Z" />

        {/* Sweeping round connector (mim/ha structure) */}
        <path d="M 175 270 C 175 270 255 205 288 240 C 316 270 256 335 205 347 C 153 359 112 340 112 340 C 112 340 158 375 220 370 C 280 365 330 315 315 265 C 300 215 203 225 175 270 Z" />

        {/* Lower flourish */}
        <path d="M 138 320 C 138 320 158 390 225 387 C 290 384 318 340 318 340 C 318 340 290 403 220 403 C 148 403 122 343 122 343 Z" />
        
        {/* Loop / Eye of the calligraphic letter */}
        <path d="M 235 185 C 215 185 197 215 220 240 C 245 265 290 250 285 215 C 280 180 255 185 235 185 Z M 240 200 C 253 200 267 210 265 223 C 263 236 240 243 230 230 C 220 217 227 200 240 200 Z" />

        {/* Three dots at the top */}
        <path d="M 208 140 L 221 125 L 231 133 L 218 148 Z" />
        <path d="M 228 140 L 241 125 L 251 133 L 238 148 Z" />
        <path d="M 218 123 L 231 108 L 241 116 L 228 131 Z" />

        {/* Right side swooshes */}
        <path d="M 298 317 L 315 290 L 327 297 L 310 324 Z" />
        <path d="M 318 305 L 335 278 L 347 285 L 330 312 Z" />
      </g>

      {/* 6. BOOK STAND / REHAL (Yellow-orange supporting wings) */}
      <g transform="translate(0, 35)" filter="url(#shadow)">
        {/* Left wing of Rehal */}
        <path
          d="M 200 405 L 45 315 C 45 315 105 375 200 450 Z"
          fill="url(#rehalGradLeft)"
          stroke="#b45309"
          strokeWidth="1.5"
        />
        {/* Right wing of Rehal */}
        <path
          d="M 200 405 L 355 315 C 355 315 295 375 200 450 Z"
          fill="url(#rehalGradRight)"
          stroke="#b45309"
          strokeWidth="1.5"
        />

        {/* Central decorative joint diamond */}
        <polygon
          points="200,380 228,405 200,430 172,405"
          fill="#fef08a"
          stroke="#b45309"
          strokeWidth="1.5"
        />
        <polygon
          points="200,390 214,405 200,420 186,405"
          fill="#f59e0b"
        />

        {/* Traditional dual calligraphic dots at the bottom of Rehal */}
        <path d="M 258 430 L 271 415 L 281 423 L 268 438 Z" fill="#111827" />
        <path d="M 278 430 L 291 415 L 301 423 L 288 438 Z" fill="#111827" />
      </g>

      {/* 7. BOTTOM ESTABLISHED BENGALI TEXT */}
      {/* "স্থাপিত : ২০০৬ইং" */}
      <g>
        <text
          x="200"
          y="545"
          fill="#111827"
          fontSize="36"
          fontWeight="900"
          fontFamily="Siyam Rupali, SolaimanLipi, Inter, Arial, sans-serif"
          textAnchor="middle"
          letterSpacing="1"
        >
          স্থাপিত : ২০০৬ইং
        </text>
      </g>
    </svg>
  );
}
