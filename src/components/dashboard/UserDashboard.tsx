import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, Brain, ShoppingBag, Zap, ArrowRight, 
  FileText, Package, Clock, TrendingUp, Plus, Eye
} from "lucide-react";
import { format } from "date-fns";

interface AnalysisResult {
  id: string;
  mode: string;
  overall_score: number;
  created_at: string;
  video_duration: string | null;
}

interface MarketplaceListing {
  id: string;
  title: string;
  price: number | null;
  listing_type: string;
  condition: string;
  is_active: boolean;
  created_at: string;
}

export const UserDashboard = () => {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const [analysisRes, listingsRes] = await Promise.all([
        supabase
          .from("analysis_results")
          .select("id, mode, overall_score, created_at, video_duration")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("marketplace_listings")
          .select("id, title, price, listing_type, condition, is_active, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (analysisRes.data) setAnalyses(analysisRes.data);
      if (listingsRes.data) setListings(listingsRes.data);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Athlete";

  const quickActions = [
    { name: "AI Coaching", path: "/coaching", icon: Zap, color: "primary" },
    { name: "TechniqueAI", path: "/techniqueai", icon: Brain, color: "accent" },
    { name: "Smart Analytics", path: "/analytics", icon: BarChart3, color: "primary" },
    { name: "Gear Marketplace", path: "/marketplace", icon: ShoppingBag, color: "primary" },
  ];

  return (
    <section className="pt-32 pb-16">
      <div className="container mx-auto px-4">
        {/* Welcome Header */}
        <div className="mb-10">
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3">
            Welcome back, <span className="text-gradient-primary">{userName}</span>!
          </h1>
          <p className="text-muted-foreground text-lg">
            Ready to elevate your game? Here's your personalized dashboard.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {quickActions.map((action) => (
            <Link key={action.path} to={action.path} className="group">
              <div className={`p-5 rounded-2xl bg-card border border-border hover:border-${action.color}/50 transition-all duration-300 hover:shadow-glow`}>
                <div className={`w-12 h-12 rounded-xl bg-${action.color}/10 flex items-center justify-center mb-4 group-hover:bg-${action.color}/20 transition-colors`}>
                  <action.icon className={`w-6 h-6 text-${action.color}`} />
                </div>
                <h3 className="font-display font-semibold text-foreground">
                  {action.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Analysis History */}
          <div className="rounded-2xl bg-gradient-card border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Your Analysis History
                </h2>
              </div>
              <Link to="/analytics" className="text-sm text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
                ))}
              </div>
            ) : analyses.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <p className="text-muted-foreground mb-4">No analysis yet</p>
                <Button variant="hero" size="sm" asChild>
                  <Link to="/coaching">
                    <Plus className="w-4 h-4" />
                    Start Your First Analysis
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.map((analysis) => (
                  <Link
                    key={analysis.id}
                    to={`/analysis/${analysis.id}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground capitalize">
                          {analysis.mode} Analysis
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {format(new Date(analysis.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-display font-bold text-xl text-primary">
                          {analysis.overall_score}%
                        </p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                      <Eye className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Marketplace Listings */}
          <div className="rounded-2xl bg-gradient-card border border-border p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-accent" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">
                  Your Gear Listings
                </h2>
              </div>
              <Link to="/marketplace" className="text-sm text-accent hover:underline flex items-center gap-1">
                Manage <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-secondary/50 animate-pulse" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <ShoppingBag className="w-8 h-8 text-accent" />
                </div>
                <p className="text-muted-foreground mb-4">No listings yet</p>
                <Button variant="accent" size="sm" asChild>
                  <Link to="/marketplace">
                    <Plus className="w-4 h-4" />
                    List Your First Item
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {listing.title}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className={`px-2 py-0.5 rounded-md text-xs ${
                            listing.listing_type === 'donation' 
                              ? 'bg-accent/10 text-accent' 
                              : 'bg-primary/10 text-primary'
                          }`}>
                            {listing.listing_type === 'donation' ? 'Donation' : 'For Sale'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-secondary text-xs">
                            {listing.condition}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {listing.price ? (
                        <p className="font-display font-bold text-lg text-foreground">
                          ${listing.price}
                        </p>
                      ) : (
                        <p className="font-display font-bold text-lg text-accent">
                          Free
                        </p>
                      )}
                      <p className={`text-xs ${listing.is_active ? 'text-primary' : 'text-muted-foreground'}`}>
                        {listing.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
