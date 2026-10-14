import { useMutation } from "@tanstack/react-query";
import { ExternalLink, Loader2, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { PreviewNotice } from "@/components/shared/preview-notice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyError, notifySuccess } from "@/lib/notify";
import { isWhatsAppConfigured, sendInvoiceViaWhatsApp, whatsAppChatLink } from "@/lib/whatsapp";

/**
 * Confirmation step for sending an invoice on WhatsApp.
 * Sends only through the server-side integration; never claims a send that didn't happen.
 */
export function WhatsAppSendDialog({
  open,
  onOpenChange,
  invoiceId,
  recipient,
  phone,
  invoiceNumber,
  companyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  recipient: string;
  phone: string | null;
  invoiceNumber: string;
  companyName: string;
}) {
  const defaultMessage = `Your invoice ${invoiceNumber} from ${companyName} is ready.`;
  const [message, setMessage] = useState(defaultMessage);
  const configured = isWhatsAppConfigured();
  const chatLink = phone ? whatsAppChatLink(phone, message) : null;

  const send = useMutation({
    mutationFn: () => sendInvoiceViaWhatsApp(invoiceId, message),
    onSuccess: (result) => {
      notifySuccess(
        result.status === "sent" ? "Invoice sent on WhatsApp" : "Invoice queued for WhatsApp",
        recipient,
      );
      onOpenChange(false);
    },
    onError: (error) => notifyError(error, "Invoice not sent"),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setMessage(defaultMessage);
        onOpenChange(next);
      }}
    >
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-success-soft text-success">
              <MessageCircle className="size-4" />
            </span>
            Send invoice via WhatsApp
          </DialogTitle>
          <DialogDescription>Review the recipient and message before sending.</DialogDescription>
        </DialogHeader>

        <dl className="grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              Send invoice to
            </dt>
            <dd className="mt-1 font-medium">{recipient}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Phone</dt>
            <dd className="mt-1 font-medium">{phone ?? "No phone on file"}</dd>
          </div>
        </dl>

        <div className="space-y-2">
          <Label htmlFor="wa-message">Message</Label>
          <Textarea
            id="wa-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-24 rounded-xl"
          />
        </div>

        {!configured && (
          <PreviewNotice>
            WhatsApp integration not configured. Nothing will be sent automatically — an admin needs
            to connect the WhatsApp Business API. You can open a chat and send the message yourself.
          </PreviewNotice>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!configured && chatLink ? (
            <Button asChild variant="outline" className="rounded-xl">
              <a href={chatLink} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Open WhatsApp chat
              </a>
            </Button>
          ) : null}
          <Button
            className="rounded-xl"
            disabled={!configured || !phone || send.isPending}
            onClick={() => send.mutate()}
          >
            {send.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}{" "}
            Send Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
