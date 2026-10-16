import { Field } from "@/components/forms/action-form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { VEHICLE_TYPES } from "@/lib/constants";
import type { Vehicle } from "@/lib/types";

/** Campos do cadastro de veículo (usar dentro de <ActionForm>). */
export function VehicleFields({ v, compact }: { v?: Partial<Vehicle>; compact?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Field name="plate" label="Placa" className="sm:col-span-2" hint="ABC1234 ou Mercosul ABC1D23">
        <Input id="plate" name="plate" defaultValue={v?.plate ?? ""} maxLength={8} className="font-display uppercase tracking-widest" autoComplete="off" />
      </Field>
      <Field name="brand" label="Marca" required className="sm:col-span-2">
        <Input id="brand" name="brand" defaultValue={v?.brand} required placeholder="Ex.: Toyota" />
      </Field>
      <Field name="model" label="Modelo" required className="sm:col-span-2">
        <Input id="model" name="model" defaultValue={v?.model} required placeholder="Ex.: Corolla XEi" />
      </Field>
      <Field name="manufacture_year" label="Ano fabricação" className="sm:col-span-1">
        <Input id="manufacture_year" name="manufacture_year" inputMode="numeric" maxLength={4} defaultValue={v?.manufacture_year ?? ""} />
      </Field>
      <Field name="model_year" label="Ano modelo" className="sm:col-span-1">
        <Input id="model_year" name="model_year" inputMode="numeric" maxLength={4} defaultValue={v?.model_year ?? ""} />
      </Field>
      <Field name="color" label="Cor" className="sm:col-span-2">
        <Input id="color" name="color" defaultValue={v?.color ?? ""} />
      </Field>
      <Field name="vehicle_type" label="Tipo" className="sm:col-span-2">
        <Select id="vehicle_type" name="vehicle_type" defaultValue={v?.vehicle_type ?? "carro"}>
          {Object.entries(VEHICLE_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </Field>
      <Field name="mileage_km" label="Quilometragem" className="sm:col-span-2" hint="Opcional">
        <Input id="mileage_km" name="mileage_km" inputMode="numeric" defaultValue={v?.mileage_km ?? ""} />
      </Field>
      {!compact ? (
        <Field name="notes" label="Observações sobre o veículo" className="sm:col-span-4">
          <Textarea id="notes" name="notes" rows={2} defaultValue={v?.notes ?? ""} placeholder="Ex.: blindado, envelopado, rodas aro 20…" />
        </Field>
      ) : null}
    </div>
  );
}
