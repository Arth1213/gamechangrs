import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Loader2, Mail, CheckCircle } from "lucide-react";
import { generateConnectionCode } from "@/lib/connection-codes";

interface ConnectionRequestDialogProps {
  targetId: string;
  targetType: "coach" | "player";
  targetName: string;
  targetEmail: string;
  isConnected?: boolean;
  onSuccess?: () => void;
  // Controlled mode props
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: boolean;
}

export const ConnectionRequestDialog = ({
  targetId,
  targetType,
  targetName,
  targetEmail,
  isConnected = false,
  onSuccess,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  triggerButton = true,
}: ConnectionRequestDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  const sendConnectionRequest = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to send a connection request.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get sender's profile based on target type
      let senderId: string;
      let senderName: string;
      let senderEmail: string;
      let senderType: "coach" | "player";

      if (targetType === "coach") {
        // Sender is a player connecting to a coach
        const { data: player, error } = await supabase
          .from("players")
          .select("id, name, email")
          .eq("user_id", user.id)
          .single();
        
        if (error || !player) {
          throw new Error("You need a player profile to connect with coaches");
        }
        senderId = player.id;
        senderName = player.name;
        senderEmail = player.email;
        senderType = "player";
      } else {
        // Sender is a coach connecting to a player
        const { data: coach, error } = await supabase
          .from("coaches")
          .select("id, name, email")
          .eq("user_id", user.id)
          .single();
        
        if (error || !coach) {
          throw new Error("You need a coach profile to connect with players");
        }
        senderId = coach.id;
        senderName = coach.name;
        senderEmail = coach.email;
        senderType = "coach";
      }

      // Generate verification code (24 hour expiry for email)
      const verificationCode = generateConnectionCode();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Create connection record
      const connectionData = {
        coach_id: targetType === "coach" ? targetId : senderId,
        student_id: targetType === "player" ? targetId : senderId,
        code: verificationCode,
        expires_at: expiresAt.toISOString(),
        verified: false,
        status: "pending",
        requester_type: senderType,
        requester_email: senderEmail,
        recipient_email: targetEmail,
      };

      const { data: connection, error: connectionError } = await supabase
        .from("connections")
        .insert([connectionData])
        .select()
        .single();

      if (connectionError) {
        if (connectionError.code === "23505") {
          throw new Error("A connection request already exists");
        }
        throw connectionError;
      }

      // Send email via edge function
      const { error: emailError } = await supabase.functions.invoke("send-connection-email", {
        body: {
          connectionId: connection.id,
          recipientEmail: targetEmail,
          recipientName: targetName,
          senderName: senderName,
          senderType: senderType,
          verificationCode: verificationCode,
          action: "request",
        },
      });

      if (emailError) {
        console.error("Email error:", emailError);
        // Don't fail the whole operation if email fails
        toast({
          title: "Connection Request Sent",
          description: "Request created but email notification failed. Share the code manually.",
        });
      } else {
        toast({
          title: "Connection Request Sent!",
          description: `An email has been sent to ${targetName} with a verification link.`,
        });
      }

      setSent(true);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error sending connection request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send connection request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isConnected) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <CheckCircle className="w-4 h-4 text-green-500" />
        Connected
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {triggerButton && (
        <DialogTrigger asChild>
          <Button variant="hero" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Connect
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect with {targetName}</DialogTitle>
          <DialogDescription>
            Send a connection request to start your coaching journey together.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="font-semibold text-lg">Request Sent!</h3>
            <p className="text-muted-foreground text-sm">
              We've sent an email to {targetName} with a verification link. 
              They'll be able to accept your request by clicking the link.
            </p>
            <Button onClick={() => setOpen(false)} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-secondary/50 p-4">
              <h4 className="font-medium mb-2">What happens next?</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary">1.</span>
                  {targetName} will receive an email with your connection request
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">2.</span>
                  They can accept by clicking the verification link
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">3.</span>
                  Once verified, you can book sessions and see contact info
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="hero"
                className="flex-1 gap-2"
                onClick={sendConnectionRequest}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Request
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
