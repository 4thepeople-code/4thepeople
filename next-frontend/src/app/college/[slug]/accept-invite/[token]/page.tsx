import React from 'react';
import AcceptInviteClient from './AcceptInviteClient';

interface PageProps {
  params: Promise<{
    slug: string;
    token: string;
  }>;
}

export default async function AcceptInvitePage({ params }: PageProps) {
  const { slug, token } = await params;

  return <AcceptInviteClient slug={slug} token={token} />;
}

