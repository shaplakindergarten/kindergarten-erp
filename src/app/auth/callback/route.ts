// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function sanitizeNext(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

// ✅ Role-based default redirect
const ROLE_DEFAULT_REDIRECT: Record<string, string> = {
  admin: "/dashboard",
  teacher: "/dashboard",
  staff: "/attendance/student-leave",
  accountant: "/fees",
  store: "/inventory",
  student: "/my-profile",
  user: "/dashboard",
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const type = searchParams.get("type");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=Missing+auth+code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // Recovery flow
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  // ✅ Role-based redirect
  const { data: { user } } = await supabase.auth.getUser();
  let finalRedirect = "/dashboard";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = (profile?.role || "user").toLowerCase();
    finalRedirect = ROLE_DEFAULT_REDIRECT[role] || "/dashboard";
  }

  // URL param `next` থাকলে সেটা priority
  const explicitNext = sanitizeNext(next);
  return NextResponse.redirect(`${origin}${explicitNext || finalRedirect}`);
}