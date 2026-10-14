import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { TableSkeleton } from "@/components/shared/loaders";

/**
 * Renders the loading, error, empty or success branch of a query.
 *
 *   <QueryState query={useQuery(customerQueries.list())} empty={<EmptyState … />}>
 *     {(customers) => <CustomerTable rows={customers} />}
 *   </QueryState>
 */
export function QueryState<T>({
  query,
  children,
  loading = <TableSkeleton />,
  empty,
  isEmpty = defaultIsEmpty,
  errorTitle,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  errorTitle?: string;
}) {
  if (query.isPending) {
    // A disabled query (`enabled: false`) stays pending without fetching.
    const idle = query.fetchStatus === "idle";
    return <>{idle && empty !== undefined ? empty : loading}</>;
  }
  if (query.isError) {
    return (
      <ErrorState error={query.error} title={errorTitle} onRetry={() => void query.refetch()} />
    );
  }
  if (empty !== undefined && isEmpty(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}

function defaultIsEmpty(data: unknown) {
  return data == null || (Array.isArray(data) && data.length === 0);
}
