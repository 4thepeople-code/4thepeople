'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { collegeAdmin } from '@/lib/copy';

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Short badge shown beside the label, e.g. a department short code. */
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

/**
 * Multi-select dropdown with chips, in-canvas search, and select-all/clear.
 * Kit form control (token-based) used for department pickers.
 */
export default function MultiSelect({
  options = [],
  selectedValues = [],
  onChange,
  placeholder = 'Select items…',
  disabled = false,
  disabledNote = '',
  searchPlaceholder = 'Search…',
  label,
  required = false,
  id,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const t = collegeAdmin.multiSelect;

  // Close on outside click or Esc.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const filteredOptions = options.filter((opt) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      opt.label?.toLowerCase().includes(term) ||
      opt.badge?.toLowerCase().includes(term) ||
      opt.sublabel?.toLowerCase().includes(term)
    );
  });

  const handleToggleOption = (value: string) => {
    if (disabled) return;
    onChange(
      selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value],
    );
  };

  const handleRemoveValue = (event: React.MouseEvent, value: string) => {
    event.stopPropagation();
    if (disabled) return;
    onChange(selectedValues.filter((v) => v !== value));
  };

  const handleSelectAll = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (disabled) return;
    onChange(Array.from(new Set([...selectedValues, ...filteredOptions.map((o) => o.value)])));
  };

  const handleClearAll = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (disabled) return;
    onChange([]);
  };

  const selectedMap = new Map(options.map((opt) => [opt.value, opt]));

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <span
          id={id ? `${id}-label` : undefined}
          className="block text-xs font-bold uppercase tracking-wider text-[var(--ink-soft)]"
        >
          {label}
          {required && (
            <span aria-hidden="true" className="ml-1 text-[var(--secondary)]">
              *
            </span>
          )}
        </span>
      )}

      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={id ? `${id}-label ${id}` : undefined}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-sm transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 ${
            disabled
              ? 'cursor-not-allowed border-[var(--line)] bg-[var(--bg)] text-[var(--ink-soft)] opacity-70'
              : 'cursor-pointer border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--primary)]'
          }`}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {selectedValues.length === 0 ? (
              <span className="py-1 text-xs text-[var(--ink-soft)]">{placeholder}</span>
            ) : (
              selectedValues.map((value) => {
                const opt = selectedMap.get(value);
                return (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--primary-soft)]/50 py-0.5 pl-2 pr-1 text-xs font-semibold text-[var(--ink)]"
                  >
                    {opt?.label || value}
                    {opt?.badge && (
                      <span className="text-[10px] font-bold uppercase text-[var(--primary)]">
                        {opt.badge}
                      </span>
                    )}
                    {!disabled && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Remove ${opt?.label || value}`}
                        onClick={(e) => handleRemoveValue(e, value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleRemoveValue(e as unknown as React.MouseEvent, value);
                          }
                        }}
                        className="grid h-5 w-5 place-items-center rounded text-[var(--ink-soft)] transition-colors hover:text-[var(--secondary)] motion-reduce:transition-none"
                      >
                        <X aria-hidden="true" className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                );
              })
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-[var(--ink-soft)] transition-transform duration-150 motion-reduce:transition-none ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-lg">
            <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--bg)] px-3 py-2.5">
              <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--ink-soft)]" />
              <input
                type="text"
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-xs text-[var(--ink)] placeholder:text-[var(--ink-soft)] focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-between border-b border-[var(--line)] px-3.5 py-2 text-[11px] font-semibold text-[var(--ink-soft)]">
              <span>
                {filteredOptions.length} {filteredOptions.length === 1 ? 'option' : 'options'}
              </span>
              <span className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="min-h-8 rounded px-1 text-[var(--primary)] underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  {t.selectAll}
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="min-h-8 rounded px-1 text-[var(--secondary)] underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  {t.clearAll}
                </button>
              </span>
            </div>

            <ul className="max-h-56 divide-y divide-[var(--line)] overflow-y-auto p-1" role="listbox" aria-multiselectable="true">
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-[var(--ink-soft)]">{t.noMatches}</li>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = selectedValues.includes(opt.value);
                  return (
                    <li key={opt.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleToggleOption(opt.value)}
                        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
                          isSelected
                            ? 'bg-[var(--primary-soft)] font-semibold text-[var(--ink)]'
                            : 'text-[var(--ink-soft)] hover:bg-[var(--primary-soft)]/50 hover:text-[var(--ink)]'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                              isSelected
                                ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]'
                                : 'border-[var(--line)] bg-[var(--surface)]'
                            }`}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </span>
                          <span className="min-w-0 truncate">
                            {opt.label}
                            {opt.sublabel && (
                              <span className="block truncate text-[11px] font-normal text-[var(--ink-soft)]">
                                {opt.sublabel}
                              </span>
                            )}
                          </span>
                        </span>
                        {opt.badge && (
                          <span className="shrink-0 rounded-md border border-[var(--line)] bg-[var(--bg)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--primary)]">
                            {opt.badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>

      {disabledNote && disabled && (
        <p className="text-xs italic text-[var(--ink-soft)]">{disabledNote}</p>
      )}
    </div>
  );
}
