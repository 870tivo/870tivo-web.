/**
 * src/types/profile.ts
 * Definición de tipos para perfiles de usuario y gestión de cuenta admin.
 * Actualizado para reflejar la reestructuración: eliminación de full_name
 * y adición de first_name y last_name.
 */

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  role: string | null;
  avatar_url?: string | null;
  updated_at?: string;
}

export interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

export interface ChangePasswordPayload {
  password: string;
  confirmPassword?: string;
}
