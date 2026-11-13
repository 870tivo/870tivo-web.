import { defineMiddleware } from 'astro:middleware';
import { supabase, supabaseAdmin } from './lib/supabase';
import { getUserRoleAndPermissions, isUserAdminOrHasAccess } from './lib/auth';
import type { Role, RolePermissions } from './types/roles';

/**
 * UUID secreto asignado para ofuscar el panel de administración.
 * Todas las rutas de administración residen bajo este prefijo.
 */
const ADMIN_UUID = '2416f50b-da02-4a5b-86a8-61ae470ed3bd';
const ADMIN_PATH = `/${ADMIN_UUID}`;

/**
 * Rutas públicas dentro del panel de administración que no requieren sesión activa.
 */
const PUBLIC_ADMIN_ROUTES = [
  `${ADMIN_PATH}/login`,
  `${ADMIN_PATH}/forgot-password`,
  `${ADMIN_PATH}/reset-password`,
  `${ADMIN_PATH}/setup-profile`,
];

/**
 * Rutas administrativas críticas que requieren privilegios elevados (Super Admin / Admin).
 */
const CRITICAL_ADMIN_PREFIXES = [
  `${ADMIN_PATH}/roles`,
  `${ADMIN_PATH}/usuarios`,
];

/**
 * Endpoints de la API interna que requieren privilegios de Administrador.
 */
const CRITICAL_API_ADMIN_PREFIXES = [
  '/api/admin/roles',
  '/api/admin/users',
];

/**
 * Endpoints de la API interna que son públicos y no requieren sesión activa.
 * Se excluyen explícitamente para evitar que el middleware los bloquee con 401.
 */
const PUBLIC_API_ROUTES = [
  '/api/admin/auth/login',
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect, request } = context;
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  // =========================================================================
  // 1. OFUSCACIÓN DE SEGURIDAD: RESPUESTA 404 INMEDIATA PARA RUTAS /admin
  // =========================================================================
  // Si cualquier atacante, escáner o bot intenta acceder a rutas estándar
  // de administración (ej: /admin, /admin/, /admin/users, /admin/dashboard, /login),
  // se responde con HTTP 404 de inmediato para ocultar por completo su existencia.
  if (
    pathname === '/admin' || 
    pathname.startsWith('/admin/') || 
    pathname === '/login'
  ) {
    return new Response('Not Found', {
      status: 404,
      statusText: 'Not Found',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  // =========================================================================
  // 2. FILTRADO DE RUTAS
  // =========================================================================
  // Si la petición no se dirige a la ruta administrativa secreta ni a la API interna,
  // se delega inmediatamente al siguiente manejador para no incurrir en sobrecoste SSR.
  const isAdminRoute = pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`);
  const isApiAdminRoute = pathname.startsWith('/api/admin');

  if (!isAdminRoute && !isApiAdminRoute) {
    return next();
  }

  // Early-exit: endpoints de API públicos que no requieren sesión activa.
  // Debe ir ANTES de la validación de tokens para que el login pueda procesar credenciales.
  if (PUBLIC_API_ROUTES.includes(pathname)) {
    return next();
  }

  const isPublicAdminRoute = PUBLIC_ADMIN_ROUTES.includes(pathname);
  const isApiRoute = pathname.startsWith('/api');

  // =========================================================================
  // 3. RECUPERACIÓN Y VALIDACIÓN DE SESIÓN (SUPABASE AUTH)
  // =========================================================================
  // Compatible con Supabase Auth configurado en sessionStorage en el navegador.
  // El cliente web sincroniza los tokens mediante cookies (sb-access-token y sb-refresh-token),
  // permitiendo validación en SSR y cierre de sesión seguro al cerrar la pestaña o expirar.
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  let isAuthenticated = false;
  let currentUser = null;

  if (accessToken) {
    try {
      // Validación criptográfica del access token con el servidor de Supabase
      const { data, error } = await supabase.auth.getUser(accessToken);

      if (data?.user && !error) {
        isAuthenticated = true;
        currentUser = data.user;
      } else if (refreshToken) {
        // En caso de expiración del access token, intentar renovación con el refresh token
        const { data: refreshData, error: refreshError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (refreshData?.session && !refreshError) {
          isAuthenticated = true;
          currentUser = refreshData.user;

          // Sincronizar nuevas cookies manteniendo httpOnly: false para interoperabilidad
          // fluida con sessionStorage y la función client-side clearAuthCookies()
          cookies.set('sb-access-token', refreshData.session.access_token, {
            path: '/',
            maxAge: refreshData.session.expires_in,
            sameSite: 'lax',
            secure: import.meta.env.PROD,
            httpOnly: false,
          });

          cookies.set('sb-refresh-token', refreshData.session.refresh_token, {
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 días
            sameSite: 'lax',
            secure: import.meta.env.PROD,
            httpOnly: false,
          });
        }
      }
    } catch (err) {
      console.error('[Middleware] Error en la validación de Supabase Auth:', err);
      isAuthenticated = false;
      currentUser = null;
    }
  }

  // Si no se pudo validar la sesión y existían cookies corruptas o inválidas, limpiarlas
  if (!isAuthenticated && accessToken) {
    cookies.delete('sb-access-token', { path: '/' });
    cookies.delete('sb-refresh-token', { path: '/' });
  }

  // =========================================================================
  // 4. INYECCIÓN EN CONTEXTO LOCAL (Astro.locals)
  // =========================================================================
  context.locals.user = currentUser;

  let userRole: Role | null = null;
  let userPermissions: RolePermissions | null = null;
  let isSuperAdmin = false;

  let userFirstName = '';
  let userLastName = '';
  let userFullName = '';

  if (isAuthenticated && currentUser) {
    // Obtener rol y permisos granulares de la base de datos
    const roleDetails = await getUserRoleAndPermissions(currentUser.id);
    userRole = roleDetails.role;
    userPermissions = roleDetails.permissions;
    isSuperAdmin = roleDetails.isSuperAdmin;

    // Obtener nombres para la interfaz desde public.profiles con fallback a user_metadata
    try {
      const { data: profileRow } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profileRow?.first_name || profileRow?.last_name) {
        userFirstName = (profileRow.first_name || '').trim();
        userLastName = (profileRow.last_name || '').trim();
      } else {
        userFirstName = (currentUser.user_metadata?.first_name || '').trim();
        userLastName = (currentUser.user_metadata?.last_name || '').trim();
      }
    } catch {
      userFirstName = (currentUser.user_metadata?.first_name || '').trim();
      userLastName = (currentUser.user_metadata?.last_name || '').trim();
    }

    const combinedName = [userFirstName, userLastName].filter(Boolean).join(' ');
    const metaFullName = (currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '').trim();
    userFullName = combinedName || metaFullName || (currentUser.email?.split('@')[0] ?? '');
  }

  context.locals.role = userRole;
  context.locals.permissions = userPermissions;
  context.locals.isSuperAdmin = isSuperAdmin;
  context.locals.userFirstName = userFirstName;
  context.locals.userLastName = userLastName;
  context.locals.userFullName = userFullName;

  // =========================================================================
  // 5. CONTROL DE ACCESO PARA USUARIOS NO AUTENTICADOS
  // =========================================================================
  if (!isAuthenticated && !isPublicAdminRoute) {
    if (isApiRoute) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized', 
          message: 'No autorizado. Se requiere iniciar sesión.' 
        }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    // Redirigir al inicio de sesión secreto
    return redirect(`${ADMIN_PATH}/login`);
  }

  // =========================================================================
  // 6. REDIRECCIONES DE CONVENIENCIA PARA USUARIOS YA AUTENTICADOS
  // =========================================================================
  // Si un usuario con sesión activa intenta ir al login secreto o a la raíz secreta,
  // redirigirlo automáticamente al panel principal (dashboard).
  if (isAuthenticated && (pathname === `${ADMIN_PATH}/login` || pathname === ADMIN_PATH)) {
    return redirect(`${ADMIN_PATH}/dashboard`);
  }

  // =========================================================================
  // 7. CONTROL DE ACCESO BASADO EN ROLES (RBAC)
  // =========================================================================
  const isCriticalPageRoute = CRITICAL_ADMIN_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const isCriticalApiRoute = CRITICAL_API_ADMIN_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isCriticalPageRoute || isCriticalApiRoute) {
    const hasAdminAccess = isUserAdminOrHasAccess(userRole, userPermissions);

    if (!hasAdminAccess) {
      const acceptsJson = request.headers.get('accept')?.includes('application/json');
      if (isCriticalApiRoute || acceptsJson) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Forbidden',
            message: 'Acceso restringido: Se requieren privilegios de Administrador para acceder a esta sección.',
          }),
          { 
            status: 403, 
            headers: { 'Content-Type': 'application/json' } 
          }
        );
      }

      // Redirección con mensaje de acceso denegado hacia el dashboard administrativo
      const restrictedMessage = encodeURIComponent(
        'Acceso restringido: Se requieren privilegios de Administrador para gestionar roles y usuarios.'
      );
      return redirect(`${ADMIN_PATH}/dashboard?error=access_denied&message=${restrictedMessage}`);
    }
  }

  return next();
});
