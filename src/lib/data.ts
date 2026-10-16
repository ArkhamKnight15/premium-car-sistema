import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { CompanySettings, Employee, PaymentMethod, Service } from "@/lib/types";

export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle<CompanySettings>();
  return data;
});

export const getEmployees = cache(async (includeInactive = false) => {
  const supabase = await createClient();
  let q = supabase.from("employees").select("*").order("full_name");
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as Employee[];
});

export const getServices = cache(async (includeInactive = false) => {
  const supabase = await createClient();
  let q = supabase.from("services").select("*").order("sort_order").order("name");
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as Service[];
});

export const getPaymentMethods = cache(async (includeInactive = false) => {
  const supabase = await createClient();
  let q = supabase.from("payment_methods").select("*").order("sort_order").order("name");
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as PaymentMethod[];
});
