'use client';

import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import type { Event } from '@/types/models';

export interface GalleryLightboxProps {
  event: Event | null;
  onClose: () => void;
}

export function GalleryLightbox({ event, onClose }: GalleryLightboxProps) {
  const gallery = event?.gallery || [];
  const images =
    gallery.length > 0
      ? gallery
      : event?.coverImage?.url
      ? [{ url: event.coverImage.url }]
      : event?.coverImageUrl
      ? [{ url: event.coverImageUrl }]
      : [];

  const [currentIndex, setCurrentIndex] = useState(0);

  if (!event || images.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
            <ImageIcon className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">No Gallery Photos</h3>
          <p className="text-sm text-slate-400">
            No photos have been uploaded for &quot;{event?.title || 'this event'}&quot;.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const activeImg = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-4 md:p-8 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div className="w-full max-w-6xl flex items-center justify-between z-10 text-white">
        <div>
          <h3 className="text-lg font-bold truncate max-w-md md:max-w-xl">{event.title}</h3>
          <p className="text-xs text-slate-400">
            Photo {currentIndex + 1} of {images.length}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-3 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 hover:text-white rounded-full transition shadow-lg cursor-pointer"
          aria-label="Close Lightbox"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main Image Display */}
      <div
        className="relative flex-1 w-full max-w-5xl flex items-center justify-center my-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={activeImg.url}
          alt={`Photo ${currentIndex + 1}`}
          className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800/60"
        />

        {/* Prev / Next Controls */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 md:left-4 p-3 bg-slate-900/80 hover:bg-cyan-500 text-white hover:text-black rounded-full border border-slate-700/60 transition shadow-xl hover:scale-110 cursor-pointer"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 md:right-4 p-3 bg-slate-900/80 hover:bg-cyan-500 text-white hover:text-black rounded-full border border-slate-700/60 transition shadow-xl hover:scale-110 cursor-pointer"
              aria-label="Next photo"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      {images.length > 1 && (
        <div
          className="w-full max-w-4xl flex items-center justify-center gap-2 overflow-x-auto py-2 scrollbar-none z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`relative w-16 h-12 rounded-lg overflow-hidden border-2 transition shrink-0 cursor-pointer ${
                idx === currentIndex
                  ? 'border-[#00F0FF] scale-105 shadow-md shadow-cyan-500/30'
                  : 'border-slate-800 opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img.url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default GalleryLightbox;

