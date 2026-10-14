/**
 * Central TanStack Query keys. Invalidate a whole domain with e.g.
 * `queryClient.invalidateQueries({ queryKey: queryKeys.customers.all })`.
 */
export const queryKeys = {
  profiles: {
    all: ["profiles"] as const,
    current: () => ["profiles", "current"] as const,
    list: () => ["profiles", "list"] as const,
  },
  settings: {
    all: ["settings"] as const,
    company: () => ["settings", "company"] as const,
  },
  equipmentTypes: {
    all: ["equipment-types"] as const,
    list: () => ["equipment-types", "list"] as const,
  },
  equipmentUnits: {
    all: ["equipment-units"] as const,
    list: () => ["equipment-units", "list"] as const,
    detail: (id: string) => ["equipment-units", "detail", id] as const,
  },
  customers: {
    all: ["customers"] as const,
    list: () => ["customers", "list"] as const,
    detail: (id: string) => ["customers", "detail", id] as const,
  },
  rentals: {
    all: ["rentals"] as const,
    list: () => ["rentals", "list"] as const,
    detail: (id: string) => ["rentals", "detail", id] as const,
  },
  sales: {
    all: ["sales"] as const,
    list: () => ["sales", "list"] as const,
  },
  invoices: {
    all: ["invoices"] as const,
    list: () => ["invoices", "list"] as const,
    detail: (id: string) => ["invoices", "detail", id] as const,
  },
  payments: {
    all: ["payments"] as const,
    list: () => ["payments", "list"] as const,
  },
  deliveryPhotos: {
    all: ["delivery-photos"] as const,
    byRental: (rentalId: string) => ["delivery-photos", rentalId] as const,
  },
  activity: {
    all: ["activity"] as const,
    list: (limit: number) => ["activity", "list", limit] as const,
    entities: (ids: string[]) => ["activity", "entities", ...ids] as const,
  },
};

/**
 * What to refresh after a business workflow, since one action touches several
 * domains (e.g. a rental changes equipment, invoices and activity).
 */
export const workflowKeys = [
  queryKeys.rentals.all,
  queryKeys.sales.all,
  queryKeys.invoices.all,
  queryKeys.payments.all,
  queryKeys.equipmentUnits.all,
  queryKeys.customers.all,
  queryKeys.activity.all,
];
