import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CustomerForm } from "@/components/customers/customer-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createCustomer, customerQueries } from "@/lib/db/customers";
import { queryKeys } from "@/lib/db/query-keys";
import { notifyError, notifySuccess } from "@/lib/notify";

export const Route = createFileRoute("/_app/customers/new")({
  head: () => ({
    meta: [
      { title: "Add customer · Breath Care Kart" },
      {
        name: "description",
        content: "Add a patient with attender, contact and delivery details.",
      },
    ],
  }),
  component: AddCustomerPage,
});

function AddCustomerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const existing = useQuery(customerQueries.list());

  const create = useMutation({
    mutationFn: createCustomer,
    onSuccess: async (customer) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      notifySuccess("Customer added", customer.name);
      navigate({ to: "/customers/$customerId", params: { customerId: customer.id } });
    },
    onError: (error) => notifyError(error, "Couldn't add customer"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add customer"
        description="Patient, attender and delivery details used across rentals, sales and invoices."
        actions={
          <Button
            variant="ghost"
            className="rounded-xl"
            onClick={() => navigate({ to: "/customers" })}
          >
            <ArrowLeft className="size-4" /> Back to customers
          </Button>
        }
      />
      <CustomerForm
        existing={existing.data ?? []}
        submitting={create.isPending}
        submitLabel="Save customer"
        onSubmit={(input) => create.mutate(input)}
        onCancel={() => navigate({ to: "/customers" })}
        aside={
          <>
            <h2 className="text-base font-semibold">Before you save</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Fields marked * are required. These details flow into every invoice for this customer.
            </p>
            <Separator className="my-5" />
          </>
        }
      />
    </div>
  );
}
