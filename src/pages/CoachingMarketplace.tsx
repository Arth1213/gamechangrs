import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Filter, MapPin, Star, Users, Award, 
  Calendar, Mail, UserPlus, CheckCircle, XCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { CoachWithDetails, CoachingCategory } from "@/types/coaching";
import { sortCoachesByMatch, getMaxExperienceYears } from "@/lib/coaching-matching";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CoachingMarketplace = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coaches, setCoaches] = useState<CoachWithDetails[]>([]);
  const [categories, setCategories] = useState<CoachingCategory[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<CoachWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"match" | "rating" | "experience">("match");
  
  // Player profile for matching
  const [playerProfile, setPlayerProfile] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [coaches, searchQuery, selectedCategories, selectedLevel, selectedLocation, minRating, sortBy, playerProfile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch categories
      const { data: cats } = await supabase
        .from("coaching_categories")
        .select("*")
        .order("name");
      
      if (cats) setCategories(cats);

      // Fetch coaches
      const { data: coachesData } = await supabase
        .from("coaches")
        .select("*")
        .eq("is_active", true)
        .order("adjusted_rating", { ascending: false });

      if (coachesData) {
        // Fetch categories for each coach
        const coachesWithDetails = await Promise.all(
          coachesData.map(async (coach) => {
            const { data: coachCategories } = await supabase
              .from("coaching_categories")
              .select("*")
              .in("id", coach.specialties);
            
            return {
              ...coach,
              categories: coachCategories || [],
            };
          })
        );
        
        setCoaches(coachesWithDetails);
      }

      // If user is logged in, fetch their player profile for matching
      if (user) {
        const { data: player } = await supabase
          .from("players")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .single();
        
        if (player) {
          const { data: playerCategories } = await supabase
            .from("coaching_categories")
            .select("*")
            .in("id", player.training_categories_needed);
          
          setPlayerProfile({
            ...player,
            categories: playerCategories || [],
          });
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load coaches. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...coaches];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (coach) =>
          coach.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coach.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coach.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((coach) =>
        selectedCategories.some((catId) => coach.specialties.includes(catId))
      );
    }

    // Level filter
    if (selectedLevel !== "all") {
      filtered = filtered.filter((coach) => coach.coaching_level === selectedLevel);
    }

    // Location filter
    if (selectedLocation) {
      filtered = filtered.filter((coach) =>
        coach.location?.toLowerCase().includes(selectedLocation.toLowerCase())
      );
    }

    // Rating filter
    filtered = filtered.filter((coach) => coach.adjusted_rating >= minRating);

    // Calculate match scores if player profile exists
    if (playerProfile) {
      const maxExp = getMaxExperienceYears(filtered);
      const matchResults = sortCoachesByMatch(filtered, playerProfile, maxExp);
      filtered = matchResults.map((r) => r.coach!);
    }

    // Sort
    if (sortBy === "rating") {
      filtered.sort((a, b) => b.adjusted_rating - a.adjusted_rating);
    } else if (sortBy === "experience") {
      filtered.sort((a, b) => b.years_experience - a.years_experience);
    }
    // "match" sorting is already done by sortCoachesByMatch

    setFilteredCoaches(filtered);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="pt-32 pb-12 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Coaching <span className="text-gradient-primary">Marketplace</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              Find the perfect coach to elevate your cricket game. Connect with experienced coaches who match your training needs.
            </p>
            {!user && (
              <div className="flex gap-4 justify-center">
                <Button variant="hero" asChild>
                  <Link to="/coaching-marketplace/player-signup">Join as Player</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/coaching-marketplace/coach-signup">Become a Coach</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 border-b border-border bg-card sticky top-16 z-40">
        <div className="container mx-auto px-4">
          <div className="space-y-4">
            {/* Search and Sort */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search coaches by name, location, or bio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12"
                />
              </div>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match">Best Match</SelectItem>
                  <SelectItem value="rating">Highest Rating</SelectItem>
                  <SelectItem value="experience">Most Experience</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge
                  key={category.id}
                  variant={selectedCategories.includes(category.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleCategory(category.id)}
                >
                  {category.name}
                </Badge>
              ))}
            </div>

            {/* Additional Filters */}
            <div className="flex flex-wrap gap-4">
              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Coaching Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="text"
                placeholder="Location"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full sm:w-48"
              />

              <Select 
                value={minRating.toString()} 
                onValueChange={(v) => setMinRating(Number(v))}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Min Rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any Rating</SelectItem>
                  <SelectItem value="3">3+ Stars</SelectItem>
                  <SelectItem value="4">4+ Stars</SelectItem>
                  <SelectItem value="4.5">4.5+ Stars</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredCoaches.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No coaches found matching your criteria.</p>
              <Button variant="outline" onClick={() => {
                setSearchQuery("");
                setSelectedCategories([]);
                setSelectedLevel("all");
                setSelectedLocation("");
                setMinRating(0);
              }}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCoaches.map((coach) => (
                <div
                  key={coach.id}
                  className="rounded-2xl bg-gradient-card border border-border p-6 hover:border-primary/30 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-display text-xl font-bold text-foreground mb-1">
                        {coach.name}
                      </h3>
                      {coach.location && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                          <MapPin className="w-3 h-3" />
                          {coach.location}
                        </div>
                      )}
                    </div>
                    {coach.is_verified && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-primary text-primary" />
                      <span className="font-semibold">{coach.adjusted_rating.toFixed(1)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({coach.number_of_ratings} {coach.number_of_ratings === 1 ? 'rating' : 'ratings'})
                    </span>
                  </div>

                  {/* Specialties */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {coach.categories?.slice(0, 3).map((cat) => (
                      <Badge key={cat.id} variant="outline" className="text-xs">
                        {cat.name}
                      </Badge>
                    ))}
                    {coach.categories && coach.categories.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{coach.categories.length - 3} more
                      </Badge>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Level</div>
                      <div className="font-semibold capitalize">{coach.coaching_level}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Experience</div>
                      <div className="font-semibold">{coach.years_experience} years</div>
                    </div>
                  </div>

                  {/* Bio preview */}
                  {coach.bio && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {coach.bio}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="hero" size="sm" className="flex-1" asChild>
                      <Link to={`/coaching-marketplace/coach/${coach.id}`}>
                        View Profile
                      </Link>
                    </Button>
                    {user && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/coaching-marketplace/connect/${coach.id}`}>
                          <UserPlus className="w-4 h-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CoachingMarketplace;

