import { queryOptions } from "@tanstack/react-query";
import { db, unwrap } from "@/lib/db/client";
import { queryKeys } from "@/lib/db/query-keys";
import type { EquipmentUnit, InsertRow, UpdateRow } from "@/lib/db/types";

export async function fetchEquipmentTypes() {
  return unwrap(await db().from("equipment_types").select("*").order("name"));
}

/** Physical units with their catalogue type. */
export async function fetchEquipmentUnits() {
  return unwrap(
    await db()
      .from("equipment_units")
      .select("*, equipment_type:equipment_types(id, name)")
      .order("created_at", { ascending: false }),
  );
}

/** One unit with its rental and sale history (each trimmed by RLS for the caller's role). */
export async function fetchEquipmentUnit(id: string) {
  return unwrap(
    await db()
      .from("equipment_units")
      .select(
        `*, equipment_type:equipment_types(id, name),
        rental_items(*, rental:rentals(id, rental_number, start_date, due_date, returned_date, status, delivery_status, customer:customers(id, name))),
        sale_items(*, sale:sales(id, sale_number, sale_date, status, customer:customers(id, name)))`,
      )
      .eq("id", id)
      .single(),
  );
}

export type EquipmentUnitInput = Pick<
  InsertRow<"equipment_units">,
  | "equipment_type_id"
  | "unit_code"
  | "serial_number"
  | "brand"
  | "model"
  | "purchase_date"
  | "status"
  | "notes"
  | "available_for"
  | "daily_rate"
  | "monthly_rate"
  | "sale_price"
>;

export async function createEquipmentUnit(input: EquipmentUnitInput) {
  return unwrap(await db().from("equipment_units").insert(input).select().single());
}

export async function updateEquipmentUnit(id: string, patch: UpdateRow<"equipment_units">) {
  return unwrap(await db().from("equipment_units").update(patch).eq("id", id).select().single());
}

/** "BiPAP Machine · Philips A40 (BIP-001)" */
export function unitLabel(
  unit: Pick<EquipmentUnit, "brand" | "model" | "unit_code"> & {
    equipment_type?: { name: string } | null;
  },
) {
  const model = [unit.brand, unit.model].filter(Boolean).join(" ");
  return [
    unit.equipment_type?.name ?? "Equipment",
    model ? `· ${model}` : "",
    unit.unit_code ? `(${unit.unit_code})` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const equipmentQueries = {
  types: () =>
    queryOptions({
      queryKey: queryKeys.equipmentTypes.list(),
      queryFn: fetchEquipmentTypes,
      staleTime: 5 * 60_000,
    }),
  units: () =>
    queryOptions({ queryKey: queryKeys.equipmentUnits.list(), queryFn: fetchEquipmentUnits }),
  unit: (id: string) =>
    queryOptions({
      queryKey: queryKeys.equipmentUnits.detail(id),
      queryFn: () => fetchEquipmentUnit(id),
    }),
};
