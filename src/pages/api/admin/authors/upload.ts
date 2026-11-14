import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

export const prerender = false;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

async function ensureAvatarsBucket() {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === 'avatars');
    if (!exists) {
      await supabaseAdmin.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE_BYTES,
      });
    }
  } catch (err) {
    console.warn('Error comprobando bucket avatars:', err);
  }
}

/**
 * POST /api/admin/authors/upload
 * Sube la fotografía/avatar del autor estrictamente al bucket público 'avatars' de Supabase Storage.
 * Retorna { success: true, url: publicUrl, publicUrl }
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof File) || file.size === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No se adjuntó ningún archivo de imagen.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Formato de imagen no permitido (${file.type}). Formatos aceptados: JPG, PNG, WEBP, GIF, AVIF.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'La imagen excede el límite máximo de 5MB.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Asegurar que el bucket 'avatars' exista y sea público
    await ensureAvatarsBucket();

    const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const fileName = `author-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `avatars/${fileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // Subir obligatoriamente al bucket 'avatars'
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Error al subir imagen a Supabase Storage (avatars):', uploadError);
      return new Response(
        JSON.stringify({
          success: false,
          message: `Error al subir la imagen al bucket avatars: ${uploadError.message}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Obtener la URL pública del bucket 'avatars'
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Avatar subido exitosamente.',
        url: publicUrl,
        publicUrl,
        path: filePath,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en /api/admin/authors/upload:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Error inesperado al subir el avatar.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

