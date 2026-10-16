import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Cliente com a chave service_role (ignora RLS). Uso restrito ao servidor e
 * apenas para administrar logins (criar, bloquear, redefinir senha).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env.supabaseUrl || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  return createClient(env.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const hasServiceRole = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
