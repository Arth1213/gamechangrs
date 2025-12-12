import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, MapPin, Clock, Star, ExternalLink, Award, Users, Calendar } from "lucide-react";
import { ProfileAvatar } from "@/components/coaching/ProfileAvatar";

interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  timezone: string | null;
  bio: string | null;
  specialties: string[];
  coaching_level: string | null;
  years_experience: number | null;
  teams_coached: string[];
  notable_players_coached: string[];
  external_links: string[];
  average_rating: number | null;
  number_of_ratings: number | null;
  is_verified: boolean | null;
  profile_picture_url: string | null;
}

interface CoachingCategory {
  id: string;
  name: string;
}

const CoachProfile = () => {
  const { coachId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [categories, setCategories] = useState<CoachingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    fetchCoach();
    fetchCategories();
  }, [coachId]);

  const fetchCoach = async () => {
    if (!coachId) return;

    const { data, error } = await supabase
      .from("coaches")
      .select("*")
      .eq("id", coachId)
      .eq("is_active", true)
      .single();

    if (error) {
      console.error("Error fetching coach:", error);
      setLoading(false);
      return;
    }

    setCoach(data as Coach);
    setIsOwnProfile(user?.id === data.user_id);
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("coaching_categories")
      .select("*");
    if (data) setCategories(data as CoachingCategory[]);
  };

  const getCategoryName = (id: string) => {
    return categories.find(c => c.id === id)?.name || id;
  };

  const formatCoachingLevel = (level: string | null) => {
    if (!level) return "Not specified";
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!coach) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <section className="pt-32 pb-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-4xl font-bold text-foreground mb-4">
              Coach Not Found
            </h1>
            <p className="text-muted-foreground mb-8">
              This coach profile doesn't exist or is no longer active.
            </p>
            <Button asChild>
              <Link to="/coaching-marketplace">Back to Marketplace</Link>
            </Button>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/coaching-marketplace">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Link>
          </Button>

          {/* Profile Header */}
          <div className="rounded-2xl bg-gradient-card border border-border p-8 mb-6">
            <div className="flex flex-col md:flex-row gap-6">
              <ProfileAvatar
                name={coach.name}
                imageUrl={coach.profile_picture_url}
                size="lg"
              />
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="font-display text-3xl font-bold text-foreground">
                    {coach.name}
                  </h1>
                  {coach.is_verified && (
                    <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                      Verified
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-muted-foreground mb-4">
                  {coach.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {coach.location}
                    </span>
                  )}
                  {coach.timezone && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {coach.timezone}
                    </span>
                  )}
                  {coach.average_rating && coach.number_of_ratings && coach.number_of_ratings > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                      {coach.average_rating.toFixed(1)} ({coach.number_of_ratings} reviews)
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {formatCoachingLevel(coach.coaching_level)} Level
                  </Badge>
                  {coach.years_experience && (
                    <Badge variant="outline">
                      {coach.years_experience} years experience
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              {isOwnProfile ? (
                <Button asChild>
                  <Link to="/coaching-marketplace/coach-dashboard">
                    Go to Dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild>
                    <Link to={`/coaching-marketplace/book/${coach.id}`}>
                      <Calendar className="w-4 h-4 mr-2" />
                      Book Session
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to={`/coaching-marketplace/connect/${coach.id}`}>
                      Connect
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Bio */}
          {coach.bio && (
            <div className="rounded-2xl bg-gradient-card border border-border p-6 mb-6">
              <h2 className="font-display text-xl font-bold text-foreground mb-4">
                About
              </h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{coach.bio}</p>
            </div>
          )}

          {/* Specialties */}
          {coach.specialties && coach.specialties.length > 0 && (
            <div className="rounded-2xl bg-gradient-card border border-border p-6 mb-6">
              <h2 className="font-display text-xl font-bold text-foreground mb-4">
                <Award className="w-5 h-5 inline mr-2" />
                Specialties
              </h2>
              <div className="flex flex-wrap gap-2">
                {coach.specialties.map((specialty) => (
                  <Badge key={specialty} variant="default">
                    {getCategoryName(specialty)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {coach.teams_coached && coach.teams_coached.length > 0 && (
              <div className="rounded-2xl bg-gradient-card border border-border p-6">
                <h2 className="font-display text-xl font-bold text-foreground mb-4">
                  <Users className="w-5 h-5 inline mr-2" />
                  Teams Coached
                </h2>
                <ul className="space-y-2">
                  {coach.teams_coached.map((team, index) => (
                    <li key={index} className="text-muted-foreground">
                      • {team}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {coach.notable_players_coached && coach.notable_players_coached.length > 0 && (
              <div className="rounded-2xl bg-gradient-card border border-border p-6">
                <h2 className="font-display text-xl font-bold text-foreground mb-4">
                  <Star className="w-5 h-5 inline mr-2" />
                  Notable Players Coached
                </h2>
                <ul className="space-y-2">
                  {coach.notable_players_coached.map((player, index) => (
                    <li key={index} className="text-muted-foreground">
                      • {player}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* External Links */}
          {coach.external_links && coach.external_links.length > 0 && (
            <div className="rounded-2xl bg-gradient-card border border-border p-6">
              <h2 className="font-display text-xl font-bold text-foreground mb-4">
                <ExternalLink className="w-5 h-5 inline mr-2" />
                External Links
              </h2>
              <div className="flex flex-wrap gap-4">
                {coach.external_links.map((link, index) => (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {(() => {
                      try {
                        return new URL(link).hostname;
                      } catch {
                        return link;
                      }
                    })()}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CoachProfile;
