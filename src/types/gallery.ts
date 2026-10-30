/**
 * Tipos para el módulo de Galería de Arte & Proyectos
 */

/**
 * Estados posibles de una obra en la galería
 */
export type GalleryStatus = 'publicado' | 'borrador';

/**
 * Entidad Gallery (representación exacta de la tabla public.gallery)
 */
export interface GalleryItem {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  category: string;
  status: GalleryStatus;
  created_at: string;
}

/**
 * Datos de entrada para crear una nueva obra desde el Dashboard
 */
export interface GalleryFormInput {
  title: string;
  description?: string | null;
  category?: string;
  status?: GalleryStatus;
}

/**
 * Extensiones de imagen permitidas para la galería
 */
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'] as const;

/**
 * Tipos MIME permitidos para la galería
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

/**
 * Peso máximo permitido para las imágenes (10MB)
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Nombre del bucket en Supabase Storage
 */
export const GALLERY_BUCKET = 'gallery-media';

/**
 * Categorías predefinidas sugeridas para la galería
 */
export const GALLERY_CATEGORIES = [
  'Pintura',
  'Fotografía',
  'Escultura',
  'Digital',
  'Arquitectura',
  'Instalación',
  'Mixta',
  'Otro',
] as const;
