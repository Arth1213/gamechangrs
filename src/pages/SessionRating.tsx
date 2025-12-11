import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Session, Rating, Coach } from "@/types/coaching";
import { formatDate } from "@/lib/helpers";

const SessionRating = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [existingRating, setExistingRating] = useState<Rating | null>(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sessionId) {
      fetchData();
    }
  }, [sessionId]);

  const fetchData = async () => {
    if (!sessionId || !user) return;

    setLoading(true);
    try {
      // Fetch session
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (!sessionData) {
        toast({
          title: "Session Not Found",
          description: "This session does not exist.",
          variant: "destructive",
        });
        navigate("/coaching-marketplace/player-dashboard");
        return;
      }

      setSession(sessionData as Session);

      // Verify user owns this session
      const { data: playerData } = await supabase
        .from("players")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!playerData || playerData.id !== sessionData.student_id) {
        toast({
          title: "Access Denied",
          description: "You can only rate your own sessions.",
          variant: "destructive",
        });
        navigate("/coaching-marketplace/player-dashboard");
        return;
      }

      // Fetch coach
      const { data: coachData } = await supabase
        .from("coaches")
        .select("*")
        .eq("id", sessionData.coach_id)
        .single();

      if (coachData) setCoach(coachData as Coach);

      // Check for existing rating
      const { data: ratingData } = await supabase
        .from("ratings")
        .select("*")
        .eq("session_id", sessionId)
        .single();

      if (ratingData) {
        setExistingRating(ratingData);
        setRating(ratingData.rating);
        setReviewText(ratingData.review_text || "");
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load session information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a rating.",
        variant: "destructive",
      });
      return;
    }

    if (!session || !user) return;

    setSubmitting(true);
    try {
      if (existingRating) {
        // Update existing rating
        const { error } = await supabase
          .from("ratings")
          .update({
            rating,
            review_text: reviewText || null,
          })
          .eq("id", existingRating.id);

        if (error) throw error;

        toast({
          title: "Rating Updated",
          description: "Your rating has been updated successfully.",
        });
      } else {
        // Create new rating
        const { data: playerData } = await supabase
          .from("players")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!playerData) throw new Error("Player profile not found");

        const { error } = await supabase.from("ratings").insert([
          {
            session_id: session.id,
            coach_id: session.coach_id,
            student_id: playerData.id,
            rating,
            review_text: reviewText || null,
          },
        ]);

        if (error) throw error;

        toast({
          title: "Rating Submitted",
          description: "Thank you for your feedback!",
        });
      }

      navigate("/coaching-marketplace/player-dashboard");
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit rating. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !coach) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/coaching-marketplace/player-dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>

          <div className="rounded-2xl bg-gradient-card border border-border p-8">
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">
              Rate Your Session
            </h1>
            <p className="text-muted-foreground mb-8">
              Help other players by sharing your experience with {coach.name}
            </p>

            {/* Session Info */}
            <div className="p-6 rounded-xl bg-secondary border border-border mb-8">
              <h3 className="font-semibold text-foreground mb-2">Session Details</h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Date: {formatDate(session.session_date_time_utc, "long")}
                </p>
                <p>
                  Time: {new Date(session.session_date_time_utc).toLocaleTimeString()}
                </p>
                <p>Duration: {session.duration_minutes} minutes</p>
                <p>Coach: {coach.name}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Rating */}
              <div>
                <Label className="text-lg font-semibold mb-4 block">
                  Overall Rating *
                </Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      onMouseEnter={() => setHoveredRating(value)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`w-10 h-10 transition-colors ${
                          value <= (hoveredRating || rating)
                            ? "fill-primary text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      {rating} {rating === 1 ? "star" : "stars"}
                    </span>
                  )}
                </div>
              </div>

              {/* Review Text */}
              <div>
                <Label htmlFor="review" className="text-lg font-semibold mb-4 block">
                  Write a Review (Optional)
                </Label>
                <Textarea
                  id="review"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={6}
                  placeholder="Share your experience with this coach. What did you learn? What could be improved?"
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {reviewText.length} / 1000 characters
                </p>
              </div>

              <div className="flex gap-4">
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  disabled={submitting || rating === 0}
                  className="flex-1"
                >
                  {submitting
                    ? "Submitting..."
                    : existingRating
                    ? "Update Rating"
                    : "Submit Rating"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => navigate("/coaching-marketplace/player-dashboard")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SessionRating;

