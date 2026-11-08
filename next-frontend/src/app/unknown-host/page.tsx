import React from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function UnknownHostPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <Card withFigmaShadow className="max-w-md w-full text-center">
        <Badge variant="danger" className="mb-3">
          400 • Invalid Host
        </Badge>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Unrecognized Hostname
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          The requested hostname is not a recognized tenant subdomain or authorized domain of the 4thepeople platform.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">
          Please check the URL or access via 4thepeople.in.
        </p>
      </Card>
    </div>
  );
}

