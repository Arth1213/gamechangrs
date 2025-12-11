import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle, XCircle, Clock, Mail, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { Connection } from "@/types/coaching";
import { generateConnectionCode, getCodeExpiration, isValidConnectionCode } from "@/lib/connection-codes";

const ConnectionVerification = () => {
  const { coachId, studentId } = useParams<{ coachId?: string; studentId?: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [code, setCode] = useState("");
  const [otherPartyCode, setOtherPartyCode] = useState("");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (coachId || studentId) {
      fetchConnection();
    }
  }, [coachId, studentId]);

  useEffect(() => {
    if (connection && !connection.verified) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((new Date(connection.expires_at).getTime() - Date.now()) / 1000));
        setTimeRemaining(remaining);
        if (remaining === 0) {
          clearInterval(interval);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [connection]);

  const fetchConnection = async () => {
    if (!user) return;

    try {
      let query = supabase.from("connections").select("*");
      
      if (coachId) {
        query = query.eq("coach_id", coachId);
        const { data: player } = await supabase
          .from("players")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (player) query = query.eq("student_id", player.id);
      } else if (studentId) {
        query = query.eq("student_id", studentId);
        const { data: coach } = await supabase
          .from("coaches")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (coach) query = query.eq("coach_id", coach.id);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setConnection(data);
        setCode(data.code);
      }
    } catch (error) {
      console.error("Error fetching connection:", error);
    }
  };

  const createConnection = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to request a connection.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let studentIdValue: string;
      let coachIdValue: string;

      if (coachId) {
        const { data: player } = await supabase
          .from("players")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (!player) throw new Error("Player profile not found");
        studentIdValue = player.id;
        coachIdValue = coachId;
      } else if (studentId) {
        const { data: coach } = await supabase
          .from("coaches")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (!coach) throw new Error("Coach profile not found");
        coachIdValue = coach.id;
        studentIdValue = studentId;
      } else {
        throw new Error("Invalid connection request");
      }

      const connectionCode = generateConnectionCode();
      const expiresAt = getCodeExpiration();

      const { data, error } = await supabase
        .from("connections")
        .insert([
          {
            student_id: studentIdValue,
            coach_id: coachIdValue,
            code: connectionCode,
            expires_at: expiresAt.toISOString(),
            verified: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setConnection(data);
      setCode(connectionCode);
      
      toast({
        title: "Connection Code Generated",
        description: "Share this code with the other party. It expires in 10 minutes.",
      });
    } catch (error: any) {
      console.error("Error creating connection:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create connection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyConnection = async () => {
    if (!connection || !otherPartyCode) {
      toast({
        title: "Code Required",
        description: "Please enter the code from the other party.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Check if codes match
      if (!isValidConnectionCode(otherPartyCode, connection.code, connection.expires_at)) {
        toast({
          title: "Invalid Code",
          description: "The code doesn't match or has expired. Please request a new connection.",
          variant: "destructive",
        });
        return;
      }

      // Update connection to verified
      const { error } = await supabase
        .from("connections")
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      if (error) throw error;

      toast({
        title: "Connection Verified!",
        description: "You can now see contact information and book sessions.",
      });

      navigate(coachId ? "/coaching-marketplace/coach-dashboard" : "/coaching-marketplace/player-dashboard");
    } catch (error: any) {
      console.error("Error verifying connection:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to verify connection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/coaching-marketplace">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Link>
          </Button>

          <div className="rounded-2xl bg-gradient-card border border-border p-8">
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Verify Connection
            </h1>
            <p className="text-muted-foreground mb-8">
              Exchange codes to securely connect with {coachId ? "the coach" : "the player"}
            </p>

            {!connection ? (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground mb-4">
                    To connect securely, both parties need to exchange a verification code.
                    This ensures privacy and prevents unwanted connections.
                  </p>
                  <Button onClick={createConnection} disabled={loading} variant="hero" className="w-full">
                    {loading ? "Generating Code..." : "Generate Connection Code"}
                  </Button>
                </div>
              </div>
            ) : connection.verified ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                <h2 className="font-display text-2xl font-bold text-foreground">
                  Connection Verified!
                </h2>
                <p className="text-muted-foreground">
                  You are now connected. You can view contact information and book sessions.
                </p>
                <Button asChild variant="hero">
                  <Link to={coachId ? "/coaching-marketplace/coach-dashboard" : "/coaching-marketplace/player-dashboard"}>
                    Go to Dashboard
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Your Code */}
                <div className="p-6 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between mb-4">
                    <Label className="text-lg font-semibold">Your Code</Label>
                    {timeRemaining > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {formatTime(timeRemaining)} remaining
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-mono font-bold text-primary mb-2 tracking-wider">
                      {code}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Share this code with the other party via email or phone
                    </p>
                  </div>
                </div>

                {/* Enter Other Party's Code */}
                <div className="p-6 rounded-xl bg-secondary border border-border">
                  <Label htmlFor="otherCode" className="text-lg font-semibold mb-4 block">
                    Enter {coachId ? "Coach's" : "Player's"} Code
                  </Label>
                  <Input
                    id="otherCode"
                    type="text"
                    maxLength={6}
                    value={otherPartyCode}
                    onChange={(e) => setOtherPartyCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="text-center text-2xl font-mono tracking-widest mb-4"
                  />
                  <Button
                    onClick={verifyConnection}
                    disabled={loading || otherPartyCode.length !== 6 || timeRemaining === 0}
                    variant="hero"
                    className="w-full"
                  >
                    {loading ? "Verifying..." : "Verify Connection"}
                  </Button>
                  {timeRemaining === 0 && (
                    <p className="text-sm text-destructive mt-2 text-center">
                      Code expired. Please request a new connection.
                    </p>
                  )}
                </div>

                {/* Instructions */}
                <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                  <h3 className="font-semibold mb-2">How it works:</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                    <li>Share your code with the other party</li>
                    <li>Ask them to enter your code on their end</li>
                    <li>Enter their code in the field above</li>
                    <li>Click "Verify Connection" when both codes are entered</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ConnectionVerification;

