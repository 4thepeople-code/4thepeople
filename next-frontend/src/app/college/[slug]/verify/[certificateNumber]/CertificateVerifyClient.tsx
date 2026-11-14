'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from '@/context/ThemeContext';
import { useVerifyCertificateQuery } from '@/lib/api/events';
import PublicLayout from '@/components/public/PublicLayout';
import {
  ShieldCheck,
  ShieldAlert,
  Award,
  Calendar,
  Building2,
  User,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Lock,
} from 'lucide-react';

export interface CertificateVerifyClientProps {
  slug: string;
  certificateNumber: string;
}

export function CertificateVerifyClient({
  slug,
  certificateNumber,
}: CertificateVerifyClientProps) {
  const { isDark } = useTheme();
  const collegeDisplay = slug.toUpperCase();

  const { data: cert, isLoading, isError } = useVerifyCertificateQuery(slug, certificateNumber);

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="py-12 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center justify-between">
          <Link
            href={`/college/${slug}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to {collegeDisplay} Campus Portal</span>
          </Link>
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            Public Credential Verification
          </span>
        </div>

        {isLoading ? (
          <div
            className={`p-12 rounded-3xl border shadow-xl flex flex-col items-center justify-center space-y-4 ${
              isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
            <div className="text-center">
              <p className="font-bold text-sm text-slate-200">Verifying Credential Authenticity...</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Checking cryptographic records for <code className="text-cyan-400">{certificateNumber}</code>
              </p>
            </div>
          </div>
        ) : isError || !cert ? (
          <div
            className={`p-10 rounded-3xl border shadow-xl text-center space-y-4 ${
              isDark ? 'bg-[#12141C] border-rose-500/20' : 'bg-white border-rose-200'
            }`}
          >
            <ShieldAlert className="w-14 h-14 text-rose-500 mx-auto" />
            <div className="space-y-1">
              <h2 className="text-xl font-black uppercase text-rose-400">Verification Error</h2>
              <p className="text-xs text-slate-400">
                Unable to query verification service at this time. Please try again later.
              </p>
            </div>
          </div>
        ) : !cert.valid ? (
          <div
            className={`p-8 sm:p-10 rounded-3xl border shadow-2xl text-center space-y-6 ${
              isDark ? 'bg-[#12141C] border-rose-500/30' : 'bg-white border-rose-200'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-wider">
                {cert.isRevoked ? 'Certificate Revoked' : 'Invalid Certificate Number'}
              </span>
              <h1 className="text-2xl font-black uppercase text-slate-100">
                {cert.isRevoked ? 'This Certificate Has Been Revoked' : 'Record Not Found'}
              </h1>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {cert.isRevoked
                  ? `Certificate ${cert.certificateNumber} was officially revoked by college authorities on ${
                      cert.revokedAt ? new Date(cert.revokedAt).toLocaleDateString() : 'record'
                    } and is no longer valid.`
                  : `Certificate identifier "${certificateNumber}" does not correspond to any issued credential in the official institutional ledger.`}
              </p>
            </div>

            <div className="pt-4 border-t border-white/10">
              <Link
                href={`/college/${slug}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
              >
                <span>Return to Campus Home</span>
              </Link>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-3xl border shadow-2xl overflow-hidden transition-all ${
              isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200 shadow-slate-200/50'
            }`}
          >
            {/* Authenticity Header Banner */}
            <div className="p-6 sm:p-8 bg-gradient-to-r from-emerald-500/15 via-cyan-500/15 to-transparent border-b border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Officially Verified Credential</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                    Authentic Certificate
                  </h1>
                </div>
              </div>

              <div className="text-right sm:text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Certificate Identifier</span>
                <span className="font-mono text-xs font-bold text-cyan-400">{cert.certificateNumber}</span>
              </div>
            </div>

            {/* Credential Details Grid */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    Recipient Student
                  </span>
                  <div className="text-sm font-bold text-white">{cert.recipientName || 'Student'}</div>
                  <span className="text-[10px] text-slate-500 block">Identity masked for student privacy</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    Event / Program
                  </span>
                  <div className="text-sm font-bold text-white line-clamp-1">{cert.eventTitle || 'Campus Event'}</div>
                  <span className="text-[10px] text-slate-500 block">Authorized participation credential</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-purple-400" />
                    Issuing Institution
                  </span>
                  <div className="text-sm font-bold text-white">{cert.collegeName || collegeDisplay}</div>
                  <span className="text-[10px] text-slate-500 block">Registered collegiate campus</span>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    Issue Timestamp
                  </span>
                  <div className="text-sm font-bold text-white">
                    {cert.issuedAt
                      ? new Date(cert.issuedAt).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Verified on record'}
                  </div>
                  <span className="text-[10px] text-slate-500 block">Recorded in PostgreSQL ledger</span>
                </div>
              </div>

              {/* Trust & Security Notice */}
              <div
                className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
                  isDark ? 'bg-cyan-500/5 border-cyan-500/20 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  This cryptographic record certifies that the student referenced above completed all requirements for
                  the stated event. Issued through <strong>4 THE PEOPLE</strong> multi-tenant platform.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
export default CertificateVerifyClient;
