"use client";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SystemError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center text-center">
      <AlertTriangle className="h-8 w-8 text-amber-300" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold">Não foi possível carregar esta tela</h1>
      <p className="mt-1 max-w-md text-sm text-ink-400">Verifique sua conexão e tente novamente. Se o problema continuar, informe o administrador{error.digest ? ` (código ${error.digest})` : ""}.</p>
      <Button className="mt-5" onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
