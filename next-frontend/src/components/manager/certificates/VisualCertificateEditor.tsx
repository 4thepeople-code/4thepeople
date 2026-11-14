'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  Settings2,
  Download,
  RefreshCw,
  FileText,
  User,
  Sliders,
  ChevronRight,
  ChevronLeft,
  Info,
} from 'lucide-react';
import type { PlaceholderConfigItem, PredefinedTemplate, EligibleStudentItem } from '@/types/models';
import { previewCertificateTemplateApi } from '@/lib/api/manager';

export interface VisualCertificateEditorProps {
  templateSource: 'predefined' | 'custom';
  predefinedTemplate: PredefinedTemplate | null;
  customFile: File | null;
  config: PlaceholderConfigItem[];
  onChangeConfig: (newConfig: PlaceholderConfigItem[]) => void;
  students: EligibleStudentItem[];
  eventTitle: string;
  collegeName?: string;
  slug: string;
  eventId: string;
}

const PLACEHOLDER_LABELS: Record<string, string> = {
  '{{studentName}}': 'Student Name',
  '{{rollNumber}}': 'Roll / ID Number',
  '{{eventName}}': 'Event Title',
  '{{issueDate}}': 'Issue Date',
  '{{certificateId}}': 'Certificate ID',
  '{{collegeName}}': 'College / Institution',
};

const FONT_OPTIONS: Array<{ label: string; value: PlaceholderConfigItem['font'] }> = [
  { label: 'Helvetica (Sans-Serif)', value: 'Helvetica' },
  { label: 'Helvetica Bold', value: 'HelveticaBold' },
  { label: 'Times New Roman (Serif)', value: 'Times' },
  { label: 'Times Bold', value: 'TimesBold' },
  { label: 'Courier (Monospace)', value: 'Courier' },
  { label: 'Courier Bold', value: 'CourierBold' },
];

const PRESET_COLORS = [
  '#0F172A', // Slate 900
  '#1E293B', // Slate 800
  '#0A192F', // Deep Navy
  '#1E3A8A', // Blue 900
  '#14532D', // Emerald 900
  '#78350F', // Amber 900
  '#831843', // Rose 900
  '#B45309', // Warm Amber
  '#D97706', // Gold/Amber
  '#C5A059', // Classic Gold
  '#475569', // Slate 600
  '#64748B', // Slate 500
  '#FFFFFF', // White
];

export function VisualCertificateEditor({
  templateSource,
  predefinedTemplate,
  customFile,
  config,
  onChangeConfig,
  students,
  eventTitle,
  collegeName = 'LBRCE Autonomous College',
  slug,
  eventId,
}: VisualCertificateEditorProps) {
  // Mode: Visual Canvas Editor vs Final Vector PDF Preview
  const [viewMode, setViewMode] = useState<'editor' | 'pdf'>('editor');

  // Active Selected Placeholder
  const [selectedId, setSelectedId] = useState<string>('{{studentName}}');

  // Sample Student Attendee Selection
  const [selectedStudent, setSelectedStudent] = useState<EligibleStudentItem | null>(() => {
    return students.length > 0 ? students[0] : null;
  });

  // Canvas View Controls
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Custom File Preview Asset URL (if PNG/JPEG)
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [customImageAspectRatio, setCustomImageAspectRatio] = useState<number>(1.414); // A4 Landscape default

  // PDF Preview State
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Dragging State for Placeholders
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingPlaceholder, setDraggingPlaceholder] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });
  const [snapGuideX, setSnapGuideX] = useState<number | null>(null);

  // Load custom image if uploaded
  useEffect(() => {
    if (customFile && (customFile.type.startsWith('image/') || /\.(png|jpe?g)$/i.test(customFile.name))) {
      const url = URL.createObjectURL(customFile);
      setCustomImageUrl(url);

      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setCustomImageAspectRatio(img.naturalWidth / img.naturalHeight);
        }
      };
      img.src = url;

      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setCustomImageUrl(null);
      setCustomImageAspectRatio(1.4142);
    }
  }, [customFile]);

  // Clean up PDF preview URL
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  // Derive active sample data
  const sampleData = useMemo(() => {
    const studentName = selectedStudent?.user?.name || 'Alex Mercer';
    const rollNumber = selectedStudent?.user?.rollNumber || '23761A0599';
    return {
      studentName,
      rollNumber,
      eventName: eventTitle || 'Campus Hackathon 2026',
      collegeName,
      issueDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      certificateId: 'CERT-DEMO-2026-X8B9',
    };
  }, [selectedStudent, eventTitle, collegeName]);

  // Resolve placeholder text
  const getPlaceholderDisplay = useCallback(
    (key: string) => {
      switch (key) {
        case '{{studentName}}':
          return sampleData.studentName;
        case '{{rollNumber}}':
          return `ID / Roll: ${sampleData.rollNumber}`;
        case '{{eventName}}':
          return sampleData.eventName;
        case '{{issueDate}}':
          return `Issued on: ${sampleData.issueDate}`;
        case '{{certificateId}}':
          return `ID: ${sampleData.certificateId}`;
        case '{{collegeName}}':
          return sampleData.collegeName;
        default:
          return key;
      }
    },
    [sampleData]
  );

  // Active selected item
  const selectedItem = useMemo(() => {
    return config.find((item) => (item.id || item.placeholder) === selectedId) || config[0] || null;
  }, [config, selectedId]);

  // Update specific item in config
  const updateSelectedItem = useCallback(
    (updates: Partial<PlaceholderConfigItem>) => {
      if (!selectedItem) return;
      const targetKey = selectedItem.id || selectedItem.placeholder;
      const next = config.map((c) => {
        if ((c.id || c.placeholder) === targetKey) {
          return { ...c, ...updates };
        }
        return c;
      });
      onChangeConfig(next);
    },
    [config, selectedItem, onChangeConfig]
  );

  // Generate Real Vector PDF Preview
  const handleGeneratePdfPreview = useCallback(async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const blob = await previewCertificateTemplateApi(slug, eventId, config, {
        sampleData,
        predefinedTemplateId: templateSource === 'predefined' ? predefinedTemplate?.id : null,
        templateFile: templateSource === 'custom' ? customFile : null,
      });

      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err as Error).message ||
        'Failed to generate PDF preview from server.';
      setPdfError(message);
    } finally {
      setPdfLoading(false);
    }
  }, [slug, eventId, config, sampleData, templateSource, predefinedTemplate, customFile, pdfBlobUrl]);

  // Auto-generate PDF preview when switching to 'pdf' view
  useEffect(() => {
    if (viewMode === 'pdf') {
      void handleGeneratePdfPreview();
    }
  }, [viewMode, handleGeneratePdfPreview]);

  // --- Drag and Drop Handlers for Canvas Elements ---
  const handlePointerDown = (e: React.PointerEvent, placeholderKey: string) => {
    e.stopPropagation();
    setSelectedId(placeholderKey);
    setDraggingPlaceholder(placeholderKey);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentItem = config.find((c) => (c.id || c.placeholder) === placeholderKey);
    if (!currentItem) return;

    const currentXPercent = currentItem.xPercent ?? (currentItem.x ? (currentItem.x / 841.89) * 100 : 50);
    const currentYPercent = currentItem.yPercent ?? (currentItem.y ? ((595.28 - currentItem.y) / 595.28) * 100 : 50);

    const elemX = rect.left + (currentXPercent / 100) * rect.width;
    const elemY = rect.top + (currentYPercent / 100) * rect.height;

    dragOffsetRef.current = {
      offsetX: e.clientX - elemX,
      offsetY: e.clientY - elemY,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingPlaceholder) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - dragOffsetRef.current.offsetX - rect.left;
    const rawY = e.clientY - dragOffsetRef.current.offsetY - rect.top;

    let xPercent = Math.max(5, Math.min(95, (rawX / rect.width) * 100));
    const yPercent = Math.max(5, Math.min(95, (rawY / rect.height) * 100));

    // Snapping logic: snap to 50% horizontal center if within ±1.5%
    if (Math.abs(xPercent - 50) < 1.5) {
      xPercent = 50;
      setSnapGuideX(50);
    } else {
      setSnapGuideX(null);
    }

    // Round to 1 decimal place
    const roundedX = Math.round(xPercent * 10) / 10;
    const roundedY = Math.round(yPercent * 10) / 10;

    const next = config.map((c) => {
      if ((c.id || c.placeholder) === draggingPlaceholder) {
        return {
          ...c,
          xPercent: roundedX,
          yPercent: roundedY,
        };
      }
      return c;
    });
    onChangeConfig(next);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingPlaceholder) {
      setDraggingPlaceholder(null);
      setSnapGuideX(null);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(1.8, Math.round((z + 0.15) * 100) / 100));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100));
  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Canvas Aspect Ratio
  const aspectRatio = templateSource === 'predefined'
    ? predefinedTemplate?.aspectRatio || 1.4142
    : customImageAspectRatio;

  // Background Styling for Predefined Templates
  const renderPredefinedCanvasBackground = () => {
    const id = predefinedTemplate?.id || 'tpl-academic-navy';

    if (id === 'tpl-academic-navy') {
      return (
        <div className="absolute inset-0 bg-[#FBF9F4] overflow-hidden pointer-events-none select-none">
          {/* Outer Navy Border */}
          <div className="absolute inset-4 border-[6px] border-[#0A192F] pointer-events-none" />
          {/* Inner Gold Border */}
          <div className="absolute inset-6 border border-[#C5A059] pointer-events-none" />
          {/* Decorative Corner Ornaments */}
          <div className="absolute top-7 left-7 w-6 h-6 border-t-2 border-l-2 border-[#C5A059]" />
          <div className="absolute top-7 right-7 w-6 h-6 border-t-2 border-r-2 border-[#C5A059]" />
          <div className="absolute bottom-7 left-7 w-6 h-6 border-b-2 border-l-2 border-[#C5A059]" />
          <div className="absolute bottom-7 right-7 w-6 h-6 border-b-2 border-r-2 border-[#C5A059]" />
          {/* Header watermark */}
          <div className="absolute top-12 left-0 right-0 text-center">
            <span className="text-[10px] tracking-[0.3em] font-serif font-bold text-[#C5A059] uppercase">
              Certificate of Completion
            </span>
          </div>
          {/* Lower footer signature line mocks */}
          <div className="absolute bottom-16 left-16 w-36 border-b border-[#0A192F]/40" />
          <div className="absolute bottom-16 right-16 w-36 border-b border-[#0A192F]/40" />
          <div className="absolute bottom-11 left-16 text-[9px] text-[#0A192F]/60 font-serif">Authorized Signatory</div>
          <div className="absolute bottom-11 right-16 text-[9px] text-[#0A192F]/60 font-serif">College Dean / Principal</div>
        </div>
      );
    }

    if (id === 'tpl-modern-cyber') {
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B0F19] via-[#0F172A] to-[#0B0F19] text-white overflow-hidden pointer-events-none select-none">
          {/* Corner Cyber Brackets */}
          <div className="absolute top-5 left-5 w-8 h-8 border-t-2 border-l-2 border-[#06B6D4]" />
          <div className="absolute top-5 right-5 w-8 h-8 border-t-2 border-r-2 border-[#06B6D4]" />
          <div className="absolute bottom-5 left-5 w-8 h-8 border-b-2 border-l-2 border-[#06B6D4]" />
          <div className="absolute bottom-5 right-5 w-8 h-8 border-b-2 border-r-2 border-[#06B6D4]" />
          {/* Outer Border */}
          <div className="absolute inset-5 border border-[#1E293B] pointer-events-none" />
          {/* Cyber Accent Lines */}
          <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[#06B6D4]/50 to-transparent" />
          <div className="absolute bottom-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[#06B6D4]/50 to-transparent" />
          {/* Badge */}
          <div className="absolute top-10 left-0 right-0 text-center">
            <span className="px-3 py-1 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[10px] tracking-[0.25em] font-mono text-[#06B6D4] uppercase">
              Technology & Innovation Distinction
            </span>
          </div>
          {/* Subtle Cyber Grid Lines */}
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#06B6D4_1px,transparent_1px)] [background-size:16px_16px]" />
        </div>
      );
    }

    // Default: Formal Gold
    return (
      <div className="absolute inset-0 bg-[#FCFBF7] overflow-hidden pointer-events-none select-none">
        {/* Charcoal & Gold Dual Border */}
        <div className="absolute inset-4 border-[4px] border-[#1E2229]" />
        <div className="absolute inset-6 border-[2px] border-[#D4AF37]" />
        <div className="absolute top-12 left-0 right-0 text-center">
          <span className="text-[10px] tracking-[0.35em] font-serif font-semibold text-[#D4AF37] uppercase">
            Institutional Merit Award
          </span>
        </div>
        <div className="absolute bottom-16 left-20 w-36 border-b border-[#1E2229]/40" />
        <div className="absolute bottom-16 right-20 w-36 border-b border-[#1E2229]/40" />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF9F7] dark:bg-[#12141A] font-sans">
      {/* Top Action Bar: View Switcher, Attendee Switcher, Zoom Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white dark:bg-[#1A1D24] border-b border-[#E7E5E4] dark:border-[#2D3139] z-20">
        {/* Left: View Mode Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F2F0EC] dark:bg-[#252830] rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('editor')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'editor'
                ? 'bg-white dark:bg-[#1A1D24] text-[#B08D57] shadow-xs font-semibold'
                : 'text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Visual Editor</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pdf')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'pdf'
                ? 'bg-white dark:bg-[#1A1D24] text-[#B08D57] shadow-xs font-semibold'
                : 'text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Real PDF Preview</span>
            {pdfLoading && <RefreshCw className="w-3 h-3 animate-spin text-[#B08D57]" />}
          </button>
        </div>

        {/* Center: Real Sample Student Attendee Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#6B6966] dark:text-[#A8A5A0] flex items-center gap-1">
            <User className="w-3 h-3 text-[#B08D57]" />
            Preview Data:
          </span>
          <select
            value={selectedStudent?.user?.id || ''}
            onChange={(e) => {
              const student = students.find((s) => s.user.id === e.target.value) || null;
              setSelectedStudent(student);
              if (viewMode === 'pdf') {
                setTimeout(() => void handleGeneratePdfPreview(), 10);
              }
            }}
            className="text-xs bg-[#FAF9F7] dark:bg-[#252830] border border-[#E7E5E4] dark:border-[#3D424E] rounded-md px-2.5 py-1 text-[#1C1B1F] dark:text-[#F5F3EF] focus:outline-none focus:border-[#B08D57]"
          >
            {students.length === 0 ? (
              <option value="">Sample: Alex Mercer (23761A0599)</option>
            ) : (
              students.map((st) => (
                <option key={st.user.id} value={st.user.id}>
                  {st.user?.name || 'Student'} ({st.user?.rollNumber || 'No ID'})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Right: Zoom & Reset Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 0.6}
            className="p-1.5 text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] hover:bg-[#F2F0EC] dark:hover:bg-[#252830] rounded disabled:opacity-40 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono w-12 text-center text-[#6B6966] dark:text-[#A8A5A0]">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 1.8}
            className="p-1.5 text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] hover:bg-[#F2F0EC] dark:hover:bg-[#252830] rounded disabled:opacity-40 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="p-1.5 text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] dark:hover:text-[#F5F3EF] hover:bg-[#F2F0EC] dark:hover:bg-[#252830] rounded cursor-pointer"
            title="Reset Zoom & Pan"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Workspace: Canvas + Properties Sidebar */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Workspace Canvas Area */}
        <div
          className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-[#EFECE6] dark:bg-[#0B0D12] relative cursor-default"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {viewMode === 'editor' ? (
            /* Visual Canvas Editor */
            <div
              className="relative transition-transform duration-75 select-none"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transformOrigin: 'center center',
              }}
            >
              {/* Certificate Sheet (A4 Landscape aspect ratio) */}
              <div
                ref={canvasRef}
                className="relative bg-white shadow-2xl rounded-sm border border-[#D5D0C7] dark:border-[#2D3139] overflow-hidden"
                style={{
                  width: '740px',
                  height: `${740 / aspectRatio}px`,
                }}
              >
                {/* Background Design */}
                {templateSource === 'predefined' && renderPredefinedCanvasBackground()}

                {templateSource === 'custom' && customImageUrl && (
                  <img
                    src={customImageUrl}
                    alt="Uploaded Certificate Template Background"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                  />
                )}

                {templateSource === 'custom' && !customImageUrl && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-[#FAF8F5] text-center pointer-events-none select-none">
                    <FileText className="w-12 h-12 text-[#B08D57]/60 mb-2" />
                    <p className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                      {customFile ? customFile.name : 'Custom Template'}
                    </p>
                    <p className="text-[10px] text-[#6B6966] mt-1">
                      Background template ready. Use placeholders below to position text.
                    </p>
                  </div>
                )}

                {/* Vertical Center Guideline (Snapping) */}
                {snapGuideX !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-[1px] bg-red-500 z-30 pointer-events-none shadow-xs"
                    style={{ left: `${snapGuideX}%` }}
                  >
                    <span className="absolute top-2 left-1 text-[9px] font-mono text-red-500 bg-white/80 px-1 rounded">
                      CENTER
                    </span>
                  </div>
                )}

                {/* Draggable Placeholders Layer */}
                {config.map((item) => {
                  const key = item.id || item.placeholder;
                  const isSelected = selectedId === key;
                  const xPct = item.xPercent ?? (item.x ? (item.x / 841.89) * 100 : 50);
                  const yPct = item.yPercent ?? (item.y ? ((595.28 - item.y) / 595.28) * 100 : 50);
                  const widthPct = item.widthPercent || 80;
                  const align = item.align || 'center';
                  const displayText = getPlaceholderDisplay(item.placeholder);

                  // Font mapping for preview
                  const fontFam =
                    item.font?.includes('Times') ? 'font-serif' : item.font?.includes('Courier') ? 'font-mono' : 'font-sans';
                  const isBold = item.font?.includes('Bold') || false;

                  return (
                    <div
                      key={key}
                      onPointerDown={(e) => handlePointerDown(e, key)}
                      className={`absolute z-20 cursor-move transition-shadow duration-75 select-none ${
                        isSelected
                          ? 'ring-2 ring-[#B08D57] bg-[#B08D57]/10 rounded shadow-md'
                          : 'hover:ring-1 hover:ring-[#B08D57]/50 rounded'
                      }`}
                      style={{
                        left: `${xPct}%`,
                        top: `${yPct}%`,
                        width: `${widthPct}%`,
                        transform:
                          align === 'center'
                            ? 'translate(-50%, -50%)'
                            : align === 'right'
                            ? 'translate(-100%, -50%)'
                            : 'translate(0%, -50%)',
                        textAlign: align,
                        padding: '4px 6px',
                      }}
                    >
                      <div
                        className={`${fontFam} ${isBold ? 'font-bold' : 'font-normal'} leading-tight truncate`}
                        style={{
                          fontSize: `${Math.max(10, Math.min(32, (item.fontSize || 16) * 0.75))}px`,
                          color: item.color || '#0F172A',
                        }}
                      >
                        {displayText}
                      </div>

                      {/* Pill Badge when selected */}
                      {isSelected && (
                        <div
                          className={`absolute -top-5 ${
                            align === 'center' ? 'left-1/2 -translate-x-1/2' : align === 'right' ? 'right-0' : 'left-0'
                          } px-1.5 py-0.5 rounded bg-[#B08D57] text-white text-[9px] font-mono whitespace-nowrap shadow-xs pointer-events-none`}
                        >
                          {PLACEHOLDER_LABELS[item.placeholder] || item.placeholder} ({xPct}%, {yPct}%)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Real Backend Generated PDF Preview */
            <div className="w-full h-full flex flex-col items-center justify-center p-2">
              {pdfLoading ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-16">
                  <RefreshCw className="w-8 h-8 text-[#B08D57] animate-spin" />
                  <p className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                    Rendering Vector PDF with Server Engine...
                  </p>
                  <p className="text-[11px] text-[#6B6966] dark:text-[#A8A5A0]">
                    Applying exact normalized coordinates and auto-fitting text overlays
                  </p>
                </div>
              ) : pdfError ? (
                <div className="max-w-md p-6 bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 rounded-lg text-center space-y-3">
                  <p className="text-xs font-semibold text-red-700 dark:text-rose-300">
                    Failed to render PDF preview
                  </p>
                  <p className="text-xs text-red-600 dark:text-rose-400">{pdfError}</p>
                  <button
                    type="button"
                    onClick={() => void handleGeneratePdfPreview()}
                    className="px-3.5 py-1.5 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-medium rounded transition-colors cursor-pointer"
                  >
                    Retry Render
                  </button>
                </div>
              ) : pdfBlobUrl ? (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-2">
                  <div className="w-full max-w-4xl h-[70vh] bg-white rounded-lg shadow-xl border border-[#E7E5E4] dark:border-[#2D3139] overflow-hidden">
                    <object
                      data={`${pdfBlobUrl}#toolbar=0&navpanes=0`}
                      type="application/pdf"
                      className="w-full h-full"
                    >
                      <iframe src={pdfBlobUrl} className="w-full h-full border-0" title="Certificate PDF Preview" />
                    </object>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={pdfBlobUrl}
                      download={`Preview-${selectedStudent?.user?.name || 'Certificate'}.pdf`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1A1D24] border border-[#E7E5E4] dark:border-[#2D3139] rounded text-xs font-medium text-[#1C1B1F] dark:text-[#F5F3EF] hover:bg-[#FAF9F7] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-[#B08D57]" />
                      <span>Download Preview PDF</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleGeneratePdfPreview()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF9F7] dark:bg-[#252830] border border-[#E7E5E4] dark:border-[#2D3139] rounded text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] hover:text-[#1C1B1F] transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Render</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Right Properties Panel (Configures selected placeholder) */}
        <div className="w-full md:w-80 bg-white dark:bg-[#1A1D24] border-t md:border-t-0 md:border-l border-[#E7E5E4] dark:border-[#2D3139] flex flex-col p-4 overflow-y-auto z-10 font-sans space-y-5">
          <div className="flex items-center justify-between border-b border-[#E7E5E4] dark:border-[#2D3139] pb-3">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[#B08D57]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#1C1B1F] dark:text-[#F5F3EF]">
                Placeholder Properties
              </h4>
            </div>
          </div>

          {/* Placeholder Selector Tabs */}
          <div>
            <label className="block text-[11px] font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
              Select Element to Style
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {config.map((item) => {
                const key = item.id || item.placeholder;
                const active = selectedId === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedId(key)}
                    className={`px-2 py-1.5 text-xs text-left rounded border transition-colors truncate cursor-pointer ${
                      active
                        ? 'bg-[#FAF4E8] dark:bg-amber-950/40 border-[#B08D57] text-[#8A6421] dark:text-amber-300 font-medium'
                        : 'bg-[#FAF9F7] dark:bg-[#252830] border-[#E7E5E4] dark:border-[#2D3139] text-[#6B6966] dark:text-[#A8A5A0] hover:border-[#B08D57]/50'
                    }`}
                  >
                    {PLACEHOLDER_LABELS[item.placeholder] || item.placeholder}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedItem && (
            <div className="space-y-4">
              {/* Position Nudge Controls (X & Y normalized percentages) */}
              <div className="p-3 bg-[#FAF9F7] dark:bg-[#252830] rounded-lg border border-[#E7E5E4] dark:border-[#2D3139] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                    Position (Normalized %)
                  </span>
                  <span className="text-[10px] font-mono text-[#B08D57]">
                    X: {selectedItem.xPercent ?? 50}% | Y: {selectedItem.yPercent ?? 50}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[#6B6966] block mb-0.5">X Axis (Horizontal)</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedItem({
                            xPercent: Math.max(0, Math.round(((selectedItem.xPercent ?? 50) - 0.5) * 10) / 10),
                          })
                        }
                        className="p-1 bg-white dark:bg-[#1A1D24] border border-[#E7E5E4] rounded hover:bg-[#F2F0EC] cursor-pointer"
                        title="Nudge Left 0.5%"
                      >
                        <ChevronLeft className="w-3 h-3 text-[#6B6966]" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={selectedItem.xPercent ?? 50}
                        onChange={(e) => updateSelectedItem({ xPercent: parseFloat(e.target.value) || 0 })}
                        className="w-full text-center py-1 bg-white dark:bg-[#1A1D24] border border-[#E7E5E4] dark:border-[#3D424E] rounded text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedItem({
                            xPercent: Math.min(100, Math.round(((selectedItem.xPercent ?? 50) + 0.5) * 10) / 10),
                          })
                        }
                        className="p-1 bg-white dark:bg-[#1A1D24] border border-[#E7E5E4] rounded hover:bg-[#F2F0EC] cursor-pointer"
                        title="Nudge Right 0.5%"
                      >
                        <ChevronRight className="w-3 h-3 text-[#6B6966]" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6B6966] block mb-0.5">Y Axis (Vertical)</label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedItem({
                            yPercent: Math.max(0, Math.round(((selectedItem.yPercent ?? 50) - 0.5) * 10) / 10),
                          })
                        }
                        className="p-1 bg-white dark:bg-[#1A1D24] border border-[#E7E5E4] rounded hover:bg-[#F2F0EC] cursor-pointer"
                        title="Nudge Up 0.5%"
                      >
                        <ChevronLeft className="w-3 h-3 text-[#6B6966] rotate-90" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={selectedItem.yPercent ?? 50}
                        onChange={(e) => updateSelectedItem({ yPercent: parseFloat(e.target.value) || 0 })}
                        className="w-full text-center py-1 bg-white dark:bg-[#1A1D24] border border-[#E7E5E4] dark:border-[#3D424E] rounded text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedItem({
                            yPercent: Math.min(100, Math.round(((selectedItem.yPercent ?? 50) + 0.5) * 10) / 10),
                          })
                        }
                        className="p-1 bg-white dark:bg-[#1A1D24] border border-[#E7E5E4] rounded hover:bg-[#F2F0EC] cursor-pointer"
                        title="Nudge Down 0.5%"
                      >
                        <ChevronRight className="w-3 h-3 text-[#6B6966] rotate-90" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Font Family */}
              <div>
                <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1">
                  Font Family
                </label>
                <select
                  value={selectedItem.font || 'Helvetica'}
                  onChange={(e) =>
                    updateSelectedItem({ font: e.target.value as PlaceholderConfigItem['font'] })
                  }
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-[#252830] border border-[#E7E5E4] dark:border-[#3D424E] rounded text-xs text-[#1C1B1F] dark:text-[#F5F3EF] focus:outline-none focus:border-[#B08D57]"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Size & Alignment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0]">Font Size</label>
                    <span className="text-xs font-mono text-[#B08D57]">{selectedItem.fontSize || 16} pt</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    step="1"
                    value={selectedItem.fontSize || 16}
                    onChange={(e) => updateSelectedItem({ fontSize: parseInt(e.target.value, 10) })}
                    className="w-full accent-[#B08D57] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1">
                    Text Alignment
                  </label>
                  <div className="flex items-center gap-1 bg-[#F2F0EC] dark:bg-[#252830] p-1 rounded">
                    <button
                      type="button"
                      onClick={() => updateSelectedItem({ align: 'left' })}
                      className={`flex-1 p-1 rounded flex items-center justify-center cursor-pointer ${
                        selectedItem.align === 'left'
                          ? 'bg-white dark:bg-[#1A1D24] text-[#B08D57] shadow-xs'
                          : 'text-[#6B6966] hover:text-[#1C1B1F]'
                      }`}
                      title="Align Left"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedItem({ align: 'center' })}
                      className={`flex-1 p-1 rounded flex items-center justify-center cursor-pointer ${
                        selectedItem.align === 'center' || !selectedItem.align
                          ? 'bg-white dark:bg-[#1A1D24] text-[#B08D57] shadow-xs'
                          : 'text-[#6B6966] hover:text-[#1C1B1F]'
                      }`}
                      title="Align Center"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedItem({ align: 'right' })}
                      className={`flex-1 p-1 rounded flex items-center justify-center cursor-pointer ${
                        selectedItem.align === 'right'
                          ? 'bg-white dark:bg-[#1A1D24] text-[#B08D57] shadow-xs'
                          : 'text-[#6B6966] hover:text-[#1C1B1F]'
                      }`}
                      title="Align Right"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Color Picker & Preset Swatches */}
              <div>
                <label className="block text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0] mb-1.5">
                  Text Color
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={selectedItem.color || '#0F172A'}
                    onChange={(e) => updateSelectedItem({ color: e.target.value })}
                    className="w-7 h-7 rounded border border-[#E7E5E4] cursor-pointer"
                  />
                  <input
                    type="text"
                    value={selectedItem.color || '#0F172A'}
                    onChange={(e) => updateSelectedItem({ color: e.target.value })}
                    className="flex-1 px-2.5 py-1 bg-white dark:bg-[#252830] border border-[#E7E5E4] dark:border-[#3D424E] rounded text-xs font-mono text-[#1C1B1F] dark:text-[#F5F3EF]"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateSelectedItem({ color: c })}
                      className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                        selectedItem.color?.toLowerCase() === c.toLowerCase()
                          ? 'scale-125 ring-2 ring-[#B08D57] border-white'
                          : 'border-black/20 hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Maximum Width % & Auto-Fit */}
              <div className="space-y-2 pt-2 border-t border-[#E7E5E4] dark:border-[#2D3139]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#6B6966] dark:text-[#A8A5A0]">
                    Max Width Constraint
                  </label>
                  <span className="text-xs font-mono text-[#B08D57]">
                    {selectedItem.widthPercent || 80}%
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="95"
                  step="5"
                  value={selectedItem.widthPercent || 80}
                  onChange={(e) => updateSelectedItem({ widthPercent: parseInt(e.target.value, 10) })}
                  className="w-full accent-[#B08D57] cursor-pointer"
                />

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={selectedItem.autoFit !== false}
                    onChange={(e) => updateSelectedItem({ autoFit: e.target.checked })}
                    className="rounded accent-[#B08D57]"
                  />
                  <span className="text-xs text-[#1C1B1F] dark:text-[#F5F3EF]">
                    Auto-shrink font size if text exceeds width
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Quick Help Tip */}
          <div className="mt-auto p-3 bg-[#FAF4E8] dark:bg-amber-950/20 border border-[#EEDFA8] dark:border-amber-900/40 rounded-lg text-[11px] text-[#8A6421] dark:text-amber-300 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <Info className="w-3.5 h-3.5" />
              <span>Alignment Guarantee</span>
            </div>
            <p className="leading-relaxed">
              All coordinates are stored as normalized percentages. Drag elements directly on the sheet or use the
              micro-nudge buttons for pixel-perfect alignment invariant to screen resolution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VisualCertificateEditor;
