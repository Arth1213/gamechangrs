import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { CoachingCategory, CoachProfileForm, CoachingLevel } from "@/types/coaching";

const CoachSignup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [categories, setCategories] = useState<CoachingCategory[]>([]);
  
  const [formData, setFormData] = useState<CoachProfileForm>({
    name: user?.user_metadata?.full_name || "",
    email: user?.email || "",
    phone: "",
    location: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    specialties: [],
    coaching_level: "intermediate",
    years_experience: 0,
    teams_coached: [],
    notable_players_coached: [],
    external_links: [],
    bio: "",
  });

  const [teamInput, setTeamInput] = useState("");
  const [playerInput, setPlayerInput] = useState("");
  const [linkInput, setLinkInput] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (user) {
      checkExistingProfile();
    } else {
      setCheckingProfile(false);
    }
  }, [user]);

  const checkExistingProfile = async () => {
    if (!user) {
      setCheckingProfile(false);
      return;
    }
    
    try {
      const { data: existingCoach } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (existingCoach) {
        toast({
          title: "Profile Exists",
          description: "You already have a coach profile. Redirecting to dashboard.",
        });
        navigate("/coaching-marketplace/coach-dashboard");
        return;
      }
    } catch (error) {
      console.error("Error checking profile:", error);
    }
    setCheckingProfile(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("coaching_categories")
      .select("*")
      .order("name");
    if (data) setCategories(data as CoachingCategory[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create a coach profile.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (formData.specialties.length === 0) {
      toast({
        title: "Specialties Required",
        description: "Please select at least one coaching specialty.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("coaches").insert([
        {
          user_id: user.id,
          ...formData,
          teams_coached: formData.teams_coached.filter(Boolean),
          notable_players_coached: formData.notable_players_coached.filter(Boolean),
          external_links: formData.external_links.filter(Boolean),
        },
      ]);

      if (error) throw error;

      toast({
        title: "Profile Created!",
        description: "Your coach profile has been created successfully.",
      });

      navigate("/coaching-marketplace/coach-dashboard");
    } catch (error: any) {
      console.error("Error creating profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSpecialty = (categoryId: string) => {
    setFormData((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(categoryId)
        ? prev.specialties.filter((id) => id !== categoryId)
        : [...prev.specialties, categoryId],
    }));
  };

  const addTeam = () => {
    if (teamInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        teams_coached: [...prev.teams_coached, teamInput.trim()],
      }));
      setTeamInput("");
    }
  };

  const removeTeam = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      teams_coached: prev.teams_coached.filter((_, i) => i !== index),
    }));
  };

  const addPlayer = () => {
    if (playerInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        notable_players_coached: [...prev.notable_players_coached, playerInput.trim()],
      }));
      setPlayerInput("");
    }
  };

  const removePlayer = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      notable_players_coached: prev.notable_players_coached.filter((_, i) => i !== index),
    }));
  };

  const addLink = () => {
    if (linkInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        external_links: [...prev.external_links, linkInput.trim()],
      }));
      setLinkInput("");
    }
  };

  const removeLink = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      external_links: prev.external_links.filter((_, i) => i !== index),
    }));
  };

  if (checkingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <Button variant="ghost" asChild className="mb-6">
            <Link to="/coaching-marketplace">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Link>
          </Button>

          <h1 className="font-display text-4xl font-bold text-foreground mb-2">
            Create Coach Profile
          </h1>
          <p className="text-muted-foreground mb-8">
            Set up your coaching profile to start connecting with players
          </p>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Info */}
            <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                Basic Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-2"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="mt-2"
                    placeholder="City, State"
                  />
                </div>
              </div>
            </div>

            {/* Coaching Details */}
            <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                Coaching Details
              </h2>

              <div>
                <Label>Specialties *</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Select all that apply
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Badge
                      key={category.id}
                      variant={formData.specialties.includes(category.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleSpecialty(category.id)}
                    >
                      {formData.specialties.includes(category.id) && (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coaching_level">Coaching Level *</Label>
                  <select
                    id="coaching_level"
                    value={formData.coaching_level}
                    onChange={(e) => setFormData({ ...formData, coaching_level: e.target.value as CoachingLevel })}
                    className="w-full h-10 px-4 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mt-2"
                    required
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="years_experience">Years of Experience *</Label>
                  <Input
                    id="years_experience"
                    type="number"
                    min="0"
                    value={formData.years_experience}
                    onChange={(e) => setFormData({ ...formData, years_experience: parseInt(e.target.value) || 0 })}
                    required
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label>Teams Coached</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={teamInput}
                    onChange={(e) => setTeamInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTeam())}
                    placeholder="Add team name"
                  />
                  <Button type="button" variant="outline" onClick={addTeam}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.teams_coached.map((team, index) => (
                    <Badge key={index} variant="secondary">
                      {team}
                      <button
                        type="button"
                        onClick={() => removeTeam(index)}
                        className="ml-2 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>Notable Players Coached</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={playerInput}
                    onChange={(e) => setPlayerInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addPlayer())}
                    placeholder="Add player name"
                  />
                  <Button type="button" variant="outline" onClick={addPlayer}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.notable_players_coached.map((player, index) => (
                    <Badge key={index} variant="secondary">
                      {player}
                      <button
                        type="button"
                        onClick={() => removePlayer(index)}
                        className="ml-2 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>External Links (YouTube, CricHQ, etc.)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
                    placeholder="https://..."
                  />
                  <Button type="button" variant="outline" onClick={addLink}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.external_links.map((link, index) => (
                    <Badge key={index} variant="secondary">
                      <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {link}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeLink(index)}
                        className="ml-2 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  className="mt-2"
                  placeholder="Tell players about your coaching style and experience..."
                />
              </div>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Creating Profile..." : "Create Coach Profile"}
            </Button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CoachSignup;

