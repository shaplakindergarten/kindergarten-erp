// src/lib/auth/index.ts
import { createClient } from '@/lib/supabase/client';

/**
 * Get current user ID safely.
 * Returns null if no session or error occurs.
 * No console errors, no crashes.
 */
export async function getUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return null;
    }

    return session.user.id;
  } catch {
    return null;
  }
}

/**
 * Get current user object safely.
 * Returns null if no session or error occurs.
 */
export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.user) {
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

/**
 * Get current session safely.
 * Returns null if no session or error occurs.
 */
export async function getSession() {
  try {
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}