import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Check, Plus, X, Save, Globe } from "lucide-react";
import { Coach, CoachingCategory, CoachingLevel } from "@/types/coaching";
import { TIMEZONES, getBrowserTimezone } from "@/lib/timezones";
import { ProfilePictureUpload } from "./ProfilePictureUpload";

interface CoachProfileEditorProps {
  coach: Coach;
  onSave: () => void;
}

export const CoachProfileEditor = ({ coach, onSave }: CoachProfileEditorProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CoachingCategory[]>([]);
  const [formData, setFormData] = useState({
    name: coach.name,
    phone: coach.phone || "",
    location: coach.location || "",
    timezone: coach.timezone || "",
    bio: coach.bio || "",
    specialties: coach.specialties || [],
    coaching_level: coach.coaching_level || "intermediate",
    years_experience: coach.years_experience || 0,
    teams_coached: coach.teams_coached || [],
    notable_players_coached: coach.notable_players_coached || [],
    external_links: coach.external_links || [],
    profile_picture_url: coach.profile_picture_url || null,
  });

  const [teamInput, setTeamInput] = useState("");
  const [playerInput, setPlayerInput] = useState("");
  const [linkInput, setLinkInput] = useState("");

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
        .from("coaches")
        .update({
          name: formData.name,
          phone: formData.phone || null,
          location: formData.location || null,
          timezone: formData.timezone || null,
          bio: formData.bio || null,
          specialties: formData.specialties,
          coaching_level: formData.coaching_level,
          years_experience: formData.years_experience,
          teams_coached: formData.teams_coached.filter(Boolean),
          notable_players_coached: formData.notable_players_coached.filter(Boolean),
          external_links: formData.external_links.filter(Boolean),
          profile_picture_url: formData.profile_picture_url,
        })
        .eq("id", coach.id);

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your coach profile has been updated successfully.",
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

  const toggleSpecialty = (categoryId: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(categoryId)
        ? prev.specialties.filter(id => id !== categoryId)
        : [...prev.specialties, categoryId],
    }));
  };

  const addItem = (field: 'teams_coached' | 'notable_players_coached' | 'external_links', value: string, setter: (v: string) => void) => {
    if (value.trim()) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()],
      }));
      setter("");
    }
  };

  const removeItem = (field: 'teams_coached' | 'notable_players_coached' | 'external_links', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
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
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
            <Label htmlFor="years_experience">Years of Experience</Label>
            <Input
              id="years_experience"
              type="number"
              min="0"
              value={formData.years_experience}
              onChange={(e) => setFormData({ ...formData, years_experience: parseInt(e.target.value) || 0 })}
              className="mt-2"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            className="mt-2"
            rows={4}
            placeholder="Tell players about your coaching experience..."
          />
        </div>
      </div>

      {/* Specialties */}
      <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
        <h3 className="font-display text-xl font-bold text-foreground">Specialties</h3>
        
        <div>
          <Label htmlFor="coaching_level">Coaching Level</Label>
          <select
            id="coaching_level"
            value={formData.coaching_level}
            onChange={(e) => setFormData({ ...formData, coaching_level: e.target.value as CoachingLevel })}
            className="w-full h-10 px-4 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary mt-2"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div>
          <Label>Coaching Specialties *</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {categories.map((category) => (
              <Badge
                key={category.id}
                variant={formData.specialties.includes(category.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleSpecialty(category.id)}
              >
                {formData.specialties.includes(category.id) && <Check className="w-3 h-3 mr-1" />}
                {category.name}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Experience */}
      <div className="rounded-2xl bg-gradient-card border border-border p-6 space-y-4">
        <h3 className="font-display text-xl font-bold text-foreground">Experience</h3>
        
        <div>
          <Label>Teams Coached</Label>
          <div className="flex gap-2 mt-2">
            <Input
              value={teamInput}
              onChange={(e) => setTeamInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addItem('teams_coached', teamInput, setTeamInput))}
              placeholder="Team name"
            />
            <Button type="button" variant="outline" onClick={() => addItem('teams_coached', teamInput, setTeamInput)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.teams_coached.map((team, index) => (
              <Badge key={index} variant="secondary">
                {team}
                <button type="button" onClick={() => removeItem('teams_coached', index)} className="ml-2 hover:text-destructive">
                  <X className="w-3 h-3" />
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
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addItem('notable_players_coached', playerInput, setPlayerInput))}
              placeholder="Player name"
            />
            <Button type="button" variant="outline" onClick={() => addItem('notable_players_coached', playerInput, setPlayerInput)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.notable_players_coached.map((player, index) => (
              <Badge key={index} variant="secondary">
                {player}
                <button type="button" onClick={() => removeItem('notable_players_coached', index)} className="ml-2 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label>External Links</Label>
          <div className="flex gap-2 mt-2">
            <Input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addItem('external_links', linkInput, setLinkInput))}
              placeholder="https://..."
            />
            <Button type="button" variant="outline" onClick={() => addItem('external_links', linkInput, setLinkInput)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.external_links.map((link, index) => (
              <Badge key={index} variant="secondary">
                <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {link}
                </a>
                <button type="button" onClick={() => removeItem('external_links', index)} className="ml-2 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Button type="submit" variant="hero" disabled={loading} className="w-full">
        <Save className="w-4 h-4 mr-2" />
        {loading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
};
