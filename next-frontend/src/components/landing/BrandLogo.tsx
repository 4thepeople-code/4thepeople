import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'light' | 'dark';
  className?: string;
}

const SIZES = {
  sm: {
    container: 'gap-1',
    number: 'text-[19px] font-black leading-none',
    textWrapper: 'text-[8px] leading-[0.85] tracking-tight font-extrabold',
  },
  md: {
    container: 'gap-1.5',
    number: 'text-2xl font-black leading-none',
    textWrapper: 'text-[9px] leading-[0.85] tracking-tight font-extrabold',
  },
  lg: {
    container: 'gap-2',
    number: 'text-4xl font-black leading-none',
    textWrapper: 'text-[13px] leading-[0.85] tracking-tight font-extrabold',
  },
};

const VARIANTS = {
  light: 'text-white',
  dark: 'text-ink-950 dark:text-white',
};

export default function BrandLogo({ size = 'md', variant, className = '' }: BrandLogoProps) {
  const currentSize = SIZES[size] || SIZES.md;
  const currentVariant = variant ? VARIANTS[variant] : 'text-current';

  return (
    <span
      className={`inline-flex items-center select-none ${currentSize.container} ${currentVariant} ${className}`.trim()}
      style={{ fontFamily: "'Sora', sans-serif" }}
      aria-hidden="true"
    >
      <span className={currentSize.number} style={{ fontFamily: "'Sora', sans-serif" }}>
        4
      </span>
      <span
        className={`flex flex-col justify-between uppercase ${currentSize.textWrapper}`}
        style={{ fontFamily: "'Sora', sans-serif" }}
      >
        <span>THE</span>
        <span>PEOPLE</span>
      </span>
    </span>
  );
}
