import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin } = await requireUser();
  const supabase = await createClient();
  const { count } = await supabase.from("service_orders").select("id", { count: "exact", head: true }).not("status", "in", "(delivered,cancelled)");
  return (
    <AppShell isAdmin={isAdmin} userName={profile.full_name || profile.email || "Usuário"} inShop={count ?? 0}>
      {children}
    </AppShell>
  );
}
