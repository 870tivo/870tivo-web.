import { defineMiddleware } from 'astro:middleware';
import { supabase } from './lib/supabase';

// Explicit public routes inside /admin that do not require an active session
const PUBLIC_ADMIN_ROUTES = [
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect } = context;
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  // Only intercept routes under /admin
  if (!pathname.startsWith('/admin')) {
    return next();
  }

  const isPublicAdminRoute = PUBLIC_ADMIN_ROUTES.includes(pathname);

  // Retrieve auth tokens from cookies
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  let isAuthenticated = false;
  let currentUser = null;

  if (accessToken) {
    try {
      // Validate token with Supabase auth server
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

          // Update cookies with new session tokens
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

  // Populate locals for downstream Astro pages and layouts
  context.locals.user = currentUser;

  // Authenticated user accessing /admin/login -> redirect to /admin/dashboard
  if (isAuthenticated && pathname === '/admin/login') {
    return redirect('/admin/dashboard');
  }

  // Authenticated user accessing /admin root -> redirect to /admin/dashboard
  if (isAuthenticated && pathname === '/admin') {
    return redirect('/admin/dashboard');
  }

  // Unauthenticated user attempting to access private admin route -> redirect to /admin/login
  if (!isAuthenticated && !isPublicAdminRoute) {
    return redirect('/admin/login');
  }

  return next();
});
