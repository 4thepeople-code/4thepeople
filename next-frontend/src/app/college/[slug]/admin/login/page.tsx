import { redirect } from 'next/navigation';

export interface AdminLoginRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminLoginRedirectPage({ params }: AdminLoginRedirectProps) {
  const { slug } = await params;
  redirect(`/college/${slug}/login/admin`);
}
