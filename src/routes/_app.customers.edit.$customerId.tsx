import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CustomerForm } from "@/components/customers/customer-form";
import { CardsSkeleton } from "@/components/shared/loaders";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { customerQueries, updateCustomer } from "@/lib/db/customers";
import { queryKeys } from "@/lib/db/query-keys";
import { formatDateTime } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/notify";

export const Route = createFileRoute("/_app/customers/edit/$customerId")({
  head: () => ({ meta: [{ title: "Edit customer · Breath Care Kart" }] }),
  component: EditCustomerPage,
});

function EditCustomerPage() {
  const { customerId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const customer = useQuery(customerQueries.detail(customerId));
  const existing = useQuery(customerQueries.list());
  const back = () => navigate({ to: "/customers/$customerId", params: { customerId } });

  const save = useMutation({
    mutationFn: (input: Parameters<typeof updateCustomer>[1]) => updateCustomer(customerId, input),
    onSuccess: async (c) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.activity.all });
      notifySuccess("Customer updated", c.name);
      back();
    },
    onError: (error) => notifyError(error, "Couldn't update customer"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit customer"
        description={customer.data?.name}
        actions={
          <Button variant="ghost" className="rounded-xl" onClick={back}>
            <ArrowLeft className="size-4" /> Back to customer
          </Button>
        }
      />
      <QueryState
        query={customer}
        loading={<CardsSkeleton count={2} />}
        errorTitle="Couldn't load this customer"
      >
        {(c) => (
          <CustomerForm
            initial={c}
            existing={existing.data ?? []}
            submitting={save.isPending}
            submitLabel="Save changes"
            onSubmit={(input) => save.mutate(input)}
            onCancel={back}
            aside={
              <>
                <h2 className="text-base font-semibold">Record</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Last updated {formatDateTime(c.updated_at)}
                </p>
                <Separator className="my-5" />
              </>
            }
          />
        )}
      </QueryState>
    </div>
  );
}
