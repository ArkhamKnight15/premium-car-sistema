import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Employee, Profile } from "@/lib/types";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
    supabase.from("employees").select("*").eq("profile_id", user.id).maybeSingle<Employee>(),
  ]);
  return { user, profile, employee };
});

export type Perm = "customers" | "all_orders" | "payments" | "discounts";

/** Espelha has_perm() do banco — a interface usa para exibir/ocultar; o banco é quem garante. */
export function can(p: Profile | null | undefined, perm: Perm) {
  if (!p?.active) return false;
  if (p.role === "admin") return true;
  return { customers: p.perm_customers, all_orders: p.perm_all_orders, payments: p.perm_payments, discounts: p.perm_discounts }[perm];
}

export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.profile?.active) redirect("/login?erro=sem-acesso");
  return { user: s.user, profile: s.profile, employee: s.employee, isAdmin: s.profile.role === "admin" };
}

export async function requireAdmin() {
  const s = await requireUser();
  if (!s.isAdmin) redirect("/dashboard?aviso=restrito");
  return s;
}

export async function requirePerm(perm: Perm) {
  const s = await requireUser();
  if (!can(s.profile, perm)) redirect("/dashboard?aviso=restrito");
  return s;
}
