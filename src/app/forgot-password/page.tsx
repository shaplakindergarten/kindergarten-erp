'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ============================================
// ফরগট পাসওয়ার্ড ফর্ম
// ============================================
function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    if (!email.trim()) {
      setError('দয়া করে আপনার ইমেইল ঠিকানা দিন।');
      setLoading(false);
      return;
    }

    const cleanEmail = email.trim();

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        // ✅ PKCE flow: /auth/callback → /reset-password
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password&type=recovery`,
      });

      if (error) {
        console.error('[forgot-password]', error.message);

        // Rate limit হলে আলাদা message (এটা enumeration leak না)
        if (
          error.message.toLowerCase().includes('rate limit') ||
          error.message.toLowerCase().includes('too many')
        ) {
          setError('অনেক বেশি চেষ্টা করেছেন। দয়া করে কিছুক্ষণ পরে আবার চেষ্টা করুন।');
          setLoading(false);
          return;
        }
        // ✅ অন্য সব error (including "User not found") গুলো silently ignore
        // → কেউ জানে না email আছে কিনা (enumeration attack প্রতিরোধ)
      }

      // ✅ Always show success (security: user enumeration prevent)
      setSubmittedEmail(cleanEmail);
      setSuccess(true);
      setEmail('');
    } catch (err) {
      console.error('[forgot-password] Unexpected:', err);
      // Network error হলেও generic success দেখাই (security)
      setSubmittedEmail(cleanEmail);
      setSuccess(true);
      setEmail('');
    } finally {
      setLoading(false);
    }
  };

  // সাফল্য মেসেজ দেখান
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-blue-50 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">ইমেইল পাঠানো হয়েছে! 📧</h2>
            <p className="text-gray-600 mb-4">
              যদি এই ইমেইলে কোনো অ্যাকাউন্ট থাকে, তাহলে <strong>{submittedEmail}</strong> এ
              পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।
              <br />
              দয়া করে আপনার ইমেইল চেক করুন এবং লিংকে ক্লিক করে পাসওয়ার্ড পরিবর্তন করুন।
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/login')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                লগইন পেজে যান
              </button>
              <button
                onClick={() => {
                  setSuccess(false);
                  setSubmittedEmail('');
                  setEmail('');
                }}
                className="w-full text-blue-600 hover:text-blue-800 font-medium"
              >
                আবার চেষ্টা করুন
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">পাসওয়ার্ড ভুলে গেছেন?</h1>
          <p className="text-gray-600 mt-2">
            আপনার ইমেইল ঠিকানা দিন, আমরা পাসওয়ার্ড রিসেট লিংক পাঠাবো
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

            {/* ইমেইল ফিল্ড */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                ইমেইল ঠিকানা
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="আপনার ইমেইল লিখুন"
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                আমরা এই ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠাবো
              </p>
            </div>

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
                  লিংক পাঠানো হচ্ছে...
                </>
              ) : (
                'রিসেট লিংক পাঠান'
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
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">লোড হচ্ছে...</p>
        </div>
      </div>
    }>
      <ForgotPasswordForm />
    </Suspense>
  );
}