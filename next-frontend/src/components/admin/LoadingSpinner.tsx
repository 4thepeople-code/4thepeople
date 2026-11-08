import React from 'react';

export interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

export function LoadingSpinner({
  label = 'Loading...',
  size = 'md',
  fullScreen = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-7 h-7 border-2',
    lg: 'w-10 h-10 border-3',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-3 p-6 text-[#6B6966] dark:text-[#A8A5A0] font-sans">
      <div
        className={`${sizeClasses[size] || sizeClasses.md} border-[#E7E5E4] dark:border-[#2D2C30] border-t-[#B08D57] rounded-full animate-spin`}
        role="status"
        aria-label={label}
      />
      {label && <p className="text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0]">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}

export default LoadingSpinner;

