import { supabaseAdmin } from './supabase';
import type { 
  SystemModule, 
  PermissionAction, 
  RolePermissions, 
  Role 
} from '../types/roles';
export { hasModulePermission } from '../types/roles';

/**
 * Matriz de permisos con acceso total para Super Administradores
 */
export const FULL_SUPERADMIN_PERMISSIONS: RolePermissions = {
  publicaciones: {
    read: true,
    create: true,
    update: true,
    delete: true,
    toggle_visibility: true,
  },
  galeria: {
    read: true,
    create: true,
    update: true,
    delete: true,
    toggle_visibility: true,
  },
  usuarios: {
    read: true,
    create: true,
    update: true,
    delete: true,
  },
};

/**
 * Consulta si un usuario tiene un permiso específico sobre un módulo.
 * Utiliza primariamente la función RPC 'has_permission' de PostgreSQL/Supabase,
 * y cuenta con fallback directo sobre la tabla 'user_roles' y 'roles'.
 * 
 * @param userId - UUID del usuario autenticado
 * @param module - Identificador del módulo ('publicaciones' | 'galeria' | 'usuarios')
 * @param action - Acción requerida ('read' | 'create' | 'update' | 'delete' | 'toggle_visibility')
 */
export async function hasPermission(
  userId: string,
  module: SystemModule,
  action: PermissionAction | string
): Promise<boolean> {
  if (!userId) return false;

  try {
    // 1. Intento primario: Llamada a la RPC 'has_permission'
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('has_permission', {
      _user_id: userId,
      _module: module,
      _action: action,
    });

    if (!rpcError && typeof rpcResult === 'boolean') {
      return rpcResult;
    }

    if (rpcError) {
      console.warn('RPC has_permission fallback to direct query:', rpcError.message);
    }
  } catch (err) {
    console.warn('Error llamando a RPC has_permission, ejecutando fallback:', err);
  }

  // 2. Fallback: Consulta directa a 'user_roles' uniendo con 'roles'
  try {
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('role_id, roles(id, name, permissions)')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data || !data.roles) {
      return false;
    }

    const roleData = Array.isArray(data.roles) ? data.roles[0] : data.roles;
    if (!roleData) return false;

    // Super Administrador tiene todos los privilegios
    if (roleData.name === 'Super Administrador') {
      return true;
    }

    const permissions = roleData.permissions as RolePermissions | undefined;
    if (!permissions || !permissions[module]) {
      return false;
    }

    const moduleActions = permissions[module] as unknown as Record<string, boolean | undefined>;
    return Boolean(moduleActions[action]);
  } catch (err) {
    console.error('Error verificando permiso en hasPermission:', err);
    return false;
  }
}

/**
 * Obtiene el rol y la matriz de permisos completa del usuario en SSR
 * 
 * @param userId - UUID del usuario
 */
export async function getUserRoleAndPermissions(userId: string): Promise<{
  role: Role | null;
  permissions: RolePermissions | null;
  isSuperAdmin: boolean;
}> {
  if (!userId) {
    return { role: null, permissions: null, isSuperAdmin: false };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role_id, assigned_at, roles(*)')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data || !data.roles) {
      return { role: null, permissions: null, isSuperAdmin: false };
    }

    const role = (Array.isArray(data.roles) ? data.roles[0] : data.roles) as Role;
    const isSuperAdmin = role.name === 'Super Administrador';
    const permissions: RolePermissions = isSuperAdmin
      ? FULL_SUPERADMIN_PERMISSIONS
      : (role.permissions as RolePermissions);

    return {
      role,
      permissions,
      isSuperAdmin,
    };
  } catch (err) {
    console.error('Error al obtener rol y permisos del usuario:', err);
    return { role: null, permissions: null, isSuperAdmin: false };
  }
}

/**
 * Helper para obtener únicamente los permisos del usuario actual en SSR
 */
export async function getUserPermissions(userId: string): Promise<RolePermissions | null> {
  const result = await getUserRoleAndPermissions(userId);
  return result.permissions;
}

/**
 * Helper para obtener el rol asignado a un usuario
 */
export async function getUserRole(userId: string): Promise<Role | null> {
  const result = await getUserRoleAndPermissions(userId);
  return result.role;
}

/**
 * Obtiene el listado de todos los roles existentes con conteo de usuarios asignados
 */
export async function getAllRoles(): Promise<Role[]> {
  try {
    // 1. Obtener todos los roles
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('*')
      .order('created_at', { ascending: true });

    if (rolesError || !roles) {
      console.error('Error obteniendo roles:', rolesError);
      return [];
    }

    // 2. Obtener conteo de usuarios por rol desde user_roles
    const { data: userRoles, error: urError } = await supabaseAdmin
      .from('user_roles')
      .select('role_id');

    const countsByRoleId: Record<string, number> = {};
    if (!urError && userRoles) {
      for (const ur of userRoles) {
        countsByRoleId[ur.role_id] = (countsByRoleId[ur.role_id] || 0) + 1;
      }
    }

    return roles.map((r: any) => ({
      ...r,
      user_count: countsByRoleId[r.id] || 0,
    }));
  } catch (err) {
    console.error('Error en getAllRoles:', err);
    return [];
  }
}
