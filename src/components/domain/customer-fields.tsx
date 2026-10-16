"use client";
import { useState } from "react";
import { Field } from "@/components/forms/action-form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { UFS } from "@/lib/constants";
import { cep, doc, phone } from "@/lib/format";
import type { Customer } from "@/lib/types";

/** Campos do cadastro de cliente (usar dentro de <ActionForm>). */
export function CustomerFields({ c, compact }: { c?: Partial<Customer>; compact?: boolean }) {
  const [type, setType] = useState<"PF" | "PJ">(c?.person_type ?? "PF");
  const [address, setAddress] = useState(Boolean(c?.street || c?.city || c?.zip_code));
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Field name="person_type" label="Tipo" className="sm:col-span-2">
        <Select id="person_type" name="person_type" value={type} onChange={(e) => setType(e.target.value as "PF" | "PJ")}>
          <option value="PF">Pessoa física</option>
          <option value="PJ">Pessoa jurídica</option>
        </Select>
      </Field>
      <Field name="full_name" label={type === "PF" ? "Nome completo" : "Razão social"} required className="sm:col-span-4">
        <Input id="full_name" name="full_name" defaultValue={c?.full_name} required autoComplete="off" />
      </Field>
      <Field name="document" label={type === "PF" ? "CPF" : "CNPJ"} hint="Opcional" className="sm:col-span-2">
        <Input id="document" name="document" inputMode="numeric" defaultValue={c?.document ? doc(c.document) : ""} placeholder={type === "PF" ? "000.000.000-00" : "00.000.000/0000-00"} />
      </Field>
      <Field name="phone" label="Telefone" className="sm:col-span-2">
        <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={c?.phone ? phone(c.phone) : ""} placeholder="(11) 0000-0000" />
      </Field>
      <Field name="whatsapp" label="WhatsApp" className="sm:col-span-2">
        <Input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" defaultValue={c?.whatsapp ? phone(c.whatsapp) : ""} placeholder="(11) 90000-0000" />
      </Field>
      <Field name="email" label="E-mail" className="sm:col-span-6">
        <Input id="email" name="email" type="email" defaultValue={c?.email ?? ""} autoComplete="off" />
      </Field>

      {!address ? (
        <button type="button" onClick={() => setAddress(true)} className="text-left text-xs font-semibold text-gold-300 hover:text-gold-200 sm:col-span-6">
          + Adicionar endereço (opcional)
        </button>
      ) : (
        <>
          <Field name="zip_code" label="CEP" className="sm:col-span-2"><Input id="zip_code" name="zip_code" inputMode="numeric" defaultValue={cep(c?.zip_code)} /></Field>
          <Field name="street" label="Rua" className="sm:col-span-3"><Input id="street" name="street" defaultValue={c?.street ?? ""} /></Field>
          <Field name="number" label="Número" className="sm:col-span-1"><Input id="number" name="number" defaultValue={c?.number ?? ""} /></Field>
          <Field name="complement" label="Complemento" className="sm:col-span-2"><Input id="complement" name="complement" defaultValue={c?.complement ?? ""} /></Field>
          <Field name="district" label="Bairro" className="sm:col-span-2"><Input id="district" name="district" defaultValue={c?.district ?? ""} /></Field>
          <Field name="city" label="Cidade" className="sm:col-span-1"><Input id="city" name="city" defaultValue={c?.city ?? ""} /></Field>
          <Field name="state" label="UF" className="sm:col-span-1">
            <Select id="state" name="state" defaultValue={c?.state ?? ""}>
              <option value="">—</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </Field>
        </>
      )}
      {!compact ? (
        <Field name="notes" label="Observações internas" className="sm:col-span-6" hint="Visível apenas para a equipe.">
          <Textarea id="notes" name="notes" rows={3} defaultValue={c?.notes ?? ""} />
        </Field>
      ) : null}
    </div>
  );
}
