'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnerAuth } from '@/lib/owner-auth-context';

export default function RootPage() {
  const { user, isOwner, loading } = useOwnerAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && isOwner) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [user, isOwner, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
