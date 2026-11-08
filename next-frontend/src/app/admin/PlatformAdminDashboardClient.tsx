'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import PlatformAdminLayout from '@/components/platform/PlatformAdminLayout';
import PlatformAdminsTab from '@/components/platform/PlatformAdminsTab';
import {
  Shield,
  ShieldCheck,
  Building2,
  Lock,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Database,
  Key,
  Layers,
  Users,
} from 'lucide-react';

export function PlatformAdminDashboardClient() {
  const { user, refreshSession } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      await refreshSession();
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Known onboarded college tenants in platform database
  const knownColleges = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Lakireddy Bali Reddy College of Engineering',
      slug: 'lbrce',
      subdomain: 'lbrce.4thepeople.in',
      devSubdomain: 'lbrce.localhost:3000',
      studentEmailDomain: 'lbrce.ac.in',
      status: 'ACTIVE',
      rlsIsolated: true,
    },
  ];

  return (
    <PlatformAdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {/* Tab 1: Platform Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Welcome & Session Banner */}
          <div className="bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div>
                <div className="flex items-center space-x-2.5 mb-2">
                  <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-500/30 text-purple-200 rounded-full border border-purple-400/30">
                    Super-Administrator Active
                  </span>
                  <span className="text-xs text-purple-300 font-mono">
                    Host: admin.4thepeople.in
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Platform Operations Command Center
                </h1>
                <p className="text-xs sm:text-sm text-purple-200/80 mt-1.5 max-w-2xl leading-relaxed">
                  Authenticated as <strong className="text-white font-mono">{user?.email}</strong>. 
                  Managing global multi-tenant routing, cryptographic security policies, and PostgreSQL database isolation.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl backdrop-blur transition-all disabled:opacity-50 border border-white/10"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Verifying Session...' : 'Verify Session'}</span>
                </button>
              </div>
            </div>

            {refreshSuccess && (
              <div className="mt-4 p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Session verified with backend /api/platform/auth/me: Active and valid.</span>
              </div>
            )}
          </div>

          {/* Quick Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Registered Institutions */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Active Institutions
                </span>
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {knownColleges.length}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                  Colleges Onboarded
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>LBRCE Tenant Operating</span>
              </div>
            </div>

            {/* Card 2: Multi-Factor Authentication */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  MFA Enforcement
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  RFC 6238
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                  TOTP 2FA
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Anti-Replay Cache Active</span>
              </div>
            </div>

            {/* Card 3: Database Isolation */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Database Isolation
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  Postgres RLS
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>platform_ops Role (RLS Bypass)</span>
              </div>
            </div>

            {/* Card 4: Session Cookie Security */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Session Boundary
                </span>
                <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  Host-Only
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>yuva_platform_token (Strict)</span>
              </div>
            </div>
          </div>

          {/* Platform System Architecture Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Active Institutions Summary */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Onboarded Institution Tenants
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Tenant partition mapping and verified domain routing.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('colleges')}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1"
                >
                  <span>View Details</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {knownColleges.map((col) => (
                  <div key={col.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            {col.name}
                          </h3>
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                            {col.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                          <span>subdomain: <strong>{col.subdomain}</strong></span>
                          <span>&bull;</span>
                          <span>domain: <strong>@{col.studentEmailDomain}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <a
                        href={`http://${col.devSubdomain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        <span>Visit Tenant</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right 1 Col: Platform Security & Policy Summary */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                Security Controls
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                Active platform cryptographic boundaries.
              </p>

              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <div className="flex items-center space-x-2 mb-1">
                    <Lock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Host Isolation
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Platform authentication is only allowed when incoming host resolves to <code className="text-purple-600 dark:text-purple-400">admin.*</code>.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <div className="flex items-center space-x-2 mb-1">
                    <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Token Signing Key
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Signed with <code className="text-emerald-600 dark:text-emerald-400">PLATFORM_JWT_SECRET</code>, distinct from tenant college secret.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <div className="flex items-center space-x-2 mb-1">
                    <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      Anti-Replay Protection
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    90-second in-memory cache blocks TOTP code reuse within rotating authentication windows.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Super-Administrators Management */}
      {activeTab === 'admins' && <PlatformAdminsTab />}

      {/* Tab 2: Institutions & Tenancy */}
      {activeTab === 'colleges' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Multi-Tenant Institution Directory
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Global college records partitioned by PostgreSQL Row-Level Security.
                </p>
              </div>
            </div>

            {/* Institutions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Institution Name</th>
                    <th className="px-4 py-3">Tenant Slug</th>
                    <th className="px-4 py-3">Production Domain</th>
                    <th className="px-4 py-3">Email Domain</th>
                    <th className="px-4 py-3">RLS Isolation</th>
                    <th className="px-4 py-3 rounded-r-lg">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {knownColleges.map((col) => (
                    <tr key={col.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">
                        {col.name}
                      </td>
                      <td className="px-4 py-4 font-mono text-purple-600 dark:text-purple-400">
                        {col.slug}
                      </td>
                      <td className="px-4 py-4 font-mono text-slate-600 dark:text-slate-300">
                        {col.subdomain}
                      </td>
                      <td className="px-4 py-4 font-mono text-slate-600 dark:text-slate-300">
                        @{col.studentEmailDomain}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Tenant Keyed</span>
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                          {col.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Architectural Note regarding Platform Provisioning APIs */}
            <div className="mt-8 p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-xs text-purple-800 dark:text-purple-200 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Backend Platform Endpoints Architecture Notice</span>
              </div>
              <p className="leading-relaxed">
                The Express backend exposes privileged platform authentication at <code className="font-mono bg-purple-100 dark:bg-purple-900 px-1 py-0.5 rounded">/api/platform/auth/*</code> (login, logout, me). 
                Dynamic college registration endpoints (e.g. <code className="font-mono bg-purple-100 dark:bg-purple-900 px-1 py-0.5 rounded">POST /api/platform/colleges</code>) are not mounted in the current backend release; college provisioning is managed via verified migration scripts and platform seed scripts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Security & Access Control */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Platform Security Architecture & Access Control
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Multi-layered cryptographic defenses and cross-boundary protections.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Policy 1: TOTP Multi-Factor Authentication */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400">
                  <Key className="w-5 h-5" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    RFC 6238 TOTP Two-Factor Authentication
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Platform administrators authenticate using rotating 6-digit TOTP codes computed from Base32 secrets. Secrets are stored at rest encrypted with AES-256-GCM. An in-memory anti-replay cache rejects reuse of identical codes within a 90-second window.
                </p>
                <div className="pt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Enforced on /api/platform/auth/login</span>
                </div>
              </div>

              {/* Policy 2: Dedicated Host-Only Cookie Policy */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                  <Lock className="w-5 h-5" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Dedicated Host-Only Cookie: yuva_platform_token
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Platform sessions use a dedicated cookie <code className="font-mono text-purple-600 dark:text-purple-400">yuva_platform_token</code> with <code className="font-mono">SameSite=Strict</code>, <code className="font-mono">HttpOnly=true</code>, and a 4-hour lifespan. No Domain attribute is set, guaranteeing that college subdomains cannot read or send platform credentials.
                </p>
                <div className="pt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Strict cookie-first architecture</span>
                </div>
              </div>

              {/* Policy 3: Cross-Boundary Role Isolation */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="w-5 h-5" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Cross-Boundary Role Isolation
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Backend middleware rejects college administrator, club manager, and student tokens on platform endpoints with HTTP 403. Conversely, platform tokens are rejected on college endpoints, strictly isolating platform operations from institutional tenant data.
                </p>
                <div className="pt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Verified by authenticatePlatformToken</span>
                </div>
              </div>

              {/* Policy 4: PostgreSQL Row-Level Security (RLS) Bypass Role */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
                  <Database className="w-5 h-5" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Database platform_ops Client
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  The Express backend accesses <code className="font-mono text-purple-600 dark:text-purple-400">platform_admins</code> using a dedicated <code className="font-mono">platform_ops</code> Prisma client configured with <code className="font-mono">BYPASSRLS</code> privileges, completely isolated from college tenant connection pools.
                </p>
                <div className="pt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Isolated database connection pool</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: System Architecture */}
      {activeTab === 'telemetry' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              System Architecture & BFF Communication Layer
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Next.js 16 App Router BFF Proxy upstream forwarding topology.
            </p>

            <div className="space-y-4 font-mono text-xs">
              <div className="p-4 rounded-xl bg-slate-900 text-slate-200 overflow-x-auto">
                <div className="text-purple-400 font-semibold mb-2">{'// Platform Request Flow'}</div>
                <div>1. Client Request: https://admin.4thepeople.in/api/platform/auth/login</div>
                <div>2. Next.js Middleware: Resolves host type PLATFORM_ADMIN & sets x-yuva-clean-host</div>
                <div>3. Next.js Route Handler: Proxies to internal Express backend with preserved headers</div>
                <div>4. Express resolveCollege: Identifies admin slug &rarr; sets req.isPlatform = true</div>
                <div>5. Express platformAuthController: Verifies bcrypt hash + TOTP &rarr; Sets yuva_platform_token</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                <h4 className="font-bold text-slate-900 dark:text-white mb-1 font-sans">
                  Environment Configuration
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <div>Proxy URL: <code>http://localhost:5000</code></div>
                  <div>Database: <code>yuva_test (PostgreSQL 16)</code></div>
                  <div>Node Environment: <code>development / test</code></div>
                  <div>Next.js Version: <code>16.0.7</code></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </PlatformAdminLayout>
  );
}

export default PlatformAdminDashboardClient;
