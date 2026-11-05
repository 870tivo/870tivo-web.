import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { isUserAdminOrHasAccess } from '../../../../lib/auth';

export const prerender = false;

/**
 * POST: Asignar o cambiar el rol de un usuario
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) {
    return new Response(JSON.stringify({ success: false, message: 'No autenticado.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isUserAdminOrHasAccess(locals.role, locals.permissions)) {
    return new Response(JSON.stringify({ success: false, message: 'Acceso denegado: Privilegios de administrador requeridos.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { userId, roleId } = body;

    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'El ID del usuario es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const requesterIsSuperAdmin = Boolean(locals.isSuperAdmin || locals.role?.name === 'Super Administrador');

    // Consultar el rol actual del usuario objetivo en la base de datos
    const { data: currentUR } = await supabaseAdmin
      .from('user_roles')
      .select('role_id, roles(id, name)')
      .eq('user_id', userId)
      .maybeSingle();

    const currentRole = Array.isArray(currentUR?.roles) ? currentUR?.roles[0] : currentUR?.roles;
    const isTargetSuperAdmin = currentRole?.name === 'Super Administrador';

    // Validación A: Retorna 403 Forbidden si se intenta cambiar o remover el rol de un usuario que ya es 'super_admin'
    if (isTargetSuperAdmin) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Acceso denegado: No está permitido modificar el rol de un Super Administrador.' 
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Si no hay roleId o es vacío, se remueve el rol del usuario
    if (!roleId) {
      // Eliminar asignación previa
      const { error: delErr } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (delErr) throw delErr;

      return new Response(
        JSON.stringify({ success: true, message: 'Rol removido correctamente.', role: null }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Si hay roleId, verificar que el rol exista
    const { data: targetRole, error: roleErr } = await supabaseAdmin
      .from('roles')
      .select('id, name, permissions')
      .eq('id', roleId)
      .single();

    if (roleErr || !targetRole) {
      return new Response(
        JSON.stringify({ success: false, message: 'El rol seleccionado no existe.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validación B: Retorna 403 Forbidden si un usuario que NO es 'super_admin' intenta asignar el rol 'super_admin' a alguien más
    if (targetRole.name === 'Super Administrador' && !requesterIsSuperAdmin) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Acceso denegado: Solo un Super Administrador puede asignar el rol de Super Administrador.' 
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Eliminar asignaciones previas del usuario (en caso de que tuviera otro rol)
    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // 4. Asignar el nuevo rol
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: roleId,
        assigned_at: new Date().toISOString(),
      })
      .select('*, roles(*)')
      .single();

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Rol «${targetRole.name}» asignado correctamente.`,
        userRole: inserted,
        role: targetRole
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error al asignar rol a usuario:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error en el servidor al asignar rol' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
