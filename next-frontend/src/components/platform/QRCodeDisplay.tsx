'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeDisplay({ value, size = 180, className = '' }: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (value) {
      QRCode.toDataURL(value, {
        width: size,
        margin: 2,
        color: {
          dark: '#1e1b4b',
          light: '#ffffff',
        },
      })
        .then((url) => {
          if (isMounted) setDataUrl(url);
        })
        .catch((err) => {
          console.error('Failed to render QR code', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center animate-pulse ${className}`}
      >
        <span className="text-[10px] text-slate-400 font-mono">Generating QR...</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Two-Factor Authentication Setup QR Code"
      width={size}
      height={size}
      className={`rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 bg-white p-1.5 ${className}`}
    />
  );
}

export default QRCodeDisplay;

