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

/** Categorías oficiales para las actividades de 870tivo */
export type ActivityCategory = 'ciclos-cine' | 'club-lectura' | 'talleres' | 'encuentros';

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
          specialty: string | null;
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
          specialty?: string | null;
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
          specialty?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      specialties: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      gallery: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          image_url: string;
          category: string;
          status: 'publicado' | 'borrador';
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          image_url: string;
          category?: string;
          status?: 'publicado' | 'borrador';
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          image_url?: string;
          category?: string;
          status?: 'publicado' | 'borrador';
          created_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          user_email: string;
          action: string;
          target: string;
          entity_type: 'post' | 'activity' | 'gallery' | 'role' | 'user';
          details: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_email: string;
          action: string;
          target: string;
          entity_type?: 'post' | 'activity' | 'gallery' | 'role' | 'user';
          details?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_email?: string;
          action?: string;
          target?: string;
          entity_type?: 'post' | 'activity' | 'gallery' | 'role' | 'user';
          details?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string | null;
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
      activities: {
        Row: {
          id: string;
          slug: string;
          title: string;
          category: ActivityCategory;
          description: string | null;
          content: string | null;
          event_date: string;
          location: string;
          cover_url: string | null;
          status: 'publicado' | 'borrador' | 'archivado';
          is_published: boolean;
          tags?: string[] | null;
          metadata?: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          category: ActivityCategory;
          description?: string | null;
          content?: string | null;
          event_date: string;
          location?: string;
          cover_url?: string | null;
          status?: 'publicado' | 'borrador' | 'archivado';
          is_published?: boolean;
          tags?: string[] | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          category?: ActivityCategory;
          description?: string | null;
          content?: string | null;
          event_date?: string;
          location?: string;
          cover_url?: string | null;
          status?: 'publicado' | 'borrador' | 'archivado';
          is_published?: boolean;
          tags?: string[] | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          title: string;
          slug: string;
          subtitle: string | null;
          category: string;
          author: string;
          author_social_url: string | null;
          author_id: string | null;
          cover_image: string | null;
          content: string;
          read_time: string;
          status: 'publicado' | 'borrador' | 'archivado';
          views: number;
          likes: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          subtitle?: string | null;
          category?: string;
          author: string;
          author_social_url?: string | null;
          author_id?: string | null;
          cover_image?: string | null;
          content?: string;
          read_time?: string;
          status?: 'publicado' | 'borrador' | 'archivado';
          views?: number;
          likes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          subtitle?: string | null;
          category?: string;
          author?: string;
          author_social_url?: string | null;
          author_id?: string | null;
          cover_image?: string | null;
          content?: string;
          read_time?: string;
          status?: 'publicado' | 'borrador' | 'archivado';
          views?: number;
          likes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "authors";
            referencedColumns: ["id"];
          }
        ];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_name: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_name: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_name?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_post_views: {
        Args: {
          post_slug: string;
        };
        Returns: undefined;
      };
      increment_post_likes: {
        Args: {
          post_slug: string;
        };
        Returns: number;
      };
      decrement_post_likes: {
        Args: {
          post_slug: string;
        };
        Returns: number;
      };
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

export type SpecialtyRow    = Tables<'specialties'>;
export type SpecialtyInsert = TablesInsert<'specialties'>;
export type SpecialtyUpdate = TablesUpdate<'specialties'>;

export type ActivityRow    = Tables<'activities'>;
export type ActivityInsert = TablesInsert<'activities'>;
export type ActivityUpdate = TablesUpdate<'activities'>;

export type PostRow    = Tables<'posts'>;
export type PostInsert = TablesInsert<'posts'>;
export type PostUpdate = TablesUpdate<'posts'>;

export type CommentRow    = Tables<'comments'>;
export type CommentInsert = TablesInsert<'comments'>;
export type CommentUpdate = TablesUpdate<'comments'>;

export type GalleryRow    = Tables<'gallery'>;
export type GalleryInsert = TablesInsert<'gallery'>;
export type GalleryUpdate = TablesUpdate<'gallery'>;

export type AuditLogRow    = Tables<'audit_log'>;
export type AuditLogInsert = TablesInsert<'audit_log'>;
export type AuditLogUpdate = TablesUpdate<'audit_log'>;

export type SiteSettingRow    = Tables<'site_settings'>;
export type SiteSettingInsert = TablesInsert<'site_settings'>;
export type SiteSettingUpdate = TablesUpdate<'site_settings'>;

export interface ActivityCategoryMeta {
  slug: ActivityCategory;
  label: string;
  tagline: string;
  description: string;
  badgeClass: string;
  accentColor: string;
}

export const ACTIVITY_CATEGORIES: Record<ActivityCategory, ActivityCategoryMeta> = {
  'ciclos-cine': {
    slug: 'ciclos-cine',
    label: 'Ciclos de Cine',
    tagline: 'Proyecciones y conversaciones',
    description: 'Espacios de visionado crítico, diálogo cinematográfico y memoria audiovisual.',
    badgeClass: 'bg-brand-orange/15 text-brand-orange border-brand-orange/30 dark:bg-brand-orange/20 dark:text-brand-orange',
    accentColor: '#E4572E',
  },
  'club-lectura': {
    slug: 'club-lectura',
    label: 'Club de Lectura',
    tagline: 'Lecturas y diálogos literarios',
    description: 'Encuentros alrededor de la palabra escrita, textos contemporáneos y debates literarios.',
    badgeClass: 'bg-brand-forest/15 text-brand-forest border-brand-forest/30 dark:bg-brand-forest/25 dark:text-brand-forest dark:border-brand-forest/40',
    accentColor: '#2F4B3A',
  },
  'talleres': {
    slug: 'talleres',
    label: 'Talleres',
    tagline: 'Formación creativa y técnica',
    description: 'Laboratorios prácticos de creación, artes gráficas, escritura y experimentación técnica.',
    badgeClass: 'bg-brand-mustard/20 text-brand-ink dark:text-brand-mustard border-brand-mustard/40 dark:bg-brand-mustard/15',
    accentColor: '#F2B134',
  },
  'encuentros': {
    slug: 'encuentros',
    label: 'Encuentros',
    tagline: 'Eventos y jornadas diversas',
    description: 'Jornadas culturales, ferias independientes, conciertos acústicos y micrófonos abiertos.',
    badgeClass: 'bg-brand-ink/10 text-brand-ink border-brand-ink/20 dark:bg-white/10 dark:text-brand-darkInk dark:border-white/20',
    accentColor: '#1F1B16',
  },
};

export interface AuthorSocialLinks {
  instagram?: string;
  twitter?: string;
  x?: string;
  website?: string;
  tiktok?: string;
  email?: string;
  [key: string]: string | undefined;
}
