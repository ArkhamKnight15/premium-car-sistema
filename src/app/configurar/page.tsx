import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { isConfigured } from "@/lib/env";

export default function SetupPage() {
  if (isConfigured()) redirect("/login");
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
      <Logo href="/configurar" />
      <div className="mt-10 rounded-xl border border-ink-800 bg-ink-900 p-6">
        <Database className="h-6 w-6 text-gold-400" aria-hidden />
        <h1 className="mt-3 text-lg font-semibold">Conecte o banco de dados</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          Defina as variáveis <code className="text-gold-300">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
          <code className="text-gold-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> e <code className="text-gold-300">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
          e reinicie o sistema. O passo a passo está no README do projeto.
        </p>
      </div>
    </main>
  );
}
