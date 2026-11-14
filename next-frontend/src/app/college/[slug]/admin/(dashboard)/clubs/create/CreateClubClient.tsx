'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Building2 } from 'lucide-react';
import { useCreateAdminClubMutation } from '@/lib/api/admin';
import { useDepartments, useReplaceClubDepartmentsMutation } from '@/lib/api/departments';
import PageHeader from '@/components/dashboard/ui/PageHeader';
import DashboardCard from '@/components/dashboard/ui/DashboardCard';
import DashboardButton from '@/components/dashboard/ui/DashboardButton';
import Field, { Input, Textarea } from '@/components/dashboard/ui/Field';
import Switch from '@/components/dashboard/ui/Switch';
import MultiSelect from '@/components/dashboard/ui/MultiSelect';
import { useToast } from '@/components/dashboard/ui/Toast';
import { actions, collegeAdmin } from '@/lib/copy';

export interface CreateClubClientProps {
  slug: string;
}

const adminPath = (slug: string, subPath: string) => `/college/${slug}/admin${subPath}`;

/**
 * Create a club, optionally central, optionally linked to Departments (the
 * links are replaced right after creation). Same hooks + id extraction
 * (`data.id || data.club.id || id || club.id`) as before.
 */
export default function CreateClubClient({ slug }: CreateClubClientProps) {
  const t = collegeAdmin.createClub;
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCentral, setIsCentral] = useState(false);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: departments = [] } = useDepartments(slug);
  const createClubMutation = useCreateAdminClubMutation(slug);
  const replaceClubDeptMutation = useReplaceClubDepartmentsMutation(slug);

  const departmentOptions = departments.map((d) => ({
    value: d.id,
    label: d.name,
    badge: d.shortCode,
  }));

  const handleCentralChange = (checked: boolean) => {
    setIsCentral(checked);
    if (checked) setSelectedDepartmentIds([]);
  };

  const isSubmitting = createClubMutation.isPending || replaceClubDeptMutation.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage(t.errNameRequired);
      return;
    }

    try {
      const res = await createClubMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        isCentral,
      });

      const resObj = res as {
        data?: { id?: string; club?: { id?: string } };
        id?: string;
        club?: { id?: string };
      };
      const newClubId = resObj.data?.id || resObj.data?.club?.id || resObj.id || resObj.club?.id;

      if (!isCentral && selectedDepartmentIds.length > 0 && newClubId) {
        await replaceClubDeptMutation.mutateAsync({
          clubId: newClubId,
          departmentIds: selectedDepartmentIds,
        });
      }

      toast(t.toastCreated, { variant: 'success' });
      router.push(adminPath(slug, newClubId ? `/clubs/${newClubId}` : '/clubs'));
    } catch (err: unknown) {
      const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setErrorMessage(serverMessage || t.errCreate);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <DashboardButton
        variant="ghost"
        size="sm"
        href={adminPath(slug, '/clubs')}
        leftIcon={<ArrowLeft aria-hidden="true" className="h-4 w-4" />}
        className="-ml-2 mb-3"
      >
        {t.back}
      </DashboardButton>

      <PageHeader role="collegeAdmin" title={t.title} description={t.description} />

      <DashboardCard>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label={t.formName} htmlFor="create-club-name" required>
            <div className="relative">
              <Building2
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-soft)]"
              />
              <Input
                id="create-club-name"
                placeholder={t.formNamePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                className="pl-9"
              />
            </div>
          </Field>

          {/* Central toggle (clears departments when on) */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4">
            <div className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-bold text-[var(--ink)]">{t.centralToggle}</span>
                <span className="mt-0.5 block text-xs text-[var(--ink-soft)]">{t.centralHint}</span>
              </span>
              <Switch
                checked={isCentral}
                onChange={handleCentralChange}
                label={t.centralToggle}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <MultiSelect
            label={t.departmentsLabel}
            options={departmentOptions}
            selectedValues={selectedDepartmentIds}
            onChange={setSelectedDepartmentIds}
            disabled={isCentral || isSubmitting}
            disabledNote={t.multiSelectDisabled}
            placeholder={isCentral ? t.multiSelectDisabled : t.multiSelectPlaceholder}
            searchPlaceholder={collegeAdmin.departments.searchPlaceholder}
          />

          <Field label={t.formDescription} htmlFor="create-club-description">
            <Textarea
              id="create-club-description"
              rows={4}
              placeholder={t.formDescriptionPlaceholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </Field>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-xl bg-[var(--secondary-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--secondary)]"
            >
              {errorMessage}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-[var(--line)] pt-4">
            <DashboardButton variant="secondary" size="sm" href={adminPath(slug, '/clubs')}>
              {actions.cancel}
            </DashboardButton>
            <DashboardButton
              type="submit"
              size="sm"
              loading={isSubmitting}
              loadingLabel={t.submitting}
              disabled={!name.trim() && !isSubmitting}
            >
              {t.submit}
            </DashboardButton>
          </div>
        </form>
      </DashboardCard>
    </div>
  );
}
