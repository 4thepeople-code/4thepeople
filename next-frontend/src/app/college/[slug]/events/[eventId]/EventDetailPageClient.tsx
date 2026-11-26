'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useUpcomingEvents,
  usePublicEventById,
  useMyRegistrationStatus,
  useRegisterForEventMutation,
  useCancelRegistrationMutation,
  useExternalRegistrationStatus,
  useCancelExternalMutation,
  registerExternalParticipant,
} from '@/lib/api/events';
import {
  getStoredExternalToken,
  clearStoredExternalToken,
  getStoredExternalUser,
} from '@/lib/auth/tokenStorage';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import PublicLayout from '@/components/public/PublicLayout';
import GalleryLightbox from '@/components/public/GalleryLightbox';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  MapPin,
  Calendar,
  Clock,
  Share2,
  ExternalLink,
  Sparkles,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  CreditCard,
  Hourglass,
  Users,
  Plus,
  Trash2,
} from 'lucide-react';
import { launchPaymentCheckout } from '@/lib/payment/paymentSdk';
import {
  useStudentCheckoutMutation,
  useStudentVerifyPaymentMutation,
  externalCheckout,
  externalVerifyPayment,
} from '@/lib/api/payment';
import type { Event } from '@/types/models';

export interface EventDetailPageClientProps {
  slug: string;
  eventId: string;
  clubId?: string;
}

const formatDateParts = (dateString?: string) => {
  if (!dateString) return { day: 'TBA', month: 'TBA', full: 'Date TBA' };
  const dateObj = new Date(dateString);
  if (isNaN(dateObj.getTime())) return { day: 'TBA', month: 'TBA', full: 'Date TBA' };
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const full = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  return { day, month, full };
};

const formatEventTime = (startStr?: string, endStr?: string) => {
  if (!startStr) return null;
  const d = new Date(startStr);
  if (isNaN(d.getTime())) return null;
  let timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (endStr) {
    const end = new Date(endStr);
    if (!isNaN(end.getTime())) {
      const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      timeStr = `${timeStr} - ${endTime}`;
    }
  }
  return timeStr;
};

const getValidUrl = (url?: string | null) => {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

export function EventDetailPageClient({ slug, eventId, clubId: propClubId }: EventDetailPageClientProps) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { user } = useAuth();

  // Queries
  const { data: upcomingEvents = [], isLoading, isError, error, refetch } = useUpcomingEvents(slug);
  const { data: directEvent } = usePublicEventById(eventId, !upcomingEvents.some((e) => e.id === eventId));

  const registerMutation = useRegisterForEventMutation(slug);
  const cancelMutation = useCancelRegistrationMutation(slug);
  const cancelExternalMutation = useCancelExternalMutation(slug);
  const studentCheckoutMutation = useStudentCheckoutMutation();
  const studentVerifyPaymentMutation = useStudentVerifyPaymentMutation(slug);

  const [showModal, setShowModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showCrossCollegeModal, setShowCrossCollegeModal] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Standard 8 Student Registration Fields
  const [studentRollNumber, setStudentRollNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentDepartment, setStudentDepartment] = useState('');
  const [studentGender, setStudentGender] = useState('');
  const [studentYearOfStudy, setStudentYearOfStudy] = useState('');
  const [studentCollege, setStudentCollege] = useState('');
  const [studentPhone, setStudentPhone] = useState('');

  const [formAnswers, setFormAnswers] = useState<Record<string, unknown>>({});
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamMembers, setTeamMembers] = useState<Array<{ name: string; email: string; rollNumber?: string }>>([
    { name: '', email: '', rollNumber: '' },
  ]);
  const [teamValidationError, setTeamValidationError] = useState<string | null>(null);
  const [isSubmittingTeam, setIsSubmittingTeam] = useState(false);
  const [isEditingLeaderDetails, setIsEditingLeaderDetails] = useState(false);
  const [shareNotice, setShareNotice] = useState(false);
  const [activeGalleryEvent, setActiveGalleryEvent] = useState<Event | null>(null);
  const [regError, setRegError] = useState<string | null>(null);

  // External token tracking in session
  const [externalToken, setExternalToken] = useState<string | null>(null);
  useEffect(() => {
    setExternalToken(getStoredExternalToken());
  }, []);

  const event = upcomingEvents.find((e) => e.id === eventId) || directEvent || upcomingEvents[0];
  const club = event?.club;
  const clubId = propClubId || club?.id || event?.clubId;

  const teamSettings = event?.customFormDefinition?.teamSettings;
  const isTeamEvent = Boolean(teamSettings?.enabled);

  useEffect(() => {
    if (showTeamModal && teamSettings) {
      const minAdditional = Math.max(1, (teamSettings.minTeamSize || 2) - 1);
      if (teamMembers.length < minAdditional) {
        setTeamMembers(
          Array.from({ length: minAdditional }, () => ({
            name: '',
            email: '',
            rollNumber: '',
          }))
        );
      }
    }
  }, [showTeamModal, teamSettings]);

  // Pre-fill standard fields from user or external session
  useEffect(() => {
    if (user) {
      if (user.name) setStudentName(user.name);
      if (user.email) setStudentEmail(user.email);
      if (user.rollNumber) setStudentRollNumber(user.rollNumber);
      if (user.phone) setStudentPhone(user.phone);
      if (user.gender) setStudentGender(user.gender);
      if (user.yearOfStudy) setStudentYearOfStudy(user.yearOfStudy);

      const userWithCollege = user as unknown as {
        college?: { name?: string };
        collegeName?: string;
        institutionName?: string;
      };
      const cName =
        userWithCollege.college?.name ||
        userWithCollege.collegeName ||
        userWithCollege.institutionName ||
        event?.college?.name;
      if (cName) setStudentCollege(cName);

      const rawDept = (user as unknown as { department?: { name?: string } | string })?.department;
      const deptName =
        typeof rawDept === 'object' ? rawDept?.name : typeof rawDept === 'string' ? rawDept : '';
      if (deptName) setStudentDepartment(deptName);
    } else {
      const ext = getStoredExternalUser();
      if (ext) {
        if (ext.name) setStudentName(ext.name);
        if (ext.email) setStudentEmail(ext.email);
        if (ext.phone) setStudentPhone(ext.phone);
        if (ext.rollNumber) setStudentRollNumber(ext.rollNumber);
        if (ext.department) setStudentDepartment(ext.department);
        if (ext.gender) setStudentGender(ext.gender);
        if (ext.yearOfStudy) setStudentYearOfStudy(ext.yearOfStudy);
        if (ext.institutionName || ext.collegeName) {
          setStudentCollege(ext.institutionName || ext.collegeName || '');
        }
      }
    }
  }, [user, event]);

  const collegeDisplay = slug.toUpperCase();

  const { data: regStatus } = useMyRegistrationStatus(slug, eventId, Boolean(user));
  const { data: externalRegStatus } = useExternalRegistrationStatus(eventId, !user && Boolean(externalToken));

  const hostCollegeId = event?.collegeId || event?.college?.id || (event?.club as unknown as { collegeId?: string })?.collegeId;
  const isCrossCollege = Boolean(user && user.collegeId && hostCollegeId && user.collegeId !== hostCollegeId);
  const activeStatus = regStatus?.isRegistered ? regStatus : externalRegStatus?.isRegistered ? externalRegStatus : null;
  const isRegistered = Boolean(activeStatus?.isRegistered);
  const isTeamMember = Boolean(activeStatus?.isTeamMember);
  const isTeamLeader = Boolean(activeStatus?.isLeader);
  const registeredTeamName = activeStatus?.teamName;

  const isDeadlinePassed = Boolean(
    event?.registrationDeadline && new Date() > new Date(event.registrationDeadline)
  );

  const dateInfo = formatDateParts(event?.startAt || event?.startDate || event?.date);
  const eventTime = formatEventTime(
    event?.startAt || event?.startDate || event?.date,
    event?.endAt || event?.endDate
  );

  const rawRegistrationUrl =
    event?.registrationUrl || event?.url || event?.formUrl || event?.link || event?.externalUrl;
  const validRegistrationUrl = getValidUrl(rawRegistrationUrl);

  const executePaidCheckout = async (submittedAnswers?: Record<string, unknown>) => {
    if (!event?.id || !user) return;
    if (isDeadlinePassed) {
      setRegError('Registration deadline has passed for this event.');
      return;
    }
    try {
      setIsCheckingOut(true);
      setRegError(null);

      const session = await studentCheckoutMutation.mutateAsync({
        eventId: event.id,
        formAnswers: submittedAnswers,
        returnUrl: window.location.href,
      });

      await launchPaymentCheckout({
        session,
        participant: {
          name: user.name || 'Student Participant',
          email: user.email,
          phone: (user as unknown as { phone?: string })?.phone || undefined,
        },
        onSuccess: async (verifyPayload) => {
          const verifyRes = await studentVerifyPaymentMutation.mutateAsync({
            eventId: event.id,
            payload: verifyPayload,
          });

          if (verifyRes.success && verifyRes.registration) {
            setShowModal(true);
          } else {
            router.push(
              `/college/${slug}/events/${event.id}/payment/status?transactionId=${session.transactionId}`
            );
          }
        },
        onFailure: (err) => {
          setRegError(err.message);
        },
        onDismiss: () => {
          setRegError('Checkout cancelled. You may complete your registration within 15 minutes before the seat reservation expires.');
        },
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to initiate payment checkout.');
      setRegError(msg);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const executeExternalRegistration = async (submittedAnswers?: Record<string, unknown>) => {
    if (!event?.id) return;
    if (isDeadlinePassed) {
      setRegError('Registration deadline has passed for this event.');
      return;
    }
    const activeToken = externalToken || getStoredExternalToken();
    if (!activeToken) {
      const returnPath = `/college/${slug}/events/${eventId}`;
      router.push(`/college/${slug}/login?returnUrl=${encodeURIComponent(returnPath)}&type=external`);
      return;
    }

    const storedUser = getStoredExternalUser();
    const ans = submittedAnswers || {};
    const participantName = (typeof ans.name === 'string' && ans.name) || studentName || user?.name || storedUser?.name || 'Guest Participant';
    const participantEmail = (typeof ans.email === 'string' && ans.email) || studentEmail || user?.email || storedUser?.email || '';
    const participantRollNumber = (typeof ans.rollNumber === 'string' && ans.rollNumber) || studentRollNumber || undefined;
    const participantDepartment = (typeof ans.department === 'string' && ans.department) || studentDepartment || undefined;
    const participantGender = (typeof ans.gender === 'string' && ans.gender) || studentGender || undefined;
    const participantYearOfStudy = (typeof ans.yearOfStudy === 'string' && ans.yearOfStudy) || studentYearOfStudy || undefined;
    const participantPhone = (typeof ans.phone === 'string' && ans.phone) || studentPhone || storedUser?.phone || undefined;
    const participantInstitution = (typeof ans.institutionName === 'string' && ans.institutionName) || (typeof ans.collegeName === 'string' && ans.collegeName) || studentCollege || storedUser?.institutionName || undefined;

    try {
      setRegError(null);
      setIsCheckingOut(true);

      if (event.isPaid) {
        const checkoutSession = await externalCheckout(
          event.id,
          {
            name: participantName,
            rollNumber: participantRollNumber,
            email: participantEmail,
            department: participantDepartment,
            gender: participantGender,
            yearOfStudy: participantYearOfStudy,
            phone: participantPhone,
            institutionName: participantInstitution,
            collegeName: participantInstitution,
            formAnswers: submittedAnswers,
            returnUrl: window.location.href,
          },
          activeToken
        );

        await launchPaymentCheckout({
          session: checkoutSession,
          participant: {
            name: participantName,
            email: participantEmail,
            phone: participantPhone,
          },
          onSuccess: async (verifyPayload) => {
            const verifyRes = await externalVerifyPayment(event.id, verifyPayload, activeToken);
            if (verifyRes.success && verifyRes.registration) {
              setShowModal(true);
            } else {
              router.push(
                `/college/${slug}/events/${event.id}/payment/status?transactionId=${checkoutSession.transactionId}`
              );
            }
          },
          onFailure: (err) => {
            setRegError(err.message);
          },
          onDismiss: () => {
            setRegError('Checkout cancelled. You may complete your registration within 15 minutes before the seat reservation expires.');
          },
        });
        return;
      }

      // Free external registration
      const regRes = await registerExternalParticipant(
        event.id,
        {
          name: participantName,
          rollNumber: participantRollNumber,
          email: participantEmail,
          department: participantDepartment,
          gender: participantGender,
          yearOfStudy: participantYearOfStudy,
          phone: participantPhone,
          institutionName: participantInstitution,
          collegeName: participantInstitution,
          formAnswers: submittedAnswers,
        },
        activeToken
      );

      if (regRes.success) {
        setShowModal(true);
      }
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to register for event.');
      setRegError(msg);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleRegister = async () => {
    if (validRegistrationUrl) {
      window.open(validRegistrationUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (isDeadlinePassed) {
      setRegError('Registration deadline has passed for this event.');
      return;
    }

    // 1. Unauthenticated visitor (neither student nor external session)
    if (!user && !externalToken) {
      const returnPath = `/college/${slug}/events/${eventId}`;
      const loginUrl =
        event?.visibility === 'PUBLIC'
          ? `/college/${slug}/login?returnUrl=${encodeURIComponent(returnPath)}&type=external`
          : `/college/${slug}/login?returnUrl=${encodeURIComponent(returnPath)}`;
      router.push(loginUrl);
      return;
    }

    if (!event?.id) return;

    // Check visibility permissions
    const isExternalParticipant = user?.role === 'EXTERNAL' || (!user && Boolean(externalToken));
    if ((isExternalParticipant || isCrossCollege) && event.visibility !== 'PUBLIC') {
      setRegError('This event is exclusive to students of this institution.');
      return;
    }

    // Populate registration form fields from known session before showing modal
    if (user) {
      if (user.name) setStudentName((prev) => prev || user.name || '');
      if (user.email) setStudentEmail((prev) => prev || user.email || '');
      if (user.rollNumber) setStudentRollNumber((prev) => prev || user.rollNumber || '');
      const userWithCollege = user as unknown as { college?: { name?: string }; collegeName?: string };
      const cName = userWithCollege.college?.name || userWithCollege.collegeName || event?.college?.name;
      if (cName) setStudentCollege((prev) => prev || cName || '');
      const userDept = (user as unknown as { department?: { name?: string } })?.department?.name;
      if (userDept) setStudentDepartment((prev) => prev || userDept || '');
    } else {
      const ext = getStoredExternalUser();
      if (ext) {
        if (ext.name) setStudentName((prev) => prev || ext.name || '');
        if (ext.email) setStudentEmail((prev) => prev || ext.email || '');
        if (ext.institutionName) setStudentCollege((prev) => prev || ext.institutionName || '');
        if (ext.phone) setStudentPhone((prev) => prev || ext.phone || '');
      }
    }

    // 2. Team event registration flow
    if (isTeamEvent) {
      setShowTeamModal(true);
      return;
    }

    // 3. Cross-college student confirmation
    if (isCrossCollege) {
      setShowCrossCollegeModal(true);
      return;
    }

    // 4. Custom organizer questions if present on event
    const hasCustomQuestions = Boolean(
      event?.customFormDefinition?.fields && event.customFormDefinition.fields.length > 0
    );
    if (hasCustomQuestions) {
      setShowFormModal(true);
      return;
    }

    // 5. 1-Click Instant RSVP (Student details are permanently saved on account)
    await executeDirectRegistration({});
  };

  const handleConfirmCrossCollege = async () => {
    setShowCrossCollegeModal(false);
    const hasCustomQuestions = Boolean(
      event?.customFormDefinition?.fields && event.customFormDefinition.fields.length > 0
    );
    if (hasCustomQuestions) {
      setShowFormModal(true);
      return;
    }
    await executeDirectRegistration({});
  };

  const executeDirectRegistration = async (answers: Record<string, unknown> = {}) => {
    if (!event?.id) return;
    setFormValidationError(null);
    setRegError(null);

    const isExternalParticipant = user?.role === 'EXTERNAL' || (!user && Boolean(externalToken));
    const finalAnswers = Object.keys(answers).length > 0 ? answers : undefined;
    const payload = {
      formAnswers: finalAnswers,
    };

    if (isExternalParticipant) {
      setShowFormModal(false);
      await executeExternalRegistration(payload);
      return;
    }

    if (event.isPaid) {
      setShowFormModal(false);
      await executePaidCheckout(payload);
      return;
    }

    try {
      await registerMutation.mutateAsync({
        eventId: event.id,
        formAnswers: finalAnswers,
      });
      setShowFormModal(false);
      setShowModal(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to register for event.');
      setRegError(msg);
      setFormValidationError(msg);
    }
  };

  const handleCustomFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event?.id) return;

    setFormValidationError(null);

    const fields = event.customFormDefinition?.fields || [];
    for (const f of fields) {
      const key = f.id || f.name;
      if (!key) continue;
      const val = formAnswers[key];
      if (f.required && (val === undefined || val === null || val === '')) {
        setFormValidationError(`"${f.label || key}" is required.`);
        return;
      }
    }

    await executeDirectRegistration(formAnswers);
  };

  const handleTeamFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeamValidationError(null);
    if (!event?.id) return;

    const trimmedTeamName = teamName.trim();
    if (!trimmedTeamName) {
      setTeamValidationError('Please enter a team name.');
      return;
    }

    const minSize = teamSettings?.minTeamSize || 2;
    const maxSize = teamSettings?.maxTeamSize || 10;
    const totalMembers = teamMembers.length + 1;

    if (totalMembers < minSize || totalMembers > maxSize) {
      setTeamValidationError(`Total team size must be between ${minSize} and ${maxSize} members.`);
      return;
    }

    const leaderName = user?.name || studentName.trim() || 'Leader';
    const leaderEmail = (user?.email || studentEmail || getStoredExternalUser()?.email || '').toLowerCase().trim();
    const leaderRoll = user?.rollNumber || studentRollNumber.trim() || '';
    const userWithCollege = user as unknown as { college?: { name?: string }; collegeName?: string; institutionName?: string };
    const leaderCollege = studentCollege.trim() || userWithCollege.college?.name || userWithCollege.collegeName || userWithCollege.institutionName || event?.college?.name || '';
    const rawDept = (user as unknown as { department?: { name?: string } | string })?.department;
    const userDept = typeof rawDept === 'object' ? rawDept?.name : (typeof rawDept === 'string' ? rawDept : '');
    const leaderDept = studentDepartment.trim() || userDept || '';
    const leaderGender = studentGender.trim() || user?.gender || '';
    const leaderYear = studentYearOfStudy.trim() || user?.yearOfStudy || '';
    const leaderPhone = studentPhone.trim() || user?.phone || '';

    if (!leaderRoll) {
      setIsEditingLeaderDetails(true);
      setTeamValidationError('Please enter your Roll Number / Student ID.');
      return;
    }
    if (!leaderPhone || leaderPhone.replace(/\D/g, '').length < 10) {
      setIsEditingLeaderDetails(true);
      setTeamValidationError('Please enter a valid 10-digit Phone Number.');
      return;
    }
    if (!leaderDept) {
      setIsEditingLeaderDetails(true);
      setTeamValidationError('Please specify your Department.');
      return;
    }
    if (!leaderGender) {
      setIsEditingLeaderDetails(true);
      setTeamValidationError('Please select your Gender.');
      return;
    }
    if (!leaderYear) {
      setIsEditingLeaderDetails(true);
      setTeamValidationError('Please select your Year of Study.');
      return;
    }
    if (!leaderCollege) {
      setIsEditingLeaderDetails(true);
      setTeamValidationError('Please specify your College / Institution.');
      return;
    }

    const emailSet = new Set<string>();
    if (leaderEmail) emailSet.add(leaderEmail);

    for (let i = 0; i < teamMembers.length; i++) {
      const m = teamMembers[i];
      const mName = m.name.trim();
      const mEmail = m.email.trim().toLowerCase();

      if (!mName) {
        setTeamValidationError(`Teammate #${i + 2} name is required.`);
        return;
      }
      if (!mEmail) {
        setTeamValidationError(`Teammate #${i + 2} email is required.`);
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(mEmail)) {
        setTeamValidationError(`Teammate #${i + 2} email "${mEmail}" is invalid.`);
        return;
      }
      if (emailSet.has(mEmail)) {
        setTeamValidationError(
          mEmail === leaderEmail
            ? `Teammate #${i + 2} email cannot be the same as the team leader's email.`
            : `Duplicate teammate email found: "${mEmail}".`
        );
        return;
      }
      emailSet.add(mEmail);
    }

    // Custom form questions validation
    const fields = event.customFormDefinition?.fields || [];
    for (const f of fields) {
      const key = f.id || f.name;
      if (!key) continue;
      const val = formAnswers[key];
      if (f.required && (val === undefined || val === null || val === '')) {
        setTeamValidationError(`"${f.label || key}" is required.`);
        return;
      }
    }

    const teamPayload = {
      rollNumber: leaderRoll,
      name: leaderName,
      email: leaderEmail,
      department: leaderDept,
      gender: leaderGender,
      yearOfStudy: leaderYear,
      collegeName: leaderCollege,
      institutionName: leaderCollege,
      phone: leaderPhone,
      isTeamRegistration: true,
      teamName: trimmedTeamName,
      teamSize: totalMembers,
      teamLeader: {
        name: leaderName,
        email: leaderEmail,
        rollNumber: leaderRoll || null,
        phone: leaderPhone || null,
        department: leaderDept || null,
        gender: leaderGender || null,
        yearOfStudy: leaderYear || null,
        collegeName: leaderCollege || null,
      },
      teamMembers: teamMembers.map((m) => ({
        name: m.name.trim(),
        email: m.email.trim().toLowerCase(),
        rollNumber: m.rollNumber?.trim() || null,
      })),
      formAnswers: {
        ...formAnswers,
        rollNumber: leaderRoll,
        name: leaderName,
        email: leaderEmail,
        department: leaderDept,
        gender: leaderGender,
        yearOfStudy: leaderYear,
        collegeName: leaderCollege,
        institutionName: leaderCollege,
        phone: leaderPhone,
        isTeamRegistration: true,
        teamName: trimmedTeamName,
        teamSize: totalMembers,
        teamLeader: {
          name: leaderName,
          email: leaderEmail,
          rollNumber: leaderRoll || null,
          phone: leaderPhone || null,
          department: leaderDept || null,
          gender: leaderGender || null,
          yearOfStudy: leaderYear || null,
          collegeName: leaderCollege || null,
        },
        teamMembers: teamMembers.map((m) => ({
          name: m.name.trim(),
          email: m.email.trim().toLowerCase(),
          rollNumber: m.rollNumber?.trim() || null,
        })),
      },
    };

    const isExternalParticipant = user?.role === 'EXTERNAL' || (!user && Boolean(externalToken));
    if (isExternalParticipant) {
      setShowTeamModal(false);
      await executeExternalRegistration(teamPayload);
      return;
    }

    if (event.isPaid) {
      setShowTeamModal(false);
      await executePaidCheckout(teamPayload);
      return;
    }

    try {
      setIsSubmittingTeam(true);
      await registerMutation.mutateAsync({
        eventId: event.id,
        formAnswers: teamPayload,
      });
      setShowTeamModal(false);
      setShowModal(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to register team.');
      setTeamValidationError(msg);
    } finally {
      setIsSubmittingTeam(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!event?.id) return;
    try {
      setRegError(null);
      if (user) {
        await cancelMutation.mutateAsync(event.id);
      } else if (externalRegStatus?.isRegistered) {
        await cancelExternalMutation.mutateAsync({ eventId: event.id });
        clearStoredExternalToken();
        setExternalToken(null);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Failed to cancel registration.');
      setRegError(msg);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: event?.title || 'Campus Event',
          text: `Check out ${event?.title} organized by ${club?.name || 'campus clubs'} on 4 THE PEOPLE!`,
          url: window.location.href,
        });
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error(err);
        }
      }
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setShareNotice(true);
        setTimeout(() => setShareNotice(false), 2500);
      }
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <PublicLayout collegeSlug={slug} collegeName={collegeDisplay}>
      <div className="py-8 sm:py-12 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        {/* Back Link & Share Notification Bar */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/college/${slug}`}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold uppercase transition cursor-pointer ${
              isDark
                ? 'bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-white/20'
                : 'bg-white border border-slate-200 text-slate-700 hover:text-slate-900 shadow-2xs hover:border-slate-300'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>

          {shareNotice && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-[#00F0FF] animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Event link copied to clipboard!</span>
            </div>
          )}
        </div>

        {/* Error State */}
        {isError && (
          <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-3xl text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h2 className={`text-xl font-extrabold font-['Syne',sans-serif] ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
              Event Not Available
            </h2>
            <p className="text-sm text-red-300">
              {error instanceof Error ? error.message : 'Failed to load event details.'}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-5 py-2.5 bg-red-500/20 text-red-200 rounded-full text-xs font-bold uppercase cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div
            className={`h-[420px] rounded-3xl animate-pulse border ${
              isDark ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'
            }`}
          />
        )}

        {/* Event Main Content */}
        {!isLoading && !isError && event && (
          <>
            <div
              className={`rounded-3xl border overflow-hidden p-6 sm:p-8 lg:p-10 transition-colors ${
                isDark ? 'bg-[#12141C] border-white/15 shadow-2xl' : 'bg-white border-slate-200 shadow-md'
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
                {/* Left Column (Information First) */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-[#00F0FF] text-[11px] font-black uppercase tracking-wider">
                        {event.category || 'CAMPUS EVENT'}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                        REGISTRATION OPEN
                      </span>
                      {event.visibility === 'PUBLIC' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase tracking-wider">
                          <Globe className="w-3.5 h-3.5" />
                          <span>Public Event</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/15 border border-slate-500/30 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-wider">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>College Only</span>
                        </span>
                      )}
                      {club?.name && (
                        <Link
                          href={`/college/${slug}/clubs/${clubId}`}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition ${
                            isDark
                              ? 'bg-white/5 hover:bg-white/10 text-gray-300'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5 text-cyan-500" />
                          <span>{club.name}</span>
                        </Link>
                      )}

                      {isTeamEvent && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold uppercase tracking-wider">
                          <Users className="w-3.5 h-3.5" />
                          <span>Team Event ({teamSettings?.minTeamSize}–{teamSettings?.maxTeamSize} Members)</span>
                        </span>
                      )}

                      {event.isPaid ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs font-bold uppercase tracking-wider">
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>
                            Fee: ₹{event.fee || 0}
                            {isTeamEvent && (teamSettings?.feeModel === 'PER_MEMBER' ? ' / member' : ' / team')}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-[#00F0FF] border border-cyan-500/20 text-xs font-bold uppercase tracking-wider">
                          <span>{isTeamEvent ? 'Free Team Registration' : 'Free RSVP'}</span>
                        </span>
                      )}
                    </div>

                    <h1
                      className={`font-['Syne',sans-serif] text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight leading-[1.05] ${
                        isDark ? 'text-white' : 'text-[#0F172A]'
                      }`}
                    >
                      {event.title}
                    </h1>

                    <p className={`text-xs sm:text-sm font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                      Presented by{' '}
                      {club?.name ? (
                        <Link
                          href={`/college/${slug}/clubs/${clubId}`}
                          className="text-cyan-600 dark:text-[#00F0FF] hover:underline font-bold"
                        >
                          {club.name}
                        </Link>
                      ) : (
                        <span className="font-bold text-cyan-500">{collegeDisplay} Clubs</span>
                      )}
                    </p>
                  </div>

                  {/* Date, Time, Location Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                        isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-500 shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Date</span>
                        <span className="font-extrabold text-sm">{dateInfo.full}</span>
                      </div>
                    </div>

                    {eventTime && (
                      <div
                        className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
                          isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 shrink-0">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Time</span>
                          <span className="font-extrabold text-sm font-mono">{eventTime}</span>
                        </div>
                      </div>
                    )}

                    <div
                      className={`sm:col-span-2 p-3.5 rounded-2xl border flex items-start gap-3 ${
                        isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="p-2 rounded-xl bg-pink-500/15 text-pink-500 shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Venue / Location</span>
                        <span className="font-extrabold text-sm">{event.venue || event.location || 'Campus Main Venue'}</span>
                      </div>
                    </div>

                    {event.registrationDeadline && (
                      <div
                        className={`sm:col-span-2 p-3.5 rounded-2xl border flex items-start gap-3 ${
                          isDeadlinePassed
                            ? 'bg-rose-500/10 border-rose-500/25 text-rose-300'
                            : isDark
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-xl shrink-0 ${
                            isDeadlinePassed
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-500 dark:text-amber-400'
                          }`}
                        >
                          <Hourglass className="w-4 h-4" />
                        </div>
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                              Registration Deadline
                            </span>
                            <span className="font-extrabold text-sm">
                              {formatDateParts(event.registrationDeadline).full} • {formatEventTime(event.registrationDeadline)}
                            </span>
                          </div>
                          {isDeadlinePassed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider">
                              Registration Closed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                              Registration Open
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action CTA Buttons */}
                  <div className="pt-2 flex flex-col gap-2.5">
                    {/* Visitor Context Banners */}
                    {isCrossCollege && event.visibility === 'PUBLIC' && (
                      <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2.5">
                        <Globe className="w-4 h-4 shrink-0 text-indigo-400" />
                        <span>Inter-College Event: Open to students from other campuses.</span>
                      </div>
                    )}
                    {isCrossCollege && event.visibility !== 'PUBLIC' && (
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>Restricted Event: Open only to students of {event.college?.name || slug.toUpperCase()}.</span>
                      </div>
                    )}
                    {!user && (event.visibility === 'PUBLIC' || !event.visibility) && (
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span>Guest & External Registration open for this event</span>
                        </span>
                        <Link
                          href={`/college/${slug}/login?returnUrl=${encodeURIComponent(`/college/${slug}/events/${eventId}`)}`}
                          className="text-[#00F0FF] hover:underline font-bold text-[11px] shrink-0"
                        >
                          Student Login
                        </Link>
                      </div>
                    )}

                    {regError && (
                      <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs font-semibold text-red-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{regError}</span>
                      </div>
                    )}
                    {isRegistered && isTeamMember && (
                      <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200 flex items-start gap-3">
                        <Users className="w-5 h-5 text-[#00F0FF] shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold text-[#00F0FF]">
                            Team Membership: {registeredTeamName || 'Team'}
                          </p>
                          <p className="text-[11px] text-gray-300 leading-relaxed">
                            You are registered as a team member. Team Leader:{' '}
                            <span className="font-semibold text-white">
                              {activeStatus?.teamLeader?.name || 'Leader'}
                            </span>{' '}
                            {activeStatus?.teamLeader?.email ? `(${activeStatus.teamLeader.email})` : ''}.
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Only the team leader can modify or cancel this team registration.
                          </p>
                        </div>
                      </div>
                    )}

                    {isRegistered && isTeamLeader && (
                      <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-3">
                        <Users className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold text-purple-300">
                            Team Leader: {registeredTeamName || 'Team'}
                          </p>
                          <p className="text-[11px] text-gray-300 leading-relaxed">
                            You registered this team with{' '}
                            <span className="font-semibold text-white">
                              {activeStatus?.teamSize || (activeStatus?.teamMembers?.length ? activeStatus.teamMembers.length + 1 : 1)} members
                            </span>.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      {validRegistrationUrl ? (
                        <a
                          href={validRegistrationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-[200px] py-3.5 px-6 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer bg-[#00F0FF] hover:bg-[#38f2ff] text-black shadow-cyan-500/30 hover:scale-[1.01] active:scale-[0.99]"
                          title="Open official registration form"
                        >
                          <span>Register for Event</span>
                          <ExternalLink className="w-4 h-4 shrink-0" />
                        </a>
                      ) : isRegistered ? (
                        isTeamMember ? (
                          <div className="flex-1 min-w-[200px] py-3.5 px-6 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-lg bg-emerald-500 text-black flex items-center justify-center gap-2 cursor-default">
                            <Users className="w-4 h-4 shrink-0" />
                            <span>Registered with Team {registeredTeamName || ''}</span>
                          </div>
                        ) : isTeamLeader ? (
                          <div className="flex-1 flex flex-wrap items-center gap-2">
                            <div className="flex-1 min-w-[160px] py-3.5 px-6 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-lg bg-emerald-500 text-black flex items-center justify-center gap-2 cursor-default">
                              <Users className="w-4 h-4 shrink-0" />
                              <span>Team Leader: {registeredTeamName || ''}</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleCancelRegistration}
                              disabled={cancelMutation.isPending || cancelExternalMutation.isPending}
                              className="py-3 px-4 rounded-full font-bold text-xs uppercase tracking-wider border border-red-500/30 text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                              title="Cancel Team RSVP"
                            >
                              {cancelMutation.isPending || cancelExternalMutation.isPending ? 'Cancelling...' : 'Cancel Team RSVP'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-wrap items-center gap-2">
                            <div className="flex-1 min-w-[160px] py-3.5 px-6 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-lg bg-emerald-500 text-black flex items-center justify-center gap-2 cursor-default">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>RSVP Confirmed</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleCancelRegistration}
                              disabled={cancelMutation.isPending || cancelExternalMutation.isPending}
                              className="py-3 px-4 rounded-full font-bold text-xs uppercase tracking-wider border border-red-500/30 text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                              title="Cancel RSVP"
                            >
                              {cancelMutation.isPending || cancelExternalMutation.isPending ? 'Cancelling...' : 'Cancel RSVP'}
                            </button>
                          </div>
                        )
                      ) : isDeadlinePassed ? (
                        <div className="flex-1 min-w-[200px] py-3.5 px-6 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center gap-2 cursor-not-allowed">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>Registration Closed (Deadline Passed)</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRegister}
                          disabled={
                            registerMutation.isPending ||
                            isCheckingOut ||
                            studentCheckoutMutation.isPending ||
                            studentVerifyPaymentMutation.isPending ||
                            (isCrossCollege && event.visibility !== 'PUBLIC') ||
                            (event.capacity !== null &&
                              event.capacity !== undefined &&
                              (event.registeredCount || 0) >= event.capacity)
                          }
                          className={`flex-1 min-w-[200px] py-3.5 px-6 rounded-full font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            (isCrossCollege && event.visibility !== 'PUBLIC') ||
                            (event.capacity !== null &&
                              event.capacity !== undefined &&
                              (event.registeredCount || 0) >= event.capacity)
                              ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                              : 'bg-[#00F0FF] hover:bg-[#38f2ff] text-black shadow-cyan-500/30'
                          }`}
                        >
                          {registerMutation.isPending ||
                          isCheckingOut ||
                          studentCheckoutMutation.isPending ||
                          studentVerifyPaymentMutation.isPending ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>{isCheckingOut ? 'Securing Checkout...' : 'Registering...'}</span>
                            </>
                          ) : event.capacity !== null &&
                            event.capacity !== undefined &&
                            (event.registeredCount || 0) >= event.capacity ? (
                            <>
                              <AlertCircle className="w-4 h-4" />
                              <span>Event Full (Capacity Reached)</span>
                            </>
                          ) : isCrossCollege && event.visibility !== 'PUBLIC' ? (
                            <>
                              <AlertCircle className="w-4 h-4" />
                              <span>Restricted to Host College</span>
                            </>
                          ) : (
                            <>
                              <span>
                                {event.isPaid ? (
                                  isTeamEvent ? (
                                    teamSettings?.feeModel === 'PER_MEMBER' ? (
                                      `Register Team (₹${event.fee || 0}/member)`
                                    ) : (
                                      `Pay ₹${event.fee || 0} & Register Team`
                                    )
                                  ) : (
                                    `Pay ₹${event.fee || 0} & Register`
                                  )
                                ) : isTeamEvent ? (
                                  `Register Team (${teamSettings?.minTeamSize}–${teamSettings?.maxTeamSize} Members)`
                                ) : (
                                  'RSVP / Register Now'
                                )}
                              </span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleShare}
                        className={`p-3.5 rounded-full border transition cursor-pointer ${
                          isDark
                            ? 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                        }`}
                        title="Share Event Link"
                        aria-label="Share Event Link"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>

                    {validRegistrationUrl && (
                      <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium flex items-center gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        <span>Redirects to official Google Form / Registration Page</span>
                      </p>
                    )}
                  </div>

                  {/* Registration Count Note */}
                  <div className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    <span className={`font-extrabold ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                      {event.capacity !== null && event.capacity !== undefined
                        ? `${event.registeredCount ?? 0} / ${event.capacity} spots filled`
                        : `${event.registeredCount ?? 0} Students registered`}
                    </span>
                    {event.capacity !== null &&
                    event.capacity !== undefined &&
                    (event.registeredCount ?? 0) >= event.capacity
                      ? ' • Capacity Full'
                      : ' • Direct Club RSVP'}
                  </div>
                </div>

                {/* Right Column (Image Showcase + Organizer) */}
                <div className="lg:col-span-5 flex flex-col space-y-4">
                  <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-gray-900 border border-white/10 shadow-lg group">
                    <img
                      src={
                        event.coverImage?.url ||
                        event.coverUrl ||
                        event.bannerUrl ||
                        event.coverImageUrl ||
                        'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=800&auto=format&fit=crop'
                      }
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[10px] font-bold text-white border border-white/20 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>Event Poster</span>
                    </div>
                  </div>

                  {/* Host Club Card */}
                  <div
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                      isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-cyan-500/10 border border-cyan-500/20 shrink-0">
                        {club?.logo?.url ? (
                          <img
                            src={club.logo.url}
                            alt={`${club.name || 'Club'} logo`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 m-auto text-cyan-500" />
                        )}
                      </div>
                      <div className="truncate">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400">Host Club</span>
                        <span className={`block font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {club?.name || `${collegeDisplay} Club`}
                        </span>
                      </div>
                    </div>

                    {clubId && (
                      <Link
                        href={`/college/${slug}/clubs/${clubId}`}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                          isDark
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-white hover:bg-slate-200 text-slate-800 border border-slate-200'
                        }`}
                      >
                        Profile →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Description & Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div
                className={`lg:col-span-8 rounded-3xl p-6 sm:p-8 border space-y-4 ${
                  isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <h2
                  className={`font-['Syne',sans-serif] text-2xl font-extrabold uppercase ${
                    isDark ? 'text-white' : 'text-[#0F172A]'
                  }`}
                >
                  Event <span className="text-cyan-500">Description</span>
                </h2>
                <p
                  className={`text-sm leading-relaxed font-normal whitespace-pre-line ${
                    isDark ? 'text-gray-300' : 'text-slate-600'
                  }`}
                >
                  {event.description ||
                    'Join us for an incredible session organized by our active campus club. Bring your enthusiasm and collaborate with passionate peers!'}
                </p>
              </div>

              {/* Organizer Profile Card Sidebar */}
              <div
                className={`lg:col-span-4 rounded-3xl p-6 border space-y-4 ${
                  isDark ? 'bg-[#12141C] border-white/10' : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <span className="text-[10px] font-black uppercase text-cyan-500 tracking-widest">
                  About The Organizer
                </span>
                <div className="space-y-2">
                  <h3
                    className={`font-['Syne',sans-serif] text-xl font-bold ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    {club?.name || `${collegeDisplay} Organization`}
                  </h3>
                  <p className={`text-xs line-clamp-4 leading-relaxed ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    {club?.description ||
                      'Student organization committed to tech innovation, learning, and campus community events.'}
                  </p>
                </div>
                {clubId && (
                  <Link
                    href={`/college/${slug}/clubs/${clubId}`}
                    className={`block w-full text-center py-2.5 rounded-xl text-xs font-bold transition-colors ${
                      isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                    }`}
                  >
                    View Full Club Profile →
                  </Link>
                )}
              </div>
            </div>

            {/* Event Photo Gallery */}
            {event.gallery && event.gallery.length > 0 && (
              <section className="space-y-4 pt-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-cyan-500" />
                  <h2
                    className={`font-['Syne',sans-serif] text-2xl font-extrabold uppercase ${
                      isDark ? 'text-white' : 'text-[#0F172A]'
                    }`}
                  >
                    Event <span className="text-cyan-500">Gallery</span>
                  </h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {event.gallery.map((photo, idx) => (
                    <div
                      key={photo.publicId || idx}
                      onClick={() => setActiveGalleryEvent(event)}
                      className="group relative rounded-2xl overflow-hidden aspect-square bg-gray-900 border border-white/10 cursor-pointer shadow-sm hover:shadow-lg transition-all"
                    >
                      <img
                        src={photo.url}
                        alt={`Event gallery ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Sparkles className="w-6 h-6 text-cyan-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Team Registration Modal */}
      {showTeamModal && isTeamEvent && event && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`border rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl flex flex-col max-h-[90vh] ${
              isDark ? 'bg-[#12141C] border-white/15 text-white' : 'bg-white border-slate-200 text-[#0F172A]'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider">
                  Team Registration
                </span>
                <span className="text-[11px] text-slate-400 font-semibold">
                  ({teamSettings?.minTeamSize} to {teamSettings?.maxTeamSize} Members)
                </span>
              </div>
              <h3 className={`font-['Syne',sans-serif] text-xl font-extrabold uppercase ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                {event.title}
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Register your team. You will be listed as the primary team leader.
              </p>
            </div>

            {teamValidationError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs font-semibold text-red-400 flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{teamValidationError}</span>
              </div>
            )}

            <form onSubmit={handleTeamFormSubmit} className="space-y-5 overflow-y-auto pr-1 flex-1">
              {/* Team Name */}
              <div className="space-y-1.5">
                <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                  Team Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Code Commanders"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                    isDark
                      ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                  required
                />
              </div>

              {/* Leader Snapshot & Profile Card */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                    Team Leader Details (You)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      Leader
                    </span>
                    {(user || getStoredExternalUser()) && (
                      <button
                        type="button"
                        onClick={() => setIsEditingLeaderDetails((prev) => !prev)}
                        className="text-[11px] text-[#00F0FF] hover:underline cursor-pointer"
                      >
                        {isEditingLeaderDetails ? 'Done Editing' : 'Edit details'}
                      </button>
                    )}
                  </div>
                </div>

                {(user || getStoredExternalUser()) && !isEditingLeaderDetails ? (
                  <div
                    className={`p-4 rounded-2xl border transition-all ${
                      isDark ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-white/5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#00F0FF]/15 text-[#00F0FF] font-black text-xs flex items-center justify-center shrink-0">
                          {(user?.name || studentName || 'TL').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {user?.name || studentName || 'Team Leader'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {user?.email || studentEmail}
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Verified Account</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div className={`p-2 rounded-xl border ${isDark ? 'bg-[#0B0C10]/60 border-white/5' : 'bg-white border-slate-200'}`}>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Roll Number</span>
                        <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                          {studentRollNumber || user?.rollNumber || <span className="text-amber-400 italic font-normal">Click edit to add</span>}
                        </span>
                      </div>
                      <div className={`p-2 rounded-xl border ${isDark ? 'bg-[#0B0C10]/60 border-white/5' : 'bg-white border-slate-200'}`}>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Phone Number</span>
                        <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                          {studentPhone || user?.phone || <span className="text-amber-400 italic font-normal">Click edit to add</span>}
                        </span>
                      </div>
                      <div className={`p-2 rounded-xl border ${isDark ? 'bg-[#0B0C10]/60 border-white/5' : 'bg-white border-slate-200'}`}>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Department</span>
                        <span className={`font-semibold truncate block ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                          {studentDepartment || (user?.department as { name?: string })?.name || <span className="text-amber-400 italic font-normal">Click edit to add</span>}
                        </span>
                      </div>
                      <div className={`p-2 rounded-xl border ${isDark ? 'bg-[#0B0C10]/60 border-white/5' : 'bg-white border-slate-200'}`}>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Gender</span>
                        <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                          {studentGender || user?.gender || <span className="text-amber-400 italic font-normal">Click edit to add</span>}
                        </span>
                      </div>
                      <div className={`p-2 rounded-xl border ${isDark ? 'bg-[#0B0C10]/60 border-white/5' : 'bg-white border-slate-200'}`}>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Year of Study</span>
                        <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                          {studentYearOfStudy || user?.yearOfStudy || <span className="text-amber-400 italic font-normal">Click edit to add</span>}
                        </span>
                      </div>
                      <div className={`p-2 rounded-xl border ${isDark ? 'bg-[#0B0C10]/60 border-white/5' : 'bg-white border-slate-200'}`}>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">College</span>
                        <span className={`font-semibold truncate block ${isDark ? 'text-gray-200' : 'text-slate-800'}`}>
                          {studentCollege || user?.college?.name || event?.college?.name || <span className="text-amber-400 italic font-normal">Click edit to add</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Roll Number <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={studentRollNumber}
                        onChange={(e) => setStudentRollNumber(e.target.value)}
                        placeholder="e.g. 21CS101"
                        className={`w-full px-3 py-2 rounded-xl border text-xs transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                          isDark ? 'bg-[#0B0C10] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Phone Number <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={studentPhone}
                        onChange={(e) => setStudentPhone(e.target.value)}
                        placeholder="+91 9876543210"
                        className={`w-full px-3 py-2 rounded-xl border text-xs transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                          isDark ? 'bg-[#0B0C10] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Department <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={studentDepartment}
                        onChange={(e) => setStudentDepartment(e.target.value)}
                        placeholder="e.g. Computer Science"
                        className={`w-full px-3 py-2 rounded-xl border text-xs transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                          isDark ? 'bg-[#0B0C10] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Gender <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={studentGender}
                        onChange={(e) => setStudentGender(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-xs transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                          isDark ? 'bg-[#0B0C10] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
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
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Year of Study <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={studentYearOfStudy}
                        onChange={(e) => setStudentYearOfStudy(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-xs transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                          isDark ? 'bg-[#0B0C10] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
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

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        College / Institution <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={studentCollege}
                        onChange={(e) => setStudentCollege(e.target.value)}
                        placeholder="College / Institution"
                        className={`w-full px-3 py-2 rounded-xl border text-xs transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                          isDark ? 'bg-[#0B0C10] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Teammates List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                    Additional Teammates ({teamMembers.length} added)
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Total: {teamMembers.length + 1} / {teamSettings?.maxTeamSize || 10} members
                  </span>
                </div>

                <div className="space-y-3">
                  {teamMembers.map((member, idx) => {
                    const canRemove = (teamMembers.length + 1) > (teamSettings?.minTeamSize || 2);
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-2xl border space-y-2.5 relative ${
                          isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                            Member #{idx + 2}
                          </span>
                          {canRemove && (
                            <button
                              type="button"
                              onClick={() => setTeamMembers((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-rose-400 hover:text-rose-300 p-1 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                              title="Remove teammate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <input
                              type="text"
                              value={member.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTeamMembers((prev) =>
                                  prev.map((m, i) => (i === idx ? { ...m, name: val } : m))
                                );
                              }}
                              placeholder="Full Name *"
                              className={`w-full px-3 py-2 rounded-xl border text-xs transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                                isDark
                                  ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                              }`}
                              required
                            />
                          </div>
                          <div>
                            <input
                              type="email"
                              value={member.email}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTeamMembers((prev) =>
                                  prev.map((m, i) => (i === idx ? { ...m, email: val } : m))
                                );
                              }}
                              placeholder="Email Address *"
                              className={`w-full px-3 py-2 rounded-xl border text-xs transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                                isDark
                                  ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                              }`}
                              required
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              value={member.rollNumber || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTeamMembers((prev) =>
                                  prev.map((m, i) => (i === idx ? { ...m, rollNumber: val } : m))
                                );
                              }}
                              placeholder="Roll Number / Student ID (Optional)"
                              className={`w-full px-3 py-2 rounded-xl border text-xs transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                                isDark
                                  ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                                  : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {teamMembers.length + 1 < (teamSettings?.maxTeamSize || 10) && (
                  <button
                    type="button"
                    onClick={() =>
                      setTeamMembers((prev) => [...prev, { name: '', email: '', rollNumber: '' }])
                    }
                    className={`w-full py-2.5 rounded-xl border border-dashed text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isDark
                        ? 'border-white/20 text-indigo-400 hover:bg-white/5 hover:border-indigo-400'
                        : 'border-slate-300 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-500'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Teammate</span>
                  </button>
                )}
              </div>

              {/* Custom Form Questions if Defined */}
              {event.customFormDefinition?.fields && event.customFormDefinition.fields.length > 0 && (
                <div className="space-y-3 pt-3 border-t">
                  <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                    Additional Information
                  </label>
                  {event.customFormDefinition.fields.map((field, idx) => {
                    const fieldKey: string = field.id || field.name || `field_${idx}`;
                    const value = formAnswers[fieldKey] !== undefined ? String(formAnswers[fieldKey]) : '';

                    return (
                      <div key={fieldKey} className="space-y-1.5">
                        <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                          {field.label || fieldKey} {field.required && <span className="text-red-400">*</span>}
                        </label>

                        {field.type === 'SELECT' ? (
                          <select
                            value={value}
                            onChange={(e) =>
                              setFormAnswers((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                            }
                            className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                              isDark
                                ? 'bg-[#0B0C10] border-white/10 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                            required={field.required}
                          >
                            <option value="">Select an option...</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'RADIO' ? (
                          <div className="space-y-1.5 pt-1">
                            {field.options?.map((opt) => (
                              <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="radio"
                                  name={fieldKey}
                                  value={opt}
                                  checked={value === opt}
                                  onChange={(e) =>
                                    setFormAnswers((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                                  }
                                  required={field.required}
                                  className="text-cyan-500 focus:ring-cyan-500"
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            type={field.type === 'NUMBER' ? 'number' : 'text'}
                            value={value}
                            onChange={(e) =>
                              setFormAnswers((prev) => ({
                                ...prev,
                                [fieldKey]: field.type === 'NUMBER' ? Number(e.target.value) : e.target.value,
                              }))
                            }
                            placeholder={`Enter ${field.label || fieldKey}...`}
                            className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                              isDark
                                ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                            }`}
                            required={field.required}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Price Breakdown if Paid */}
              {event.isPaid && (
                <div className={`p-4 rounded-2xl border space-y-1.5 ${
                  isDark ? 'bg-purple-500/10 border-purple-500/20' : 'bg-purple-50 border-purple-200'
                }`}>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">Pricing Model:</span>
                    <span className="font-bold text-purple-400">
                      {teamSettings?.feeModel === 'PER_MEMBER' ? 'Per Member' : 'Flat per Team'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">Team Size:</span>
                    <span>{teamMembers.length + 1} members</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-purple-500/20 text-sm font-extrabold">
                    <span>Total Amount Due:</span>
                    <span className="text-purple-400 text-base font-mono">
                      ₹{teamSettings?.feeModel === 'PER_MEMBER'
                        ? (event.fee || 0) * (teamMembers.length + 1)
                        : (event.fee || 0)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t sticky bottom-0 bg-inherit pb-1">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  disabled={isSubmittingTeam || isCheckingOut || registerMutation.isPending}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition cursor-pointer ${
                    isDark ? 'bg-white/5 border-white/10 text-gray-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTeam || isCheckingOut || registerMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-[#00F0FF] hover:bg-[#38f2ff] text-black font-extrabold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingTeam || isCheckingOut || registerMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{isCheckingOut ? 'Securing Checkout...' : 'Registering Team...'}</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {event.isPaid
                          ? `Pay ₹${
                              teamSettings?.feeModel === 'PER_MEMBER'
                                ? (event.fee || 0) * (teamMembers.length + 1)
                                : (event.fee || 0)
                            } & Register Team`
                          : 'Confirm Team Registration'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Registration Form Modal */}
      {showFormModal && event && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`border rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl flex flex-col max-h-[90vh] ${
              isDark ? 'bg-[#12141C] border-white/15 text-white' : 'bg-white border-slate-200 text-[#0F172A]'
            }`}
          >
            <div className="space-y-1 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-[#00F0FF] uppercase">
                  Additional Event Questions
                </span>
                {event.isPaid ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider font-mono">
                    ₹{event.fee || 0}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                    Free RSVP
                  </span>
                )}
              </div>
              <h3 className={`font-['Syne',sans-serif] text-xl font-extrabold uppercase ${isDark ? 'text-white' : 'text-[#0F172A]'}`}>
                {event.title}
              </h3>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                Please answer the organizer questions below to complete your registration.
              </p>
            </div>

            {formValidationError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs font-semibold text-red-400 flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formValidationError}</span>
              </div>
            )}

            <form onSubmit={handleCustomFormSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Account Profile Verification Badge */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
                  isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                    Registering With Account Profile
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-bold text-sm text-[#00F0FF]">
                      {user?.name || studentName || 'Participant'}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="font-mono text-xs text-gray-300">
                      {user?.rollNumber || studentRollNumber || user?.email || studentEmail}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase">
                    Profile Linked
                  </span>
                </div>
              </div>

              {/* Additional Organizer Questions if customFormDefinition exists */}
              {event.customFormDefinition?.fields && Array.isArray(event.customFormDefinition.fields) && event.customFormDefinition.fields.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#00F0FF]">
                    Additional Organizer Questions
                  </p>
                  {event.customFormDefinition.fields.map((field, idx) => {
                    const fieldKey: string = field.id || field.name || `field_${idx}`;
                    const value = formAnswers[fieldKey] !== undefined ? String(formAnswers[fieldKey]) : '';

                    return (
                      <div key={fieldKey} className="space-y-1.5">
                        <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                          {field.label || fieldKey} {field.required && <span className="text-red-400">*</span>}
                        </label>

                        {field.type === 'SELECT' ? (
                          <select
                            value={value}
                            onChange={(e) =>
                              setFormAnswers((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                            }
                            className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                              isDark
                                ? 'bg-[#0B0C10] border-white/10 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                            required={field.required}
                          >
                            <option value="">Select an option...</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'RADIO' ? (
                          <div className="space-y-1.5 pt-1">
                            {field.options?.map((opt) => (
                              <label key={opt} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="radio"
                                  name={fieldKey}
                                  value={opt}
                                  checked={value === opt}
                                  onChange={(e) =>
                                    setFormAnswers((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                                  }
                                  required={field.required}
                                  className="text-cyan-500 focus:ring-cyan-500"
                                />
                                <span>{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <input
                            type={field.type === 'NUMBER' ? 'number' : 'text'}
                            value={value}
                            onChange={(e) =>
                              setFormAnswers((prev) => ({
                                ...prev,
                                [fieldKey]: field.type === 'NUMBER' ? Number(e.target.value) : e.target.value,
                              }))
                            }
                            placeholder={`Enter ${field.label || fieldKey}...`}
                            className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:outline-hidden focus:border-[#00F0FF] ${
                              isDark
                                ? 'bg-[#0B0C10] border-white/10 text-white placeholder-gray-600'
                                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                            }`}
                            required={field.required}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t shrink-0">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  disabled={registerMutation.isPending || isCheckingOut}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition cursor-pointer ${
                    isDark ? 'bg-white/5 border-white/10 text-gray-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registerMutation.isPending || isCheckingOut}
                  className="px-5 py-2.5 rounded-xl bg-[#00F0FF] hover:bg-[#38f2ff] text-black font-extrabold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2"
                >
                  {registerMutation.isPending || isCheckingOut ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{isCheckingOut ? 'Initiating Checkout...' : 'Submitting...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{event.isPaid ? `Proceed to Pay ₹${event.fee || 0}` : 'Confirm & Register'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Cross-College Student Confirmation Modal */}
      {showCrossCollegeModal && event && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`border rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl ${
              isDark ? 'bg-[#12141C] border-white/15 text-white' : 'bg-white border-slate-200 text-[#0F172A]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-['Syne',sans-serif] text-xl font-black uppercase">
                  Cross-College Registration
                </h3>
                <p className="text-xs text-slate-400">Inter-institutional event participation</p>
              </div>
            </div>

            <div className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-2.5 ${
              isDark ? 'bg-slate-950/60 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <p>
                You are registering as a verified student for an event organized by another institution.
              </p>
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Host Campus:</span>
                  <span className="font-bold">{event?.college?.name || slug.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Your Account:</span>
                  <span className="font-semibold">{user?.email}</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                • Your student identity details will be securely shared with the host college organizers.<br />
                • Your home institution affiliation and account remain unchanged.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCrossCollegeModal(false)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition cursor-pointer ${
                  isDark ? 'bg-white/5 border-white/10 text-gray-300 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCrossCollege}
                disabled={registerMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-[#00F0FF] hover:bg-[#38f2ff] text-black font-extrabold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2"
              >
                {registerMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Registering...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm & Register</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className={`border rounded-3xl max-w-md w-full p-8 text-center space-y-4 shadow-2xl ${
              isDark ? 'bg-[#12141C] border-white/15 text-white' : 'bg-white border-slate-200 text-[#0F172A]'
            }`}
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3
              className={`font-['Syne',sans-serif] text-2xl font-black uppercase ${
                isDark ? 'text-white' : 'text-[#0F172A]'
              }`}
            >
              RSVP Confirmed!
            </h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
              Your registration for <strong>{event?.title}</strong> is confirmed. Check your email for further instructions.
            </p>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full py-3 rounded-full bg-[#00F0FF] text-black text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Gallery Lightbox */}
      {activeGalleryEvent && (
        <GalleryLightbox event={activeGalleryEvent} onClose={() => setActiveGalleryEvent(null)} />
      )}
    </PublicLayout>
  );
}

export default EventDetailPageClient;

