'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search, Check } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  badge?: string;
  sublabel?: string;
}

export interface MultiSelectProps {
  options?: MultiSelectOption[];
  selectedValues?: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  disabledNote?: string;
  searchPlaceholder?: string;
  label?: string;
  required?: boolean;
  id?: string;
}

export function MultiSelect({
  options = [],
  selectedValues = [],
  onChange,
  placeholder = 'Select items...',
  disabled = false,
  disabledNote = '',
  searchPlaceholder = 'Search...',
  label,
  required = false,
  id,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const filteredOptions = options.filter((opt) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const labelMatch = opt.label?.toLowerCase().includes(term);
    const badgeMatch = opt.badge?.toLowerCase().includes(term);
    const sublabelMatch = opt.sublabel?.toLowerCase().includes(term);
    return labelMatch || badgeMatch || sublabelMatch;
  });

  const handleToggleOption = (val: string) => {
    if (disabled) return;
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleRemoveValue = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedValues.filter((v) => v !== val));
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    const allFilteredValues = filteredOptions.map((o) => o.value);
    const combined = Array.from(new Set([...selectedValues, ...allFilteredValues]));
    onChange(combined);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange([]);
  };

  const selectedMap = new Map(options.map((opt) => [opt.value, opt]));

  return (
    <div className="space-y-1.5 font-sans" ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className={`block text-xs font-medium ${
            disabled ? 'text-[#A8A5A0]' : 'text-[#6B6966] dark:text-[#A8A5A0]'
          }`}
        >
          {label} {required && <span className="text-[#8B3A3A]">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Trigger Box */}
        <div
          id={id}
          onClick={() => {
            if (!disabled) setIsOpen(!isOpen);
          }}
          className={`min-h-[42px] w-full px-3 py-2 rounded border text-sm transition-colors flex items-center justify-between gap-2 ${
            disabled
              ? 'bg-[#F7F6F2] dark:bg-[#1C1B1F]/50 border-[#E2E0D8] dark:border-[#2D2C30] text-[#A8A5A0] cursor-not-allowed'
              : isOpen
              ? 'bg-white dark:bg-[#1C1B1F] border-[#B08D57] shadow-xs cursor-pointer'
              : 'bg-white dark:bg-[#1C1B1F] border-[#D8D7DC] dark:border-[#2D2C30] hover:border-[#B08D57] cursor-pointer'
          }`}
        >
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {selectedValues.length === 0 ? (
              <span className="text-xs text-[#A8A5A0] select-none">{placeholder}</span>
            ) : (
              selectedValues.map((val) => {
                const opt = selectedMap.get(val);
                return (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded text-xs font-medium bg-[#FAF9F7] dark:bg-[#252429] text-[#1C1B1F] dark:text-[#F5F3EF] border border-[#E7E5E4] dark:border-[#2D2C30]"
                  >
                    <span>{opt?.label || val}</span>
                    {opt?.badge && (
                      <span className="text-[10px] text-[#B08D57] font-semibold uppercase">
                        ({opt.badge})
                      </span>
                    )}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={(e) => handleRemoveValue(e, val)}
                        className="p-0.5 text-[#8E8B85] hover:text-[#8B3A3A] rounded transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-[#8E8B85]">
            {selectedValues.length > 0 && !disabled && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs hover:text-[#8B3A3A] transition-colors p-0.5"
                title="Clear all selected"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-[#B08D57]' : ''
              }`}
            />
          </div>
        </div>

        {/* Dropdown Menu */}
        {isOpen && !disabled && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {/* Search Input Bar */}
            <div className="p-2 border-b border-[#E7E5E4] dark:border-[#2D2C30] bg-[#FAF9F7] dark:bg-[#252429] flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#8E8B85] shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-xs text-[#1C1B1F] dark:text-[#F5F3EF] placeholder-[#A8A5A0] focus:outline-none"
              />
            </div>

            {/* Quick Actions (Select All / Clear) */}
            <div className="px-3 py-1.5 border-b border-[#E7E5E4] dark:border-[#2D2C30] bg-[#FAF9F7]/60 dark:bg-[#252429]/60 flex items-center justify-between text-[11px] text-[#6B6966] dark:text-[#A8A5A0]">
              <span>
                {filteredOptions.length} option{filteredOptions.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="hover:text-[#B08D57] transition-colors cursor-pointer"
                >
                  Select all
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="hover:text-[#8B3A3A] transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-56 overflow-y-auto p-1 divide-y divide-[#F7F6F2] dark:divide-[#2D2C30]">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#8E8B85]">
                  No matching options found
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = selectedValues.includes(opt.value);
                  return (
                    <div
                      key={opt.value}
                      onClick={() => handleToggleOption(opt.value)}
                      className={`px-3 py-2 rounded text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#FAF9F7] dark:bg-[#252429] text-[#1C1B1F] dark:text-[#F5F3EF] font-medium'
                          : 'text-[#6B6966] dark:text-[#A8A5A0] hover:bg-[#FAF9F7]/70 dark:hover:bg-[#252429]/50 hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-[#B08D57] border-[#B08D57] text-white'
                              : 'border-[#D8D7DC] dark:border-[#4B4950] bg-white dark:bg-[#1C1B1F]'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <div className="truncate">
                          <span>{opt.label}</span>
                          {opt.sublabel && (
                            <span className="block text-[11px] text-[#8E8B85] truncate">
                              {opt.sublabel}
                            </span>
                          )}
                        </div>
                      </div>

                      {opt.badge && (
                        <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#FAF9F7] dark:bg-[#252429] text-[#B08D57] border border-[#E7E5E4] dark:border-[#2D2C30] uppercase shrink-0">
                          {opt.badge}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {disabledNote && disabled && (
        <p className="text-[11px] text-[#8E8B85] italic">{disabledNote}</p>
      )}
    </div>
  );
}

export default MultiSelect;

