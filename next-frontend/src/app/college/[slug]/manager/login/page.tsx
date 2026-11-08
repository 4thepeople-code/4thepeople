import { redirect } from 'next/navigation';

export interface ManagerLoginRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function ManagerLoginRedirectPage({ params }: ManagerLoginRedirectProps) {
  const { slug } = await params;
  redirect(`/college/${slug}/login/manager`);
}

