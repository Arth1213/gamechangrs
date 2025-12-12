import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, Plus, X, Save, Globe } from "lucide-react";
import { Player, CoachingCategory, ExperienceLevel, PreferredMode } from "@/types/coaching";
import { TIMEZONES, getBrowserTimezone } from "@/lib/timezones";
import { ProfilePictureUpload } from "./ProfilePictureUpload";
import { LocationAutocomplete } from "./LocationAutocomplete";

interface PlayerProfileEditorProps {
  player: Player;
  onSave: () => void;
}

export const PlayerProfileEditor = ({ player, onSave }: PlayerProfileEditorProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CoachingCategory[]>([]);
  const [formData, setFormData] = useState({
    name: player.name,
    phone: player.phone || "",
    location: player.location || "",
    timezone: player.timezone || "",
    age_group: player.age_group || "",
    playing_role: player.playing_role || "",
    training_categories_needed: player.training_categories_needed || [],
    experience_level: player.experience_level || "beginner",
    matches_played: player.matches_played || 0,
    batting_strike_rate: player.batting_strike_rate,
    batting_average: player.batting_average,
    bowling_economy: player.bowling_economy,
    best_figures: player.best_figures || "",
    external_links: player.external_links || [],
    preferred_mode: player.preferred_mode || "either",
    preferred_days: player.preferred_days || [],
    preferred_time_range: player.preferred_time_range || "",
    profile_picture_url: player.profile_picture_url || null,
  });

  const [linkInput, setLinkInput] = useState("");
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data } = await supabase
      .from("coaching_categories")
      .select("*")
      .order("name");
    if (data) setCategories(data as CoachingCategory[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("players")
        .update({
          name: formData.name,
          phone: formData.phone || null,
          location: formData.location || null,
          timezone: formData.timezone || null,
          age_group: formData.age_group || null,
          playing_role: formData.playing_role || null,
          training_categories_needed: formData.training_categories_needed,
          experience_level: formData.experience_level,
          matches_played: formData.matches_played,
          batting_strike_rate: formData.batting_strike_rate,
          batting_average: formData.batting_average,
          bowling_economy: formData.bowling_economy,
          best_figures: formData.best_figures || null,
          external_links: formData.external_links.filter(Boolean),
          preferred_mode: formData.preferred_mode,
          preferred_days: formData.preferred_days.filter(Boolean),
          preferred_time_range: formData.preferred_time_range || null,
          profile_picture_url: formData.profile_picture_url,
        })
        .eq("id", player.id);

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your player profile has been updated successfully.",
      });
      onSave();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      training_categories_needed: prev.training_categories_needed.includes(categoryId)
        ? prev.training_categories_needed.filter(id => id !== categoryId)
        : [...prev.training_categories_needed, categoryId],
    }));
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      preferred_days: prev.preferred_days.includes(day)
        ? prev.preferred_days.filter(d => d !== day)
        : [...prev.preferred_days, day],
    }));
  };

  const addLink = () => {
    if (linkInput.trim()) {
      setFormData(prev => ({
        ...prev,
        external_links: [...prev.external_links, linkInput.trim()],
      }));
      setLinkInput("");
    }
  };

  const removeLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      external_links: prev.external_links.filter((_, i) => i !== index),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile Picture */}
      <div className="rounded-2xl bg-gradient-card border border-border p-6">
        <h3 className="font-display text-xl font-bold text-foreground mb-4">Profile Picture</h3>
        <ProfilePictureUpload
          currentImageUrl={formData.profile_picture_url}
          name={formData.name}
          onImageUploaded={(url) => setFormData({ ...formData, profile_picture_url: url })}
        />
      </div>

      {/* Basic Info */}
      <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
        <h3 className="font-display text-xl font-bold text-foreground">Basic Information</h3>
        
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
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="location">Location</Label>
            <LocationAutocomplete
              id="location"
              value={formData.location}
              onChange={(value) => setFormData({ ...formData, location: value })}
              className="mt-2"
              placeholder="City, State"
            />
          </div>
          <div>
            <Label htmlFor="timezone">
              <span className="flex items-center gap-1">
                <Globe className="w-4 h-4" />
                Timezone
              </span>
            </Label>
            <select
              id="timezone"
              value={formData.timezone || getBrowserTimezone()}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
              className="w-full h-10 px-4 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mt-2"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
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
              placeholder="e.g., Batsman, Bowler"
            />
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

      {/* Training Needs */}
      <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
        <h3 className="font-display text-xl font-bold text-foreground">Training Needs</h3>

        <div>
          <Label>Training Categories Needed *</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {categories.map((category) => (
              <Badge
                key={category.id}
                variant={formData.training_categories_needed.includes(category.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleCategory(category.id)}
              >
                {formData.training_categories_needed.includes(category.id) && <Check className="w-3 h-3 mr-1" />}
                {category.name}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="experience_level">Experience Level</Label>
          <select
            id="experience_level"
            value={formData.experience_level}
            onChange={(e) => setFormData({ ...formData, experience_level: e.target.value as ExperienceLevel })}
            className="w-full h-10 px-4 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mt-2"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
        <h3 className="font-display text-xl font-bold text-foreground">Performance Stats</h3>

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
          <Label>External Links</Label>
          <div className="flex gap-2 mt-2">
            <Input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
              placeholder="https://..."
            />
            <Button type="button" variant="outline" onClick={addLink}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.external_links.map((link, index) => (
              <Badge key={index} variant="secondary">
                <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {link}
                </a>
                <button type="button" onClick={() => removeLink(index)} className="ml-2 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
        <h3 className="font-display text-xl font-bold text-foreground">Preferences</h3>

        <div>
          <Label htmlFor="preferred_mode">Preferred Mode</Label>
          <select
            id="preferred_mode"
            value={formData.preferred_mode}
            onChange={(e) => setFormData({ ...formData, preferred_mode: e.target.value as PreferredMode })}
            className="w-full h-10 px-4 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mt-2"
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
                {formData.preferred_days.includes(day) && <Check className="w-3 h-3 mr-1" />}
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
            placeholder="e.g., 5PM - 8PM"
          />
        </div>
      </div>

      <Button type="submit" variant="hero" disabled={loading} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        {loading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
};
