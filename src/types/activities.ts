/**
 * src/types/activities.ts
 * Definiciones de tipos e interfaces para la gestión integral de actividades
 * y eventos culturales en el colectivo 870tivo.
 */

import type { ActivityCategory, ActivityRow, ActivityInsert, ActivityUpdate } from './database';

export type { ActivityCategory, ActivityRow, ActivityInsert, ActivityUpdate };

export type ActivityStatus = 'publicado' | 'borrador' | 'archivado';

/**
 * 🎬 Campos especializados para Ciclos de Cine
 */
export interface CineMetadata {
  director?: string;
  release_year?: number | string;
  duration_min?: number | string;
  country?: string;
  trailer_url?: string;
}

/**
 * 📚 Campos especializados para Club de Lectura
 */
export interface LecturaMetadata {
  book_title?: string;
  book_author?: string;
  assigned_readings?: string;
}

/**
 * 🛠️ Campos especializados para Talleres
 */
export interface TalleresMetadata {
  facilitator?: string;
  level?: 'Principiante' | 'Intermedio' | 'Avanzado' | 'Todos' | string;
  materials?: string;
  capacity?: number | string;
}

/**
 * 🗣️ Campos especializados para Encuentros
 */
export interface EncuentrosMetadata {
  guests?: string;
  event_format?: string;
}

/**
 * Metadatos extendidos según la categoría seleccionada
 */
export type ActivitySpecializedMetadata =
  | CineMetadata
  | LecturaMetadata
  | TalleresMetadata
  | EncuentrosMetadata
  | Record<string, unknown>;

/**
 * Estructura para el formulario unificado de administración de actividades
 */
export interface ActivityFormData {
  // Comunes
  id?: string;
  title: string;
  slug: string;
  category: ActivityCategory;
  description: string;
  content: string;
  event_date: string;
  location: string;
  cover_url: string;
  tags: string[];
  status: ActivityStatus;
  is_published: boolean;

  // Especializados (JSON metadata)
  metadata: ActivitySpecializedMetadata;
}

