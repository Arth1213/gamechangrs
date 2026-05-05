import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const VerifyConnectionPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState<"loading" | "valid" | "invalid" | "verified" | "expired">("loading");
  const [connectionDetails, setConnectionDetails] = useState<{
    senderName: string;
    senderType: string;
    senderEmail: string;
  } | null>(null);

  const code = searchParams.get("code");
  const connectionId = searchParams.get("connectionId");

  useEffect(() => {
    if (code && connectionId) {
      verifyCode();
    } else {
      setStatus("invalid");
      setLoading(false);
    }
  }, [code, connectionId]);

  const verifyCode = async () => {
    try {
      // Fetch connection details
      const { data: connection, error } = await supabase
        .from("connections")
        .select("*")
        .eq("id", connectionId)
        .eq("code", code)
        .single();

      if (error || !connection) {
        setStatus("invalid");
        setLoading(false);
        return;
      }

      // Check if already verified
      if (connection.verified) {
        setStatus("verified");
        setLoading(false);
        return;
      }

      // Check if expired
      if (new Date(connection.expires_at) < new Date()) {
        setStatus("expired");
        setLoading(false);
        return;
      }

      // Get sender details
      let senderName = "";
      let senderType = connection.requester_type || "user";
      
      if (senderType === "player") {
        const { data: player } = await supabase
          .from("players")
          .select("name")
          .eq("id", connection.student_id)
          .single();
        senderName = player?.name || "Unknown Player";
      } else {
        const { data: coach } = await supabase
          .from("coaches")
          .select("name")
          .eq("id", connection.coach_id)
          .single();
        senderName = coach?.name || "Unknown Coach";
      }

      setConnectionDetails({
        senderName,
        senderType,
        senderEmail: connection.requester_email || "",
      });
      setStatus("valid");
    } catch (error) {
      console.error("Error verifying connection:", error);
      setStatus("invalid");
    } finally {
      setLoading(false);
    }
  };

  const acceptConnection = async () => {
    if (!connectionId) return;

    setVerifying(true);
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

      // Send confirmation email to the requester
      if (connectionDetails) {
        await supabase.functions.invoke("send-connection-email", {
          body: {
            connectionId,
            action: "accepted",
          },
        });
      }

      toast({
        title: "Connection Verified!",
        description: "You are now connected. You can book sessions and see contact information.",
      });

      setStatus("verified");
    } catch (error: any) {
      console.error("Error accepting connection:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to verify connection",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying connection...</p>
        </div>
      );
    }

    switch (status) {
      case "valid":
        return (
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Connection Request</h2>
              <p className="text-muted-foreground">
                <strong>{connectionDetails?.senderName}</strong> ({connectionDetails?.senderType}) wants to connect with you.
              </p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-4 text-left">
              <h4 className="font-medium mb-2">By accepting, you'll be able to:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Share contact information</li>
                <li>• Book coaching sessions</li>
                <li>• Track your training progress together</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" asChild>
                <Link to="/">Decline</Link>
              </Button>
              <Button
                variant="hero"
                onClick={acceptConnection}
                disabled={verifying}
                className="min-w-32"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Accepting...
                  </>
                ) : (
                  "Accept Connection"
                )}
              </Button>
            </div>
          </div>
        );

      case "verified":
        return (
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-green-500 mb-2">Connected!</h2>
              <p className="text-muted-foreground">
                Your connection has been verified. You can now book sessions and see contact information.
              </p>
            </div>
            <Button variant="hero" asChild>
              <Link to="/coaching-marketplace">Go to Dashboard</Link>
            </Button>
          </div>
        );

      case "expired":
        return (
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10 text-yellow-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-yellow-500 mb-2">Link Expired</h2>
              <p className="text-muted-foreground">
                This verification link has expired. Please ask the sender to send a new connection request.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/coaching-marketplace">Go to Marketplace</Link>
            </Button>
          </div>
        );

      case "invalid":
      default:
        return (
          <div className="text-center py-8 space-y-6">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-destructive mb-2">Invalid Link</h2>
              <p className="text-muted-foreground">
                This verification link is invalid or has already been used.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/coaching-marketplace">Go to Marketplace</Link>
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-lg">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/coaching-marketplace">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Link>
          </Button>

          <div className="rounded-2xl bg-gradient-card border border-border p-8">
            <h1 className="font-display text-3xl font-bold text-foreground mb-2 text-center">
              Verify Connection
            </h1>
            {renderContent()}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default VerifyConnectionPage;
