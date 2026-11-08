/**
 * src/types/database.ts
 * Definición global de tipos de la base de datos de Supabase para el proyecto 870tivo.
 * Refleja la estructura de tablas del esquema público (public), incluyendo
 * la reestructuración de perfiles (first_name, last_name).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          role: string | null;
          avatar_url: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string;
          last_name?: string;
          role?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          role?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      authors: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          bio: string | null;
          avatar_url: string | null;
          social_url: string | null;
          social_links: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          social_url?: string | null;
          social_links?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          social_url?: string | null;
          social_links?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gallery: {
        Row: {
          id: string;
          title: string;
          artist: string | null;
          technique: string | null;
          dimensions: string | null;
          year: number | null;
          description: string | null;
          image_url: string;
          visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          artist?: string | null;
          technique?: string | null;
          dimensions?: string | null;
          year?: number | null;
          description?: string | null;
          image_url: string;
          visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          artist?: string | null;
          technique?: string | null;
          dimensions?: string | null;
          year?: number | null;
          description?: string | null;
          image_url?: string;
          visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          permissions: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role_id: string;
          assigned_at: string;
        };
        Insert: {
          user_id: string;
          role_id: string;
          assigned_at?: string;
        };
        Update: {
          user_id?: string;
          role_id?: string;
          assigned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          }
        ];
      };
      /**
       * email_subscribers
       * Registros voluntarios de correo para avisos de nuevas publicaciones.
       * No requiere autenticación. Accesible con anon key + RLS policy de INSERT.
       *
       * ── SQL de migración ────────────────────────────────────────────────────
       * Ejecutar en Supabase Dashboard → SQL Editor:
       *
       * CREATE TABLE public.email_subscribers (
       *   id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
       *   email      text        NOT NULL UNIQUE,
       *   confirmed  boolean     NOT NULL DEFAULT false,
       *   created_at timestamptz NOT NULL DEFAULT now()
       * );
       *
       * ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;
       *
       * -- Permite INSERT público (anon) sin exponer datos existentes
       * CREATE POLICY "public_insert_subscribers"
       *   ON public.email_subscribers
       *   FOR INSERT
       *   TO anon
       *   WITH CHECK (true);
       * ────────────────────────────────────────────────────────────────────────
       */
      email_subscribers: {
        Row: {
          id: string;
          email: string;
          confirmed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          confirmed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          confirmed?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_permission: {
        Args: {
          _user_id: string;
          _module: string;
          _action: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

export type ProfileRow = Tables<'profiles'>;
export type ProfileInsert = TablesInsert<'profiles'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;

export type EmailSubscriberRow    = Tables<'email_subscribers'>;
export type EmailSubscriberInsert = TablesInsert<'email_subscribers'>;

export type AuthorRow    = Tables<'authors'>;
export type AuthorInsert = TablesInsert<'authors'>;
export type AuthorUpdate = TablesUpdate<'authors'>;

export interface AuthorSocialLinks {
  instagram?: string;
  twitter?: string;
  x?: string;
  website?: string;
  tiktok?: string;
  email?: string;
  [key: string]: string | undefined;
}
