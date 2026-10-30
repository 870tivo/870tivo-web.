import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabase';

export const prerender = false;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
];
const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024; // 12MB
export const BLOG_BUCKET = 'blog-media';

/**
 * Asegura que el bucket 'blog-media' exista en Supabase Storage
 */
async function ensureBlogBucketExists() {
  try {
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) {
      console.warn('Advertencia al listar buckets en Supabase:', listError.message);
      return;
    }

    const exists = buckets?.some((b) => b.name === BLOG_BUCKET);
    if (!exists) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(BLOG_BUCKET, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE_BYTES,
      });
      if (createError) {
        console.warn(`No se pudo crear bucket "${BLOG_BUCKET}" automáticamente:`, createError.message);
      } else {
        console.log(`Bucket "${BLOG_BUCKET}" creado exitosamente con acceso público.`);
      }
    }
  } catch (err: any) {
    console.warn('Excepción al verificar/crear bucket blog-media:', err?.message || err);
  }
}

/**
 * POST /api/admin/posts/upload
 * Sube una imagen (portada o secundaria integrada) al bucket 'blog-media' de Supabase Storage
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof File) || file.size === 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'No se ha adjuntado ningún archivo.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Formato de imagen no permitido (${file.type}). Formatos soportados: JPG, PNG, WEBP, GIF, AVIF, SVG.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `El archivo supera el tamaño máximo permitido (${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB).`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verificar / crear bucket si es necesario
    await ensureBlogBucketExists();

    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const sanitizedName = file.name
      .replace(/\.[^/.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 32);

    const uniqueId = crypto.randomUUID().slice(0, 8);
    const storagePath = `blog/${Date.now()}-${sanitizedName || 'img'}-${uniqueId}.${fileExtension}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BLOG_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error al subir a Supabase Storage (blog-media):', uploadError);
      return new Response(
        JSON.stringify({
          success: false,
          message: `Error al almacenar imagen: ${uploadError.message}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(BLOG_BUCKET)
      .getPublicUrl(storagePath);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Imagen subida exitosamente a Supabase Storage.',
        url: urlData.publicUrl,
        fileName: file.name,
        storagePath,
        size: file.size,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Error no controlado en POST /api/admin/posts/upload:', err);
    return new Response(
      JSON.stringify({
        success: false,
        message: err?.message || 'Error inesperado al subir la imagen.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
