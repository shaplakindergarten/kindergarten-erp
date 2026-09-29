// src/components/LogoutButton.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface LogoutButtonProps {
  variant?: 'default' | 'icon' | 'text' | 'dropdown';
  className?: string;
  onLogout?: () => void;
}

export default function LogoutButton({
  variant = 'default',
  className = '',
  onLogout,
}: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Logout error:', error);
        alert('লগআউট করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
        setLoading(false);
        return;
      }

      if (onLogout) {
        onLogout();
      }

      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
      alert('লগআউট করতে সমস্যা হয়েছে।');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  const showLogoutConfirm = () => setShowConfirm(true);
  const cancelLogout = () => setShowConfirm(false);

  // ══════════════════════════════════════════
  // Variant: icon
  // ══════════════════════════════════════════
  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={showLogoutConfirm}
          disabled={loading}
          className={`p-2 rounded-lg hover:bg-red-50 text-gray-600 hover:text-red-600 transition-colors ${className}`}
          title="লগআউট"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          )}
        </button>

        {showConfirm && (
          <LogoutConfirmDialog
            onConfirm={handleLogout}
            onCancel={cancelLogout}
            loading={loading}
          />
        )}
      </>
    );
  }

  // ══════════════════════════════════════════
  // Variant: text
  // ══════════════════════════════════════════
  if (variant === 'text') {
    return (
      <>
        <button
          onClick={showLogoutConfirm}
          disabled={loading}
          className={`text-red-600 hover:text-red-800 font-medium transition-colors ${className}`}
        >
          {loading ? 'লগআউট হচ্ছে...' : 'লগআউট'}
        </button>

        {showConfirm && (
          <LogoutConfirmDialog
            onConfirm={handleLogout}
            onCancel={cancelLogout}
            loading={loading}
          />
        )}
      </>
    );
  }

  // ══════════════════════════════════════════
  // Variant: dropdown
  // ══════════════════════════════════════════
  if (variant === 'dropdown') {
    return (
      <>
        <button
          onClick={showLogoutConfirm}
          disabled={loading}
          className={`w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors flex items-center gap-2 ${className}`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {loading ? 'লগআউট হচ্ছে...' : 'লগআউট'}
        </button>

        {showConfirm && (
          <LogoutConfirmDialog
            onConfirm={handleLogout}
            onCancel={cancelLogout}
            loading={loading}
          />
        )}
      </>
    );
  }

  // ══════════════════════════════════════════
  // Variant: default
  // ══════════════════════════════════════════
  return (
    <>
      <button
        onClick={showLogoutConfirm}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition duration-200 ease-in-out transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            লগআউট হচ্ছে...
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            লগআউট
          </>
        )}
      </button>

      {showConfirm && (
        <LogoutConfirmDialog
          onConfirm={handleLogout}
          onCancel={cancelLogout}
          loading={loading}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════
// Logout Confirm Dialog
// ══════════════════════════════════════════════════
function LogoutConfirmDialog({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  // ✅ FIX: ESC key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleEscape);

    // ✅ FIX: Body scroll lock
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [onCancel, loading]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        // ✅ FIX: Outside click দিয়ে বন্ধ
        if (e.target === e.currentTarget && !loading) {
          onCancel();
        }
      }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/40 rounded-full flex items-center justify-center">
            <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        </div>

        <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
          লগআউট নিশ্চিত করুন
        </h3>

        <p className="text-center text-gray-600 dark:text-slate-400 mb-6">
          আপনি কি নিশ্চিত যে আপনি লগআউট করতে চান?
          <br />
          <span className="text-sm text-gray-500 dark:text-slate-500">
            আপনার সেশন বন্ধ হবে এবং আপনাকে আবার লগইন করতে হবে।
          </span>
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-700 text-gray-700 dark:text-slate-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            বাতিল করুন
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                লগআউট হচ্ছে...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                লগআউট করুন
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-4">
          ESC বা বাতিল করুন দিয়ে বন্ধ করুন
        </p>
      </div>
    </div>
  );
}