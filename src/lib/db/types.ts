import type { Database } from "@/lib/database.types";

type PublicSchema = Database["public"];

/** Row shape returned by `select *` on a table. */
export type Row<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
/** Shape accepted by `insert` on a table. */
export type InsertRow<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
/** Shape accepted by `update` on a table. */
export type UpdateRow<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
/** Postgres enum values. */
export type DbEnum<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];

export type Profile = Row<"profiles">;
export type Customer = Row<"customers">;
export type EquipmentType = Row<"equipment_types">;
export type EquipmentUnit = Row<"equipment_units">;
export type Rental = Row<"rentals">;
export type RentalItem = Row<"rental_items">;
export type Sale = Row<"sales">;
export type SaleItem = Row<"sale_items">;
export type Invoice = Row<"invoices">;
export type InvoiceItem = Row<"invoice_items">;
export type Payment = Row<"payments">;
export type DeliveryPhoto = Row<"delivery_photos">;
export type ActivityLogEntry = Row<"activity_log">;
export type CompanySettings = Row<"company_settings">;

export type EquipmentStatus = DbEnum<"equipment_status">;
export type RentalStatus = DbEnum<"rental_status">;
export type InvoiceStatus = DbEnum<"invoice_status">;
export type PaymentMethod = DbEnum<"payment_method">;
export type TransactionType = "rental" | "sale";
