import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plus,
  Package,
  Mail,
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  ShieldCheck,
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
  title: string | null;
  description: string | null;
  price: number | null;
  original_price: number | null;
  condition: string | null;
  location: string | null;
  image_url: string | null;
  category: string | null;
  listing_type: string | null;
  is_owner: boolean | null;
  is_active: boolean | null;
  created_at: string | null;
}

const featuredRetailPartner = {
  name: "East Bay Cricket Shop",
  href: "https://eastbaycricshop.com/#new-bats",
  eyebrow: "Featured Retail Partner",
  title: "Need Fresh Cricket Gear?",
  description: "Retail option for new gear alongside community listings.",
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
      const { data, error } = await supabase
        .from("public_marketplace_listings")
        .select(
          "id, title, description, price, original_price, condition, location, image_url, category, listing_type, is_owner, is_active, created_at",
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const nextListings = (data || []) as Listing[];
      setListings(nextListings);
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [user?.id]);

  const filteredListings = listings.filter((listing) => {
    const matchesCategory = category === "All" || listing.category === category;
    const matchesSearch =
      (listing.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (listing.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const ownerListings = filteredListings.filter((listing) => listing.is_owner);
  const marketplaceListings = filteredListings.filter((listing) => !listing.is_owner);

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

  const renderMarketplaceCard = (listing: Listing) => (
    <div
      key={listing.id}
      className="overflow-hidden rounded-xl border border-border bg-gradient-card transition-all duration-300 hover:border-primary/30 group"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-secondary/50">
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.title || "Marketplace listing"}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}

        <div
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            listing.listing_type === "donation"
              ? "bg-green-500/90 text-white"
              : "bg-primary/90 text-primary-foreground"
          }`}
        >
          {listing.listing_type === "donation" ? "Free" : "Sale"}
        </div>
      </div>

      <div className="p-3">
        <h3 className="mb-1 line-clamp-1 text-sm font-medium text-foreground">{listing.title}</h3>

        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {listing.condition}
          </span>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {listing.category}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            {listing.listing_type === "donation" ? (
              <span className="text-sm font-bold text-green-500">FREE</span>
            ) : (
              <span className="text-sm font-bold text-foreground">${listing.price?.toLocaleString()}</span>
            )}
          </div>

          <Button variant="hero" size="sm" className="h-7 px-2 text-xs" onClick={() => handleContact(listing)}>
            <Mail className="mr-1 h-3 w-3" />
            {listing.listing_type === "donation" ? "Get" : "Buy"}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="bg-gradient-hero pb-6 pt-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">
                  Gear <span className="text-gradient-accent">Marketplace</span>
                </h1>
              </div>
              <Button variant="accent" size="default" onClick={handleCreateListing}>
                <Plus className="h-4 w-4" />
                Donate or Sell Gear
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-secondary/50 p-3 text-left">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Connection only:</span> buyers and sellers connect by email.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search for gear..."
                className="h-10 w-full rounded-lg border border-border bg-secondary pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 rounded-lg border border-border bg-secondary px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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

      {user && (
        <section className="border-b border-border py-8">
          <div className="container mx-auto px-4">
            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Owner view</p>
                <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">Your Listings</h2>
              </div>
              <Button variant="outline" onClick={handleCreateListing}>
                <Plus className="h-4 w-4" />
                Add Another Listing
              </Button>
            </div>

            {isLoading ? (
              <div className="rounded-3xl border border-border bg-gradient-card p-8 text-sm text-muted-foreground">
                Loading your listings...
              </div>
            ) : ownerListings.length === 0 ? (
              <div className="rounded-3xl border border-border bg-gradient-card p-8">
                <h3 className="font-display text-xl font-bold text-foreground">No active listings yet</h3>
                <div className="mt-6">
                  <Button onClick={handleCreateListing}>
                    <Plus className="h-4 w-4" />
                    List Your Gear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {ownerListings.map((listing) => {
                  return (
                    <div key={listing.id} className="overflow-hidden rounded-3xl border border-border bg-gradient-card">
                      <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
                        <div className="relative min-h-[240px] bg-secondary/40">
                          {listing.image_url ? (
                            <img
                              src={listing.image_url}
                              alt={listing.title || "Your listing"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full min-h-[240px] w-full items-center justify-center">
                              <Package className="h-12 w-12 text-muted-foreground/30" />
                            </div>
                          )}
                          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                                listing.listing_type === "donation"
                                  ? "bg-green-500/90 text-white"
                                  : "bg-primary/90 text-primary-foreground"
                              }`}
                            >
                              {listing.listing_type === "donation" ? "Donation" : "For Sale"}
                            </span>
                            <span className="rounded-full bg-background/90 px-3 py-1 text-[11px] font-medium text-foreground">
                              Your listing
                            </span>
                          </div>
                        </div>

                        <div className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-display text-2xl font-bold text-foreground">{listing.title}</h3>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {listing.created_at ? `Listed ${format(new Date(listing.created_at), "MMM d, yyyy")}` : "Recently listed"}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-right">
                              <p className="font-display text-2xl font-bold text-foreground">
                                {listing.listing_type === "donation" ? "Free" : `$${listing.price?.toLocaleString()}`}
                              </p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                {listing.listing_type === "donation" ? "Donation" : "Price"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                              {listing.condition}
                            </span>
                            <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                              {listing.category}
                            </span>
                            <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                              {listing.listing_type === "donation" ? "Free" : `$${listing.price?.toLocaleString()}`}
                            </span>
                          </div>

                          {listing.description ? (
                            <p className="mt-5 line-clamp-4 text-sm leading-6 text-muted-foreground">{listing.description}</p>
                          ) : null}

                          <div className="mt-5 flex gap-3">
                            <Button variant="outline" onClick={() => setDelistingId(listing.id)}>
                              Mark as Sold
                            </Button>
                            <Button variant="ghost" onClick={fetchListings}>
                              Refresh
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="py-6">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Marketplace feed</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">Browse Gear</h2>
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading listings...</div>
          ) : marketplaceListings.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground">No marketplace listings found.</p>
              <Button variant="outline" size="sm" onClick={handleCreateListing}>
                <Plus className="mr-2 h-4 w-4" />
                Be the first to list
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {marketplaceListings.map(renderMarketplaceCard)}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border bg-gradient-card py-10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">Have Gear to Share?</h2>
            <p className="mb-4 mt-2 text-sm text-muted-foreground">
              List gear in minutes.
            </p>
            <Button variant="hero" size="default" onClick={handleCreateListing}>
              <Plus className="h-4 w-4" />
              List Your Gear
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-background py-6">
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
                    <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">
                      {featuredRetailPartner.title}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">
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

                  <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                    <a href={featuredRetailPartner.href} target="_blank" rel="noreferrer" className="inline-flex">
                      <Button variant="hero" size="default">
                        Shop East Bay
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </a>
                    <a href={featuredRetailPartner.href} target="_blank" rel="noreferrer" className="inline-flex">
                      <Button variant="outline" size="default" className="border-white/15 bg-background/30">
                        View New Bats
                      </Button>
                    </a>
                  </div>
                </div>
              </div>

              <div className="relative border-t border-border/70 lg:border-l lg:border-t-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]" />
                <div className="relative flex h-full items-center justify-center p-6 md:p-8 lg:p-10">
                  <div className="relative w-full max-w-[340px]">
                    <div className="absolute inset-10 rounded-[40px] bg-primary/10 blur-3xl" />
                    <div className="relative flex items-center justify-center overflow-hidden rounded-[30px] border border-white/10 bg-black/10 px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                      <img
                        src="/partners/east-bay-cricket-shop-logo.jpeg"
                        alt="East Bay Cricket Shop logo"
                        className="h-auto max-h-[150px] w-auto max-w-full object-contain md:max-h-[180px] lg:max-h-[200px]"
                      />
                    </div>
                    <div className="absolute inset-x-0 bottom-5 text-center">
                      <span className="inline-flex rounded-full border border-white/10 bg-background/60 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/70 backdrop-blur-sm">
                        {featuredRetailPartner.name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <CreateListingDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={fetchListings} />

      {contactListing && (
        <ContactSellerDialog
          open={!!contactListing}
          onOpenChange={(open) => !open && setContactListing(null)}
          listingId={contactListing.id}
          listingTitle={contactListing.title || "Gear Listing"}
        />
      )}

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
            <AlertDialogAction onClick={handleDelist}>Remove Listing</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Marketplace;
