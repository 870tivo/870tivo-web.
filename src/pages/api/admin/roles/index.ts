import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { getAllRoles } from '../../../../lib/auth';
import type { RoleFormInput } from '../../../../types/roles';

export const prerender = false;

/**
 * GET: Obtener listado de roles con número de usuarios asociados
 */
export const GET: APIRoute = async () => {
  try {
    const roles = await getAllRoles();
    return new Response(JSON.stringify({ success: true, roles }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error al obtener roles' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * POST: Crear un nuevo rol
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body: RoleFormInput = await request.json();
    const { name, description, permissions } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'El nombre del rol es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!permissions || typeof permissions !== 'object') {
      return new Response(
        JSON.stringify({ success: false, message: 'La estructura de permisos es requerida.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insertar en la base de datos
    const { data, error } = await supabaseAdmin
      .from('roles')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        permissions,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ success: false, message: 'Ya existe un rol con ese nombre.' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Rol creado exitosamente.', role: data }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error al crear rol:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error al crear el rol en el servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * PUT: Actualizar un rol existente
 */
export const PUT: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { id, name, description, permissions } = body;

    if (!id || typeof id !== 'string') {
      return new Response(
        JSON.stringify({ success: false, message: 'El ID del rol es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'El nombre del rol es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Comprobar si se intenta renombrar el Super Administrador
    const { data: existingRole, error: fetchErr } = await supabaseAdmin
      .from('roles')
      .select('name')
      .eq('id', id)
      .single();

    if (fetchErr || !existingRole) {
      return new Response(
        JSON.stringify({ success: false, message: 'El rol especificado no existe.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (existingRole.name === 'Super Administrador' && name.trim() !== 'Super Administrador') {
      return new Response(
        JSON.stringify({ success: false, message: 'No está permitido cambiar el nombre del rol "Super Administrador".' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('roles')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        permissions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ success: false, message: 'Ya existe otro rol con ese nombre.' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Rol actualizado exitosamente.', role: data }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error al actualizar rol:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error al actualizar el rol en el servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * DELETE: Eliminar un rol
 */
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, message: 'El parámetro "id" es requerido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar si es Super Administrador
    const { data: role, error: fetchErr } = await supabaseAdmin
      .from('roles')
      .select('name')
      .eq('id', id)
      .single();

    if (fetchErr || !role) {
      return new Response(
        JSON.stringify({ success: false, message: 'El rol especificado no existe.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (role.name === 'Super Administrador') {
      return new Response(
        JSON.stringify({ success: false, message: 'El rol "Super Administrador" es vital para el sistema y no puede eliminarse.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar si hay usuarios con este rol asignado
    const { count, error: countErr } = await supabaseAdmin
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role_id', id);

    if (!countErr && (count || 0) > 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `No se puede eliminar este rol porque está asignado a ${count} usuario(s). Reasigna los usuarios antes de eliminarlo.` 
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Eliminar
    const { error: deleteErr } = await supabaseAdmin
      .from('roles')
      .delete()
      .eq('id', id);

    if (deleteErr) throw deleteErr;

    return new Response(
      JSON.stringify({ success: true, message: 'Rol eliminado exitosamente.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error al eliminar rol:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error al eliminar el rol' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
