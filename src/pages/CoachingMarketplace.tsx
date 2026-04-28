import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  MapPin,
  Star,
  Users,
  Award,
  Calendar,
  CheckCircle,
  Sparkles,
  GraduationCap,
  UserCircle,
  ArrowRight,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Coach,
  CoachWithDetails,
  CoachingCategory,
  MatchResult,
  Player,
  Session,
} from "@/types/coaching";
import {
  getMaxExperienceYears,
  getRecommendedCoaches,
  getRecommendedPlayers,
  sortCoachesByMatch,
  sortPlayersByMatch,
} from "@/lib/coaching-matching";
import { ConnectionRequestDialog } from "@/components/coaching/ConnectionRequestDialog";
import { SessionCalendar } from "@/components/coaching/SessionCalendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MarketplacePlayer extends Player {
  categories: CoachingCategory[];
  isConnected: boolean;
}

type MarketplaceMode = "coach" | "player";

const CoachingMarketplace = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [coaches, setCoaches] = useState<(CoachWithDetails & { isConnected: boolean })[]>([]);
  const [players, setPlayers] = useState<MarketplacePlayer[]>([]);
  const [categories, setCategories] = useState<CoachingCategory[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<(CoachWithDetails & { isConnected: boolean })[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<MarketplacePlayer[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"match" | "rating" | "experience">("match");

  const [playerProfile, setPlayerProfile] = useState<MarketplacePlayer | null>(null);
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [hasCoachProfile, setHasCoachProfile] = useState(false);
  const [hasPlayerProfile, setHasPlayerProfile] = useState(false);
  const [activeMode, setActiveMode] = useState<MarketplaceMode>("player");

  const [recommendedCoaches, setRecommendedCoaches] = useState<MatchResult[]>([]);
  const [recommendedPlayers, setRecommendedPlayers] = useState<MatchResult[]>([]);

  const [connectedCoachIds, setConnectedCoachIds] = useState<Set<string>>(new Set());
  const [connectedPlayerIds, setConnectedPlayerIds] = useState<Set<string>>(new Set());

  const [coachSessions, setCoachSessions] = useState<Session[]>([]);
  const [playerSessions, setPlayerSessions] = useState<Session[]>([]);
  const [coachStudents, setCoachStudents] = useState<Player[]>([]);
  const [playerCoaches, setPlayerCoaches] = useState<Coach[]>([]);

  const isCoachMode = activeMode === "coach";
  const coachUpcomingSessions = coachSessions.filter(
    (session) => new Date(session.session_date_time_utc) > new Date() && session.status !== "canceled",
  );
  const playerUpcomingSessions = playerSessions.filter(
    (session) => new Date(session.session_date_time_utc) > new Date() && session.status !== "canceled",
  );

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    setActiveMode(hasCoachProfile ? "coach" : "player");
  }, [hasCoachProfile]);

  useEffect(() => {
    if (isCoachMode) {
      applyPlayerFilters();
      return;
    }

    applyCoachFilters();
  }, [
    coaches,
    players,
    searchQuery,
    selectedCategories,
    selectedLevel,
    selectedLocation,
    minRating,
    sortBy,
    playerProfile,
    coachProfile,
    isCoachMode,
  ]);

  useEffect(() => {
    if (!isCoachMode && playerProfile && coaches.length > 0) {
      const unconnectedCoaches = coaches.filter((coach) => !connectedCoachIds.has(coach.id));
      setRecommendedCoaches(getRecommendedCoaches(unconnectedCoaches, playerProfile, 3));
      return;
    }

    setRecommendedCoaches([]);
  }, [playerProfile, coaches, connectedCoachIds, isCoachMode]);

  useEffect(() => {
    if (isCoachMode && coachProfile && players.length > 0) {
      const unconnectedPlayers = players.filter((player) => !connectedPlayerIds.has(player.id));
      setRecommendedPlayers(getRecommendedPlayers(unconnectedPlayers, coachProfile, 3));
      return;
    }

    setRecommendedPlayers([]);
  }, [coachProfile, players, connectedPlayerIds, isCoachMode]);

  const fetchData = async () => {
    setLoading(true);

    try {
      const { data: categoryRows } = await supabase.from("coaching_categories").select("*").order("name");
      const categoryList = (categoryRows || []) as CoachingCategory[];
      const categoryMap = new Map(categoryList.map((category) => [category.id, category]));
      setCategories(categoryList);

      let nextCoachProfile: Coach | null = null;
      let nextPlayerProfile: MarketplacePlayer | null = null;
      let nextConnectedCoachIds = new Set<string>();
      let nextConnectedPlayerIds = new Set<string>();
      let nextCoachSessions: Session[] = [];
      let nextPlayerSessions: Session[] = [];
      let nextCoachStudents: Player[] = [];
      let nextPlayerCoaches: Coach[] = [];

      if (user) {
        const [coachRes, playerRes] = await Promise.all([
          supabase.from("coaches").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("players").select("*").eq("user_id", user.id).maybeSingle(),
        ]);

        nextCoachProfile = (coachRes.data as Coach | null) || null;
        const playerRow = (playerRes.data as Player | null) || null;

        setHasCoachProfile(Boolean(nextCoachProfile));
        setHasPlayerProfile(Boolean(playerRow));

        if (nextCoachProfile) {
          setCoachProfile(nextCoachProfile);
        } else {
          setCoachProfile(null);
        }

        if (playerRow) {
          nextPlayerProfile = {
            ...playerRow,
            categories: (playerRow.training_categories_needed || [])
              .map((categoryId) => categoryMap.get(categoryId))
              .filter(Boolean) as CoachingCategory[],
            isConnected: false,
          };
          setPlayerProfile(nextPlayerProfile);
        } else {
          setPlayerProfile(null);
        }

        if (nextCoachProfile) {
          const [coachConnectionsRes, coachSessionsRes] = await Promise.all([
            supabase
              .from("connections")
              .select("student_id")
              .eq("coach_id", nextCoachProfile.id)
              .eq("verified", true),
            supabase
              .from("sessions")
              .select("*")
              .eq("coach_id", nextCoachProfile.id)
              .order("session_date_time_utc", { ascending: true }),
          ]);

          nextConnectedPlayerIds = new Set((coachConnectionsRes.data || []).map((row) => row.student_id));
          nextCoachSessions = (coachSessionsRes.data || []) as Session[];

          const studentIds = [...new Set(nextCoachSessions.map((session) => session.student_id))];
          if (studentIds.length > 0) {
            const { data: studentRows } = await supabase.from("players").select("*").in("id", studentIds);
            nextCoachStudents = (studentRows || []) as Player[];
          }
        }

        if (playerRow) {
          const [playerConnectionsRes, playerSessionsRes] = await Promise.all([
            supabase
              .from("connections")
              .select("coach_id")
              .eq("student_id", playerRow.id)
              .eq("verified", true),
            supabase
              .from("sessions")
              .select("*")
              .eq("student_id", playerRow.id)
              .order("session_date_time_utc", { ascending: true }),
          ]);

          nextConnectedCoachIds = new Set((playerConnectionsRes.data || []).map((row) => row.coach_id));
          nextPlayerSessions = (playerSessionsRes.data || []) as Session[];

          const coachIds = [...new Set(nextPlayerSessions.map((session) => session.coach_id))];
          if (coachIds.length > 0) {
            const { data: coachRows } = await supabase.from("coaches").select("*").in("id", coachIds);
            nextPlayerCoaches = (coachRows || []) as Coach[];
          }
        }
      } else {
        setHasCoachProfile(false);
        setHasPlayerProfile(false);
        setCoachProfile(null);
        setPlayerProfile(null);
      }

      const { data: coachRows } = await supabase
        .from("coaches")
        .select("*")
        .eq("is_active", true)
        .order("adjusted_rating", { ascending: false });

      const nextCoaches = ((coachRows || []) as Coach[]).map((coach) => ({
        ...coach,
        categories: (coach.specialties || [])
          .map((categoryId) => categoryMap.get(categoryId))
          .filter(Boolean) as CoachingCategory[],
        isConnected: nextConnectedCoachIds.has(coach.id),
      }));

      nextCoaches.sort((left, right) => {
        if (left.isConnected && !right.isConnected) return -1;
        if (!left.isConnected && right.isConnected) return 1;
        return 0;
      });

      setCoaches(nextCoaches);

      if (nextCoachProfile) {
        const { data: playerRows } = await supabase.from("players").select("*").eq("is_active", true);

        const nextPlayers = ((playerRows || []) as Player[]).map((player) => ({
          ...player,
          categories: (player.training_categories_needed || [])
            .map((categoryId) => categoryMap.get(categoryId))
            .filter(Boolean) as CoachingCategory[],
          isConnected: nextConnectedPlayerIds.has(player.id),
        }));

        nextPlayers.sort((left, right) => {
          if (left.isConnected && !right.isConnected) return -1;
          if (!left.isConnected && right.isConnected) return 1;
          return 0;
        });

        setPlayers(nextPlayers);
      } else {
        setPlayers([]);
      }

      setConnectedCoachIds(nextConnectedCoachIds);
      setConnectedPlayerIds(nextConnectedPlayerIds);
      setCoachSessions(nextCoachSessions);
      setPlayerSessions(nextPlayerSessions);
      setCoachStudents(nextCoachStudents);
      setPlayerCoaches(nextPlayerCoaches);
    } catch (error) {
      console.error("Error fetching coaching marketplace data:", error);
      toast({
        title: "Error",
        description: "Failed to load coaching marketplace data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyCoachFilters = () => {
    let nextFiltered = [...coaches];

    if (searchQuery) {
      nextFiltered = nextFiltered.filter(
        (coach) =>
          coach.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coach.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coach.location?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (selectedCategories.length > 0) {
      nextFiltered = nextFiltered.filter((coach) =>
        selectedCategories.some((categoryId) => coach.specialties.includes(categoryId)),
      );
    }

    if (selectedLevel !== "all") {
      nextFiltered = nextFiltered.filter((coach) => coach.coaching_level === selectedLevel);
    }

    if (selectedLocation) {
      nextFiltered = nextFiltered.filter((coach) =>
        coach.location?.toLowerCase().includes(selectedLocation.toLowerCase()),
      );
    }

    nextFiltered = nextFiltered.filter((coach) => coach.adjusted_rating >= minRating);

    if (playerProfile) {
      const maxExperience = getMaxExperienceYears(nextFiltered);
      nextFiltered = sortCoachesByMatch(nextFiltered, playerProfile, maxExperience).map((match) => match.coach!);
    }

    if (sortBy === "rating") {
      nextFiltered.sort((left, right) => right.adjusted_rating - left.adjusted_rating);
    } else if (sortBy === "experience") {
      nextFiltered.sort((left, right) => right.years_experience - left.years_experience);
    }

    setFilteredCoaches(nextFiltered);
  };

  const applyPlayerFilters = () => {
    let nextFiltered = [...players];

    if (searchQuery) {
      nextFiltered = nextFiltered.filter(
        (player) =>
          player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          player.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          player.playing_role?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (selectedCategories.length > 0) {
      nextFiltered = nextFiltered.filter((player) =>
        selectedCategories.some((categoryId) => player.training_categories_needed?.includes(categoryId)),
      );
    }

    if (selectedLevel !== "all") {
      nextFiltered = nextFiltered.filter((player) => player.experience_level === selectedLevel);
    }

    if (selectedLocation) {
      nextFiltered = nextFiltered.filter((player) =>
        player.location?.toLowerCase().includes(selectedLocation.toLowerCase()),
      );
    }

    if (coachProfile) {
      nextFiltered = sortPlayersByMatch(nextFiltered, coachProfile).map((match) => match.player as MarketplacePlayer);
    }

    setFilteredPlayers(nextFiltered);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((currentCategories) =>
      currentCategories.includes(categoryId)
        ? currentCategories.filter((id) => id !== categoryId)
        : [...currentCategories, categoryId],
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedLevel("all");
    setSelectedLocation("");
    setMinRating(0);
    setSortBy("match");
  };

  const activateWorkspace = (mode: MarketplaceMode) => {
    setActiveMode(mode);

    requestAnimationFrame(() => {
      const workspace = document.getElementById("coaching-marketplace-workspace");
      if (workspace) {
        workspace.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };

  const renderScheduleSection = ({
    title,
    subtitle,
    sessions,
    userType,
    coaches: scheduleCoaches,
    players: schedulePlayers,
    timezone,
    dashboardHref,
    dashboardLabel,
    highlightLabel,
    highlightValue,
    secondaryLabel,
    secondaryValue,
  }: {
    title: string;
    subtitle: string;
    sessions: Session[];
    userType: "coach" | "player";
    coaches?: Coach[];
    players?: Player[];
    timezone?: string;
    dashboardHref: string;
    dashboardLabel: string;
    highlightLabel: string;
    highlightValue: string;
    secondaryLabel: string;
    secondaryValue: string;
  }) => (
    <section className="border-t border-border py-8">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Schedule</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <Button variant="outline" asChild>
              <Link to={dashboardHref}>
                {dashboardLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5">
              <p className="font-display text-3xl font-bold text-foreground">{sessions.length}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">Total sessions</p>
            </div>
            <div className="rounded-2xl border border-border bg-gradient-card p-5">
              <p className="font-display text-2xl font-bold text-foreground">{highlightValue}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">{highlightLabel}</p>
            </div>
            <div className="rounded-2xl border border-border bg-gradient-card p-5">
              <p className="font-display text-2xl font-bold text-foreground">{secondaryValue}</p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">{secondaryLabel}</p>
            </div>
          </div>

          <SessionCalendar
            sessions={sessions}
            userType={userType}
            coaches={scheduleCoaches}
            players={schedulePlayers}
            timezone={timezone}
          />
        </div>
      </div>
    </section>
  );

  const workspaceTitle = isCoachMode ? "Coach Workspace" : "Player Workspace";
  const workspaceDescription = isCoachMode
    ? "Players, matches, and schedule."
    : "Coaches, matches, and booking.";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="bg-gradient-hero pb-12 pt-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Coaching Marketplace
            </div>
            <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
              Coach and Player <span className="text-gradient-primary">Workspace</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground">
              Coach, player, and schedule.
            </p>
            {!user && (
              <div className="mt-8 flex flex-wrap justify-center gap-4">
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

      {user && (
        <section className="border-b border-border bg-card/60 py-8">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-6xl">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Your personas</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">Your Roles</h2>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div
                  className={`rounded-3xl border p-6 ${
                    isCoachMode ? "border-primary/35 bg-primary/10" : "border-border bg-gradient-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
                        <GraduationCap className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-primary/80">Coach persona</p>
                        <h3 className="mt-1 font-display text-2xl font-bold text-foreground">Coach</h3>
                      </div>
                    </div>
                    {coachProfile ? (
                      <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not set up</Badge>
                    )}
                  </div>

                  <p className="mt-5 text-sm leading-6 text-muted-foreground">
                    {coachProfile
                      ? `${coachProfile.years_experience} years coaching • ${connectedPlayerIds.size} connected player${connectedPlayerIds.size === 1 ? "" : "s"}`
                      : "Create a coach profile."}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {coachProfile ? (
                      <>
                        <Button onClick={() => activateWorkspace("coach")}>
                          Open Coach Workspace
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" asChild>
                          <Link to="/coaching-marketplace/coach-dashboard">Coach Dashboard</Link>
                        </Button>
                      </>
                    ) : (
                      <Button asChild>
                        <Link to="/coaching-marketplace/coach-signup">Create Coach Profile</Link>
                      </Button>
                    )}
                  </div>
                </div>

                <div
                  className={`rounded-3xl border p-6 ${
                    !isCoachMode ? "border-primary/35 bg-primary/10" : "border-border bg-gradient-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
                        <UserCircle className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-primary/80">Player persona</p>
                        <h3 className="mt-1 font-display text-2xl font-bold text-foreground">Player</h3>
                      </div>
                    </div>
                    {playerProfile ? (
                      <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not set up</Badge>
                    )}
                  </div>

                  <p className="mt-5 text-sm leading-6 text-muted-foreground">
                    {playerProfile
                      ? `${connectedCoachIds.size} connected coach${connectedCoachIds.size === 1 ? "" : "es"} • ${playerUpcomingSessions.length} upcoming session${playerUpcomingSessions.length === 1 ? "" : "s"}`
                      : "Create a player profile."}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {playerProfile ? (
                      <Button variant="outline" asChild>
                        <Link to="/coaching-marketplace/player-dashboard">Player Dashboard</Link>
                      </Button>
                    ) : (
                      <Button variant="outline" asChild>
                        <Link to="/coaching-marketplace/player-signup">Create Player Profile</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {coachProfile &&
        renderScheduleSection({
          title: "Coach Schedule",
          subtitle: "Calendar and upcoming sessions.",
          sessions: coachSessions,
          userType: "coach",
          players: coachStudents,
          timezone: coachProfile.timezone,
          dashboardHref: "/coaching-marketplace/coach-dashboard",
          dashboardLabel: "Open Coach Dashboard",
          highlightLabel: "Upcoming coach sessions",
          highlightValue: `${coachUpcomingSessions.length}`,
          secondaryLabel: "Connected students",
          secondaryValue: `${connectedPlayerIds.size}`,
        })}

      {playerProfile &&
        renderScheduleSection({
          title: "Player Schedule",
          subtitle: "Upcoming sessions and calendar.",
          sessions: playerSessions,
          userType: "player",
          coaches: playerCoaches,
          timezone: playerProfile.timezone,
          dashboardHref: "/coaching-marketplace/player-dashboard",
          dashboardLabel: "Open Player Dashboard",
          highlightLabel: "Upcoming player sessions",
          highlightValue: `${playerUpcomingSessions.length}`,
          secondaryLabel: "Connected coaches",
          secondaryValue: `${connectedCoachIds.size}`,
        })}

      {coachProfile ? (
      <section id="coaching-marketplace-workspace" className="border-t border-border py-10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
              <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Workspace</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">{workspaceTitle}</h2>
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{workspaceDescription}</p>
                </div>
            </div>

            {isCoachMode && !coachProfile ? (
              <div className="rounded-3xl border border-border bg-gradient-card p-8">
                <h3 className="font-display text-2xl font-bold text-foreground">Set up your coach persona first</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Create a coach profile to use this workspace.
                </p>
                <div className="mt-6">
                  <Button asChild>
                    <Link to="/coaching-marketplace/coach-signup">Create Coach Profile</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {!isCoachMode && user && !playerProfile && (
                  <div className="mb-6 rounded-3xl border border-border bg-gradient-card p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h3 className="font-display text-xl font-bold text-foreground">Complete your player persona</h3>
                      </div>
                      <Button asChild>
                        <Link to="/coaching-marketplace/player-signup">Create Player Profile</Link>
                      </Button>
                    </div>
                  </div>
                )}

                <section className="rounded-3xl border border-border bg-card/70 p-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-4 md:flex-row">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder={
                            isCoachMode
                              ? "Search players by name, location, or role..."
                              : "Search coaches by name, location, or bio..."
                          }
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          className="pl-12"
                        />
                      </div>

                      {!isCoachMode && (
                        <Select value={sortBy} onValueChange={(value: "match" | "rating" | "experience") => setSortBy(value)}>
                          <SelectTrigger className="w-full md:w-52">
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

                    <div className="flex flex-wrap gap-4">
                      <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                        <SelectTrigger className="w-full sm:w-52">
                          <SelectValue placeholder={isCoachMode ? "Player Experience" : "Coaching Level"} />
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
                        onChange={(event) => setSelectedLocation(event.target.value)}
                        className="w-full sm:w-52"
                      />

                      {!isCoachMode && (
                        <Select value={minRating.toString()} onValueChange={(value) => setMinRating(Number(value))}>
                          <SelectTrigger className="w-full sm:w-52">
                            <SelectValue placeholder="Minimum rating" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Any Rating</SelectItem>
                            <SelectItem value="3">3+ Stars</SelectItem>
                            <SelectItem value="4">4+ Stars</SelectItem>
                            <SelectItem value="4.5">4.5+ Stars</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      <Button variant="outline" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </section>

                {!loading &&
                  ((isCoachMode && recommendedPlayers.length > 0) || (!isCoachMode && recommendedCoaches.length > 0)) && (
                    <section className="pt-8">
                      <h3 className="mb-6 flex items-center gap-2 font-display text-2xl font-bold text-foreground">
                        <Sparkles className="h-6 w-6 text-primary" />
                        Recommended for You
                      </h3>

                      <div className="grid gap-6 md:grid-cols-3">
                        {isCoachMode
                          ? recommendedPlayers.map((match) => (
                              <div
                                key={match.player?.id}
                                className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-6"
                              >
                                <div className="mb-3 flex items-center gap-2">
                                  <Badge variant="default" className="bg-primary/20 text-primary text-xs">
                                    {Math.round(match.match_score * 100)}% Match
                                  </Badge>
                                  {match.location_match && match.location_match > 0.5 && (
                                    <Badge variant="outline" className="text-xs">
                                      <MapPin className="mr-1 h-3 w-3" />
                                      Nearby
                                    </Badge>
                                  )}
                                </div>
                                <h4 className="font-display text-lg font-bold text-foreground">{match.player?.name}</h4>
                                {match.player?.location && (
                                  <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {match.player.location}
                                  </div>
                                )}
                                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Level: </span>
                                    <span className="font-medium capitalize">{match.player?.experience_level || "N/A"}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Age: </span>
                                    <span className="font-medium">{match.player?.age_group || "N/A"}</span>
                                  </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1">
                                  {match.player?.training_categories_needed?.slice(0, 2).map((categoryId) => {
                                    const category = categories.find((entry) => entry.id === categoryId);
                                    return category ? (
                                      <Badge key={category.id} variant="outline" className="text-xs">
                                        {category.name}
                                      </Badge>
                                    ) : null;
                                  })}
                                </div>
                                <Button className="mt-5 w-full" asChild>
                                  <Link to={`/coaching-marketplace/player/${match.player?.id}`}>View Profile</Link>
                                </Button>
                              </div>
                            ))
                          : recommendedCoaches.map((match) => (
                              <div
                                key={match.coach?.id}
                                className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-transparent to-transparent p-6"
                              >
                                <div className="mb-3 flex items-center gap-2">
                                  <Badge variant="default" className="bg-primary/20 text-primary text-xs">
                                    {Math.round(match.match_score * 100)}% Match
                                  </Badge>
                                  {match.location_match && match.location_match > 0.5 && (
                                    <Badge variant="outline" className="text-xs">
                                      <MapPin className="mr-1 h-3 w-3" />
                                      Nearby
                                    </Badge>
                                  )}
                                </div>
                                <h4 className="font-display text-lg font-bold text-foreground">{match.coach?.name}</h4>
                                {match.coach?.location && (
                                  <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {match.coach.location}
                                  </div>
                                )}
                                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Level: </span>
                                    <span className="font-medium capitalize">{match.coach?.coaching_level || "N/A"}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Exp: </span>
                                    <span className="font-medium">{match.coach?.years_experience || 0} yrs</span>
                                  </div>
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                  <Star className="h-4 w-4 fill-primary text-primary" />
                                  <span className="font-semibold">{match.coach?.adjusted_rating?.toFixed(1)}</span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1">
                                  {match.coach?.categories?.slice(0, 2).map((category) => (
                                    <Badge key={category.id} variant="outline" className="text-xs">
                                      {category.name}
                                    </Badge>
                                  ))}
                                </div>
                                <Button className="mt-5 w-full" asChild>
                                  <Link to={`/coaching-marketplace/coach/${match.coach?.id}`}>View Profile</Link>
                                </Button>
                              </div>
                            ))}
                      </div>
                    </section>
                  )}

                <section className="pt-8">
                  <h3 className="mb-6 font-display text-2xl font-bold text-foreground">
                    All {isCoachMode ? "Players" : "Coaches"}
                  </h3>

                  {loading ? (
                    <div className="py-12 text-center">
                      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    </div>
                  ) : isCoachMode ? (
                    filteredPlayers.length === 0 ? (
                      <div className="py-12 text-center">
                        <p className="mb-4 text-muted-foreground">No players found matching your criteria.</p>
                        <Button variant="outline" onClick={clearFilters}>
                          Clear Filters
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {filteredPlayers.map((player) => (
                          <div
                            key={player.id}
                            className="rounded-2xl border border-border bg-gradient-card p-6 transition-all duration-300 hover:border-primary/30"
                          >
                            <div className="mb-4 flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-display text-xl font-bold text-foreground">{player.name}</h4>
                                {player.location && (
                                  <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {player.location}
                                  </div>
                                )}
                              </div>
                              {player.isConnected ? (
                                <Badge variant="default" className="bg-green-500/10 text-green-500">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Connected
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <Users className="mr-1 h-3 w-3" />
                                  Player
                                </Badge>
                              )}
                            </div>

                            {player.playing_role && (
                              <div className="mb-4 flex items-center gap-2">
                                <Award className="h-4 w-4 text-primary" />
                                <span className="font-semibold capitalize">{player.playing_role}</span>
                              </div>
                            )}

                            <div className="mb-4 flex flex-wrap gap-2">
                              {player.categories.slice(0, 3).map((category) => (
                                <Badge key={category.id} variant="outline" className="text-xs">
                                  {category.name}
                                </Badge>
                              ))}
                              {player.categories.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{player.categories.length - 3} more
                                </Badge>
                              )}
                            </div>

                            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <div className="text-muted-foreground">Level</div>
                                <div className="font-semibold capitalize">{player.experience_level || "Not set"}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground">Age Group</div>
                                <div className="font-semibold capitalize">{player.age_group || "Not set"}</div>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button className="flex-1" asChild>
                                <Link to={`/coaching-marketplace/player/${player.id}`}>View Profile</Link>
                              </Button>
                              {!player.isConnected && coachProfile && (
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
                  ) : filteredCoaches.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="mb-4 text-muted-foreground">No coaches found matching your criteria.</p>
                      <Button variant="outline" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {filteredCoaches.map((coach) => (
                        <div
                          key={coach.id}
                          className="rounded-2xl border border-border bg-gradient-card p-6 transition-all duration-300 hover:border-primary/30"
                        >
                          <div className="mb-4 flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-display text-xl font-bold text-foreground">{coach.name}</h4>
                              {coach.location && (
                                <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  {coach.location}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              {coach.isConnected && (
                                <Badge variant="default" className="bg-green-500/10 text-green-500">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Connected
                                </Badge>
                              )}
                              {coach.is_verified && (
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">
                                  <CheckCircle className="mr-1 h-3 w-3" />
                                  Verified
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="mb-4 flex items-center gap-2">
                            <Star className="h-4 w-4 fill-primary text-primary" />
                            <span className="font-semibold">{coach.adjusted_rating.toFixed(1)}</span>
                            <span className="text-sm text-muted-foreground">
                              ({coach.number_of_ratings} {coach.number_of_ratings === 1 ? "rating" : "ratings"})
                            </span>
                          </div>

                          <div className="mb-4 flex flex-wrap gap-2">
                            {coach.categories?.slice(0, 3).map((category) => (
                              <Badge key={category.id} variant="outline" className="text-xs">
                                {category.name}
                              </Badge>
                            ))}
                            {coach.categories && coach.categories.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{coach.categories.length - 3} more
                              </Badge>
                            )}
                          </div>

                          <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Level</div>
                              <div className="font-semibold capitalize">{coach.coaching_level}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Experience</div>
                              <div className="font-semibold">{coach.years_experience} years</div>
                            </div>
                          </div>

                          {coach.bio && (
                            <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                              {coach.bio}
                            </p>
                          )}

                          <div className="flex gap-2">
                            <Button className="flex-1" asChild>
                              <Link to={`/coaching-marketplace/coach/${coach.id}`}>View Profile</Link>
                            </Button>
                            {user && hasPlayerProfile && !coach.isConnected && (
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
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      </section>
      ) : null}

      <Footer />
    </div>
  );
};

export default CoachingMarketplace;
