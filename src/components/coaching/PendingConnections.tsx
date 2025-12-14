import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, CheckCircle, XCircle, Clock, 
  Mail, Loader2, RefreshCw 
} from "lucide-react";
import { format } from "date-fns";

interface PendingConnection {
  id: string;
  coach_id: string;
  student_id: string;
  status: string;
  requester_type: string;
  expires_at: string;
  created_at: string;
  coach?: { name: string; email: string };
  player?: { name: string; email: string };
}

interface PendingConnectionsProps {
  userType: "coach" | "player";
  profileId: string;
  onConnectionChange?: () => void;
}

export const PendingConnections = ({ 
  userType, 
  profileId,
  onConnectionChange 
}: PendingConnectionsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingConnections, setPendingConnections] = useState<PendingConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingConnections();
  }, [profileId, userType]);

  const fetchPendingConnections = async () => {
    try {
      let query = supabase
        .from("connections")
        .select("*")
        .eq("status", "pending")
        .eq("verified", false);

      if (userType === "coach") {
        query = query.eq("coach_id", profileId);
      } else {
        query = query.eq("student_id", profileId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch related names
      const connectionsWithNames = await Promise.all(
        (data || []).map(async (conn) => {
          if (userType === "coach") {
            // Fetch player name
            const { data: player } = await supabase
              .from("players")
              .select("name, email")
              .eq("id", conn.student_id)
              .single();
            return { ...conn, player };
          } else {
            // Fetch coach name
            const { data: coach } = await supabase
              .from("coaches")
              .select("name, email")
              .eq("id", conn.coach_id)
              .single();
            return { ...conn, coach };
          }
        })
      );

      setPendingConnections(connectionsWithNames);
    } catch (error) {
      console.error("Error fetching pending connections:", error);
    } finally {
      setLoading(false);
    }
  };

  const acceptConnection = async (connectionId: string, requesterEmail: string, requesterName: string) => {
    setActionLoading(connectionId);
    try {
      // Update connection to verified
      const { error: updateError } = await supabase
        .from("connections")
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
          status: "verified",
        })
        .eq("id", connectionId);

      if (updateError) throw updateError;

      // Send confirmation email
      const userName = user?.user_metadata?.full_name || "User";
      await supabase.functions.invoke("send-connection-email", {
        body: {
          connectionId,
          recipientEmail: requesterEmail,
          recipientName: requesterName,
          senderName: userName,
          senderType: userType,
          verificationCode: "",
          action: "accepted",
        },
      });

      toast({
        title: "Connection Accepted!",
        description: `You are now connected with ${requesterName}.`,
      });

      fetchPendingConnections();
      onConnectionChange?.();
    } catch (error: any) {
      console.error("Error accepting connection:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept connection",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const declineConnection = async (connectionId: string) => {
    setActionLoading(connectionId);
    try {
      const { error } = await supabase
        .from("connections")
        .delete()
        .eq("id", connectionId);

      if (error) throw error;

      toast({
        title: "Connection Declined",
        description: "The connection request has been declined.",
      });

      fetchPendingConnections();
    } catch (error: any) {
      console.error("Error declining connection:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to decline connection",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (pendingConnections.length === 0) {
    return null; // Don't show anything if no pending connections
  }

  return (
    <div className="rounded-2xl bg-gradient-card border-2 border-primary/50 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-lg flex items-center gap-2 text-foreground">
          <Mail className="w-5 h-5 text-primary" />
          Pending Connection Requests ({pendingConnections.length})
        </h4>
        <Button variant="ghost" size="sm" onClick={fetchPendingConnections}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="grid gap-3">
        {pendingConnections.map((conn) => {
          const isExpired = new Date(conn.expires_at) < new Date();
          const otherPartyName = userType === "coach" 
            ? conn.player?.name 
            : conn.coach?.name;
          const otherPartyEmail = userType === "coach"
            ? conn.player?.email
            : conn.coach?.email;

          return (
            <div
              key={conn.id}
              className={`rounded-xl border bg-background/50 p-4 ${isExpired ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {otherPartyName || "Unknown"}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {isExpired ? (
                      <span className="text-destructive">Expired</span>
                    ) : (
                      <span>Expires {format(new Date(conn.expires_at), "MMM d, h:mm a")}</span>
                    )}
                  </div>
                </div>
                
                {!isExpired && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => acceptConnection(conn.id, otherPartyEmail || "", otherPartyName || "")}
                      disabled={actionLoading === conn.id}
                    >
                      {actionLoading === conn.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-1" />
                      )}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => declineConnection(conn.id)}
                      disabled={actionLoading === conn.id}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
