/**
 * src/lib/supabase-storage.ts
 * Helpers de TypeScript para la gestión de archivos y portadas en Supabase Storage
 * correspondientes al módulo de Actividades del colectivo cultural 870tivo.
 *
 * Características:
 * - Bucket 'activities' con acceso público para lectura.
 * - Validación rigurosa de tipo MIME y peso máximo (10MB).
 * - Soporte para relación de aspecto 16:10 para afiches y portadas editoriales.
 * - Generación de rutas únicas mediante slug sanitizado, timestamp y sufijo pseudoaleatorio.
 * - Compatible tanto en ejecución del lado cliente (browser) como servidor (SSR / Astro API).
 */

import { supabase, supabaseAdmin } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Nombre oficial del bucket de Storage para actividades
 */
export const ACTIVITIES_STORAGE_BUCKET = 'activities';

/**
 * Formatos de imagen permitidos para afiches y portadas
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/**
 * Límite máximo de tamaño permitido: 10 MB (10 * 1024 * 1024 bytes)
 */
export const MAX_ACTIVITY_COVER_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Especificaciones editoriales de proporción 16:10 para 870tivo
 */
export const ACTIVITY_COVER_SPECS = {
  aspectRatio: '16:10',
  ratioDecimal: 1.6, // 16 / 10
  recommendedWidth: 1280,
  recommendedHeight: 800,
  recommendedDimensionsText: '16:10 (ej. 1280x800 px o 1920x1200 px)',
} as const;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface ActivityStorageUploadOptions {
  /** Archivo o Blob de imagen a subir */
  file: File | Blob;
  /** Slug base o título de la actividad para generar el nombre único */
  slug?: string;
  /** Nombre original opcional del archivo si `file` es un Blob anónimo */
  fileName?: string;
  /** Carpeta interna dentro del bucket (por defecto: 'covers') */
  folder?: string;
  /** Cliente opcional de Supabase; por defecto utiliza `supabase` o `supabaseAdmin` */
  client?: SupabaseClient;
  /** Si debe reemplazar un archivo existente con la misma ruta (por defecto: false) */
  upsert?: boolean;
}

export interface ActivityStorageUploadResult {
  success: boolean;
  /** URL pública directa para guardar en el campo `cover_url` */
  publicUrl: string;
  /** Ruta relativa dentro del bucket (ej. 'covers/mi-actividad-1731110000-a1b2c3d4.webp') */
  storagePath: string;
  /** Nombre del bucket utilizado ('activities') */
  bucket: string;
  /** Detalle del error en caso de fallo */
  error?: string;
}

export interface ActivityStorageDeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Determina el cliente adecuado según el entorno de ejecución
 */
function resolveClient(client?: SupabaseClient): SupabaseClient {
  if (client) return client;
  if (typeof window !== 'undefined') {
    return supabase;
  }
  return supabaseAdmin || supabase;
}

/**
 * Obtiene la extensión recomendada a partir de un tipo MIME
 */
export function getExtensionFromMimeType(mime: string): string {
  switch (mime.toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/avif':
      return 'avif';
    case 'image/gif':
      return 'gif';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'jpg';
  }
}

/**
 * Sanitiza una cadena de texto para su uso seguro como slug en el almacenamiento
 */
export function slugifyStorageName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remueve tildes y diacríticos
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')   // Reemplaza caracteres no alfanuméricos por guiones
    .replace(/-+/g, '-')            // Consolida guiones consecutivos
    .replace(/^-|-$/g, '')          // Elimina guiones al inicio o final
    .slice(0, 48);                  // Limita a longitud segura
}

/**
 * Valida si un archivo cumple con los requisitos de tipo y peso para portadas de actividades
 */
export function validateActivityCover(
  file: File | Blob | null | undefined,
  options?: {
    maxSizeBytes?: number;
    allowedMimeTypes?: readonly string[];
  }
): FileValidationResult {
  if (!file) {
    return { valid: false, error: 'No se ha proporcionado ningún archivo para subir.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'El archivo adjunto está vacío (0 bytes).' };
  }

  const maxSize = options?.maxSizeBytes ?? MAX_ACTIVITY_COVER_SIZE_BYTES;
  if (file.size > maxSize) {
    const maxMb = (maxSize / (1024 * 1024)).toFixed(0);
    const actualMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `El archivo (${actualMb} MB) supera el tamaño máximo permitido (${maxMb} MB).`,
    };
  }

  const allowed = options?.allowedMimeTypes ?? ALLOWED_IMAGE_MIME_TYPES;
  if (file.type && !allowed.includes(file.type as AllowedImageMimeType)) {
    return {
      valid: false,
      error: `Formato de imagen no permitido (${file.type}). Se aceptan: JPG, PNG, WEBP, AVIF, GIF y SVG.`,
    };
  }

  return { valid: true };
}

/**
 * Genera una ruta única y estructurada dentro del bucket de actividades
 * Ejemplo: covers/ciclo-cine-akira-1731110000000-a1b2c3d4.webp
 */
export function generateActivityStoragePath(options: {
  slug?: string;
  originalFileName?: string;
  folder?: string;
  fileType?: string;
}): string {
  const folder = (options.folder || 'covers').replace(/^\/+|\/+$/g, '');
  const baseSlug = slugifyStorageName(options.slug || 'actividad') || 'actividad';
  const timestamp = Date.now();
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).substring(2, 10);

  let ext = 'jpg';
  if (options.originalFileName && options.originalFileName.includes('.')) {
    const rawExt = options.originalFileName.split('.').pop()?.toLowerCase();
    if (rawExt && /^[a-z0-9]+$/.test(rawExt)) {
      ext = rawExt;
    }
  } else if (options.fileType) {
    ext = getExtensionFromMimeType(options.fileType);
  }

  return `${folder}/${baseSlug}-${timestamp}-${randomSuffix}.${ext}`;
}

/**
 * Extrae la ruta relativa de un archivo dentro del bucket a partir de una URL pública completa o ruta parcial
 */
export function extractStoragePathFromUrl(
  urlOrPath: string,
  bucket: string = ACTIVITIES_STORAGE_BUCKET
): string {
  if (!urlOrPath) return '';

  // Si ya es una ruta relativa
  if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
    return urlOrPath.replace(/^\/+/, '');
  }

  try {
    const parsed = new URL(urlOrPath);
    const searchPattern = `/public/${bucket}/`;
    const index = parsed.pathname.indexOf(searchPattern);
    if (index !== -1) {
      return decodeURIComponent(parsed.pathname.slice(index + searchPattern.length));
    }

    const altPattern = `/${bucket}/`;
    const altIndex = parsed.pathname.indexOf(altPattern);
    if (altIndex !== -1) {
      return decodeURIComponent(parsed.pathname.slice(altIndex + altPattern.length));
    }
  } catch {
    // Si la URL no es válida, devolvemos la cadena limpia
  }

  return urlOrPath;
}

/**
 * Obtiene la URL pública directa para un archivo almacenado en el bucket 'activities'
 */
export function getActivityCoverPublicUrl(
  storagePath: string,
  client?: SupabaseClient
): string {
  const sb = resolveClient(client);
  const cleanPath = extractStoragePathFromUrl(storagePath, ACTIVITIES_STORAGE_BUCKET);
  const { data } = sb.storage.from(ACTIVITIES_STORAGE_BUCKET).getPublicUrl(cleanPath);
  return data.publicUrl;
}

/**
 * Sube directamente un archivo o Blob al bucket 'activities' de Supabase Storage.
 * Genera el slug/timestamp único y devuelve la URL pública para el campo `cover_url`.
 */
export async function uploadActivityCover(
  options: ActivityStorageUploadOptions
): Promise<ActivityStorageUploadResult> {
  const { file, slug, fileName, folder = 'covers', client, upsert = false } = options;

  // 1. Validación defensiva de formato y peso
  const validation = validateActivityCover(file);
  if (!validation.valid) {
    return {
      success: false,
      publicUrl: '',
      storagePath: '',
      bucket: ACTIVITIES_STORAGE_BUCKET,
      error: validation.error || 'Archivo de portada no válido.',
    };
  }

  try {
    const sb = resolveClient(client);

    // 2. Resolver nombre original y generar ruta única
    const originalName = fileName || (file instanceof File ? file.name : undefined);
    const storagePath = generateActivityStoragePath({
      slug,
      originalFileName: originalName,
      folder,
      fileType: file.type,
    });

    const contentType = file.type || 'image/jpeg';

    // 3. Subir archivo a Supabase Storage
    const { error: uploadError } = await sb.storage
      .from(ACTIVITIES_STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType,
        cacheControl: '3600',
        upsert,
      });

    if (uploadError) {
      return {
        success: false,
        publicUrl: '',
        storagePath: '',
        bucket: ACTIVITIES_STORAGE_BUCKET,
        error: `Error al subir la portada a Supabase Storage: ${uploadError.message}`,
      };
    }

    // 4. Obtener URL pública directa
    const { data: urlData } = sb.storage
      .from(ACTIVITIES_STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    return {
      success: true,
      publicUrl: urlData.publicUrl,
      storagePath,
      bucket: ACTIVITIES_STORAGE_BUCKET,
    };
  } catch (err: any) {
    return {
      success: false,
      publicUrl: '',
      storagePath: '',
      bucket: ACTIVITIES_STORAGE_BUCKET,
      error: err?.message || 'Error inesperado al subir la portada a Storage.',
    };
  }
}

/**
 * Elimina un archivo del bucket 'activities' de Supabase Storage mediante su ruta relativa o URL pública
 */
export async function deleteActivityCover(
  pathOrUrl: string,
  client?: SupabaseClient
): Promise<ActivityStorageDeleteResult> {
  try {
    const targetPath = extractStoragePathFromUrl(pathOrUrl, ACTIVITIES_STORAGE_BUCKET);
    if (!targetPath) {
      return { success: false, error: 'No se proporcionó una ruta de archivo válida.' };
    }

    const sb = resolveClient(client);
    const { error } = await sb.storage.from(ACTIVITIES_STORAGE_BUCKET).remove([targetPath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error inesperado al eliminar el archivo de Storage.',
    };
  }
}

/**
 * Verifica y crea de manera idempotente el bucket 'activities' mediante la API de Supabase
 * Útil para tareas de bootstrapping o verificación programática desde el backend SSR.
 */
export async function ensureActivitiesBucketExists(
  client?: SupabaseClient
): Promise<{ success: boolean; created: boolean; error?: string }> {
  try {
    const sb = resolveClient(client);
    const { data: buckets, error: listError } = await sb.storage.listBuckets();

    if (listError) {
      return { success: false, created: false, error: listError.message };
    }

    const exists = buckets?.some((b) => b.name === ACTIVITIES_STORAGE_BUCKET);
    if (exists) {
      return { success: true, created: false };
    }

    const { error: createError } = await sb.storage.createBucket(ACTIVITIES_STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: MAX_ACTIVITY_COVER_SIZE_BYTES,
      allowedMimeTypes: [...ALLOWED_IMAGE_MIME_TYPES],
    });

    if (createError) {
      return { success: false, created: false, error: createError.message };
    }

    return { success: true, created: true };
  } catch (err: any) {
    return {
      success: false,
      created: false,
      error: err?.message || 'Excepción al verificar/crear bucket de actividades.',
    };
  }
}

