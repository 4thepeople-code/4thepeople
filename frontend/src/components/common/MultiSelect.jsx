import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Search, Check } from 'lucide-react';

const MultiSelect = ({
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
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
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

  const handleToggleOption = (val) => {
    if (disabled) return;
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const handleRemoveValue = (e, val) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selectedValues.filter((v) => v !== val));
  };

  const handleSelectAll = (e) => {
    e.stopPropagation();
    if (disabled) return;
    const allFilteredValues = filteredOptions.map((o) => o.value);
    const combined = Array.from(new Set([...selectedValues, ...allFilteredValues]));
    onChange(combined);
  };

  const handleClearAll = (e) => {
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
            disabled ? 'text-[#A8A5A0]' : 'text-[#6B6966]'
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
              ? 'bg-[#F7F6F2] border-[#E2E0D8] text-[#A8A5A0] cursor-not-allowed'
              : isOpen
              ? 'bg-white border-[#B08D57] shadow-xs cursor-pointer'
              : 'bg-white border-[#D8D7DC] hover:border-[#B08D57] cursor-pointer'
          }`}
        >
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {selectedValues.length === 0 ? (
              <span className={disabled ? 'text-[#A8A5A0]' : 'text-[#A8A5A0]'}>
                {placeholder}
              </span>
            ) : (
              selectedValues.map((val) => {
                const item = selectedMap.get(val);
                const itemLabel = item?.label || val;
                const itemBadge = item?.badge;

                return (
                  <span
                    key={val}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${
                      disabled
                        ? 'bg-[#ECEAE3] text-[#787570] border-[#DCDAD2]'
                        : 'bg-[#FAF9F7] text-[#1C1B1F] border-[#E7E5E4]'
                    }`}
                  >
                    {itemBadge && (
                      <span className="font-semibold text-[#B08D57] uppercase tracking-wider">
                        {itemBadge}
                      </span>
                    )}
                    <span className="truncate max-w-[140px]">{itemLabel}</span>
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

          <ChevronDown
            className={`w-4 h-4 text-[#8E8B85] shrink-0 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>

        {/* Disabled Note */}
        {disabled && disabledNote && (
          <p className="text-xs text-[#8E8B85] italic mt-1">{disabledNote}</p>
        )}

        {/* Dropdown Menu */}
        {!disabled && isOpen && (
          <div className="absolute left-0 right-0 mt-1.5 z-50 bg-white border border-[#E7E5E4] rounded-lg shadow-lg overflow-hidden animate-in fade-in-50 duration-150">
            {/* Search and Action Bar */}
            <div className="p-2 border-b border-[#E7E5E4] bg-[#FAF9F7]/70 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8E8B85] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#D8D7DC] focus:border-[#B08D57] rounded text-xs text-[#1C1B1F] focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between text-[11px] px-1">
                <span className="text-[#8E8B85]">
                  {selectedValues.length} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-[#B08D57] hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <span className="text-[#D8D7DC]">|</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-[#8E8B85] hover:text-[#1C1B1F] font-medium"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-56 overflow-y-auto divide-y divide-[#F5F4F0] p-1">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#8E8B85]">
                  No items found
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isChecked = selectedValues.includes(opt.value);
                  return (
                    <div
                      key={opt.value}
                      onClick={() => handleToggleOption(opt.value)}
                      className={`px-3 py-2 flex items-center justify-between gap-2.5 rounded cursor-pointer transition-colors text-xs ${
                        isChecked
                          ? 'bg-[#FAF9F7] text-[#1C1B1F] font-medium'
                          : 'hover:bg-[#FAF9F7]/60 text-[#38373A]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? 'bg-[#B08D57] border-[#B08D57] text-white'
                              : 'border-[#D8D7DC] bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-normal text-[#1C1B1F]">
                            {opt.label}
                          </span>
                          {opt.sublabel && (
                            <p className="text-[11px] text-[#8E8B85] truncate">
                              {opt.sublabel}
                            </p>
                          )}
                        </div>
                      </div>

                      {opt.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FAF9F7] text-[#B08D57] border border-[#E7E5E4] shrink-0 uppercase tracking-wider">
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
    </div>
  );
};

export default MultiSelect;

