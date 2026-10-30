import { defineMiddleware } from 'astro:middleware';
import { supabase } from './lib/supabase';
import { getUserRoleAndPermissions, isUserAdminOrHasAccess } from './lib/auth';
import type { Role, RolePermissions } from './types/roles';

// Explicit public routes inside /admin that do not require an active session
const PUBLIC_ADMIN_ROUTES = [
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
];

// Critical administrative routes requiring elevated Admin privileges
const CRITICAL_ADMIN_PREFIXES = [
  '/admin/roles',
  '/admin/usuarios',
];

const CRITICAL_API_ADMIN_PREFIXES = [
  '/api/admin/roles',
  '/api/admin/users',
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect, request } = context;
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  // Support direct /login navigation by redirecting to canonical /admin/login
  if (pathname === '/login') {
    return redirect('/admin/login');
  }

  // Intercept routes under /admin and /api/admin
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return next();
  }

  const isPublicAdminRoute = PUBLIC_ADMIN_ROUTES.includes(pathname);
  const isApiRoute = pathname.startsWith('/api');

  // Retrieve auth tokens securely from HTTP cookies
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  let isAuthenticated = false;
  let currentUser = null;

  if (accessToken) {
    try {
      // Validate token cryptographically with Supabase auth server
      const { data, error } = await supabase.auth.getUser(accessToken);
      if (data?.user && !error) {
        isAuthenticated = true;
        currentUser = data.user;
      } else if (refreshToken) {
        // Access token might be expired, attempt session refresh using refresh token
        const { data: refreshData, error: refreshError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (refreshData?.session && !refreshError) {
          isAuthenticated = true;
          currentUser = refreshData.user;

          // Update cookies securely with new session tokens
          cookies.set('sb-access-token', refreshData.session.access_token, {
            path: '/',
            maxAge: refreshData.session.expires_in,
            sameSite: 'lax',
            secure: import.meta.env.PROD,
            httpOnly: false,
          });

          cookies.set('sb-refresh-token', refreshData.session.refresh_token, {
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            sameSite: 'lax',
            secure: import.meta.env.PROD,
            httpOnly: false,
          });
        }
      }
    } catch (err) {
      console.error('Middleware Supabase auth validation error:', err);
      isAuthenticated = false;
      currentUser = null;
    }
  }

  // Populate user in locals
  context.locals.user = currentUser;

  // Retrieve role and granular permissions if user is authenticated
  let userRole: Role | null = null;
  let userPermissions: RolePermissions | null = null;
  let isSuperAdmin = false;

  if (isAuthenticated && currentUser) {
    const roleDetails = await getUserRoleAndPermissions(currentUser.id);
    userRole = roleDetails.role;
    userPermissions = roleDetails.permissions;
    isSuperAdmin = roleDetails.isSuperAdmin;
  }

  context.locals.role = userRole;
  context.locals.permissions = userPermissions;
  context.locals.isSuperAdmin = isSuperAdmin;

  // Handle unauthenticated requests
  if (!isAuthenticated && !isPublicAdminRoute) {
    if (isApiRoute) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized', 
          message: 'No autorizado. Se requiere iniciar sesión.' 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    // Web: redirect to login
    return redirect('/admin/login');
  }

  // Authenticated user accessing /admin/login -> redirect to /admin/dashboard
  if (isAuthenticated && pathname === '/admin/login') {
    return redirect('/admin/dashboard');
  }

  // Authenticated user accessing /admin root -> redirect to /admin/dashboard
  if (isAuthenticated && pathname === '/admin') {
    return redirect('/admin/dashboard');
  }

  // RBAC: Guard critical admin routes (/admin/roles, /admin/usuarios, /api/admin/roles, /api/admin/users)
  const isCriticalPageRoute = CRITICAL_ADMIN_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isCriticalApiRoute = CRITICAL_API_ADMIN_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isCriticalPageRoute || isCriticalApiRoute) {
    const hasAdminAccess = isUserAdminOrHasAccess(userRole, userPermissions);

    if (!hasAdminAccess) {
      // If API or request explicitly accepts JSON, return 403 Forbidden
      const acceptsJson = request.headers.get('accept')?.includes('application/json');
      if (isCriticalApiRoute || acceptsJson) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Forbidden',
            message: 'Acceso restringido: Se requieren privilegios de Administrador para acceder a esta sección.',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Web: redirect to dashboard with access restriction message
      const restrictedMessage = encodeURIComponent(
        'Acceso restringido: Se requieren privilegios de Administrador para gestionar roles y usuarios.'
      );
      return redirect(`/admin/dashboard?error=access_denied&message=${restrictedMessage}`);
    }
  }

  return next();
});
