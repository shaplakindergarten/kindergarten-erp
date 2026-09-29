"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Moon, Sun, User as UserIcon, Mail, Phone, Lock,
  Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════
interface SchoolSettings {
  school_name: string | null;
  school_address: string | null;
  school_phone: string | null;
  school_logo: string | null;
}

// ═══════════════════════════════════════════════════════════
// Dark mode hook
// ═══════════════════════════════════════════════════════════
function useDarkMode() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDarkMode = stored === "dark" || (!stored && prefersDark);
    setIsDark(isDarkMode);
    if (isDarkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem("theme", newMode ? "dark" : "light");
    if (newMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  };

  return { isDark, toggleDarkMode };
}

// ═══════════════════════════════════════════════════════════
// Signup Form
// ═══════════════════════════════════════════════════════════
export default function SignupForm() {
  const router = useRouter();
  const supabase = createClient();

  // ✅ FIX: role state সম্পূর্ণ সরানো হয়েছে
  const [formData, setFormData] = React.useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    phone: "",
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState(""); // ← email preserve
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [agreedToTerms, setAgreedToTerms] = React.useState(false);

  const [schoolSettings, setSchoolSettings] = React.useState<SchoolSettings>({
    school_name: null,
    school_address: null,
    school_phone: null,
    school_logo: null,
  });

  const { isDark, toggleDarkMode } = useDarkMode();

  // ─── Load school settings ───
  React.useEffect(() => {
    const loadSchoolSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("school_settings")
          .select("school_name, school_address, school_phone, school_logo")
          .limit(1)
          .single();
        if (data && !error) setSchoolSettings(data);
      } catch (err) {
        console.error("Failed to load school settings:", err);
      }
    };
    loadSchoolSettings();
  }, [supabase]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ═══════════════════════════════════════════════════════════
  // ✅ FIX: handleSignup — role সরানো, manual profile.insert সরানো
  // ═══════════════════════════════════════════════════════════
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // ─── Validation ───
    if (!formData.email || !formData.password || !formData.fullName) {
      setError("সব required field পূরণ করুন।");
      return;
    }
    if (formData.password.length < 6) {
      setError("Password কমপক্ষে ৬ অক্ষর হতে হবে।");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Password দুটি মিলছে না।");
      return;
    }
    if (!agreedToTerms) {
      setError("Terms of Service এ সম্মতি দিন।");
      return;
    }

    setLoading(true);

    try {
      // ✅ FIX: role পাঠানো হচ্ছে না — DB trigger default 'staff' দেবে
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName.trim(),
            phone: formData.phone.trim() || null,
            // ❌ role: formData.role,  ← সরানো হয়েছে
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        if (authError.message.includes("rate limit")) {
          setError("অনেকবার চেষ্টা হয়েছে। ১ ঘণ্টা পর আবার চেষ্টা করুন।");
        } else if (authError.message.includes("User already registered")) {
          setError("এই email দিয়ে account আছে। Login করুন।");
        } else {
          setError(authError.message);
        }
        return;
      }

      if (authData.user) {
        // ✅ FIX: handle_new_user() trigger already profile তৈরি করেছে
        // Manual retry loop আর দরকার নেই
        setSubmittedEmail(formData.email.trim());
        setSuccess(true);

        // formData clear
        setFormData({
          email: "",
          password: "",
          confirmPassword: "",
          fullName: "",
          phone: "",
        });
        setAgreedToTerms(false);
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError("কিছু ভুল হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // Success Screen
  // ═══════════════════════════════════════════════════════════
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/20 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 sm:p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              অ্যাকাউন্ট তৈরি হয়েছে! 🎉
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm sm:text-base break-words">
              <strong>{submittedEmail}</strong> এ একটি confirmation link পাঠানো হয়েছে।
              <br />
              ইমেইল চেক করে অ্যাকাউন্ট verify করুন।
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push("/login")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-4 rounded-lg transition text-sm sm:text-base"
              >
                Login এ যান
              </button>
              <button
                onClick={() => setSuccess(false)}
                className="w-full text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium text-sm sm:text-base"
              >
                আরেকটি অ্যাকাউন্ট তৈরি করুন
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Main Form
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        {/* Dark Mode Toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <Sun className="h-5 w-5 text-amber-500" />
            ) : (
              <Moon className="h-5 w-5 text-slate-700" />
            )}
          </button>
        </div>

        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {schoolSettings.school_logo ? (
              <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg bg-white dark:bg-slate-800 flex items-center justify-center p-2">
                <Image
                  src={schoolSettings.school_logo}
                  alt={schoolSettings.school_name || "School Logo"}
                  width={72}
                  height={72}
                  className="object-contain w-full h-full"
                />
              </div>
            ) : (
              <div className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
                <GraduationCap className="w-12 h-12 text-white" />
              </div>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate px-2">
            {schoolSettings.school_name || "KinderERP"}
          </h1>

          {schoolSettings.school_address && (
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 truncate px-2">
              {schoolSettings.school_address}
            </p>
          )}

          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            নতুন অ্যাকাউন্ট তৈরি করুন
          </p>
        </div>

        {/* Signup Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 sm:p-8">
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 p-3 sm:p-4 rounded-md flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400 break-words">
                  {error}
                </p>
              </div>
            )}

            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                পূর্ণ নাম <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-3 text-sm sm:text-base border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="আপনার পূর্ণ নাম লিখুন"
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                ইমেইল <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-3 text-sm sm:text-base border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                ফোন নম্বর <span className="text-slate-400 text-xs">(optional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-3 text-sm sm:text-base border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="01XXXXXXXXX"
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* ✅ Role Select সম্পূর্ণ সরানো হয়েছে */}

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                পাসওয়ার্ড <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 text-sm sm:text-base border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                কমপক্ষে ৬ অক্ষর
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                পাসওয়ার্ড নিশ্চিত করুন <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-12 py-3 text-sm sm:text-base border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-3">
              <input
                id="terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 rounded"
                required
              />
              <label htmlFor="terms" className="text-sm text-slate-700 dark:text-slate-300">
                আমি{" "}
                <Link
                  href="/terms"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Terms of Service
                </Link>{" "}
                এবং{" "}
                <Link
                  href="/privacy"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  Privacy Policy
                </Link>{" "}
                এ সম্মত
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "w-full h-11 rounded-xl font-medium text-sm text-white",
                "bg-gradient-to-r from-indigo-600 to-violet-600",
                "hover:from-indigo-700 hover:to-violet-700",
                "shadow-lg shadow-indigo-500/25 transition-all",
                "disabled:opacity-60 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  অ্যাকাউন্ট তৈরি হচ্ছে...
                </>
              ) : (
                "অ্যাকাউন্ট তৈরি করুন"
              )}
            </button>

            {/* Login Link */}
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                ইতিমধ্যে অ্যাকাউন্ট আছে?{" "}
                <Link
                  href="/login"
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                >
                  লগইন করুন
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-slate-500 dark:text-slate-500 truncate px-2">
            &copy; {new Date().getFullYear()} {schoolSettings.school_name || "KinderERP"}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}