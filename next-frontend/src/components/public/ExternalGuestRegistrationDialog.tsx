'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mail,
  User,
  Building,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  CreditCard,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import {
  requestExternalOtp,
  verifyExternalOtp,
  registerExternalParticipant,
  getExternalRegistrationStatus,
  ExternalRegisterInput,
} from '@/lib/api/events';
import { externalCheckout, externalVerifyPayment } from '@/lib/api/payment';
import { launchPaymentCheckout } from '@/lib/payment/paymentSdk';
import { getStoredExternalUser } from '@/lib/auth/tokenStorage';
import type { Event } from '@/types/models';

export interface ExternalGuestRegistrationDialogProps {
  isOpen: boolean;
  event: Event;
  onClose: () => void;
  onSuccess: (registration: { id: string; eventId: string; registeredAt: string }) => void;
}

type Step = 'DETAILS' | 'OTP' | 'CONFIRMATION';

export function ExternalGuestRegistrationDialog({
  isOpen,
  event,
  onClose,
  onSuccess,
}: ExternalGuestRegistrationDialogProps) {
  const { isDark } = useTheme();

  // Form State
  const [step, setStep] = useState<Step>('DETAILS');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [gender, setGender] = useState('');
  const [yearOfStudy, setYearOfStudy] = useState('');
  const [formAnswers, setFormAnswers] = useState<Record<string, unknown>>({});

  // OTP State (6 separate digit boxes)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Status & Error States
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ id: string; eventId: string; registeredAt: string } | null>(null);

  // Reset state when dialog is opened or closed, prefill with stored profile if present
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredExternalUser();
      if (stored) {
        if (stored.name) setName(stored.name);
        if (stored.email) setEmail(stored.email);
        if (stored.phone) setPhone(stored.phone);
        if (stored.institutionName || stored.collegeName) {
          setInstitutionName(stored.institutionName || stored.collegeName || '');
        }
        if (stored.rollNumber) setRollNumber(stored.rollNumber);
        if (stored.department) setDepartment(stored.department);
        if (stored.gender) setGender(stored.gender);
        if (stored.yearOfStudy) setYearOfStudy(stored.yearOfStudy);
      }
      setStep('DETAILS');
      setErrorMessage(null);
      setOtpDigits(['', '', '', '', '', '']);
      setSuccessData(null);
    }
  }, [isOpen]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first OTP box when entering OTP step
  useEffect(() => {
    if (step === 'OTP') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  if (!isOpen) return null;

  // Validation for Step 1
  const validateDetails = (): boolean => {
    setErrorMessage(null);

    if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
      setErrorMessage('Registration deadline has passed for this event.');
      return false;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedRoll = rollNumber.trim();
    const trimmedDept = department.trim();
    const trimmedGender = gender.trim();
    const trimmedYear = yearOfStudy.trim();
    const trimmedInst = institutionName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage('Please enter your full name (at least 2 characters).');
      return false;
    }

    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }

    if (!trimmedRoll) {
      setErrorMessage('Please enter your roll number / student ID.');
      return false;
    }

    if (!trimmedDept) {
      setErrorMessage('Please enter your department.');
      return false;
    }

    if (!trimmedGender) {
      setErrorMessage('Please select your gender.');
      return false;
    }

    if (!trimmedYear) {
      setErrorMessage('Please select your year of study.');
      return false;
    }

    if (!trimmedPhone || trimmedPhone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please enter a valid 10-digit phone number.');
      return false;
    }

    if (!trimmedInst) {
      setErrorMessage('Please enter your college / institution name.');
      return false;
    }

    // Custom form questions validation
    const customFields = event.customFormDefinition?.fields;
    if (customFields && Array.isArray(customFields)) {
      for (const field of customFields) {
        const key = field.id || field.name;
        if (!key) continue;
        const val = formAnswers[key];
        if (field.required && (val === undefined || val === null || String(val).trim() === '')) {
          setErrorMessage(`Field "${field.label || key}" is required.`);
          return false;
        }
      }
    }

    return true;
  };

  // Step 1 -> Request OTP
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateDetails()) return;

    try {
      setIsRequestingOtp(true);
      setErrorMessage(null);

      await requestExternalOtp(event.id, email.trim().toLowerCase());
      setCooldown(60); // 60-second cooldown
      setStep('OTP');
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Unable to send verification code. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (cooldown > 0 || isRequestingOtp) return;
    try {
      setIsRequestingOtp(true);
      setErrorMessage(null);
      await requestExternalOtp(event.id, email.trim().toLowerCase());
      setCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        'Failed to resend code. Please try again later.';
      setErrorMessage(msg);
    } finally {
      setIsRequestingOtp(false);
    }
  };

  // Handle individual OTP digit input
  const handleOtpChange = (index: number, value: string) => {
    const numericChar = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = numericChar;
    setOtpDigits(newDigits);
    setErrorMessage(null);

    // Auto-advance to next input
    if (numericChar && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Support pasting full 6 digits
  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);

    const nextFocusIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[nextFocusIndex]?.focus();
  };

  // Step 2 -> Verify OTP and complete registration
  const handleVerifyAndRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isVerifying) return;
    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    try {
      setIsVerifying(true);
      setErrorMessage(null);

      // 1. Verify OTP and obtain external JWT
      const verifyRes = await verifyExternalOtp(email.trim().toLowerCase(), fullCode, event.id);
      const token = verifyRes.token || (verifyRes as unknown as { data?: { token?: string } })?.data?.token;

      // 2. Complete registration using the external JWT
      const input: ExternalRegisterInput = {
        name: name.trim(),
        rollNumber: rollNumber.trim() || undefined,
        email: email.trim().toLowerCase(),
        department: department.trim() || undefined,
        gender: gender.trim() || undefined,
        yearOfStudy: yearOfStudy.trim() || undefined,
        phone: phone.trim() || undefined,
        institutionName: institutionName.trim() || undefined,
        formAnswers: {
          ...formAnswers,
          rollNumber: rollNumber.trim() || undefined,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          department: department.trim() || undefined,
          gender: gender.trim() || undefined,
          yearOfStudy: yearOfStudy.trim() || undefined,
          phone: phone.trim() || undefined,
          institutionName: institutionName.trim() || undefined,
        },
      };

      if (event.isPaid) {
        const checkoutSession = await externalCheckout(
          event.id,
          {
            name: name.trim(),
            rollNumber: rollNumber.trim() || undefined,
            email: email.trim().toLowerCase(),
            department: department.trim() || undefined,
            gender: gender.trim() || undefined,
            yearOfStudy: yearOfStudy.trim() || undefined,
            phone: phone.trim() || undefined,
            institutionName: institutionName.trim() || undefined,
            formAnswers: {
              ...formAnswers,
              rollNumber: rollNumber.trim() || undefined,
              name: name.trim(),
              email: email.trim().toLowerCase(),
              department: department.trim() || undefined,
              gender: gender.trim() || undefined,
              yearOfStudy: yearOfStudy.trim() || undefined,
              phone: phone.trim() || undefined,
              institutionName: institutionName.trim() || undefined,
            },
            returnUrl: window.location.href,
          },
          token
        );

        await launchPaymentCheckout({
          session: checkoutSession,
          participant: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || undefined,
          },
          onSuccess: async (verifyPayload) => {
            const verifyRes = await externalVerifyPayment(event.id, verifyPayload, token);
            if (verifyRes.success && verifyRes.registration) {
              setSuccessData(verifyRes.registration);
              setStep('CONFIRMATION');
              onSuccess(verifyRes.registration);
            } else {
              setErrorMessage(
                verifyRes.message || 'Payment is processing. You will receive an email receipt once confirmed.'
              );
            }
          },
          onFailure: (err) => {
            setErrorMessage(err.message);
          },
          onDismiss: () => {
            setErrorMessage('Payment was cancelled. Your seat reservation will expire in 15 minutes if not completed.');
          },
        });
        return;
      }

      const regRes = await registerExternalParticipant(event.id, input, token);

      setSuccessData(regRes.registration);
      setStep('CONFIRMATION');
      onSuccess(regRes.registration);
    } catch (err: unknown) {
      const status = (err as { status?: number; response?: { status?: number; data?: { message?: string } } })?.status ||
                     (err as { response?: { status?: number } })?.response?.status;
      const serverMessage =
        (err as { message?: string })?.message ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;

      if (status === 401) {
        setErrorMessage('Invalid or expired verification code. Please check and try again.');
      } else if (status === 429) {
        setErrorMessage('Too many attempts. Please request a new verification code.');
      } else if (status === 409) {
        // Recovery scenario: participant previously registered and reverified email
        if (serverMessage && serverMessage.includes('already registered')) {
          try {
            const existingStatus = await getExternalRegistrationStatus(event.id);
            if (existingStatus.isRegistered && existingStatus.registration) {
              setSuccessData(existingStatus.registration);
              setStep('CONFIRMATION');
              onSuccess(existingStatus.registration);
              return;
            }
          } catch {}
        }
        setErrorMessage(serverMessage || 'You are already registered or event capacity has been reached.');
      } else if (status === 400) {
        setErrorMessage(serverMessage || 'Registration for this event is currently closed.');
      } else {
        setErrorMessage(serverMessage || 'Failed to complete registration. Please try again.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto"
      onClick={() => {
        if (!isRequestingOtp && !isVerifying) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="external-guest-dialog-title"
    >
      <div
        className={`relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border transition-all animate-in fade-in zoom-in-95 duration-200 ${
          isDark
            ? 'bg-slate-900 border-slate-800 text-white shadow-black/80'
            : 'bg-white border-slate-200 text-[#0F172A] shadow-slate-300/60'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-5 border-b ${
            isDark ? 'border-white/10 bg-slate-950/40' : 'border-[#E8E6DF] bg-slate-50/70'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#FF5733]/10 text-[#FF5733] border border-[#FF5733]/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="external-guest-dialog-title"
                className="font-['Syne',sans-serif] text-lg font-black tracking-tight"
              >
                {step === 'CONFIRMATION'
                  ? 'Registration Confirmed!'
                  : 'Guest Event Registration'}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {step === 'DETAILS' && 'Enter your details to receive a verification code'}
                {step === 'OTP' && `Verifying ${email}`}
                {step === 'CONFIRMATION' && 'Your pass is confirmed'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isRequestingOtp || isVerifying}
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-40 ${
              isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500'
            }`}
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {/* Global Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* STEP 1: PARTICIPANT DETAILS */}
          {step === 'DETAILS' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center justify-between">
                <div>
                  <span className="font-bold">Registering for: </span>
                  <span className="font-semibold">{event.title}</span>
                </div>
                {event.isPaid ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold font-mono">
                    ₹{event.fee || 0}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
                    Free RSVP
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-2xl border text-sm font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-slate-950 border-white/10 focus:border-[#FF5733] text-white'
                        : 'bg-white border-[#E2E0D5] focus:border-[#FF5733] text-[#0F172A]'
                    }`}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  We will send a 6-digit one-time code to verify your identity.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your legal or display name"
                    className={`w-full pl-10 pr-4 py-2.5 rounded-2xl border text-sm font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-slate-950 border-white/10 focus:border-[#FF5733] text-white'
                        : 'bg-white border-[#E2E0D5] focus:border-[#FF5733] text-[#0F172A]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Roll No / Student ID <span className="text-[#FF5733]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. 21CS101"
                    className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-slate-950 border-white/10 focus:border-[#FF5733] text-white'
                        : 'bg-white border-[#E2E0D5] focus:border-[#FF5733] text-[#0F172A]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Department <span className="text-[#FF5733]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-slate-950 border-white/10 focus:border-[#FF5733] text-white'
                        : 'bg-white border-[#E2E0D5] focus:border-[#FF5733] text-[#0F172A]'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Gender <span className="text-[#FF5733]">*</span>
                  </label>
                  <select
                    required
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-slate-950 border-white/10 focus:border-[#FF5733] text-white'
                        : 'bg-white border-[#E2E0D5] focus:border-[#FF5733] text-[#0F172A]'
                    }`}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Year of Study <span className="text-[#FF5733]">*</span>
                  </label>
                  <select
                    required
                    value={yearOfStudy}
                    onChange={(e) => setYearOfStudy(e.target.value)}
                    className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-medium outline-none transition-all ${
                      isDark
                        ? 'bg-slate-950 border-white/10 focus:border-[#FF5733] text-white'
                        : 'bg-white border-[#E2E0D5] focus:border-[#FF5733] text-[#0F172A]'
                    }`}
                  >
                    <option value="">Select Year</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                    <option value="Post Graduate">Post Graduate</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Phone Number <span className="text-[#FF5733]">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 9876543210"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-2xl border text-sm font-medium outline-none transition-all ${
                        isDark
                          ? 'bg-slate-950 border-white/10 focus:border-[#FF5733] text-white'
                          : 'bg-white border-[#E2E0D5] focus:border-[#FF5733] text-[#0F172A]'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    College / Institution <span className="text-[#FF5733]">*</span>
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                      placeholder="University / College"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-2xl border text-sm font-medium outline-none transition-all ${
                        isDark
                          ? 'bg-slate-950 border-white/10 focus:border-[#FF5733] text-white'
                          : 'bg-white border-[#E2E0D5] focus:border-[#FF5733] text-[#0F172A]'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Custom Form Fields if defined */}
              {event.customFormDefinition?.fields && Array.isArray(event.customFormDefinition.fields) && event.customFormDefinition.fields.length > 0 && (
                <div className="pt-2 border-t border-white/10 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#FF5733]">
                    Additional Organizer Questions
                  </p>
                  {event.customFormDefinition.fields.map((field) => {
                    const fieldKey = field.id || field.name;
                    if (!fieldKey) return null;
                    return (
                      <div key={fieldKey}>
                        <label className="block text-xs font-bold text-slate-300 mb-1">
                          {field.label || fieldKey} {field.required && <span className="text-rose-500">*</span>}
                        </label>
                        {field.type === 'SELECT' && Array.isArray(field.options) ? (
                          <select
                            value={String(formAnswers[fieldKey] || '')}
                            onChange={(e) => setFormAnswers((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                            className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm outline-none transition ${
                              isDark ? 'bg-slate-950 border-white/10 text-white' : 'bg-white border-[#E2E0D5] text-[#0F172A]'
                            }`}
                          >
                            <option value="">Select an option...</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type === 'NUMBER' ? 'number' : 'text'}
                            value={String(formAnswers[fieldKey] || '')}
                            onChange={(e) => setFormAnswers((prev) => ({ ...prev, [fieldKey]: e.target.value }))}
                            placeholder={field.placeholder || ''}
                            className={`w-full px-3.5 py-2.5 rounded-2xl border text-sm outline-none transition ${
                              isDark ? 'bg-slate-950 border-white/10 text-white' : 'bg-white border-[#E2E0D5] text-[#0F172A]'
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isRequestingOtp}
                  className="w-full py-3 px-6 rounded-2xl bg-[#FF5733] hover:bg-[#e04826] text-white font-bold text-sm tracking-wide shadow-lg shadow-[#FF5733]/25 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {isRequestingOtp ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Verification Code...
                    </>
                  ) : (
                    <>
                      Send Verification Code
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: ENTER OTP */}
          {step === 'OTP' && (
            <form onSubmit={handleVerifyAndRegister} className="space-y-5">
              <div className="text-center space-y-1.5">
                <p className="text-xs text-slate-400">
                  Please enter the 6-digit code sent to:
                </p>
                <p className="text-sm font-bold text-[#FF5733]">{email}</p>
              </div>

              {/* 6-Digit Segmented Input */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 py-2">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    aria-label={`Digit ${idx + 1}`}
                    className={`w-11 h-14 sm:w-12 sm:h-14 text-center text-xl font-black rounded-2xl border transition-all outline-none ${
                      isDark
                        ? 'bg-slate-950 border-white/10 focus:border-[#FF5733] focus:ring-2 focus:ring-[#FF5733]/30 text-white'
                        : 'bg-slate-50 border-[#E2E0D5] focus:border-[#FF5733] focus:ring-2 focus:ring-[#FF5733]/20 text-[#0F172A]'
                    }`}
                  />
                ))}
              </div>

              {/* Resend Cooldown and Back Link */}
              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => setStep('DETAILS')}
                  className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition font-medium cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Edit details
                </button>

                <div className="text-right">
                  {cooldown > 0 ? (
                    <span className="text-slate-400 font-mono">
                      Resend code in {cooldown}s
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isRequestingOtp || isVerifying}
                      onClick={handleResendOtp}
                      className="text-[#FF5733] hover:underline font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRequestingOtp ? 'animate-spin' : ''}`} />
                      Resend Code
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isVerifying || otpDigits.join('').length !== 6}
                  className="w-full py-3 px-6 rounded-2xl bg-[#FF5733] hover:bg-[#e04826] text-white font-bold text-sm tracking-wide shadow-lg shadow-[#FF5733]/25 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{event.isPaid ? 'Verifying & Securing Checkout...' : 'Verifying & Registering...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{event.isPaid ? `Verify & Pay ₹${event.fee || 0}` : 'Verify & Complete Registration'}</span>
                      {event.isPaid ? <CreditCard className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: REGISTRATION CONFIRMATION */}
          {step === 'CONFIRMATION' && successData && (
            <div className="py-4 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-black tracking-tight">
                  You are registered!
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  A confirmation email has been dispatched to{' '}
                  <span className="font-semibold text-slate-200">{email}</span>.
                </p>
              </div>

              <div
                className={`p-4 rounded-2xl border text-left text-xs space-y-2 ${
                  isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-[#E8E6DF]'
                }`}
              >
                <div className="flex justify-between">
                  <span className="text-slate-400">Event:</span>
                  <span className="font-bold text-right truncate max-w-[200px]">{event.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Participant:</span>
                  <span className="font-semibold">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Type:</span>
                  <span className="font-bold text-[#FF5733]">External Guest</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Registered At:</span>
                  <span className="text-slate-300 font-mono">
                    {new Date(successData.registeredAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-600/25 transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
