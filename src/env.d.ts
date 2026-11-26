/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
    readonly PUBLIC_SUPABASE_URL: string;
    readonly PUBLIC_SUPABASE_ANON_KEY: string;
    readonly PUBLIC_SITE_URL?: string;
    readonly SUPABASE_SERVICE_ROLE_KEY?: string;
    readonly GMAIL_USER?: string;
    readonly GMAIL_APP_PASSWORD?: string;
    readonly SANITY_PROJECT_ID: string;
    readonly SANITY_DATASET: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare namespace App {
    interface Locals {
        user?: import('@supabase/supabase-js').User | null;
        role?: import('./types/roles').Role | null;
        permissions?: import('./types/roles').RolePermissions | null;
        isSuperAdmin?: boolean;
        userFirstName?: string;
        userLastName?: string;
        userFullName?: string;
    }
}
