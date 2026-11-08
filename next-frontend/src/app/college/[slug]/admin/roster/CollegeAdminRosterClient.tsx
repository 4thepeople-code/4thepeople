'use client';

import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  AlertCircle,
  CheckCircle2,
  FileText,
  Users,
  Info,
  Copy,
  Check,
} from 'lucide-react';
import { useUploadStudentRosterMutation, type RosterStudentRow, type RosterSummary } from '@/lib/api/admin';
import AdminLayout from '@/components/admin/AdminLayout';
import StatCard from '@/components/admin/StatCard';

export interface CollegeAdminRosterClientProps {
  slug: string;
}

const SAMPLE_CSV = `roll_number,name,department,admission_year,email
21L31A0501,Aditya Sharma,CSE,2021,aditya@lbrce.ac.in
21L31A0502,Bhavani Patel,ECE,2021,bhavani@lbrce.ac.in
22L31A1201,Charan Teja,IT,2022,charan@lbrce.ac.in
22L31A0401,Divya Sri,MECH,2022,divya@lbrce.ac.in`;

export function CollegeAdminRosterClient({ slug }: CollegeAdminRosterClientProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<RosterStudentRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [duplicateRolls, setDuplicateRolls] = useState<string[]>([]);
  const [uploadResult, setUploadResult] = useState<RosterSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedSample, setCopiedSample] = useState(false);

  const uploadMutation = useUploadStudentRosterMutation(slug);

  const parseAndValidateCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setPreviewRows([]);
      setValidationErrors(['CSV must contain a header row and at least one student data row.']);
      setDuplicateRolls([]);
      return;
    }

    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));

    const rollIdx = headers.findIndex((h) => h.includes('roll') || h === 'id');
    const nameIdx = headers.findIndex((h) => h.includes('name'));
    const deptIdx = headers.findIndex((h) => h.includes('dept') || h.includes('department'));
    const yearIdx = headers.findIndex((h) => h.includes('year') || h.includes('admission'));
    const emailIdx = headers.findIndex((h) => h.includes('email'));

    if (rollIdx === -1 || nameIdx === -1) {
      setPreviewRows([]);
      setValidationErrors(['CSV header must contain "roll_number" (or "roll") and "name" columns.']);
      setDuplicateRolls([]);
      return;
    }

    const errors: string[] = [];
    const rows: RosterStudentRow[] = [];
    const seenRolls = new Set<string>();
    const duplicates = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1;
      const row = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (row.length <= Math.max(rollIdx, nameIdx)) continue;

      const rollNumber = (row[rollIdx] || '').toUpperCase();
      const name = row[nameIdx] || '';
      const department = deptIdx !== -1 && row[deptIdx] ? row[deptIdx] : null;
      const yearRaw = yearIdx !== -1 && row[yearIdx] ? parseInt(row[yearIdx], 10) : null;
      const admissionYear = yearRaw && !isNaN(yearRaw) ? yearRaw : null;
      const email = emailIdx !== -1 && row[emailIdx] ? row[emailIdx].toLowerCase() : null;

      if (!rollNumber) {
        errors.push(`Row ${lineNum}: Missing roll number.`);
        continue;
      }

      if (!/^[A-Z0-9._-]{3,30}$/.test(rollNumber)) {
        errors.push(`Row ${lineNum}: Invalid roll number "${rollNumber}". Must be 3-30 alphanumeric characters.`);
      }

      if (!name) {
        errors.push(`Row ${lineNum}: Missing student name for roll number ${rollNumber}.`);
      }

      if (seenRolls.has(rollNumber)) {
        duplicates.add(rollNumber);
      } else {
        seenRolls.add(rollNumber);
      }

      rows.push({
        rollNumber,
        name,
        department,
        admissionYear,
        email,
      });
    }

    setPreviewRows(rows);
    setValidationErrors(errors);
    setDuplicateRolls(Array.from(duplicates));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadResult(null);
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setCsvText(text);
      parseAndValidateCSV(text);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvText(text);
    setUploadResult(null);
    setErrorMessage('');
    parseAndValidateCSV(text);
  };

  const handleCopySample = () => {
    setCsvText(SAMPLE_CSV);
    setFileName('sample_student_roster.csv');
    setUploadResult(null);
    setErrorMessage('');
    parseAndValidateCSV(SAMPLE_CSV);
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 3000);
  };

  const handleUploadSubmit = async () => {
    if (!csvText.trim() || previewRows.length === 0) return;
    setErrorMessage('');
    setUploadResult(null);

    try {
      const response = await uploadMutation.mutateAsync({
        csv: csvText,
      });

      const resObj = response as {
        success?: boolean;
        message?: string;
        summary?: RosterSummary;
        data?: { summary?: RosterSummary };
      };

      const summary = resObj.summary || resObj.data?.summary;
      if (summary) {
        setUploadResult(summary);
      } else {
        setUploadResult({
          total: previewRows.length,
          inserted: previewRows.length,
          updated: 0,
          skipped: 0,
        });
      }
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(
        errObj.response?.data?.message || 'Failed to process roster upload. Please check format.'
      );
    }
  };

  return (
    <AdminLayout slug={slug}>
      <div className="space-y-8 max-w-5xl mx-auto font-sans">
        {/* Page Header */}
        <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] p-6 sm:p-8 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-[#1C1B1F] dark:text-[#F5F3EF] tracking-tight">
              Student Roster Management
            </h1>
            <p className="text-xs sm:text-sm text-[#6B6966] dark:text-[#A8A5A0] mt-1">
              Batch-import student records via CSV to enable self-activation and institutional access.
            </p>
          </div>
          <button
            onClick={handleCopySample}
            className="px-3.5 py-2 bg-[#F2F0EC] dark:bg-[#252429] hover:bg-[#E7E5E4] dark:hover:bg-[#2D2C30] text-[#38373A] dark:text-[#D4D1CB] text-xs font-medium rounded border border-[#E7E5E4] dark:border-[#2D2C30] transition-colors flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
          >
            {copiedSample ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Load Sample CSV</span>
          </button>
        </div>

        {/* Institutional Activation Guidelines Alert */}
        <div className="p-4 bg-[#FAF9F7] dark:bg-[#252429] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
            <Info className="w-4 h-4 text-[#B08D57]" />
            <span>How Student Roster & Self-Activation Works</span>
          </div>
          <p className="text-xs text-[#6B6966] dark:text-[#A8A5A0] leading-relaxed">
            Imported students are pre-provisioned in an <strong>inactive</strong> state. Active accounts are never overwritten. When students visit their campus activation page, they enter their roll number to receive a one-time cryptographic code sent to their institutional email, satisfying zero-trust S1 activation guidelines.
          </p>
        </div>

        {/* Upload Summary Result Cards */}
        {uploadResult && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 bg-[#EBF3ED] dark:bg-emerald-950/40 border border-[#D1E3D7] dark:border-emerald-900/60 text-[#2E5A44] dark:text-emerald-300 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="font-semibold text-sm">
                Roster processed successfully!
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard title="Total Rows" value={uploadResult.total} />
              <StatCard title="New Accounts" value={uploadResult.inserted} trend="Inserted" />
              <StatCard title="Updated Accounts" value={uploadResult.updated} trend="Refreshed" />
              <StatCard title="Protected / Skipped" value={uploadResult.skipped} description="Active accounts preserved" />
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 text-[#8B3A3A] dark:text-rose-300 rounded text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Upload & CSV Input Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* File Upload Box */}
          <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h2 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#B08D57]" /> Upload CSV File
            </h2>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#D8D7DC] dark:border-[#4B4950] hover:border-[#B08D57] dark:hover:border-[#B08D57] rounded-lg p-8 text-center cursor-pointer transition-colors bg-[#FAF9F7]/50 dark:bg-[#252429]/30"
            >
              <Upload className="w-8 h-8 text-[#8E8B85] mx-auto mb-2" />
              <p className="text-xs font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">
                {fileName ? fileName : 'Click to select CSV file from computer'}
              </p>
              <p className="text-[11px] text-[#8E8B85] mt-1">Accepts UTF-8 .csv up to 5,000 rows per batch</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="text-[11px] text-[#8E8B85] space-y-1">
              <p className="font-semibold text-[#1C1B1F] dark:text-[#F5F3EF]">Expected CSV Headers:</p>
              <p className="font-mono text-[10px] bg-[#FAF9F7] dark:bg-[#252429] p-2 rounded border border-[#E7E5E4] dark:border-[#2D2C30]">
                roll_number,name,department,admission_year,email
              </p>
            </div>
          </div>

          {/* Direct CSV Textarea Box */}
          <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h2 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#B08D57]" /> Paste CSV Text Directly
            </h2>

            <textarea
              rows={8}
              placeholder="Paste comma-separated rows here..."
              value={csvText}
              onChange={handleTextChange}
              className="w-full px-3 py-2 bg-white dark:bg-[#1C1B1F] border border-[#D8D7DC] dark:border-[#4B4950] focus:border-[#B08D57] rounded text-xs font-mono text-[#1C1B1F] dark:text-[#F5F3EF] placeholder-[#A8A5A0] focus:outline-none transition-colors resize-none"
            />

            <div className="flex items-center justify-between text-xs text-[#6B6966] dark:text-[#A8A5A0]">
              <span>Parsed {previewRows.length} valid student rows</span>
              {previewRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCsvText('');
                    setFileName('');
                    setPreviewRows([]);
                    setValidationErrors([]);
                    setDuplicateRolls([]);
                    setUploadResult(null);
                  }}
                  className="text-xs text-[#8B3A3A] hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Validation Errors & Duplicate Notices */}
        {(validationErrors.length > 0 || duplicateRolls.length > 0) && (
          <div className="p-4 bg-[#FDF2F2] dark:bg-rose-950/40 border border-[#F3CECE] dark:border-rose-900/60 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8B3A3A] dark:text-rose-300">
              <AlertCircle className="w-4 h-4" />
              <span>Validation Warnings</span>
            </div>
            {duplicateRolls.length > 0 && (
              <p className="text-xs text-[#8B3A3A] dark:text-rose-300">
                Duplicate roll numbers found in batch: <strong>{duplicateRolls.join(', ')}</strong> (later occurrences will update earlier ones).
              </p>
            )}
            {validationErrors.map((err, i) => (
              <p key={i} className="text-xs text-[#8B3A3A] dark:text-rose-300">
                • {err}
              </p>
            ))}
          </div>
        )}

        {/* Preview Table */}
        {previewRows.length > 0 && (
          <div className="bg-white dark:bg-[#1C1B1F] border border-[#E7E5E4] dark:border-[#2D2C30] rounded-lg p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#1C1B1F] dark:text-[#F5F3EF] font-serif flex items-center gap-2">
                <Users className="w-4 h-4 text-[#B08D57]" /> Batch Preview ({previewRows.length} students)
              </h2>
              <button
                onClick={handleUploadSubmit}
                disabled={uploadMutation.isPending || previewRows.length === 0}
                className="px-5 py-2 bg-[#B08D57] hover:bg-[#997847] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {uploadMutation.isPending ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>Process & Import Roster</span>
              </button>
            </div>

            <div className="overflow-x-auto max-h-80 border border-[#E7E5E4] dark:border-[#2D2C30] rounded">
              <table className="w-full text-left text-xs text-[#1C1B1F] dark:text-[#F5F3EF]">
                <thead className="bg-[#FAF9F7] dark:bg-[#252429] text-[11px] font-semibold text-[#6B6966] dark:text-[#A8A5A0] border-b border-[#E7E5E4] dark:border-[#2D2C30] sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">Roll Number</th>
                    <th className="px-4 py-2.5">Full Name</th>
                    <th className="px-4 py-2.5">Department</th>
                    <th className="px-4 py-2.5">Year</th>
                    <th className="px-4 py-2.5">Institutional Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EFEF] dark:divide-[#2D2C30]">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="hover:bg-[#FAF9F7]/60 dark:hover:bg-[#252429]/40">
                      <td className="px-4 py-2 font-mono font-semibold text-[#B08D57]">
                        {row.rollNumber}
                      </td>
                      <td className="px-4 py-2 font-medium">{row.name}</td>
                      <td className="px-4 py-2 text-[#6B6966] dark:text-[#A8A5A0]">
                        {row.department || '—'}
                      </td>
                      <td className="px-4 py-2 text-[#6B6966] dark:text-[#A8A5A0]">
                        {row.admissionYear || '—'}
                      </td>
                      <td className="px-4 py-2 text-[#8E8B85]">
                        {row.email || `${row.rollNumber.toLowerCase()}@institutional`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default CollegeAdminRosterClient;
