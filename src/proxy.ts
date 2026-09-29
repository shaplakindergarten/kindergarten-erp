// src/proxy.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// ═══════════════════════════════════════════════════════════
// ROLE-BASED ROUTE PROTECTION MAP
// ⚠️ IMPORTANT: Order matters! More specific routes FIRST.
//    getAllowedRoles() returns the FIRST match.
// ═══════════════════════════════════════════════════════════
const ROLE_PROTECTED_ROUTES: Array<{ prefix: string; roles: string[] }> = [
  // ═══════════ ADMIN ONLY ═══════════
  { prefix: '/settings', roles: ['admin'] },
  { prefix: '/staff/new', roles: ['admin'] },
  { prefix: '/staff/list', roles: ['admin', 'teacher'] },
  { prefix: '/staff/salary', roles: ['admin'] },
  { prefix: '/students/new', roles: ['admin'] },
  { prefix: '/students/bulk-upload', roles: ['admin'] },
  { prefix: '/students/promotion', roles: ['admin'] },
  { prefix: '/students/classes', roles: ['admin'] },
  { prefix: '/fees/setup', roles: ['admin'] },
  { prefix: '/fees/categories', roles: ['admin'] },
  { prefix: '/fees/structure', roles: ['admin'] },
  { prefix: '/fees/fine', roles: ['admin'] },
  { prefix: '/fees/discounts', roles: ['admin'] },
  { prefix: '/fees/assign', roles: ['admin'] },
  { prefix: '/attendance/staff', roles: ['admin'] },
  { prefix: '/attendance/devices', roles: ['admin'] },
  { prefix: '/attendance/settings', roles: ['admin'] },
  { prefix: '/exams/setup', roles: ['admin'] },
  { prefix: '/exams/certificates', roles: ['admin'] },
  { prefix: '/exams/settings', roles: ['admin'] },
  { prefix: '/exams/results/generate', roles: ['admin'] },
  { prefix: '/exams/results/publish', roles: ['admin'] },
  { prefix: '/exams/marks/verify', roles: ['admin'] },
  { prefix: '/exams/marks/lock', roles: ['admin'] },
  { prefix: '/notifications', roles: ['admin'] },
  { prefix: '/reports', roles: ['admin'] },

  // ═══════════ ADMIN + ACCOUNTANT ═══════════
  { prefix: '/fees', roles: ['admin', 'accountant'] },
  { prefix: '/finance', roles: ['admin', 'accountant'] },

  // ═══════════ ADMIN + STORE + ACCOUNTANT ═══════════
  { prefix: '/inventory', roles: ['admin', 'store', 'accountant'] },

  // ═══════════ ADMIN + TEACHER + STAFF ═══════════
  { prefix: '/students', roles: ['admin', 'teacher', 'staff'] },
  { prefix: '/exams', roles: ['admin', 'teacher', 'staff'] },
  { prefix: '/attendance', roles: ['admin', 'teacher', 'staff'] },

  // ═══════════ 🆕 DASHBOARD SUB-ROUTES (Specific FIRST!) ═══════════
  // ⚠️ এই entry টি MUST be BEFORE `/dashboard`
  { prefix: '/dashboard/admissions', roles: ['admin', 'teacher'] },

  // ═══════════ NON-STUDENT (DASHBOARD) ═══════════
  { prefix: '/dashboard', roles: ['admin', 'teacher', 'staff', 'accountant', 'store', 'admin_staff'] },
  { prefix: '/profile', roles: ['admin', 'teacher', 'staff', 'accountant', 'store', 'admin_staff'] },

  // ═══════════ STUDENT ONLY ═══════════
  { prefix: '/my-profile', roles: ['student'] },
  { prefix: '/my-results', roles: ['student'] },
  { prefix: '/my-attendance', roles: ['student'] },
  { prefix: '/my-fees', roles: ['student'] },
];

// ═══════════════════════════════════════════════════════════
// HELPER: Find allowed roles (returns FIRST match)
// ═══════════════════════════════════════════════════════════
function getAllowedRoles(pathname: string): string[] | null {
  for (const route of ROLE_PROTECTED_ROUTES) {
    if (pathname === route.prefix || pathname.startsWith(route.prefix + '/')) {
      return route.roles;
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// MAIN PROXY FUNCTION
// ═══════════════════════════════════════════════════════════
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // ───────────────────────────────────────────────────────
  // PUBLIC ROUTES
  // ───────────────────────────────────────────────────────
  const PUBLIC_EXACT = new Set([
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/admission',                 // 🆕 Public admission form (exact)
  ]);

  const PUBLIC_PREFIX = [
    '/api',
    '/auth',
    '/_next',
    '/fonts',
    '/icons',
    '/models',
    '/sw.js',
    '/admission',                 // 🆕 /admission/success, /admission/status, etc.
  ];

  const isPublic =
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIX.some((p) => pathname === p || pathname.startsWith(p + '/'));

  // ───────────────────────────────────────────────────────
  // Rule 1: Logged-in user → /login or /signup → redirect
  // ───────────────────────────────────────────────────────
  if (user && (pathname === '/login' || pathname === '/signup')) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = (profile?.role || 'user').toLowerCase();

      let redirectTo = '/dashboard';
      if (role === 'student') redirectTo = '/my-profile';
      else if (role === 'accountant') redirectTo = '/fees';
      else if (role === 'store') redirectTo = '/inventory';

      return NextResponse.redirect(new URL(redirectTo, request.url));
    } catch {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // ───────────────────────────────────────────────────────
  // Rule 2: Not-logged-in → protected route → /login
  // ───────────────────────────────────────────────────────
  if (!user && !isPublic) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ───────────────────────────────────────────────────────
  // Rule 3: Logged-in user → role-based protection
  // ───────────────────────────────────────────────────────
  if (user && !isPublic) {
    const allowedRoles = getAllowedRoles(pathname);

    if (allowedRoles !== null && allowedRoles.length > 0) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        const userRole = (profile?.role || 'user').toLowerCase();

        const errorParam = request.nextUrl.searchParams.get('error');

        // ✅ Loop guard for /dashboard errors
        if (
          pathname === '/dashboard' &&
          (errorParam === 'unauthorized' || errorParam === 'role_check_failed')
        ) {
          return supabaseResponse;
        }

        // ✅ Student trying dashboard → my-profile
        if (pathname === '/dashboard' && userRole === 'student') {
          return NextResponse.redirect(new URL('/my-profile', request.url));
        }

        // ✅ Non-student trying /my-* → dashboard
        if (pathname.startsWith('/my-') && userRole !== 'student') {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }

        // ✅ Role check
        if (!allowedRoles.includes(userRole)) {
          const url = new URL('/dashboard', request.url);
          url.searchParams.set('error', 'unauthorized');
          url.searchParams.set('from', pathname);
          return NextResponse.redirect(url);
        }
      } catch (err) {
        console.error('[proxy] Role check failed for', pathname, err);

        if (pathname === '/dashboard') {
          const errorParam = request.nextUrl.searchParams.get('error');
          if (errorParam === 'role_check_failed') {
            return supabaseResponse;
          }
          const url = new URL('/login', request.url);
          url.searchParams.set('error', 'role_check_failed');
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff|woff2|json|bin)$).*)',
  ],
};