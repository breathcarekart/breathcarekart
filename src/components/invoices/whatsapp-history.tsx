import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataError } from "@/lib/db/errors";
import { formatDateTime } from "@/lib/format";
import {
  isWhatsAppConfigured,
  whatsAppQueries,
  type WhatsAppHistoryEntry,
  type WhatsAppHistoryTarget,
} from "@/lib/whatsapp";
import {
  campaignLabels,
  historyStatusLabels,
  historyStatusTone,
  maskDestination,
  modeLabels,
  safeHistoryError,
} from "@/lib/whatsapp-ui";

/** Every WhatsApp attempt for one invoice (dry runs, test sends, failures). Office roles only. */
export function WhatsAppHistory({ target }: { target: WhatsAppHistoryTarget }) {
  const configured = isWhatsAppConfigured();
  const history = useQuery({ ...whatsAppQueries.history(target), enabled: configured });
  // PGRST205: the table isn't in this database yet (migration not applied).
  const missingTable = history.error instanceof DataError && history.error.code === "PGRST205";

  return (
    <WhatsAppHistoryCard
      state={
        !configured
          ? { kind: "off" }
          : history.isPending
            ? { kind: "loading" }
            : history.error
              ? {
                  kind: "error",
                  message: missingTable
                    ? "WhatsApp history isn't available yet."
                    : "Couldn't load the WhatsApp history.",
                }
              : { kind: "ready", entries: history.data }
      }
      refreshing={history.isFetching}
      onRefresh={configured ? () => void history.refetch() : undefined}
    />
  );
}

export type HistoryState =
  | { kind: "off" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; entries: WhatsAppHistoryEntry[] };

/** The history card, driven only by props (no data fetching). */
export function WhatsAppHistoryCard({
  state,
  refreshing = false,
  onRefresh,
}: {
  state: HistoryState;
  refreshing?: boolean;
  onRefresh?: (() => void) | undefined;
}) {
  return (
    <Card className="gap-0 overflow-hidden p-0 shadow-xs">
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">WhatsApp history</h2>
          <p className="text-xs text-muted-foreground">
            “Accepted by AiSensy” is not a delivery confirmation.
          </p>
        </div>
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            aria-label="Refresh WhatsApp history"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        )}
      </div>
      <Separator />
      {state.kind === "off" ? (
        <Empty>Automatic WhatsApp sending isn't switched on yet.</Empty>
      ) : state.kind === "loading" ? (
        <Empty>
          <Loader2 className="mx-auto size-4 animate-spin" aria-label="Loading" />
        </Empty>
      ) : state.kind === "error" ? (
        <Empty>{state.message}</Empty>
      ) : state.entries.length === 0 ? (
        <Empty>No WhatsApp messages yet.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Date &amp; time</TableHead>
              <TableHead className="hidden sm:table-cell">Message</TableHead>
              <TableHead className="hidden md:table-cell">Sent to</TableHead>
              <TableHead className="text-right sm:text-left">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.entries.map((m) => {
              const detail = m.status === "failed" ? safeHistoryError(m.error_message) : null;
              return (
                <TableRow key={m.id}>
                  <TableCell className="align-top text-sm">
                    {formatDateTime(m.created_at)}
                    <span className="block text-xs text-muted-foreground">
                      {m.requester?.full_name ?? "Staff member"}
                      {/* Mode and destination fold in here on small screens. */}
                      <span className="sm:hidden">
                        {" "}
                        · {campaignLabels[m.campaign_name] ?? m.campaign_name} ·{" "}
                        {modeLabels[m.mode] ?? m.mode}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="hidden align-top text-sm sm:table-cell">
                    {campaignLabels[m.campaign_name] ?? m.campaign_name}
                    <span className="block text-xs text-muted-foreground">
                      {modeLabels[m.mode] ?? m.mode}
                    </span>
                    {m.is_resend ? (
                      <span className="block text-xs text-muted-foreground">Sent again</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap align-top font-mono text-xs md:table-cell">
                    {m.mode === "dry_run" ? (
                      <span className="font-sans text-muted-foreground">Not sent</span>
                    ) : (
                      maskDestination(m.destination)
                    )}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal text-right align-top sm:text-left">
                    <StatusBadge
                      tone={historyStatusTone(m.status)}
                      label={historyStatusLabels[m.status] ?? m.status}
                      className="normal-case"
                    />
                    {detail ? <p className="mt-1 text-xs text-danger">{detail}</p> : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}
