/**
 * src/pages/api/admin/activities/toggle-status.ts
 * Endpoint para alternar rápidamente el estado y visibilidad de una actividad
 */
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  try {
    const user = (context.locals as any).user;
    if (!user?.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sesión no válida o no autorizada.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await context.request.json();
    const { id, is_published, status } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Se requiere el ID de la actividad.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const nextPublished = typeof is_published === 'boolean' ? is_published : true;
    const nextStatus = status || (nextPublished ? 'publicado' : 'borrador');

    const { data: updated, error } = await supabaseAdmin
      .from('activities')
      .update({
        is_published: nextPublished,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar estado de actividad en Supabase:', error);
      return new Response(
        JSON.stringify({ success: false, message: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: nextPublished ? 'Actividad publicada.' : 'Actividad pasada a borrador.',
        activity: updated,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en /api/admin/activities/toggle-status:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

