// src/app/signup/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignupClient from "./signup-client";

// ═══════════════════════════════════════════════════════════════════
// SECURITY: Public signup is BLOCKED by default
// ═══════════════════════════════════════════════════════════════════
// 
// ❌ REMOVED: IS_DEV bypass (was allowing signup in dev mode)
// 
// To temporarily allow public signup:
//   1. Add to .env.local: NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP=true
//   2. Restart the dev server
//   3. Create the accounts you need
//   4. Set back to false and restart
//
// RECOMMENDED: Keep it false and create accounts via:
//   - Staff menu (auto-creates teacher/staff/accountant/store accounts)
//   - Students menu (auto-creates student accounts)
// ═══════════════════════════════════════════════════════════════════

const ALLOW_PUBLIC_SIGNUP =
  process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true";

export const metadata = {
  title: "Sign Up | KinderERP",
};

export default async function SignupPage() {
  // 🔒 Block public signup unless explicitly enabled via env
  if (!ALLOW_PUBLIC_SIGNUP) {
    redirect(
      "/login?error=" +
        encodeURIComponent(
          "পাবলিক সাইনআপ বন্ধ আছে। নতুন একাউন্ট তৈরি করতে এডমিনের সাথে যোগাযোগ করুন।"
        )
    );
  }

  // If signup is enabled, check if user is already logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile?.role || "user").toLowerCase();
    const ROLE_REDIRECT: Record<string, string> = {
      admin: "/dashboard",
      teacher: "/dashboard",
      staff: "/dashboard",
      accountant: "/fees",
      store: "/inventory",
      student: "/my-profile",
      user: "/dashboard",
    };
    redirect(ROLE_REDIRECT[role] || "/dashboard");
  }

  return <SignupClient />;
}