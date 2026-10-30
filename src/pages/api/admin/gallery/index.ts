import type { APIRoute } from 'astro';
import { supabaseAdmin, supabase as defaultSupabase } from '../../../../lib/supabase';
import { hasPermission } from '../../../../lib/auth';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, GALLERY_BUCKET } from '../../../../types/gallery';

export const prerender = false;

/**
 * Obtiene y valida el usuario autenticado para la petición actual.
 * Revisa:
 * 1. context.locals.user (inyectado por middleware)
 * 2. context.locals.supabase.auth.getUser() (si existe instancia en locals)
 * 3. Token de sesión en cookies ('sb-access-token' y 'sb-refresh-token')
 */
async function getAuthenticatedUser(context: { locals: any; cookies: any }) {
  // 1. Revisar si ya fue validado en locals.user
  if (context.locals?.user?.id) {
    return context.locals.user;
  }

  // 2. Instancia de Supabase (locals.supabase o defaultSupabase)
  const supabase = context.locals?.supabase || defaultSupabase;

  // 3. Validar la sesión con supabase.auth.getUser()
  try {
    const { data, error } = await supabase.auth.getUser();
    if (data?.user?.id && !error) {
      return data.user;
    }
  } catch (err) {
    // Continuar con verificación directa en cookies
  }

  // 4. Fallback con cookies de sesión 'sb-access-token'
  const accessToken = context.cookies?.get('sb-access-token')?.value;
  const refreshToken = context.cookies?.get('sb-refresh-token')?.value;

  if (accessToken) {
    try {
      const { data, error } = await defaultSupabase.auth.getUser(accessToken);
      if (data?.user?.id && !error) {
        return data.user;
      }

      // Si el accessToken expiró pero hay refreshToken, intentar refrescar sesión
      if (refreshToken) {
        const { data: refreshData, error: refreshError } = await defaultSupabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (refreshData?.user?.id && !refreshError) {
          if (refreshData.session && context.cookies?.set) {
            context.cookies.set('sb-access-token', refreshData.session.access_token, {
              path: '/',
              maxAge: refreshData.session.expires_in,
              sameSite: 'lax',
              secure: import.meta.env.PROD,
              httpOnly: false,
            });
            context.cookies.set('sb-refresh-token', refreshData.session.refresh_token, {
              path: '/',
              maxAge: 60 * 60 * 24 * 7,
              sameSite: 'lax',
              secure: import.meta.env.PROD,
              httpOnly: false,
            });
          }
          return refreshData.user;
        }
      }
    } catch (cookieErr) {
      console.error('Error validando cookie de sesión en gallery API:', cookieErr);
    }
  }

  return null;
}

/**
 * GET: Obtener listado de items de la galería
 */
export const GET: APIRoute = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, items: data || [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error al obtener la galería' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * POST: Crear una nueva obra en la galería
 * - Valida permisos SSR
 * - Sube el archivo a Supabase Storage en 'gallery-media/'
 * - Inserta la fila en 'public.gallery' con la URL pública
 */
export const POST: APIRoute = async (context) => {
  const { request, locals } = context;
  try {
    // 1. Obtener la instancia de Supabase del contexto o cliente por defecto
    const supabase = (locals as any).supabase || defaultSupabase;

    // 2. Validar la sesión directamente con supabase.auth.getUser()
    let user = null;
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authUser?.id && !authError) {
        user = authUser;
      }
    } catch {}

    // 3. Si no hay user, verificar en locals.user o en Astro.cookies
    if (!user?.id) {
      user = await getAuthenticatedUser(context);
    }

    if (!user?.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'No autenticado.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validar permiso 'galeria.create'
    const canCreate = await hasPermission(user.id, 'galeria', 'create');
    if (!canCreate) {
      return new Response(
        JSON.stringify({ success: false, message: 'No tienes permisos para crear obras en la galería.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Parsear FormData
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string || '').trim();
    const description = (formData.get('description') as string || '').trim() || null;
    const category = (formData.get('category') as string || '').trim() || 'general';
    const status = (formData.get('status') as string || '').trim() || 'borrador';

    // 4. Validaciones
    if (!title) {
      return new Response(
        JSON.stringify({ success: false, message: 'El título de la obra es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!file || !(file instanceof File) || file.size === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Debes adjuntar una imagen.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar tipo MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Formato de archivo no permitido (${file.type}). Usa: JPG, PNG, WEBP, GIF o AVIF.` 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar peso máximo
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `El archivo excede el peso máximo permitido (${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)}MB).` 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validar estado
    if (!['publicado', 'borrador'].includes(status)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Estado inválido. Debe ser "publicado" o "borrador".' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Subir archivo a Supabase Storage
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const uniqueFileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExtension}`;
    const storagePath = `uploads/${uniqueFileName}`;

    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(GALLERY_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error subiendo archivo a Storage:', uploadError);
      throw new Error(`Error al subir la imagen: ${uploadError.message}`);
    }

    // 6. Obtener URL pública del archivo subido
    const { data: urlData } = supabaseAdmin.storage
      .from(GALLERY_BUCKET)
      .getPublicUrl(storagePath);

    const imageUrl = urlData.publicUrl;

    // 7. Insertar registro en la tabla 'gallery'
    const { data: insertedItem, error: insertError } = await supabaseAdmin
      .from('gallery')
      .insert({
        title,
        description,
        image_url: imageUrl,
        category,
        status,
      })
      .select()
      .single();

    if (insertError) {
      // Si falla la inserción, intentar limpiar el archivo subido
      await supabaseAdmin.storage.from(GALLERY_BUCKET).remove([storagePath]);
      console.error('Error insertando en gallery:', insertError);
      throw new Error(`Error al registrar la obra: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Obra registrada exitosamente.', 
        item: insertedItem 
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Error en POST /api/admin/gallery:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error interno del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * DELETE: Eliminar una obra de la galería
 * - Valida permiso 'delete'
 * - Elimina la fila de la DB
 * - Elimina el objeto del bucket de Supabase Storage
 */
export const DELETE: APIRoute = async (context) => {
  const { request } = context;
  try {
    // 1. Autenticación
    const user = await getAuthenticatedUser(context);
    if (!user?.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'No autenticado.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. Validar permiso 'galeria.delete'
    const canDelete = await hasPermission(user.id, 'galeria', 'delete');
    if (!canDelete) {
      return new Response(
        JSON.stringify({ success: false, message: 'No tienes permisos para eliminar obras de la galería.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Obtener ID de la obra (desde query string ?id=... o desde JSON body)
    let id: string | null = null;
    const url = new URL(request.url);
    if (url.searchParams.has('id')) {
      id = url.searchParams.get('id');
    }

    if (!id) {
      try {
        const body = await request.json();
        if (body && typeof body.id === 'string') {
          id = body.id;
        }
      } catch {
        // No hay body JSON, ignorar error si ya tenemos id
      }
    }

    if (!id || typeof id !== 'string' || !id.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'El ID de la obra es obligatorio.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    id = id.trim();

    // 4. Obtener datos de la obra antes de eliminar (necesitamos la URL para limpiar Storage)
    const { data: existingItem, error: fetchError } = await supabaseAdmin
      .from('gallery')
      .select('id, image_url')
      .eq('id', id)
      .single();

    if (fetchError || !existingItem) {
      return new Response(
        JSON.stringify({ success: false, message: 'La obra especificada no existe.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5. Eliminar la fila de la DB
    const { error: deleteError } = await supabaseAdmin
      .from('gallery')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error eliminando de gallery:', deleteError);
      throw new Error(`Error al eliminar la obra: ${deleteError.message}`);
    }

    // 6. Intentar eliminar el archivo del bucket de Storage
    //    Extraer el path relativo al bucket de la URL pública
    try {
      const publicUrlBase = supabaseAdmin.storage.from(GALLERY_BUCKET).getPublicUrl('').data.publicUrl;
      const relativePath = existingItem.image_url.replace(publicUrlBase, '');
      
      if (relativePath && relativePath !== existingItem.image_url) {
        const { error: removeError } = await supabaseAdmin.storage
          .from(GALLERY_BUCKET)
          .remove([relativePath]);

        if (removeError) {
          console.warn('No se pudo eliminar el archivo de Storage (no crítico):', removeError.message);
        }
      }
    } catch (storageErr) {
      // No bloquear la respuesta si falla la limpieza de Storage
      console.warn('Error limpiando archivo de Storage:', storageErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Obra eliminada exitosamente.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Error en DELETE /api/admin/gallery:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error interno del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * PATCH: Actualizar datos de una obra o alternar su estado (publicado / borrador)
 */
export const PATCH: APIRoute = async (context) => {
  const { request } = context;
  try {
    const user = await getAuthenticatedUser(context);
    if (!user?.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'No autenticado.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body: { id?: string; status?: string; title?: string; description?: string; category?: string };
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: 'Cuerpo de solicitud inválido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { id, status, title, description, category } = body;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, message: 'El ID de la obra es requerido.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Si solo cambia el estado, verificar 'toggle_visibility' o 'update'
    const canToggle = await hasPermission(user.id, 'galeria', 'toggle_visibility');
    const canUpdate = await hasPermission(user.id, 'galeria', 'update');
    if (!canToggle && !canUpdate) {
      return new Response(
        JSON.stringify({ success: false, message: 'No tienes permisos para modificar obras de la galería.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updates: Record<string, any> = {};
    if (status !== undefined) {
      if (!['publicado', 'borrador'].includes(status)) {
        return new Response(
          JSON.stringify({ success: false, message: 'Estado inválido.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      updates.status = status;
    }
    if (title !== undefined && title.trim()) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim() || null;
    if (category !== undefined) updates.category = category.trim();

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No se enviaron campos para actualizar.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: updatedItem, error } = await supabaseAdmin
      .from('gallery')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error actualizando obra en gallery:', error);
      throw new Error(`Error al actualizar obra: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Obra actualizada exitosamente.', item: updatedItem }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en PATCH /api/admin/gallery:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error interno del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

