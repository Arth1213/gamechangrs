import { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { 
  ShoppingBag, Heart, Search, Filter, ChevronDown, 
  Plus, Tag, MapPin, Package, Mail, AlertTriangle, CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  user_id: string;
  is_active: boolean;
}

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

  const fetchListings = async () => {
    setIsLoading(true);
    try {
      // Only select fields that should be publicly visible - exclude contact_email
      const { data, error } = await supabase
        .from("marketplace_listings")
        .select("id, title, description, price, original_price, condition, location, image_url, category, listing_type, user_id, is_active")
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
    setContactListing(listing);
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
      
      {/* Hero */}
      <section className="pt-32 pb-12 bg-gradient-hero">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
              <Heart className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">Supporting Youth Athletes</span>
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Gear <span className="text-gradient-accent">Marketplace</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-4">
              Quality sports equipment at affordable prices. Every purchase helps provide gear to underprivileged young athletes.
            </p>
            
            {/* Important Notice */}
            <div className="bg-secondary/50 border border-border rounded-xl p-4 mb-8 text-left">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-1">Connection Platform Only</p>
                  <p className="text-muted-foreground">
                    This marketplace connects buyers and sellers directly. We do not process payments or handle transactions. 
                    Buyers and sellers communicate via email and arrange their own transactions safely.
                  </p>
                </div>
              </div>
            </div>

            <Button variant="accent" size="xl" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-5 h-5" />
              Donate or Sell Gear
            </Button>
          </div>
        </div>
      </section>

      {/* Impact Banner */}
      <section className="py-8 bg-primary/10 border-y border-primary/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-center md:text-left">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-primary" />
              <div>
                <p className="font-display font-bold text-2xl text-foreground">5,000+</p>
                <p className="text-muted-foreground text-sm">Items Listed</p>
              </div>
            </div>
            <div className="hidden md:block w-px h-12 bg-border" />
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-primary" />
              <div>
                <p className="font-display font-bold text-2xl text-foreground">2,500+</p>
                <p className="text-muted-foreground text-sm">Kids Helped</p>
              </div>
            </div>
            <div className="hidden md:block w-px h-12 bg-border" />
            <div className="flex items-center gap-3">
              <Tag className="w-8 h-8 text-primary" />
              <div>
                <p className="font-display font-bold text-2xl text-foreground">₹50L+</p>
                <p className="text-muted-foreground text-sm">Saved by Families</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for gear..."
                className="w-full h-12 pl-12 pr-4 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex gap-4">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-12 px-6 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
      <section className="py-12">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading listings...</div>
          ) : filteredListings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No listings found.</p>
              <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Be the first to list!
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.map((listing) => (
                <div
                  key={listing.id}
                  className="rounded-2xl bg-gradient-card border border-border overflow-hidden hover:border-primary/30 transition-all duration-300 group"
                >
                  {/* Image */}
                  <div className="aspect-square bg-secondary/50 overflow-hidden relative">
                    {listing.image_url ? (
                      <img 
                        src={listing.image_url} 
                        alt={listing.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-16 h-16 text-muted-foreground/30" />
                      </div>
                    )}
                    {/* Listing type badge */}
                    <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium ${
                      listing.listing_type === "donation" 
                        ? "bg-green-500/90 text-white" 
                        : "bg-primary/90 text-primary-foreground"
                    }`}>
                      {listing.listing_type === "donation" ? "Free - Donation" : "For Sale"}
                    </div>
                    {/* Owner badge */}
                    {user?.id === listing.user_id && (
                      <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-background/90 text-xs font-medium text-foreground flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Your Listing
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="mb-3">
                      <h3 className="font-display font-semibold text-foreground mb-1">
                        {listing.title}
                      </h3>
                      {listing.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                        {listing.condition}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-secondary text-muted-foreground text-xs">
                        {listing.category}
                      </span>
                      {listing.location && (
                        <span className="flex items-center gap-1 text-muted-foreground text-xs">
                          <MapPin className="w-3 h-3" />
                          {listing.location}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        {listing.listing_type === "donation" ? (
                          <span className="font-display text-xl font-bold text-green-500">FREE</span>
                        ) : (
                          <div className="flex items-baseline gap-2">
                            <span className="font-display text-2xl font-bold text-foreground">
                              ₹{listing.price?.toLocaleString()}
                            </span>
                            {listing.original_price && listing.original_price > (listing.price || 0) && (
                              <span className="text-muted-foreground line-through text-sm">
                                ₹{listing.original_price.toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {user?.id === listing.user_id ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setDelistingId(listing.id)}
                        >
                          Mark as Sold
                        </Button>
                      ) : (
                        <Button 
                          variant="hero" 
                          size="sm"
                          onClick={() => handleContact(listing)}
                        >
                          <Mail className="w-4 h-4 mr-1" />
                          Contact
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

      {/* Donate CTA */}
      <section className="py-20 bg-gradient-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Have Gear to Share?
            </h2>
            <p className="text-muted-foreground mb-4">
              Your old equipment could be the start of someone's sports journey. Donate or sell at affordable prices to help underprivileged young athletes pursue their dreams.
            </p>
            <p className="text-sm text-muted-foreground mb-8">
              Simply upload a photo and our AI will auto-fill the details for you!
            </p>
            <Button variant="hero" size="xl" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-5 h-5" />
              List Your Gear
            </Button>
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
