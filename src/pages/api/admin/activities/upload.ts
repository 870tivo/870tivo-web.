/**
 * src/pages/api/admin/activities/upload.ts
 * Endpoint para subir afiches y portadas de actividades al bucket 'activities' (16:10)
 */
import type { APIRoute } from 'astro';
import { uploadActivityCover, validateActivityCover } from '../../../../lib/supabase-storage';
import { supabaseAdmin } from '../../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const user = (context.locals as any).user;
    if (!user?.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sesión no válida o no autorizada.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const formData = await context.request.formData();
    const file = formData.get('file') as File | null;
    const slug = (formData.get('slug') as string | null) || undefined;

    if (!file || !(file instanceof File) || file.size === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No se ha adjuntado ningún archivo.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validación preventiva de tipo y peso
    const validation = validateActivityCover(file);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, message: validation.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Subir mediante helper oficial de TypeScript
    const result = await uploadActivityCover({
      file,
      slug,
      client: supabaseAdmin,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, message: result.error || 'Error al subir la imagen a Supabase Storage.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Afiche subido exitosamente a Supabase Storage (16:10).',
        url: result.publicUrl,
        storagePath: result.storagePath,
        bucket: result.bucket,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en /api/admin/activities/upload:', err);
    return new Response(
      JSON.stringify({ success: false, message: err?.message || 'Error del servidor al procesar la subida.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

