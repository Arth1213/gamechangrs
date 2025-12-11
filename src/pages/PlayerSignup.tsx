import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { CoachingCategory, PlayerProfileForm, ExperienceLevel, PreferredMode } from "@/types/coaching";

const PlayerSignup = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [categories, setCategories] = useState<CoachingCategory[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [existingProfileId, setExistingProfileId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<PlayerProfileForm>({
    name: "",
    email: "",
    phone: "",
    location: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    age_group: "",
    playing_role: "",
    training_categories_needed: [],
    experience_level: "beginner",
    matches_played: 0,
    batting_strike_rate: null,
    batting_average: null,
    bowling_economy: null,
    best_figures: "",
    external_links: [],
    preferred_mode: "either",
    preferred_days: [],
    preferred_time_range: "",
  });

  const [linkInput, setLinkInput] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  // Update form data when user is available
  useEffect(() => {
    if (user && !isEditMode) {
      setFormData(prev => ({
        ...prev,
        name: user.user_metadata?.full_name || prev.name,
        email: user.email || prev.email,
      }));
    }
  }, [user, isEditMode]);

  // Check for existing profile after auth is loaded
  useEffect(() => {
    if (authLoading) {
      return;
    }
    
    if (user) {
      checkExistingProfile();
    } else {
      setCheckingProfile(false);
    }
  }, [user, authLoading]);

  const checkExistingProfile = async () => {
    if (!user) {
      setCheckingProfile(false);
      return;
    }
    
    try {
      const { data: existingPlayer } = await supabase
        .from("players")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (existingPlayer) {
        // Load existing data for editing
        setIsEditMode(true);
        setExistingProfileId(existingPlayer.id);
        setFormData({
          name: existingPlayer.name || "",
          email: existingPlayer.email || "",
          phone: existingPlayer.phone || "",
          location: existingPlayer.location || "",
          timezone: existingPlayer.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          age_group: existingPlayer.age_group || "",
          playing_role: existingPlayer.playing_role || "",
          training_categories_needed: existingPlayer.training_categories_needed || [],
          experience_level: (existingPlayer.experience_level || "beginner") as ExperienceLevel,
          matches_played: existingPlayer.matches_played || 0,
          batting_strike_rate: existingPlayer.batting_strike_rate,
          batting_average: existingPlayer.batting_average,
          bowling_economy: existingPlayer.bowling_economy,
          best_figures: existingPlayer.best_figures || "",
          external_links: existingPlayer.external_links || [],
          preferred_mode: (existingPlayer.preferred_mode || "either") as PreferredMode,
          preferred_days: existingPlayer.preferred_days || [],
          preferred_time_range: existingPlayer.preferred_time_range || "",
        });
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
        description: "Please sign in to create a player profile.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (formData.training_categories_needed.length === 0) {
      toast({
        title: "Training Categories Required",
        description: "Please select at least one training category you need.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const profileData = {
        ...formData,
        external_links: formData.external_links.filter(Boolean),
        preferred_days: formData.preferred_days.filter(Boolean),
      };

      // Double-check for existing profile to handle race conditions
      const { data: existingPlayer } = await supabase
        .from("players")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingPlayer || (isEditMode && existingProfileId)) {
        // Update existing profile
        const profileIdToUpdate = existingPlayer?.id || existingProfileId;
        const { error } = await supabase
          .from("players")
          .update(profileData)
          .eq("id", profileIdToUpdate);

        if (error) throw error;

        toast({
          title: "Profile Updated!",
          description: "Your player profile has been updated successfully.",
        });
      } else {
        // Create new profile
        const { error } = await supabase.from("players").insert([
          {
            user_id: user.id,
            ...profileData,
          },
        ]);

        if (error) throw error;

        toast({
          title: "Profile Created!",
          description: "Your player profile has been created successfully.",
        });
      }

      navigate("/coaching-marketplace/player-dashboard");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setFormData((prev) => ({
      ...prev,
      training_categories_needed: prev.training_categories_needed.includes(categoryId)
        ? prev.training_categories_needed.filter((id) => id !== categoryId)
        : [...prev.training_categories_needed, categoryId],
    }));
  };

  const toggleDay = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      preferred_days: prev.preferred_days.includes(day)
        ? prev.preferred_days.filter((d) => d !== day)
        : [...prev.preferred_days, day],
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

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
            {isEditMode ? "Update Player Profile" : "Create Player Profile"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isEditMode ? "Update your player profile details" : "Set up your player profile to find the perfect coach"}
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
                <div>
                  <Label htmlFor="age_group">Age Group</Label>
                  <Input
                    id="age_group"
                    value={formData.age_group}
                    onChange={(e) => setFormData({ ...formData, age_group: e.target.value })}
                    className="mt-2"
                    placeholder="e.g., U-15, U-18, Senior"
                  />
                </div>
                <div>
                  <Label htmlFor="playing_role">Playing Role</Label>
                  <Input
                    id="playing_role"
                    value={formData.playing_role}
                    onChange={(e) => setFormData({ ...formData, playing_role: e.target.value })}
                    className="mt-2"
                    placeholder="e.g., Batsman, Bowler, All-rounder"
                  />
                </div>
              </div>
            </div>

            {/* Training Needs */}
            <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                Training Needs
              </h2>

              <div>
                <Label>Training Categories Needed *</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Select all areas you want coaching in
                </p>
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Badge
                      key={category.id}
                      variant={formData.training_categories_needed.includes(category.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleCategory(category.id)}
                    >
                      {formData.training_categories_needed.includes(category.id) && (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="experience_level">Experience Level *</Label>
                  <select
                    id="experience_level"
                    value={formData.experience_level}
                    onChange={(e) => setFormData({ ...formData, experience_level: e.target.value as ExperienceLevel })}
                    className="w-full h-10 px-4 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mt-2"
                    required
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="matches_played">Matches Played</Label>
                  <Input
                    id="matches_played"
                    type="number"
                    min="0"
                    value={formData.matches_played}
                    onChange={(e) => setFormData({ ...formData, matches_played: parseInt(e.target.value) || 0 })}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                Performance Stats (Optional)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="batting_strike_rate">Batting Strike Rate</Label>
                  <Input
                    id="batting_strike_rate"
                    type="number"
                    step="0.01"
                    value={formData.batting_strike_rate || ""}
                    onChange={(e) => setFormData({ ...formData, batting_strike_rate: e.target.value ? parseFloat(e.target.value) : null })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="batting_average">Batting Average</Label>
                  <Input
                    id="batting_average"
                    type="number"
                    step="0.01"
                    value={formData.batting_average || ""}
                    onChange={(e) => setFormData({ ...formData, batting_average: e.target.value ? parseFloat(e.target.value) : null })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="bowling_economy">Bowling Economy</Label>
                  <Input
                    id="bowling_economy"
                    type="number"
                    step="0.01"
                    value={formData.bowling_economy || ""}
                    onChange={(e) => setFormData({ ...formData, bowling_economy: e.target.value ? parseFloat(e.target.value) : null })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="best_figures">Best Figures</Label>
                  <Input
                    id="best_figures"
                    value={formData.best_figures}
                    onChange={(e) => setFormData({ ...formData, best_figures: e.target.value })}
                    className="mt-2"
                    placeholder="e.g., 5/25"
                  />
                </div>
              </div>

              <div>
                <Label>External Links (Videos, CricHQ, YouTube)</Label>
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
            </div>

            {/* Preferences */}
            <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
              <h2 className="font-display text-2xl font-bold text-foreground mb-4">
                Preferences
              </h2>

              <div>
                <Label htmlFor="preferred_mode">Preferred Mode *</Label>
                <select
                  id="preferred_mode"
                  value={formData.preferred_mode}
                  onChange={(e) => setFormData({ ...formData, preferred_mode: e.target.value as PreferredMode })}
                  className="w-full h-10 px-4 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mt-2"
                  required
                >
                  <option value="online">Online</option>
                  <option value="in-person">In-Person</option>
                  <option value="either">Either</option>
                </select>
              </div>

              <div>
                <Label>Preferred Days</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {daysOfWeek.map((day) => (
                    <Badge
                      key={day}
                      variant={formData.preferred_days.includes(day) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleDay(day)}
                    >
                      {formData.preferred_days.includes(day) && (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      {day}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="preferred_time_range">Preferred Time Range</Label>
                <Input
                  id="preferred_time_range"
                  value={formData.preferred_time_range}
                  onChange={(e) => setFormData({ ...formData, preferred_time_range: e.target.value })}
                  className="mt-2"
                  placeholder="e.g., 6 PM - 8 PM"
                />
              </div>
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update Player Profile" : "Create Player Profile")}
            </Button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PlayerSignup;

