import type { ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Alert } from "@/components/ui/layout-bits";

const GUIDES: { title: string; steps: ReactNode[] }[] = [
  {
    title: "Android (Google Contatos)",
    steps: [
      <>No computador, abra <strong className="text-ink-100">contacts.google.com</strong> com a conta Google do celular do WhatsApp.</>,
      <>Para levar só os clientes, abra um marcador (ex.: &ldquo;Clientes&rdquo;). Para levar tudo, fique em &ldquo;Contatos&rdquo;.</>,
      <>Clique em <strong className="text-ink-100">Exportar</strong>, escolha <strong className="text-ink-100">vCard</strong> ou <strong className="text-ink-100">CSV do Google</strong> e confirme.</>,
    ],
  },
  {
    title: "Android (sem conta Google)",
    steps: [
      <>Abra o app <strong className="text-ink-100">Contatos</strong> e vá em Configurações → <strong className="text-ink-100">Importar/Exportar</strong>.</>,
      <>Toque em <strong className="text-ink-100">Exportar para arquivo .vcf</strong> e salve.</>,
      <>Envie o arquivo para o computador (e-mail ou WhatsApp Web) e selecione aqui.</>,
    ],
  },
  {
    title: "iPhone",
    steps: [
      <>No app Contatos, toque em <strong className="text-ink-100">Listas</strong>, segure &ldquo;Todos os Contatos&rdquo; e toque em <strong className="text-ink-100">Exportar</strong>.</>,
      <>Ou, no computador, entre em <strong className="text-ink-100">icloud.com/contacts</strong>, selecione tudo (Ctrl/Cmd + A) e use <strong className="text-ink-100">Exportar vCard</strong>.</>,
      <>Selecione aqui o arquivo .vcf gerado.</>,
    ],
  },
];

/** Passo a passo para tirar a agenda do celular em um arquivo que o sistema lê. */
export function ContactExportGuide() {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-ink-100">Como exportar os contatos</h2>
      <Alert tone="info" icon={Info}>
        O WhatsApp não exporta a lista de contatos: ele usa a agenda do celular. Exporte a agenda em um arquivo e, na próxima etapa, escolha quem entra como cliente.
      </Alert>
      <div className="divide-y divide-ink-800 overflow-hidden rounded-lg border border-ink-800">
        {GUIDES.map((g, i) => (
          <details key={g.title} open={i === 0} className="group bg-ink-925">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink-100 transition-colors hover:bg-ink-850 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/70 [&::-webkit-details-marker]:hidden">
              {g.title}
              <ChevronDown className="h-4 w-4 shrink-0 text-ink-500 transition-transform duration-200 group-open:rotate-180" aria-hidden />
            </summary>
            <ol className="space-y-2 px-4 pb-4 text-sm text-ink-300">
              {g.steps.map((s, j) => (
                <li key={j} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink-700 text-[11px] font-semibold tabular-nums text-brand-300">{j + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </div>
  );
}
