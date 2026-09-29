'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ============================================
// পাসওয়ার্ড শক্তি ক্যালকুলেটর
// ============================================
function calculateStrength(pwd: string): {
  label: string;
  color: string;
  score: number;
} {
  if (pwd.length < 6) {
    return { label: 'দুর্বল', color: 'text-red-500', score: 1 };
  }
  let score = 1;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score >= 4) return { label: 'শক্তিশালী', color: 'text-green-500', score: 4 };
  if (score >= 3) return { label: 'মধ্যম', color: 'text-yellow-500', score: 3 };
  if (score >= 2) return { label: 'মধ্যম', color: 'text-yellow-500', score: 2 };
  return { label: 'দুর্বল', color: 'text-red-500', score: 1 };
}

// ============================================
// রিসেট পাসওয়ার্ড ফর্ম
// ============================================
function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validToken, setValidToken] = useState<boolean | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // ============================================
  // Session validity check (PKCE flow aware)
  // ============================================
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        // ✅ Supabase auto-detects tokens via detectSessionInUrl: true
        // Small delay ensures URL hash/code has been processed
        const { data: { session }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error || !session?.user) {
          console.warn('[reset-password] No valid session:', error?.message);
          setValidToken(false);
          return;
        }

        setValidToken(true);
      } catch (err) {
        console.error('[reset-password] Session check error:', err);
        if (mounted) setValidToken(false);
      }
    };

    // Small delay for Supabase to process URL tokens
    const timer = setTimeout(checkSession, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    // ভ্যালিডেশন
    if (newPassword.length < 6) {
      setError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড একই হতে হবে।');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('[reset-password] Update failed:', error.message);

        if (
          error.message.toLowerCase().includes('session') ||
          error.message.toLowerCase().includes('expired')
        ) {
          setError('আপনার সেশন মেয়াদ শেষ হয়েছে। দয়া করে আবার রিসেট লিংক ব্যবহার করুন।');
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }

      // ✅ Success — Session invalidate (force fresh login)
      await supabase.auth.signOut();

      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');

      // ৩ সেকেন্ড পরে লগইন পেজে পাঠান
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      console.error('[reset-password] Unexpected:', err);
      setError('পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ইনভ্যালিড টোকেন
  // ============================================
  if (validToken === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">ইনভ্যালিড বা মেয়াদোত্তীর্ণ লিংক</h2>
            <p className="text-gray-600 mb-6">
              এই পাসওয়ার্ড রিসেট লিংকটি মেয়াদোত্তীর্ণ বা ইতিমধ্যে ব্যবহার করা হয়েছে।
              <br />
              দয়া করে আবার পাসওয়ার্ড রিসেট রিকোয়েস্ট করুন।
            </p>
            <Link
              href="/forgot-password"
              className="inline-block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition text-center"
            >
              আবার রিসেট রিকোয়েস্ট করুন
            </Link>
            <div className="mt-3">
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                ← লগইন পেজে ফিরে যান
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // লোডিং স্টেট
  // ============================================
  if (validToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">ভেরিফাই করা হচ্ছে...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // সাফল্য মেসেজ
  // ============================================
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-blue-50 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">পাসওয়ার্ড পরিবর্তন সফল! 🎉</h2>
            <p className="text-gray-600 mb-6">
              আপনার পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।
              <br />
              এখন আপনি নতুন পাসওয়ার্ড দিয়ে লগইন করতে পারবেন।
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/login')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                লগইন পেজে যান
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              স্বয়ংক্রিয়ভাবে ৩ সেকেন্ডের মধ্যে লগইন পেজে যাচ্ছেন...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // পাসওয়ার্ড শক্তি
  // ============================================
  const strength = calculateStrength(newPassword);

  // ============================================
  // রিসেট পাসওয়ার্ড ফর্ম
  // ============================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
      <div className="w-full max-w-md">
        {/* লোগো ও শিরোনাম */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg
                className="w-12 h-12 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">নতুন পাসওয়ার্ড সেট করুন</h1>
          <p className="text-gray-600 mt-2">
            আপনার নতুন পাসওয়ার্ড দিন
          </p>
        </div>

        {/* ফর্ম */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* এরর মেসেজ */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* নতুন পাসওয়ার্ড */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                নতুন পাসওয়ার্ড
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="নতুন পাসওয়ার্ড (৬+ অক্ষর)"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে</p>
            </div>

            {/* কনফার্ম পাসওয়ার্ড */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                পাসওয়ার্ড নিশ্চিত করুন
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="আবার পাসওয়ার্ড লিখুন"
                  required
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* পাসওয়ার্ড শক্তি ইন্ডিকেটর */}
            {newPassword.length > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">পাসওয়ার্ড শক্তি:</span>
                  <span className={strength.color}>{strength.label}</span>
                </div>
                <div className="w-full h-1 bg-gray-200 rounded overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      strength.score >= 4 ? 'bg-green-500' :
                      strength.score >= 2 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${Math.min((strength.score / 4) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* সাবমিট বাটন */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 ease-in-out transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  পাসওয়ার্ড পরিবর্তন হচ্ছে...
                </>
              ) : (
                'পাসওয়ার্ড পরিবর্তন করুন'
              )}
            </button>

            {/* লগইন লিংক */}
            <div className="text-center">
              <Link
                href="/login"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                ← লগইন পেজে ফিরে যান
              </Link>
            </div>
          </form>
        </div>

        {/* ফুটার */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} কিন্ডারগার্টেন ERP. সর্বস্বত্ব সংরক্ষিত।
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Suspense wrapper
// ============================================
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">লোড হচ্ছে...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}