import { RefObject, useState } from "react";
import { Download, Loader2, Mail, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { downloadBlob, renderReportFramePdf } from "@/lib/reportPdf";
import { cn } from "@/lib/utils";

type StandaloneReportActionsProps = {
  reportLabel: string;
  fileNameBase: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
  accessToken: string;
  onPrint?: (() => void) | null;
  disabled?: boolean;
  className?: string;
};

export default function StandaloneReportActions({
  reportLabel,
  fileNameBase,
  frameRef,
  accessToken,
  onPrint,
  disabled = false,
  className,
}: StandaloneReportActionsProps) {
  const { toast } = useToast();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "loading">("idle");
  const [emailStatus, setEmailStatus] = useState<"idle" | "loading">("idle");

  const isActionDisabled = disabled || !accessToken;

  const handleDownload = async () => {
    if (isActionDisabled || !frameRef.current) {
      return;
    }

    setDownloadStatus("loading");
    try {
      const pdf = await renderReportFramePdf(frameRef.current, fileNameBase);
      downloadBlob(pdf.blob, pdf.filename);
    } catch (error) {
      toast({
        title: "PDF download failed",
        description: error instanceof Error ? error.message : "The report PDF could not be downloaded right now.",
      });
    } finally {
      setDownloadStatus("idle");
    }
  };

  const handleEmail = async () => {
    if (isActionDisabled || !frameRef.current || !emailAddress.trim()) {
      return;
    }

    setEmailStatus("loading");
    try {
      const pdf = await renderReportFramePdf(frameRef.current, fileNameBase);
      const { data, error } = await supabase.functions.invoke("send-report-pdf", {
        body: {
          email: emailAddress.trim(),
          reportLabel,
          filename: pdf.filename,
          pdfBase64: pdf.base64,
        },
        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : undefined,
      });
      if (error) {
        throw error;
      }

      toast({
        title: "PDF sent",
        description: data?.message || `${reportLabel} PDF emailed successfully.`,
      });
      setEmailDialogOpen(false);
      setEmailAddress("");
    } catch (error) {
      toast({
        title: "Email delivery failed",
        description: error instanceof Error ? error.message : "The report PDF could not be emailed right now.",
      });
    } finally {
      setEmailStatus("idle");
    }
  };

  return (
    <>
      <div className={cn("flex flex-wrap gap-3", className)}>
        <Button type="button" variant="outline" onClick={() => onPrint?.()} disabled={disabled || !onPrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print / Save
        </Button>
        <Button type="button" variant="outline" onClick={() => void handleDownload()} disabled={isActionDisabled || !frameRef.current || downloadStatus === "loading"}>
          {downloadStatus === "loading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Download PDF
        </Button>
        <Button type="button" onClick={() => setEmailDialogOpen(true)} disabled={isActionDisabled || !frameRef.current}>
          <Mail className="mr-2 h-4 w-4" />
          Email PDF
        </Button>
      </div>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email {reportLabel} PDF</DialogTitle>
            <DialogDescription>
              Send the current standalone report as a preserved PDF attachment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="report-email-address">Email address</Label>
            <Input
              id="report-email-address"
              type="email"
              placeholder="name@example.com"
              value={emailAddress}
              onChange={(event) => setEmailAddress(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={emailStatus === "loading"}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleEmail()} disabled={!emailAddress.trim() || emailStatus === "loading"}>
              {emailStatus === "loading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
