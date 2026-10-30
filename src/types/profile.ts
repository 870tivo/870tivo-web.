/**
 * src/types/profile.ts
 * Definición de tipos para perfiles de usuario y gestión de cuenta admin.
 */

export interface UserProfile {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url?: string | null;
  updated_at?: string;
}

export interface ProfileUpdatePayload {
  full_name?: string;
  avatar_url?: string;
}

export interface ChangePasswordPayload {
  password: string;
  confirmPassword?: string;
}
