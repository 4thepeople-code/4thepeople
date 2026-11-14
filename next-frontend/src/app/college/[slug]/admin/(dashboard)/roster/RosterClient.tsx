'use client';

import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Info,
  Upload,
  Users,
} from 'lucide-react';
import {
  useUploadStudentRosterMutation,
  type RosterStudentRow,
  type RosterSummary,
} from '@/lib/api/admin';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import StatCard from '@/components/dashboard/ui/StatCard';
import { Textarea } from '@/components/dashboard/ui/Field';
import { useToast } from '@/components/dashboard/ui/Toast';
import { collegeAdmin } from '@/lib/copy';

export interface RosterClientProps {
  slug: string;
}

const SAMPLE_CSV = `roll_number,name,department,admission_year,email
21L31A0501,Aditya Sharma,CSE,2021,aditya@lbrce.ac.in
21L31A0502,Bhavani Patel,ECE,2021,bhavani@lbrce.ac.in
22L31A1201,Charan Teja,IT,2022,charan@lbrce.ac.in
22L31A0401,Divya Sri,MECH,2022,divya@lbrce.ac.in`;

/**
 * Student roster import. The CSV parsing/validation logic below is preserved
 * verbatim from the old client (header detection, roll regex
 * /^[A-Z0-9._-]{3,30}$/, duplicate roll detection) — only presentation moved
 * to the new UI system. Same useUploadStudentRosterMutation hook.
 */
export default function RosterClient({ slug }: RosterClientProps) {
  const t = collegeAdmin.roster;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewRows, setPreviewRows] = useState<RosterStudentRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [duplicateRolls, setDuplicateRolls] = useState<string[]>([]);
  const [uploadResult, setUploadResult] = useState<RosterSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uploadMutation = useUploadStudentRosterMutation(slug);

  const parseAndValidateCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      setPreviewRows([]);
      setValidationErrors([t.errValidation]);
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
      setValidationErrors([t.errValidation]);
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
        errors.push(
          `Row ${lineNum}: Invalid roll number "${rollNumber}". Must be 3-30 alphanumeric characters.`,
        );
      }

      if (!name) {
        errors.push(`Row ${lineNum}: Missing student name for roll number ${rollNumber}.`);
      }

      if (seenRolls.has(rollNumber)) {
        duplicates.add(rollNumber);
      } else {
        seenRolls.add(rollNumber);
      }

      rows.push({ rollNumber, name, department, admissionYear, email });
    }

    setPreviewRows(rows);
    setValidationErrors(errors);
    setDuplicateRolls(Array.from(duplicates));
  };

  const resetAll = () => {
    setCsvText('');
    setFileName('');
    setPreviewRows([]);
    setValidationErrors([]);
    setDuplicateRolls([]);
    setUploadResult(null);
    setErrorMessage(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setUploadResult(null);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      setCsvText(text);
      parseAndValidateCSV(text);
    };
    reader.readAsText(file);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    setCsvText(text);
    setUploadResult(null);
    setErrorMessage(null);
    parseAndValidateCSV(text);
  };

  const handleLoadSample = () => {
    setCsvText(SAMPLE_CSV);
    setFileName('sample_student_roster.csv');
    setUploadResult(null);
    setErrorMessage(null);
    parseAndValidateCSV(SAMPLE_CSV);
  };

  const handleUploadSubmit = async () => {
    if (!csvText.trim() || previewRows.length === 0) return;
    setErrorMessage(null);
    setUploadResult(null);

    try {
      const response = await uploadMutation.mutateAsync({ csv: csvText });

      const resObj = response as {
        success?: boolean;
        message?: string;
        summary?: RosterSummary;
        data?: { summary?: RosterSummary };
      };

      const summary = resObj.summary || resObj.data?.summary;
      const finalSummary: RosterSummary = summary || {
        total: previewRows.length,
        inserted: previewRows.length,
        updated: 0,
        skipped: 0,
      };
      setUploadResult(finalSummary);
      toast(
        t.toastImported(finalSummary.inserted, finalSummary.updated, finalSummary.skipped),
        { variant: 'success' },
      );
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setErrorMessage(serverMessage || t.errUpload);
    }
  };

  const hasWarnings = validationErrors.length > 0 || duplicateRolls.length > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        role="collegeAdmin"
        title={t.title}
        description={t.description}
        actions={
          <DashboardButton variant="secondary" size="sm" onClick={handleLoadSample}>
            {t.loadSample}
          </DashboardButton>
        }
      />

      {/* How self-activation works */}
      <div className="flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <Info aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--primary)]" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">{t.howTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{t.howBody}</p>
        </div>
      </div>

      {/* Import summary */}
      {uploadResult && (
        <div className="mt-6">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
            {t.toastImported(uploadResult.inserted, uploadResult.updated, uploadResult.skipped)}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label={t.sumTotal} value={uploadResult.total} tone="brand" />
            <StatCard label={t.sumInserted} value={uploadResult.inserted} tone="success" />
            <StatCard label={t.sumUpdated} value={uploadResult.updated} tone="accent" />
            <StatCard
              label={t.sumSkipped}
              value={uploadResult.skipped}
              hint={t.sumSkippedHint}
              tone="neutral"
            />
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="mt-6 flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--secondary-soft)]/30 p-4"
        >
          <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--secondary)]" />
          <p className="text-sm leading-relaxed text-[var(--secondary)]">{errorMessage}</p>
        </div>
      )}

      {/* File upload + paste */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DashboardCard>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
            <FileSpreadsheet aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
            {t.uploadTitle}
          </h2>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 w-full rounded-2xl border-2 border-dashed border-[var(--line)] bg-[var(--bg)] px-6 py-10 text-center transition-colors duration-150 motion-reduce:transition-none hover:border-[var(--primary)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <Upload aria-hidden="true" className="mx-auto mb-2 h-7 w-7 text-[var(--ink-soft)]" />
            <span className="block text-sm font-bold text-[var(--ink)]">
              {fileName || t.uploadChoose}
            </span>
            <span className="mt-1 block text-xs text-[var(--ink-soft)]">{t.uploadHint}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          />

          <div className="mt-5 text-xs text-[var(--ink-soft)]">
            <p className="font-bold uppercase tracking-wider">{t.headersLabel}</p>
            <code className="mt-1.5 block rounded-xl border border-[var(--line)] bg-[var(--bg)] p-2.5 font-mono text-[11px] text-[var(--ink)]">
              roll_number,name,department,admission_year,email
            </code>
          </div>
        </DashboardCard>

        <DashboardCard>
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
            <FileText aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
            {t.pasteTitle}
          </h2>

          <Textarea
            rows={8}
            aria-label={t.pasteTitle}
            placeholder={t.pastePlaceholder}
            value={csvText}
            onChange={handleTextChange}
            className="mt-4 font-mono text-xs"
          />

          <div className="mt-3 flex items-center justify-between text-xs text-[var(--ink-soft)]">
            <span>{t.parsedCount(previewRows.length)}</span>
            {previewRows.length > 0 && (
              <button
                type="button"
                onClick={resetAll}
                className="min-h-8 rounded px-2 font-semibold text-[var(--secondary)] underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--primary)] motion-reduce:transition-none"
              >
                {t.clear}
              </button>
            )}
          </div>
        </DashboardCard>
      </div>

      {/* Validation warnings (what + why + how to fix) */}
      {hasWarnings && (
        <div
          role="alert"
          className="mt-6 space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--secondary-soft)]/30 p-4"
        >
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--secondary)]">
            <AlertCircle aria-hidden="true" className="h-4 w-4" />
            {t.validationTitle}
          </p>
          {duplicateRolls.length > 0 && (
            <p className="text-xs leading-relaxed text-[var(--secondary)]">
              {t.duplicates(duplicateRolls.join(', '))}
            </p>
          )}
          {validationErrors.map((err, i) => (
            <p key={i} className="text-xs leading-relaxed text-[var(--secondary)]">
              • {err}
            </p>
          ))}
        </div>
      )}

      {/* Preview + import */}
      {previewRows.length > 0 && (
        <DashboardCard className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--ink)]">
              <Users aria-hidden="true" className="h-4 w-4 text-[var(--primary)]" />
              {t.previewTitle(previewRows.length)}
            </h2>
            <DashboardButton
              size="sm"
              onClick={() => void handleUploadSubmit()}
              loading={uploadMutation.isPending}
              loadingLabel={t.importing}
              leftIcon={uploadMutation.isPending ? undefined : <Upload aria-hidden="true" className="h-4 w-4" />}
            >
              {t.import}
            </DashboardButton>
          </div>

          <div className="mt-4 max-h-80 overflow-auto rounded-2xl border border-[var(--line)]">
            <table className="w-full text-left text-xs text-[var(--ink)]">
              <thead className="sticky top-0 border-b border-[var(--line)] bg-[var(--bg)] text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
                <tr>
                  <th className="px-4 py-2.5">{t.tableRoll}</th>
                  <th className="px-4 py-2.5">{t.tableName}</th>
                  <th className="px-4 py-2.5">{t.tableDept}</th>
                  <th className="px-4 py-2.5">{t.tableYear}</th>
                  <th className="px-4 py-2.5">{t.tableEmail}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {previewRows.map((row, i) => (
                  <tr key={i} className="transition-colors hover:bg-[var(--primary-soft)]/30">
                    <td className="px-4 py-2 font-mono font-semibold text-[var(--primary)]">
                      {row.rollNumber}
                    </td>
                    <td className="px-4 py-2 font-medium">{row.name}</td>
                    <td className="px-4 py-2 text-[var(--ink-soft)]">{row.department || t.noDept}</td>
                    <td className="px-4 py-2 text-[var(--ink-soft)]">{row.admissionYear || t.noDept}</td>
                    <td className="px-4 py-2 text-[var(--ink-soft)]">
                      {row.email || `${row.rollNumber.toLowerCase()}@institutional`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      )}
    </div>
  );
}
