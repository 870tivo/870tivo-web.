import { supabaseAdmin } from './supabase';
import type { AuditLogInsert } from '../types/database';

export type AuditEntityType = AuditLogInsert['entity_type'];

export interface RecordAuditLogInput {
  userEmail: string;
  action: string;
  target: string;
  entityType: NonNullable<AuditEntityType>;
  details?: AuditLogInsert['details'];
}

/**
 * Registra un evento en `public.audit_log` de forma no bloqueante.
 * Si la tabla aún no existe o ocurre un error de red/DB, registra una advertencia
 * sin interrumpir la operación principal del endpoint.
 */
export async function recordAuditLog({
  userEmail,
  action,
  target,
  entityType,
  details = {},
}: RecordAuditLogInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('audit_log').insert({
      user_email: userEmail || 'Sistema',
      action,
      target,
      entity_type: entityType,
      details,
    });

    if (error) {
      console.warn('[auditLog] No se pudo insertar en public.audit_log:', error.message);
    }
  } catch (err) {
    console.warn('[auditLog] Error inesperado registrando auditoría:', err);
  }
}

