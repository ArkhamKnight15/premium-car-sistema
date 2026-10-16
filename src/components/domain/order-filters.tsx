import Link from "next/link";
import { Filter } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button, buttonClass } from "@/components/ui/button";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import type { Employee, Service } from "@/lib/types";

export type OrderFilterValues = { status?: string; de?: string; ate?: string; func?: string; placa?: string; cliente?: string; servico?: string; pag?: string; view?: string };

/** Filtros por status, data, funcionário, placa, cliente e serviço (via URL). */
export function OrderFilters({ values, employees, services, basePath, statuses, showPayment = true }: {
  values: OrderFilterValues; employees: Employee[]; services: Service[]; basePath: string; statuses: (keyof typeof ORDER_STATUS)[]; showPayment?: boolean;
}) {
  const active = Object.entries(values).some(([k, v]) => v && k !== "view");
  return (
    <form action={basePath} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      {values.view ? <input type="hidden" name="view" value={values.view} /> : null}
      <Select name="status" defaultValue={values.status ?? ""} aria-label="Status">
        <option value="">Todos os status</option>
        {statuses.map((s) => <option key={s} value={s}>{ORDER_STATUS[s].label}</option>)}
      </Select>
      <Select name="func" defaultValue={values.func ?? ""} aria-label="Funcionário">
        <option value="">Todos os funcionários</option>
        {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
      </Select>
      <Select name="servico" defaultValue={values.servico ?? ""} aria-label="Serviço">
        <option value="">Todos os serviços</option>
        {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>
      {showPayment ? (
        <Select name="pag" defaultValue={values.pag ?? ""} aria-label="Pagamento">
          <option value="">Qualquer pagamento</option>
          {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      ) : <span className="hidden lg:block" />}
      <Input name="placa" defaultValue={values.placa} placeholder="Placa" className="uppercase" aria-label="Placa" />
      <Input name="cliente" defaultValue={values.cliente} placeholder="Nome do cliente" aria-label="Cliente" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" name="de" defaultValue={values.de} aria-label="Entrada a partir de" title="Entrada a partir de" />
        <Input type="date" name="ate" defaultValue={values.ate} aria-label="Entrada até" title="Entrada até" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" className="flex-1"><Filter /> Filtrar</Button>
        {active ? <Link href={`${basePath}${values.view ? `?view=${values.view}` : ""}`} className={buttonClass("ghost")}>Limpar</Link> : null}
      </div>
    </form>
  );
}
