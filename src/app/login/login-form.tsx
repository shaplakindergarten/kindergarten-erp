"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GraduationCap, Mail, Lock, Eye, EyeOff, Loader2,
  AlertCircle, CheckCircle2, Users, ShieldCheck,
  Cloud, Zap, Heart, ArrowRight, School, Crown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ─── Role → Redirect Map (unchanged) ───
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

function sanitizeRedirect(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.startsWith("/\\")) return null;
  if (path.includes("://")) return null;
  if (path.includes("\\")) return null;
  return path;
}

const TRUST_ITEMS = [
  { icon: ShieldCheck, text: "নিরাপদ ডাটা সুরক্ষা" },
  { icon: Cloud, text: "ক্লাউড ভিত্তিক সিস্টেম" },
  { icon: Zap, text: "দ্রুত ও নির্ভরযোগ্য সেবা" },
  { icon: Heart, text: "শিক্ষার উন্নয়নে আমাদের অঙ্গীকার" },
] as const;

// ═══════════════════════════════════════════════════════════════
// ✅ HARDCODED SHOWCASE IMAGES
// শুধু public/showcase/ folder-এ ছবি রাখুন, path এখানে বদলান
// ═══════════════════════════════════════════════════════════════
const SHOWCASE_IMAGES = {
  founder:     "/showcase/founder.jpg",
  studentBoy:  "/showcase/student-boy.jpg",
  studentGirl: "/showcase/student-girl.jpg",
  school:      "/showcase/school.jpg",
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = React.useState(() => createClient());

  const redirectParam = sanitizeRedirect(searchParams.get("redirect"));
  const urlError = searchParams.get("error");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const [school, setSchool] = React.useState({
    name: "KinderERP",
    subtitle: "Education Suite",
    logo: null as string | null,
  });

  // ✅ Error param from URL
  React.useEffect(() => {
    if (urlError) setError(decodeURIComponent(urlError));
  }, [urlError]);

  // ✅ Load school settings (unchanged — শুধু name/address/logo)
  React.useEffect(() => {
    supabase
      .from("school_settings")
      .select("school_name, school_address, school_logo")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setSchool({
            name: data.school_name || "KinderERP",
            subtitle: data.school_address || "Education Suite",
            logo: data.school_logo || null,
          });
        }
      });
  }, [supabase]);

  // ✅ Login handler (unchanged)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (authError) {
        if (authError.message.includes("Invalid login"))
          throw new Error("ভুল ইমেইল বা পাসওয়ার্ড");
        if (authError.message.includes("Email not confirmed"))
          throw new Error("আপনার ইমেইল এখনো verify হয়নি");
        throw new Error(authError.message);
      }

      if (!authData.user) throw new Error("লগইন ব্যর্থ হয়েছে");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", authData.user.id)
        .single();

      const role = (profile?.role || "user").toLowerCase();
      const roleRedirect = ROLE_REDIRECT[role] || "/dashboard";
      const redirectTo = redirectParam || roleRedirect;

      setSuccess(`স্বাগতম, ${profile?.full_name || cleanEmail}!`);

      setTimeout(() => router.push(redirectTo), 400);
    } catch (err: any) {
      setError(err.message || "লগইন করতে সমস্যা হয়েছে");
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Hardcoded image cards (no DB, no Storage)
  const imageCards = [
    {
      key: "founder",
      label: "প্রতিষ্ঠাতা",
      sub: "Founder & Principal",
      src: SHOWCASE_IMAGES.founder,
      icon: Crown,
      accent: "from-sky-400 to-indigo-500",
    },
    {
      key: "boy",
      label: "ছেলে শিক্ষার্থী",
      sub: "Students",
      src: SHOWCASE_IMAGES.studentBoy,
      icon: Users,
      accent: "from-emerald-400 to-teal-500",
    },
    {
      key: "girl",
      label: "মেয়ে শিক্ষার্থী",
      sub: "Students",
      src: SHOWCASE_IMAGES.studentGirl,
      icon: Users,
      accent: "from-fuchsia-400 to-pink-500",
    },
    {
      key: "school",
      label: "আমাদের বিদ্যালয়",
      sub: "Campus",
      src: SHOWCASE_IMAGES.school,
      icon: School,
      accent: "from-amber-400 to-orange-500",
    },
  ];

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#070B1A] text-white">
      {/* ─── Animated Background ─── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(99,102,241,0.35),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.35),_transparent_55%),radial-gradient(ellipse_at_center,_rgba(14,165,233,0.18),_transparent_60%)]" />
        <div
          className="absolute -inset-[40%] opacity-40 mix-blend-screen animate-[spin_28s_linear_infinite]"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(59,130,246,0.0), rgba(139,92,246,0.35), rgba(236,72,153,0.0), rgba(56,189,248,0.35), rgba(59,130,246,0.0))",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.18] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.35) 1px, transparent 1px)",
            backgroundSize: "46px 46px",
            animation: "gridMove 22s linear infinite",
          }}
        />
        <div className="absolute -top-24 -left-24 h-[28rem] w-[28rem] rounded-full bg-indigo-500/30 blur-[120px] animate-[float_10s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 -right-32 h-[26rem] w-[26rem] rounded-full bg-fuchsia-500/25 blur-[120px] animate-[float_13s_ease-in-out_infinite_reverse]" />
        <div className="absolute -bottom-32 left-1/3 h-[24rem] w-[24rem] rounded-full bg-sky-500/25 blur-[120px] animate-[float_16s_ease-in-out_infinite]" />
      </div>

      <style jsx>{`
        @keyframes gridMove { 0% {background-position:0 0,0 0;} 100% {background-position:46px 46px,46px 46px;} }
        @keyframes float { 0%,100% {transform:translate3d(0,0,0) scale(1);} 50% {transform:translate3d(20px,-24px,0) scale(1.06);} }
        @keyframes fadeUp { from {opacity:0;transform:translateY(14px);} to {opacity:1;transform:translateY(0);} }
        @keyframes shimmer { 0% {background-position:-200% 0;} 100% {background-position:200% 0;} }
        .animate-fade-up { animation: fadeUp .6s ease both; }
        .animate-fade-up-slow { animation: fadeUp .9s ease both; }
      `}</style>

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:px-10 lg:py-12">
        {/* ═══ LEFT ═══ */}
        <section className="order-1 hidden flex-col justify-center lg:flex animate-fade-up">
          {/* Brand row */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-400 to-fuchsia-500 opacity-70 blur-md" />
              <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white/10 backdrop-blur-xl">
                {school.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={school.logo} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <GraduationCap className="h-7 w-7 text-white" />
                )}
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-bold tracking-tight text-white">
                {school.name}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-300">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.7)]" />
                <span className="truncate">{school.subtitle}</span>
              </div>
            </div>

            <div className="ml-auto hidden items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 backdrop-blur-xl xl:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500">
                <ShieldCheck className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="leading-tight">
                <div className="text-[11px] font-semibold text-white">স্মার্ট স্কুল</div>
                <div className="text-[10px] text-slate-300">ম্যানেজমেন্ট</div>
              </div>
            </div>
          </div>

          <div className="mt-10 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-slate-200 backdrop-blur-md">
            <Zap className="h-3.5 w-3.5 text-sky-300" />
            স্মার্ট স্কুল ERP
            <span className="mx-1 h-3 w-px bg-white/20" />
            এক প্ল্যাটফর্মে সম্পূর্ণ বিদ্যালয় ব্যবস্থাপনা
          </div>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.15] tracking-tight text-white xl:text-5xl">
            বিদ্যালয় ব্যবস্থাপনা
            <br />
            <span className="bg-gradient-to-r from-sky-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
              এখন আরও স্মার্ট ও সহজ
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-300">
            শিক্ষার্থী, শিক্ষক, অভিভাবক, প্রশাসন — সবার জন্য একটি আধুনিক,
            নিরাপদ ও কার্যকর ডিজিটাল প্ল্যাটফর্ম।
          </p>

          {/* ═══ 4 HARDCODED IMAGE CARDS ═══ */}
          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {imageCards.map(({ key, label, sub, src, icon: Icon, accent }) => (
              <div
                key={key}
                className="group relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.1]"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={label}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                  {/* Floating icon */}
                  <div
                    className={cn(
                      "absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br shadow-lg ring-1 ring-white/20",
                      accent
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>

                <div className="p-3">
                  <div className="text-[12.5px] font-semibold leading-tight text-white">
                    {label}
                  </div>
                  <div className="mt-0.5 text-[10.5px] uppercase tracking-wider text-slate-400">
                    {sub}
                  </div>
                </div>

                <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-gradient-to-br from-white/20 to-transparent opacity-0 blur-2xl transition group-hover:opacity-100" />
              </div>
            ))}
          </div>

          {/* Trust strip */}
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur-xl">
            {TRUST_ITEMS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-[12.5px] text-slate-300">
                <Icon className="h-4 w-4 text-sky-300" />
                {text}
              </div>
            ))}
          </div>

          <p className="mt-8 text-[11.5px] text-slate-400">
            © {new Date().getFullYear()} {school.name}. All rights reserved.
          </p>
        </section>

        {/* ═══ RIGHT / LOGIN CARD ═══ */}
        <section className="order-2 flex w-full items-center justify-center animate-fade-up-slow">
          <div className="relative w-full max-w-md">
            <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-sky-500/40 via-indigo-500/40 to-fuchsia-500/40 opacity-60 blur-2xl" />

            <div className="relative rounded-[1.75rem] border border-white/15 bg-white/[0.07] p-6 shadow-[0_20px_60px_-15px_rgba(59,130,246,0.5)] backdrop-blur-2xl sm:p-8">
              <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

              {/* Mobile brand */}
              <div className="mb-6 flex items-center gap-3 lg:hidden">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white/10">
                  {school.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={school.logo} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <GraduationCap className="h-5 w-5 text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-white">
                    {school.name}
                  </div>
                  <div className="truncate text-[11px] text-slate-300">
                    {school.subtitle}
                  </div>
                </div>
              </div>

              {/* Mobile image row (hardcoded) */}
              <div className="mb-6 grid grid-cols-4 gap-2 lg:hidden">
                {imageCards.map(({ key, src, icon: Icon, accent }) => (
                  <div
                    key={key}
                    className="relative aspect-square overflow-hidden rounded-xl border border-white/15 bg-white/5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <div
                      className={cn(
                        "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br ring-1 ring-white/30",
                        accent
                      )}
                    >
                      <Icon className="h-2.5 w-2.5 text-white" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Header */}
              <div className="mb-7 text-center lg:text-left">
                <h2 className="text-3xl font-extrabold tracking-tight">
                  <span className="bg-gradient-to-r from-sky-300 via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent">
                    Welcome Back
                  </span>{" "}
                  <span className="align-middle">👋</span>
                </h2>
                <p className="mt-2 text-[13px] text-slate-300">
                  আপনার অ্যাকাউন্টে প্রবেশ করতে লগইন করুন
                </p>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-400/30 bg-red-500/10 px-3.5 py-3 text-[13px] text-red-200 animate-fade-up">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-3 text-[13px] text-emerald-200 animate-fade-up">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{success}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-medium text-slate-200">
                    ইমেইল
                  </label>
                  <div className="group relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition group-focus-within:text-sky-300" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={cn(
                        "h-11 w-full rounded-xl border border-white/15 bg-white/[0.05] pl-10 pr-3 text-sm text-white",
                        "placeholder:text-slate-400/80 outline-none transition",
                        "focus:border-sky-400/60 focus:bg-white/[0.08] focus:ring-4 focus:ring-sky-500/20"
                      )}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="password" className="block text-[12.5px] font-medium text-slate-200">
                      পাসওয়ার্ড
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-[11.5px] font-medium text-sky-300 transition hover:text-sky-200"
                    >
                      পাসওয়ার্ড ভুলে গেছেন?
                    </Link>
                  </div>
                  <div className="group relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition group-focus-within:text-sky-300" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={cn(
                        "h-11 w-full rounded-xl border border-white/15 bg-white/[0.05] pl-10 pr-11 text-sm text-white",
                        "placeholder:text-slate-400/80 outline-none transition",
                        "focus:border-sky-400/60 focus:bg-white/[0.08] focus:ring-4 focus:ring-sky-500/20"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer select-none items-center gap-2.5">
                  <span className="relative flex h-4 w-4 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-white/25 bg-white/5 transition checked:border-sky-400 checked:bg-sky-500"
                    />
                    <svg
                      viewBox="0 0 16 16"
                      className="pointer-events-none absolute h-3 w-3 scale-0 text-white transition peer-checked:scale-100"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 8.5l3.2 3.2L13 5" />
                    </svg>
                  </span>
                  <span className="text-[12.5px] text-slate-300">আমাকে মনে রাখুন</span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    "group relative mt-2 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold text-white",
                    "bg-gradient-to-r from-sky-500 via-indigo-500 to-fuchsia-500",
                    "shadow-[0_10px_30px_-8px_rgba(99,102,241,0.8)] transition-all",
                    "hover:shadow-[0_14px_40px_-8px_rgba(168,85,247,0.9)]",
                    "disabled:cursor-not-allowed disabled:opacity-70"
                  )}
                >
                  <span
                    className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
                    style={{
                      background:
                        "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 2.2s linear infinite",
                    }}
                  />
                  <span className="relative flex items-center gap-2">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        লগইন হচ্ছে...
                      </>
                    ) : (
                      <>
                        লগইন করুন
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </>
                    )}
                  </span>
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/12" />
                <span className="text-[11px] text-slate-400">নিরাপদ লগইন</span>
                <span className="h-px flex-1 bg-white/12" />
              </div>

              <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                <span className="text-[11.5px] text-slate-300">
                  Secure Login — Your data is protected and encrypted
                </span>
              </div>

              <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-slate-400">
                <Link href="/privacy" className="transition hover:text-slate-200">Privacy</Link>
                <span className="h-3 w-px bg-white/15" />
                <Link href="/support" className="transition hover:text-slate-200">Support</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}