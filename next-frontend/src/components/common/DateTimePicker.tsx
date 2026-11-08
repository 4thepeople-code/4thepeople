'use client';

import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export interface DateTimePickerProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
}

export function DateTimePicker({
  label,
  value,
  onChange,
  required = false,
  min,
  max,
  disabled = false,
  className = '',
}: DateTimePickerProps) {
  const { isDark } = useTheme();

  const formatDatePreview = (val: string) => {
    if (!val) return null;
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return null;
    }
  };

  const formattedPreview = formatDatePreview(value);
  const datePart = value ? value.split('T')[0] || '' : '';
  const timePart = value ? value.split('T')[1]?.slice(0, 5) || '' : '';

  const handleDateChange = (newDate: string) => {
    const time = timePart || '10:00';
    if (!newDate) {
      onChange('');
    } else {
      onChange(`${newDate}T${time}`);
    }
  };

  const handleTimeChange = (newTime: string) => {
    const date = datePart || new Date().toISOString().split('T')[0];
    onChange(`${date}T${newTime}`);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        className={`block text-xs font-semibold uppercase tracking-wider ${
          isDark ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      <div className="grid grid-cols-2 gap-2">
        {/* Date Input */}
        <div className="relative">
          <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="date"
            value={datePart}
            onChange={(e) => handleDateChange(e.target.value)}
            min={min ? min.split('T')[0] : undefined}
            max={max ? max.split('T')[0] : undefined}
            disabled={disabled}
            required={required}
            className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none transition-colors ${
              isDark
                ? 'bg-slate-950 border-slate-800 text-white focus:border-purple-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-600'
            }`}
          />
        </div>

        {/* Time Input */}
        <div className="relative">
          <Clock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="time"
            value={timePart}
            onChange={(e) => handleTimeChange(e.target.value)}
            disabled={disabled}
            required={required}
            className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border focus:outline-none transition-colors ${
              isDark
                ? 'bg-slate-950 border-slate-800 text-white focus:border-purple-500'
                : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-purple-600'
            }`}
          />
        </div>
      </div>

      {formattedPreview && (
        <p className="text-[11px] text-purple-400 font-medium pt-0.5">
          Selected: {formattedPreview}
        </p>
      )}
    </div>
  );
}

export default DateTimePicker;

