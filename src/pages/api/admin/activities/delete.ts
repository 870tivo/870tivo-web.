/**
 * src/pages/api/admin/activities/delete.ts
 * Endpoint para eliminar una actividad y limpiar su afiche de Supabase Storage
 */
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';
import { deleteActivityCover } from '../../../../lib/supabase-storage';

export const prerender = false;

export const DELETE: APIRoute = async (context) => {
  try {
    const user = (context.locals as any).user;
    if (!user?.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sesión no válida o no autorizada.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await context.request.json();
    const { id, slug, cover_url } = body;

    if (!id && !slug) {
      return new Response(
        JSON.stringify({ success: false, message: 'Se requiere el ID o slug de la actividad a eliminar.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. Obtener datos de la actividad antes de eliminar para rescatar cover_url
    let targetCoverUrl = cover_url;
    let targetTitle = 'Actividad';

    let query = supabaseAdmin.from('activities').select('id, title, cover_url');
    if (id) {
      query = query.eq('id', id);
    } else if (slug) {
      query = query.eq('slug', slug);
    }

    const { data: existingActivity } = await query.maybeSingle();
    if (existingActivity) {
      targetCoverUrl = targetCoverUrl || existingActivity.cover_url;
      targetTitle = existingActivity.title || targetTitle;
    }

    // 2. Eliminar fila de la base de datos
    let deleteQuery = supabaseAdmin.from('activities').delete();
    if (id) {
      deleteQuery = deleteQuery.eq('id', id);
    } else if (slug) {
      deleteQuery = deleteQuery.eq('slug', slug);
    }

    const { error: dbDeleteError } = await deleteQuery;
    if (dbDeleteError) {
      console.error('Error al eliminar actividad en Supabase:', dbDeleteError);
      return new Response(
        JSON.stringify({ success: false, message: `Error al eliminar de la base de datos: ${dbDeleteError.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Limpiar afiche del bucket 'activities' si no es una imagen por defecto/local
    if (targetCoverUrl && typeof targetCoverUrl === 'string' && !targetCoverUrl.startsWith('/assets/')) {
      try {
        await deleteActivityCover(targetCoverUrl, supabaseAdmin);
      } catch (storageErr) {
        console.warn('Aviso: no se pudo limpiar el afiche de Storage (no crítico):', storageErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `La actividad «${targetTitle}» y sus recursos han sido eliminados correctamente.`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en /api/admin/activities/delete:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error del servidor al eliminar la actividad.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

