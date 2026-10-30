import type { APIRoute } from 'astro';
import { supabaseAdmin, supabase } from '../../../../lib/supabase';

export const prerender = false;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const AVATARS_BUCKET = 'avatars';
export const FALLBACK_BUCKET = 'blog-media';

async function ensureBucket(bucketName: string) {
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === bucketName);
    if (!exists) {
      await supabaseAdmin.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE_BYTES,
      });
    }
  } catch (err) {
    console.warn(`Error comprobando bucket ${bucketName}:`, err);
  }
}

/**
 * POST /api/admin/profile/upload-avatar
 * Sube una imagen de avatar al bucket 'avatars' (o 'blog-media') y retorna la URL pública.
 */
export const POST: APIRoute = async ({ request, locals, cookies }) => {
  try {
    let currentUser = locals.user;

    if (!currentUser) {
      const accessToken = cookies.get('sb-access-token')?.value || 
        request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');

      if (accessToken) {
        const { data: authData } = await supabase.auth.getUser(accessToken);
        currentUser = authData?.user || null;
      }
    }

    if (!currentUser) {
      return new Response(
        JSON.stringify({ success: false, message: 'Sesión no válida o no autenticada.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

    await ensureBucket(AVATARS_BUCKET);

    const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const filePath = `${currentUser.id}/avatar-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // Intentar subir a 'avatars', con fallback a 'blog-media'
    let targetBucket = AVATARS_BUCKET;
    let uploadRes = await supabaseAdmin.storage
      .from(AVATARS_BUCKET)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadRes.error) {
      console.warn(`Fallo al subir a ${AVATARS_BUCKET}, intentando ${FALLBACK_BUCKET}:`, uploadRes.error.message);
      targetBucket = FALLBACK_BUCKET;
      uploadRes = await supabaseAdmin.storage
        .from(FALLBACK_BUCKET)
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: true,
        });
    }

    if (uploadRes.error) {
      console.error('Error definitivo de subida a Supabase Storage:', uploadRes.error);
      return new Response(
        JSON.stringify({
          success: false,
          message: `Error al subir imagen a Storage: ${uploadRes.error.message}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(targetBucket)
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Avatar subido exitosamente.',
        url: publicUrl,
        bucket: targetBucket,
        path: filePath,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error en POST /api/admin/profile/upload-avatar:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Error del servidor al procesar la subida del avatar.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
