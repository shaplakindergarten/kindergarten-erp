// src/app/dashboard/layout.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/dashboard');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = (profile?.role || '').toLowerCase();

  // Student → my-profile
  if (role === 'student') {
    redirect('/my-profile');
  }

  // Unknown role → login
  if (!role || !['admin', 'teacher', 'staff', 'accountant', 'store'].includes(role)) {
    redirect('/login?error=invalid_role');
  }

  return <>{children}</>;
}