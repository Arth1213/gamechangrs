import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { 
  ShoppingBag, Heart, Search, Filter, ChevronDown, 
  Plus, Tag, MapPin, Package, Mail, AlertTriangle, CheckCircle, ArrowUpRight, ShieldCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { CreateListingDialog } from "@/components/marketplace/CreateListingDialog";
import { ContactSellerDialog } from "@/components/marketplace/ContactSellerDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Listing {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  original_price: number | null;
  condition: string;
  location: string | null;
  image_url: string | null;
  category: string;
  listing_type: string;
  is_owner: boolean | null;
  is_active: boolean;
}

const featuredRetailPartner = {
  name: "East Bay Cricket Shop",
  href: "https://eastbaycricshop.com/#new-bats",
  eyebrow: "Featured Retail Partner",
  title: "Need Fresh Cricket Gear?",
  description:
    "Browse a stronger retail option alongside community listings. We kept the marketplace focused on peer-to-peer gear, but added a clean route out to East Bay Cricket Shop for players who want new bats and retail-ready equipment.",
  highlights: ["New bats", "Retail cricket gear", "Quick external checkout"],
};

const Marketplace = () => {
  const [category, setCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [delistingId, setDelistingId] = useState<string | null>(null);
  const [contactListing, setContactListing] = useState<Listing | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { requireAuth } = useRequireAuth();

  const fetchListings = async () => {
    setIsLoading(true);
    try {
      // Use secure view that provides is_owner flag instead of exposing user_id
      const { data, error } = await supabase
        .from("public_marketplace_listings")
        .select("id, title, description, price, original_price, condition, location, image_url, category, listing_type, is_owner, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const filteredListings = listings.filter(listing => {
    const matchesCategory = category === "All" || listing.category === category;
    const matchesSearch = listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (listing.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleContact = (listing: Listing) => {
    if (!requireAuth("contact sellers")) return;
    setContactListing(listing);
  };

  const handleCreateListing = () => {
    if (!requireAuth("create a listing")) return;
    setCreateDialogOpen(true);
  };

  const handleDelist = async () => {
    if (!delistingId) return;

    try {
      const { error } = await supabase
        .from("marketplace_listings")
        .update({ is_active: false })
        .eq("id", delistingId)
        .eq("user_id", user?.id);

      if (error) throw error;

      toast({ title: "Listing removed", description: "Your item has been delisted from the marketplace." });
      fetchListings();
    } catch (error) {
      console.error("Error delisting:", error);
      toast({ title: "Failed to delist item", variant: "destructive" });
    } finally {
      setDelistingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Compact Hero */}
      <section className="pt-24 pb-6 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                  Gear <span className="text-gradient-accent">Marketplace</span>
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Quality sports equipment at affordable prices
                </p>
              </div>
              <Button variant="accent" size="default" onClick={handleCreateListing}>
                <Plus className="w-4 h-4" />
                Donate or Sell Gear
              </Button>
            </div>
            
            {/* Compact Notice */}
            <div className="bg-secondary/50 border border-border rounded-lg p-3 text-left">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Connection Platform Only:</span> We connect buyers and sellers directly. Arrange transactions via email safely.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="py-4 border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for gear..."
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 px-4 rounded-lg bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option>All</option>
                <option>Cricket</option>
                <option>Football</option>
                <option>Basketball</option>
                <option>Tennis</option>
                <option>Running</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-6">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading listings...</div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No listings found.</p>
              <Button variant="outline" size="sm" onClick={handleCreateListing}>
                <Plus className="w-4 h-4 mr-2" />
                Be the first to list!
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredListings.map((listing) => (
                <div
                  key={listing.id}
                  className="rounded-xl bg-gradient-card border border-border overflow-hidden hover:border-primary/30 transition-all duration-300 group"
                >
                  {/* Compact Image */}
                  <div className="aspect-[4/3] bg-secondary/50 overflow-hidden relative">
                    {listing.image_url ? (
                      <img 
                        src={listing.image_url} 
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Listing type badge */}
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      listing.listing_type === "donation" 
                        ? "bg-green-500/90 text-white" 
                        : "bg-primary/90 text-primary-foreground"
                    }`}>
                      {listing.listing_type === "donation" ? "Free" : "Sale"}
                    </div>
                    {/* Owner badge */}
                    {listing.is_owner && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-background/90 text-[10px] font-medium text-foreground flex items-center gap-0.5">
                        <CheckCircle className="w-2.5 h-2.5" />
                        Yours
                      </div>
                    )}
                  </div>

                  {/* Compact Content */}
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-foreground mb-1 line-clamp-1">
                      {listing.title}
                    </h3>
                    
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                        {listing.condition}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground text-[10px]">
                        {listing.category}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        {listing.listing_type === "donation" ? (
                          <span className="font-bold text-sm text-green-500">FREE</span>
                        ) : (
                          <span className="font-bold text-sm text-foreground">
                            ${listing.price?.toLocaleString()}
                          </span>
                        )}
                      </div>
                      
                      {listing.is_owner ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => setDelistingId(listing.id)}
                        >
                          Sold
                        </Button>
                      ) : (
                        <Button 
                          variant="hero" 
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => handleContact(listing)}
                        >
                          <Mail className="w-3 h-3 mr-1" />
                          {listing.listing_type === "donation" ? "Get" : "Buy"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Compact Donate CTA */}
      <section className="py-10 bg-gradient-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-2">
              Have Gear to Share?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your old equipment could help young athletes. Upload a photo and our AI auto-fills the details!
            </p>
            <Button variant="hero" size="default" onClick={handleCreateListing}>
              <Plus className="w-4 h-4" />
              List Your Gear
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Retail Partner */}
      <section className="py-6 border-t border-border bg-background">
        <div className="container mx-auto px-4">
          <div className="overflow-hidden rounded-[28px] border border-border bg-[linear-gradient(135deg,rgba(14,19,28,0.98),rgba(18,30,26,0.94)_45%,rgba(24,16,10,0.94))]">
            <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="relative p-6 md:p-8 lg:p-10">
                <div className="absolute -left-16 top-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
                <div className="absolute bottom-0 right-10 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />

                <div className="relative">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-primary">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {featuredRetailPartner.eyebrow}
                  </div>

                  <div className="mt-5 max-w-2xl">
                    <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                      {featuredRetailPartner.title}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm md:text-base leading-relaxed text-muted-foreground">
                      {featuredRetailPartner.description}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {featuredRetailPartner.highlights.map((highlight) => (
                      <span
                        key={highlight}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-foreground/85"
                      >
                        {highlight}
                      </span>
                    ))}
                  </div>

                  <div className="mt-7 flex flex-col sm:flex-row gap-3">
                    <a
                      href={featuredRetailPartner.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex"
                    >
                      <Button variant="hero" size="default">
                        Shop East Bay
                        <ArrowUpRight className="w-4 h-4" />
                      </Button>
                    </a>
                    <a
                      href={featuredRetailPartner.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex"
                    >
                      <Button variant="outline" size="default" className="border-white/15 bg-background/30">
                        View New Bats
                      </Button>
                    </a>
                  </div>
                </div>
              </div>

              <div className="relative border-t border-border/70 lg:border-l lg:border-t-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]" />
                <div className="relative flex h-full min-h-[260px] items-center justify-center p-6">
                  <div className="relative h-[210px] w-[210px]">
                    <div className="absolute inset-0 rounded-full border border-primary/15" />
                    <div className="absolute inset-[18%] rounded-full border border-accent/20" />
                    <div className="absolute inset-[32%] rounded-full border border-white/10" />

                    <div className="absolute left-1/2 top-1/2 h-[132px] w-[50px] -translate-x-1/2 -translate-y-1/2 rotate-[18deg]">
                      <div className="absolute left-1/2 top-0 h-[90px] w-[28px] -translate-x-1/2 rounded-[999px] border border-[rgba(255,232,198,0.28)] bg-[linear-gradient(180deg,rgba(214,187,147,0.98),rgba(150,103,54,0.98))]" />
                      <div className="absolute bottom-0 left-1/2 h-[54px] w-[12px] -translate-x-1/2 rounded-b-[999px] rounded-t-[12px] bg-[linear-gradient(180deg,rgba(111,69,35,0.98),rgba(62,35,18,1))]" />
                    </div>

                    <div className="absolute left-1/2 top-1/2 h-[178px] w-[178px] -translate-x-1/2 -translate-y-1/2 animate-orbit-spin">
                      <div className="absolute left-1/2 top-0 h-[28px] w-[28px] -translate-x-1/2 rounded-full border border-[rgba(255,219,219,0.35)] bg-[radial-gradient(circle_at_32%_28%,rgba(255,235,235,0.9),rgba(210,54,54,0.95)_35%,rgba(112,13,13,1)_78%)] shadow-[0_0_22px_rgba(180,25,25,0.55)]" />
                    </div>

                    <div className="absolute inset-x-0 bottom-0 mx-auto w-fit rounded-full border border-white/10 bg-background/50 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/60">
                      {featuredRetailPartner.name}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {/* Create Listing Dialog */}
      <CreateListingDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchListings}
      />

      {/* Contact Seller Dialog */}
      {contactListing && (
        <ContactSellerDialog
          open={!!contactListing}
          onOpenChange={(open) => !open && setContactListing(null)}
          listingId={contactListing.id}
          listingTitle={contactListing.title}
        />
      )}

      {/* Delist Confirmation Dialog */}
      <AlertDialog open={!!delistingId} onOpenChange={() => setDelistingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as Sold / Remove Listing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your listing from the marketplace. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelist}>
              Remove Listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Marketplace;
