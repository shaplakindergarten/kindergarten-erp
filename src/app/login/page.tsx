// src/app/login/page.tsx
import { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Login | KinderERP",
  description: "Sign in to your school management account",
};

// ✅ Role → Redirect Map (sync with login-form.tsx)
const ROLE_REDIRECT: Record<string, string> = {
  admin: "/dashboard",
  teacher: "/dashboard",
  staff: "/dashboard",
  accountant: "/fees",
  store: "/inventory",
  student: "/my-profile",
  admin_staff: "/dashboard",
  user: "/dashboard",
};

function LoginFallback() {
  return (
    <div className="min-h-screen w-full grid place-items-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        <p className="text-sm text-slate-500 dark:text-slate-400">লোড হচ্ছে...</p>
      </div>
    </div>
  );
}

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ✅ Already logged in → role-based redirect (not always /dashboard)
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile?.role || "user").toLowerCase();
    const redirectTo = ROLE_REDIRECT[role] || "/dashboard";

    redirect(redirectTo);
  }

  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}