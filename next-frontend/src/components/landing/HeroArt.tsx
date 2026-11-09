"use client";

import { useId } from "react";

export default function HeroArt({ className = "absolute inset-0 -z-10 h-full w-full pointer-events-none" }: { className?: string }) {
  const id = useId();
  const gradId = `${id}-grad`;
  const glowId = `${id}-glow`;

  return (
    <svg
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f46e8" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <radialGradient id={glowId} cx="0.5" cy="0.42" r="0.55">
          <stop offset="0%" stopColor="#4f46e8" stopOpacity="0.35" />
          <stop offset="70%" stopColor="#4f46e8" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#4f46e8" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="400" fill={`url(#${glowId})`} />
      <circle cx="310" cy="60" r="150" fill={`url(#${gradId})`} opacity="0.85" />
      <circle cx="52" cy="336" r="92" fill="#f59e0b" opacity="0.45" />

      {/* dashed orbit rings */}
      <circle cx="200" cy="200" r="112" fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="3 12" />
      <circle cx="200" cy="200" r="82" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="2 9" />

      {/* sound waves */}
      <path d="M36 200 q12 -22 24 0 t24 0 t24 0 t24 0" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 240 q12 -22 24 0 t24 0 t24 0 t24 0" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 160 q12 -22 24 0 t24 0 t24 0 t24 0" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />

      {/* confetti dots */}
      <circle cx="96" cy="96" r="9" fill="#f59e0b" />
      <circle cx="318" cy="196" r="7" fill="#ffffff" opacity="0.9" />
      <circle cx="138" cy="52" r="6" fill="#4f46e8" />
      <circle cx="52" cy="150" r="5" fill="#f59e0b" opacity="0.85" />
      <circle cx="356" cy="300" r="8" fill="#ffffff" opacity="0.7" />
    </svg>
  );
}

