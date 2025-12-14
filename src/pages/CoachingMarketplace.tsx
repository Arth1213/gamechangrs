import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, MapPin, Star, Users, Award, 
  Calendar, UserPlus, CheckCircle, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { CoachWithDetails, CoachingCategory, MatchResult } from "@/types/coaching";
import { sortCoachesByMatch, getMaxExperienceYears, getRecommendedCoaches, getRecommendedPlayers, sortPlayersByMatch } from "@/lib/coaching-matching";
import { ConnectionRequestDialog } from "@/components/coaching/ConnectionRequestDialog";
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
  const [players, setPlayers] = useState<any[]>([]);
  const [categories, setCategories] = useState<CoachingCategory[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<CoachWithDetails[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<any[]>([]);
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
  const [coachProfile, setCoachProfile] = useState<any>(null);
  
  // Check if user has coach/player profile
  const [hasCoachProfile, setHasCoachProfile] = useState<boolean | null>(null);
  const [hasPlayerProfile, setHasPlayerProfile] = useState<boolean | null>(null);

  // Recommendations
  const [recommendedCoaches, setRecommendedCoaches] = useState<MatchResult[]>([]);
  const [recommendedPlayers, setRecommendedPlayers] = useState<MatchResult[]>([]);

  // Determine view mode based on user role
  const isCoachView = user && hasCoachProfile;

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (isCoachView) {
      applyPlayerFilters();
    } else {
      applyFilters();
    }
  }, [coaches, players, searchQuery, selectedCategories, selectedLevel, selectedLocation, minRating, sortBy, playerProfile, coachProfile, isCoachView]);

  // State for connections
  const [connectedCoachIds, setConnectedCoachIds] = useState<Set<string>>(new Set());
  const [connectedPlayerIds, setConnectedPlayerIds] = useState<Set<string>>(new Set());

  // Generate recommendations when data is available (excluding already connected)
  useEffect(() => {
    if (playerProfile && coaches.length > 0 && !isCoachView) {
      // Filter out already connected coaches for recommendations
      const unconnectedCoaches = coaches.filter(c => !connectedCoachIds.has(c.id));
      const recommended = getRecommendedCoaches(unconnectedCoaches, playerProfile, 3);
      setRecommendedCoaches(recommended);
    }
  }, [playerProfile, coaches, isCoachView, connectedCoachIds]);

  useEffect(() => {
    if (coachProfile && players.length > 0 && isCoachView) {
      // Filter out already connected players for recommendations
      const unconnectedPlayers = players.filter(p => !connectedPlayerIds.has(p.id));
      const recommended = getRecommendedPlayers(unconnectedPlayers, coachProfile, 3);
      setRecommendedPlayers(recommended);
    }
  }, [coachProfile, players, isCoachView, connectedPlayerIds]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch categories
      const { data: cats } = await supabase
        .from("coaching_categories")
        .select("*")
        .order("name");
      
      if (cats) setCategories(cats as CoachingCategory[]);

      // If user is logged in, check their profiles
      if (user) {
        // Check for coach profile
        const { data: coachData } = await supabase
          .from("coaches")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        setHasCoachProfile(!!coachData);
        if (coachData) setCoachProfile(coachData);
        
        // Check for player profile
        const { data: playerData } = await supabase
          .from("players")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        setHasPlayerProfile(!!playerData);
        
        if (playerData && (playerData as any).is_active) {
          const { data: playerCategories } = await supabase
            .from("coaching_categories")
            .select("*")
            .in("id", (playerData as any).training_categories_needed || []);
          
          setPlayerProfile({
            ...playerData,
            categories: playerCategories || [],
          });
        }

        // If coach, fetch ALL active players (not just connected ones)
        if (coachData) {
          const { data: playersData } = await supabase
            .from("players")
            .select("*")
            .eq("is_active", true);
          
          if (playersData) {
            // Get connected player IDs
            const { data: connections } = await supabase
              .from("connections")
              .select("student_id")
              .eq("coach_id", (coachData as any).id)
              .eq("verified", true);
            
            const connectedIds = new Set(connections?.map((c: any) => c.student_id) || []);
            setConnectedPlayerIds(connectedIds);
            
            const playersWithCategories = await Promise.all(
              (playersData as any[]).map(async (player) => {
                const { data: playerCats } = await supabase
                  .from("coaching_categories")
                  .select("*")
                  .in("id", player.training_categories_needed || []);
                return { 
                  ...player, 
                  categories: playerCats || [],
                  isConnected: connectedIds.has(player.id)
                };
              })
            );
            // Sort: connected players first
            playersWithCategories.sort((a, b) => {
              if (a.isConnected && !b.isConnected) return -1;
              if (!a.isConnected && b.isConnected) return 1;
              return 0;
            });
            setPlayers(playersWithCategories);
          }
        }

        // If player, fetch connected coach IDs
        if (playerData) {
          const { data: connections } = await supabase
            .from("connections")
            .select("coach_id")
            .eq("student_id", (playerData as any).id)
            .eq("verified", true);
          
          const connectedIds = new Set(connections?.map((c: any) => c.coach_id) || []);
          setConnectedCoachIds(connectedIds);
        }
      } else {
        setHasCoachProfile(null);
        setHasPlayerProfile(null);
      }

      // Fetch coaches (for players or non-logged-in users)
      const { data: coachesData } = await supabase
        .from("coaches")
        .select("*")
        .eq("is_active", true)
        .order("adjusted_rating", { ascending: false });

      if (coachesData) {
        const coachesWithDetails = await Promise.all(
          (coachesData as any[]).map(async (coach) => {
            const { data: coachCategories } = await supabase
              .from("coaching_categories")
              .select("*")
              .in("id", coach.specialties || []);
            
            return {
              ...coach,
              categories: coachCategories || [],
              isConnected: connectedCoachIds.has(coach.id),
            } as CoachWithDetails & { isConnected: boolean };
          })
        );
        
        // Sort: connected coaches first
        coachesWithDetails.sort((a, b) => {
          if (a.isConnected && !b.isConnected) return -1;
          if (!a.isConnected && b.isConnected) return 1;
          return 0;
        });
        
        setCoaches(coachesWithDetails);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...coaches];

    if (searchQuery) {
      filtered = filtered.filter(
        (coach) =>
          coach.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coach.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coach.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategories.length > 0) {
      filtered = filtered.filter((coach) =>
        selectedCategories.some((catId) => coach.specialties.includes(catId))
      );
    }

    if (selectedLevel !== "all") {
      filtered = filtered.filter((coach) => coach.coaching_level === selectedLevel);
    }

    if (selectedLocation) {
      filtered = filtered.filter((coach) =>
        coach.location?.toLowerCase().includes(selectedLocation.toLowerCase())
      );
    }

    filtered = filtered.filter((coach) => coach.adjusted_rating >= minRating);

    if (playerProfile) {
      const maxExp = getMaxExperienceYears(filtered);
      const matchResults = sortCoachesByMatch(filtered, playerProfile, maxExp);
      filtered = matchResults.map((r) => r.coach!);
    }

    if (sortBy === "rating") {
      filtered.sort((a, b) => b.adjusted_rating - a.adjusted_rating);
    } else if (sortBy === "experience") {
      filtered.sort((a, b) => b.years_experience - a.years_experience);
    }

    setFilteredCoaches(filtered);
  };

  const applyPlayerFilters = () => {
    let filtered = [...players];

    if (searchQuery) {
      filtered = filtered.filter(
        (player) =>
          player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          player.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          player.playing_role?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategories.length > 0) {
      filtered = filtered.filter((player) =>
        selectedCategories.some((catId) => player.training_categories_needed?.includes(catId))
      );
    }

    if (selectedLevel !== "all") {
      filtered = filtered.filter((player) => player.experience_level === selectedLevel);
    }

    if (selectedLocation) {
      filtered = filtered.filter((player) =>
        player.location?.toLowerCase().includes(selectedLocation.toLowerCase())
      );
    }

    setFilteredPlayers(filtered);
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
              {isCoachView 
                ? "View and manage your connected players." 
                : "Find the perfect coach to elevate your cricket game. Connect with experienced coaches who match your training needs."}
            </p>
            {/* Show signup buttons ONLY for non-logged-in users */}
            {!user && (
              <div className="flex gap-4 justify-center flex-wrap">
                <Button variant="hero" asChild>
                  <Link to="/coaching-marketplace/player-signup">Join as Player</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/coaching-marketplace/coach-signup">Become a Coach</Link>
                </Button>
              </div>
            )}
            {/* Show dashboard links for logged-in users with profiles */}
            {user && (hasCoachProfile || hasPlayerProfile) && (
              <div className="flex gap-4 justify-center flex-wrap">
                {hasCoachProfile && (
                  <Button variant="hero" asChild>
                    <Link to="/coaching-marketplace/coach-dashboard">Coach Dashboard</Link>
                  </Button>
                )}
                {hasPlayerProfile && (
                  <Button variant="outline" asChild>
                    <Link to="/coaching-marketplace/player-dashboard">Player Dashboard</Link>
                  </Button>
                )}
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
                  placeholder={isCoachView ? "Search players by name, location, or role..." : "Search coaches by name, location, or bio..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12"
                />
              </div>
              {!isCoachView && (
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
              )}
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
                  <SelectValue placeholder={isCoachView ? "Experience Level" : "Coaching Level"} />
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

              {!isCoachView && (
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
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Recommended For You Section */}
      {!loading && user && (
        (isCoachView && recommendedPlayers.length > 0) || 
        (!isCoachView && hasPlayerProfile && recommendedCoaches.length > 0)
      ) && (
        <section className="py-8 border-b border-border">
          <div className="container mx-auto px-4">
            <h2 className="font-display text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Recommended for You
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {isCoachView ? (
                // Show recommended players for coach
                recommendedPlayers.map((match) => (
                  <div
                    key={match.player?.id}
                    className="rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-transparent border border-primary/30 p-6 hover:border-primary/50 transition-all duration-300"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="default" className="bg-primary/20 text-primary text-xs">
                        {Math.round(match.match_score * 100)}% Match
                      </Badge>
                      {match.location_match && match.location_match > 0.5 && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="w-3 h-3 mr-1" />
                          Nearby
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-bold text-foreground mb-1">
                      {match.player?.name}
                    </h3>
                    {match.player?.location && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                        <MapPin className="w-3 h-3" />
                        {match.player.location}
                      </div>
                    )}
                    {/* Level and Age Group */}
                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Level: </span>
                        <span className="font-medium capitalize">{match.player?.experience_level || 'N/A'}</span>
                      </div>
                      {match.player?.age_group && (
                        <div>
                          <span className="text-muted-foreground">Age: </span>
                          <span className="font-medium">{match.player.age_group}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {match.player?.training_categories_needed?.slice(0, 2).map((catId: string) => {
                        const cat = categories.find(c => c.id === catId);
                        return cat ? (
                          <Badge key={cat.id} variant="outline" className="text-xs">
                            {cat.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                    <Button variant="hero" size="sm" className="w-full" asChild>
                      <Link to={`/coaching-marketplace/player/${match.player?.id}`}>
                        View Profile
                      </Link>
                    </Button>
                  </div>
                ))
              ) : (
                // Show recommended coaches for player
                recommendedCoaches.map((match) => (
                  <div
                    key={match.coach?.id}
                    className="rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-transparent border border-primary/30 p-6 hover:border-primary/50 transition-all duration-300"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="default" className="bg-primary/20 text-primary text-xs">
                        {Math.round(match.match_score * 100)}% Match
                      </Badge>
                      {match.location_match && match.location_match > 0.5 && (
                        <Badge variant="outline" className="text-xs">
                          <MapPin className="w-3 h-3 mr-1" />
                          Nearby
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-bold text-foreground mb-1">
                      {match.coach?.name}
                    </h3>
                    {match.coach?.location && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                        <MapPin className="w-3 h-3" />
                        {match.coach.location}
                      </div>
                    )}
                    {/* Level and Experience */}
                    <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Level: </span>
                        <span className="font-medium capitalize">{match.coach?.coaching_level || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Exp: </span>
                        <span className="font-medium">{match.coach?.years_experience || 0} yrs</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4 fill-primary text-primary" />
                      <span className="font-semibold">{match.coach?.adjusted_rating?.toFixed(1)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {match.coach?.categories?.slice(0, 2).map((cat) => (
                        <Badge key={cat.id} variant="outline" className="text-xs">
                          {cat.name}
                        </Badge>
                      ))}
                    </div>
                    <Button variant="hero" size="sm" className="w-full" asChild>
                      <Link to={`/coaching-marketplace/coach/${match.coach?.id}`}>
                        View Profile
                      </Link>
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* All Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-2xl font-bold text-foreground mb-6">
            All {isCoachView ? 'Players' : 'Coaches'}
          </h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            </div>
          ) : isCoachView ? (
            // Coach view - show connected players
            filteredPlayers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No players found matching your criteria.</p>
                <Button variant="outline" onClick={() => {
                  setSearchQuery("");
                  setSelectedCategories([]);
                  setSelectedLevel("all");
                  setSelectedLocation("");
                }}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="rounded-2xl bg-gradient-card border border-border p-6 hover:border-primary/30 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-display text-xl font-bold text-foreground mb-1">
                          {player.name}
                        </h3>
                        {player.location && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                            <MapPin className="w-3 h-3" />
                            {player.location}
                          </div>
                        )}
                      </div>
                      {player.isConnected ? (
                        <Badge variant="default" className="bg-green-500/10 text-green-500">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Users className="w-3 h-3 mr-1" />
                          Player
                        </Badge>
                      )}
                    </div>

                    {/* Playing Role */}
                    {player.playing_role && (
                      <div className="flex items-center gap-2 mb-4">
                        <Award className="w-4 h-4 text-primary" />
                        <span className="font-semibold capitalize">{player.playing_role}</span>
                      </div>
                    )}

                    {/* Training Categories */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {player.categories?.slice(0, 3).map((cat: any) => (
                        <Badge key={cat.id} variant="outline" className="text-xs">
                          {cat.name}
                        </Badge>
                      ))}
                      {player.categories && player.categories.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{player.categories.length - 3} more
                        </Badge>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Level</div>
                        <div className="font-semibold capitalize">{player.experience_level || 'Not set'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Age Group</div>
                        <div className="font-semibold capitalize">{player.age_group || 'Not set'}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button variant="hero" size="sm" className="flex-1" asChild>
                        <Link to={`/coaching-marketplace/player/${player.id}`}>
                          View Profile
                        </Link>
                      </Button>
                      {!player.isConnected && (
                        <ConnectionRequestDialog
                          targetId={player.id}
                          targetType="player"
                          targetName={player.name}
                          targetEmail={player.email}
                          isConnected={player.isConnected}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            // Player/non-logged-in view - show coaches
            filteredCoaches.length === 0 ? (
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
                      <div className="flex gap-1">
                        {(coach as any).isConnected && (
                          <Badge variant="default" className="bg-green-500/10 text-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                        {coach.is_verified && (
                          <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
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
                      {user && hasPlayerProfile && !(coach as any).isConnected && (
                        <ConnectionRequestDialog
                          targetId={coach.id}
                          targetType="coach"
                          targetName={coach.name}
                          targetEmail={coach.email}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CoachingMarketplace;
