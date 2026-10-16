"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { FormMessage } from "@/components/forms/action-form";
import { PHOTO_KIND } from "@/lib/constants";
import { checkPhotos, uploadOrderPhotos } from "@/lib/photo-upload";
import type { ActionResult } from "@/lib/types";
import { registerPhotos } from "@/actions/orders";

/** Anexa fotos à OS: envio direto ao Storage privado e registro na linha do tempo. */
export function PhotoUploader({ orderId, defaultKind }: { orderId: string; defaultKind: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState(defaultKind);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function send() {
    const files = Array.from(fileRef.current?.files ?? []);
    if (!files.length) return setResult({ ok: false, message: "Selecione ao menos uma foto." });
    const err = checkPhotos(files);
    if (err) return setResult({ ok: false, message: err });
    setResult(null);
    const { paths, failed } = await uploadOrderPhotos(orderId, files, (d, t) => setBusy(`Enviando ${d}/${t}…`));
    let res: ActionResult = { ok: false, message: "Não foi possível enviar as fotos. Verifique a conexão e a sua permissão." };
    if (paths.length) res = await registerPhotos(orderId, kind, caption, paths);
    if (res.ok && failed.length) res = { ok: true, message: `${res.message} Não enviadas: ${failed.join(", ")}.` };
    setBusy(null);
    setResult(res);
    if (res.ok) {
      if (fileRef.current) fileRef.current.value = "";
      setCaption("");
      router.refresh();
    }
  }

  return (
    <div className="mt-5 grid gap-3 border-t border-ink-800 pt-5 sm:grid-cols-6 sm:items-end">
      <div className="sm:col-span-2">
        <Label htmlFor="photo-kind">Tipo</Label>
        <Select id="photo-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(PHOTO_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </div>
      <div className="sm:col-span-4">
        <Label htmlFor="photo-caption">Legenda</Label>
        <Input id="photo-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Opcional" maxLength={160} />
      </div>
      <div className="sm:col-span-4">
        <Label htmlFor="photo-files">Arquivos</Label>
        <Input ref={fileRef} id="photo-files" type="file" accept="image/*" multiple capture="environment" className="pt-2" />
      </div>
      <Button variant="secondary" className="sm:col-span-2" disabled={!!busy} onClick={send}>
        {busy ? <Loader2 className="animate-spin" /> : <Camera />} {busy ?? "Anexar fotos"}
      </Button>
      {result ? <FormMessage state={result} className="sm:col-span-6" /> : null}
    </div>
  );
}
