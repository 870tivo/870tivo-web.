/**
 * Módulos disponibles en el sistema 870tivo
 */
export type SystemModule = 'publicaciones' | 'galeria' | 'usuarios';

/**
 * Acciones CRUD estándar en el sistema
 */
export interface BaseModuleActions {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

/**
 * Acciones para módulos que soportan interruptores de visibilidad en el Dashboard (publicaciones, galería)
 */
export interface ContentModuleActions extends BaseModuleActions {
  toggle_visibility: boolean;
}

/**
 * Matriz de permisos granular por módulo guardada como JSONB en la base de datos
 */
export interface RolePermissions {
  publicaciones: ContentModuleActions;
  galeria: ContentModuleActions;
  usuarios: BaseModuleActions;
  [moduleKey: string]: BaseModuleActions | ContentModuleActions;
}

/**
 * Entidad Rol (representación exacta de la tabla public.roles de Supabase)
 */
export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: RolePermissions;
  created_at: string;
  updated_at?: string;
  user_count?: number;
}

/**
 * Registro de vinculación entre usuario y rol (public.user_roles)
 */
export interface UserRole {
  user_id: string;
  role_id: string;
  assigned_at?: string;
  role?: Role;
}

/**
 * Datos de entrada para crear o editar un rol desde el Dashboard
 */
export interface RoleFormInput {
  name: string;
  description?: string | null;
  permissions: RolePermissions;
}

/**
 * Estructura de usuario con su rol asignado para la vista administrativa
 */
export interface AdminUserListItem {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string | null;
  roleId: string | null;
  roleName: string | null;
  permissions: RolePermissions | null;
}

/**
 * Acciones posibles sobre un módulo
 */
export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'toggle_visibility';

/**
 * Permisos por defecto vacíos (todos en false) para creación de nuevos roles
 */
export const DEFAULT_EMPTY_PERMISSIONS: RolePermissions = {
  publicaciones: {
    read: false,
    create: false,
    update: false,
    delete: false,
    toggle_visibility: false,
  },
  galeria: {
    read: false,
    create: false,
    update: false,
    delete: false,
    toggle_visibility: false,
  },
  usuarios: {
    read: false,
    create: false,
    update: false,
    delete: false,
  },
};

/**
 * Metadata descriptiva de cada módulo para renderizar la matriz de permisos en UI
 */
export const SYSTEM_MODULES_CONFIG: Array<{
  id: SystemModule;
  label: string;
  description: string;
  hasVisibilityToggle: boolean;
}> = [
  {
    id: 'publicaciones',
    label: 'Publicaciones & Artículos',
    description: 'Gestión editorial de ensayos, reseñas críticas y visibilidad en landing page.',
    hasVisibilityToggle: true,
  },
  {
    id: 'galeria',
    label: 'Galería de Arte',
    description: 'Catálogo de obras, fichas técnicas, artistas y exposiciones presenciales.',
    hasVisibilityToggle: true,
  },
  {
    id: 'usuarios',
    label: 'Usuarios & Roles',
    description: 'Administración de accesos, asignación de roles y control de privilegios.',
    hasVisibilityToggle: false,
  },
];

/**
 * Función de utilidad sincrónica para validar permisos en memoria
 */
export function hasModulePermission(
  permissions: RolePermissions | null | undefined,
  moduleName: SystemModule,
  action: PermissionAction
): boolean {
  if (!permissions) return false;
  const mod = (permissions[moduleName] as unknown as Record<string, boolean | undefined>) || undefined;
  if (!mod) return false;
  return Boolean(mod[action]);
}
