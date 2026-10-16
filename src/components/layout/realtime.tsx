"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowser } from "@/lib/supabase/browser";

type Watch = { table: string; filter?: string };

/**
 * Recarrega a tela quando os dados mudam no banco (Supabase Realtime, respeitando RLS).
 * Inclui recarga periódica de segurança caso o Realtime não esteja ativo no projeto.
 */
export function LiveRefresh({ channel, watch, everyMs = 60_000 }: { channel: string; watch: Watch[]; everyMs?: number }) {
  const router = useRouter();
  const key = JSON.stringify(watch);
  useEffect(() => {
    const supabase = createBrowser();
    let t: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(t);
      t = setTimeout(() => router.refresh(), 400);
    };
    const ch = supabase.channel(channel);
    for (const w of JSON.parse(key) as Watch[]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: w.table, ...(w.filter ? { filter: w.filter } : {}) }, refresh);
    }
    ch.subscribe();
    const interval = setInterval(() => document.visibilityState === "visible" && router.refresh(), everyMs);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, [channel, key, everyMs, router]);
  return null;
}
