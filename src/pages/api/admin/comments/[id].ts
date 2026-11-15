/**
 * src/pages/api/admin/comments/[id].ts
 * Endpoint administrativo para eliminar un comentario por su ID.
 */
import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

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

    const { id } = context.params;
    if (!id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Se requiere el ID del comentario a eliminar.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { error: deleteError } = await supabaseAdmin
      .from('comments')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error al eliminar comentario:', deleteError);
      return new Response(
        JSON.stringify({ success: false, message: deleteError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Comentario eliminado correctamente.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en DELETE /api/admin/comments/[id]:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error interno del servidor.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

