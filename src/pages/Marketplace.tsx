import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  HeartHandshake,
  Mail,
  MapPin,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
} from "lucide-react";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  description: "Retail access for new cricket gear alongside the community marketplace.",
  highlights: ["New bats", "Pads and gloves", "Quick external checkout"],
};

function formatListingDate(value: string | null) {
  if (!value) {
    return "Recently listed";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently listed";
  }

  return `Listed ${format(date, "MMM d, yyyy")}`;
}

function formatListingPrice(listing: Listing) {
  if (listing.listing_type === "donation") {
    return "Free";
  }
  if (typeof listing.price === "number") {
    return `$${listing.price.toLocaleString()}`;
  }
  return "Price on request";
}

function MarketplaceHeroCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "accent" | "warm";
}) {
  const toneClass =
    tone === "accent"
      ? "border-primary/20 bg-primary/10"
      : tone === "warm"
        ? "border-amber-400/20 bg-amber-400/10"
        : "border-border bg-background/70";

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <p className="font-display text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    </div>
  );
}

function MarketplaceRetailPartner() {
  return (
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
  );
}

function MarketplaceGuestLanding({
  publicListingCount,
  donationCount,
  categoryCount,
  previewCategories,
}: {
  publicListingCount: number;
  donationCount: number;
  categoryCount: number;
  previewCategories: string[];
}) {
  return (
    <>
      <section className="border-b border-border bg-card/40 pb-12 pt-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  Gear Marketplace
                </div>

                <div className="space-y-4">
                  <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
                    Pass gear forward. Find the next bat, pads, or full kit.
                  </h1>
                  <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                    Browse community listings, connect directly with sellers, and jump to retail options for new cricket gear when needed.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="hero" size="lg" asChild>
                    <Link to="/auth">
                      Sign In to List Gear
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" asChild>
                    <a href="#gear-marketplace-feed">Browse Live Listings</a>
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {previewCategories.map((category) => (
                    <Badge key={category} variant="outline" className="border-border/80 bg-background/40">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-[32px] border border-border/80 bg-card/85 p-6 shadow-xl">
                <div className="grid gap-4 md:grid-cols-3">
                  <MarketplaceHeroCard label="Community listings" value={publicListingCount} tone="accent" />
                  <MarketplaceHeroCard label="Donation listings" value={donationCount} tone="warm" />
                  <MarketplaceHeroCard label="Gear categories" value={categoryCount} />
                </div>

                <div className="mt-6 rounded-2xl border border-border/80 bg-background/60 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display text-2xl font-bold text-foreground">How it works</h2>
                      <div className="mt-4 grid gap-3">
                        <div className="rounded-2xl border border-border bg-card/80 p-4">
                          <p className="text-sm font-semibold text-foreground">1. Browse public listings</p>
                          <p className="mt-1 text-sm text-muted-foreground">Filter the live feed and open the right item.</p>
                        </div>
                        <div className="rounded-2xl border border-border bg-card/80 p-4">
                          <p className="text-sm font-semibold text-foreground">2. Connect directly by email</p>
                          <p className="mt-1 text-sm text-muted-foreground">Game-Changrs connects buyers and sellers. Payments stay offline.</p>
                        </div>
                        <div className="rounded-2xl border border-border bg-card/80 p-4">
                          <p className="text-sm font-semibold text-foreground">3. Mix community and retail</p>
                          <p className="mt-1 text-sm text-muted-foreground">Use East Bay Cricket Shop when you need new gear fast.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function MarketplaceWorkspaceHero({
  userName,
  ownerListingCount,
  publicListingCount,
  donationCount,
  onCreateListing,
}: {
  userName: string;
  ownerListingCount: number;
  publicListingCount: number;
  donationCount: number;
  onCreateListing: () => void;
}) {
  return (
    <section className="bg-gradient-hero pb-12 pt-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                <ShoppingBag className="h-4 w-4" />
                Your Gear Workspace
              </div>

              <div className="space-y-4">
                <h1 className="font-display text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
                  {userName}, manage your listings and keep the feed moving.
                </h1>
                <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                  List gear, monitor your active items, browse the community feed, and jump to retail inventory when you need something new.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="hero" size="lg" onClick={onCreateListing}>
                  <Plus className="h-5 w-5" />
                  Donate or Sell Gear
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <a href="#gear-marketplace-feed">Browse Live Feed</a>
                </Button>
              </div>

              <div className="rounded-2xl border border-border bg-card/70 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Connection only:</span> buyers and sellers still connect by email. Game-Changrs does not process payment on this surface.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-border/80 bg-card/85 p-6 shadow-xl">
              <div className="grid gap-4 md:grid-cols-3">
                <MarketplaceHeroCard label="Your active listings" value={ownerListingCount} tone="accent" />
                <MarketplaceHeroCard label="Community feed" value={publicListingCount} />
                <MarketplaceHeroCard label="Donation opportunities" value={donationCount} tone="warm" />
              </div>

              <div className="mt-6 rounded-2xl border border-border/80 bg-background/60 p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-primary/80">Workspace focus</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-card/80 p-4">
                    <p className="text-sm font-semibold text-foreground">List gear quickly</p>
                    <p className="mt-1 text-sm text-muted-foreground">Create a new listing in one flow and keep the item visible in the live marketplace.</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/80 p-4">
                    <p className="text-sm font-semibold text-foreground">Mix reuse and retail</p>
                    <p className="mt-1 text-sm text-muted-foreground">Use community listings first, then move to East Bay for new inventory.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketplaceSearchSection({
  category,
  categories,
  searchQuery,
  onCategoryChange,
  onSearchChange,
  title,
  eyebrow,
  description,
}: {
  category: string;
  categories: string[];
  searchQuery: string;
  onCategoryChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  title: string;
  eyebrow: string;
  description: string;
}) {
  return (
    <section id="gear-marketplace-feed" className="border-y border-border bg-card/30 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary/80">{eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search for gear..."
              className="h-10 w-full rounded-lg border border-border bg-secondary pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex gap-3">
            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
              className="h-10 rounded-lg border border-border bg-secondary px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}

function OwnerListingsSection({
  ownerListings,
  isLoading,
  onCreateListing,
  onRefresh,
  onDelist,
}: {
  ownerListings: Listing[];
  isLoading: boolean;
  onCreateListing: () => void;
  onRefresh: () => void;
  onDelist: (listingId: string) => void;
}) {
  return (
    <section className="border-b border-border py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-primary/80">Owner view</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">Your Listings</h2>
          </div>
          <Button variant="outline" onClick={onCreateListing}>
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
            <p className="mt-2 text-sm text-muted-foreground">Your gear will appear here once you create the first listing.</p>
            <div className="mt-6">
              <Button onClick={onCreateListing}>
                <Plus className="h-4 w-4" />
                List Your Gear
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {ownerListings.map((listing) => (
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
                        <p className="mt-2 text-sm text-muted-foreground">{formatListingDate(listing.created_at)}</p>
                      </div>
                      <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-right">
                        <p className="font-display text-2xl font-bold text-foreground">
                          {formatListingPrice(listing)}
                        </p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                          {listing.listing_type === "donation" ? "Donation" : "Price"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                      {listing.condition ? (
                        <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                          {listing.condition}
                        </span>
                      ) : null}
                      {listing.category ? (
                        <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                          {listing.category}
                        </span>
                      ) : null}
                      {listing.location ? (
                        <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
                          {listing.location}
                        </span>
                      ) : null}
                    </div>

                    {listing.description ? (
                      <p className="mt-5 line-clamp-4 text-sm leading-6 text-muted-foreground">{listing.description}</p>
                    ) : null}

                    <div className="mt-5 flex gap-3">
                      <Button variant="outline" onClick={() => onDelist(listing.id)}>
                        Mark as Sold
                      </Button>
                      <Button variant="ghost" onClick={onRefresh}>
                        Refresh
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MarketplaceCard({
  listing,
  onContact,
}: {
  listing: Listing;
  onContact: (listing: Listing) => void;
}) {
  return (
    <div className="group overflow-hidden rounded-3xl border border-border bg-card/80 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated">
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

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
              listing.listing_type === "donation"
                ? "bg-green-500/90 text-white"
                : "bg-primary/90 text-primary-foreground"
            }`}
          >
            {listing.listing_type === "donation" ? "Free" : "Sale"}
          </span>
          {listing.category ? (
            <span className="rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-medium text-foreground">
              {listing.category}
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="line-clamp-1 font-display text-xl font-bold text-foreground">
              {listing.title || "Gear Listing"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{formatListingDate(listing.created_at)}</p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-right">
            <p className="font-display text-lg font-bold text-foreground">{formatListingPrice(listing)}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {listing.listing_type === "donation" ? "Donation" : "Asking"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {listing.condition ? (
            <span className="rounded-full border border-border px-3 py-1">{listing.condition}</span>
          ) : null}
          {listing.location ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
              <MapPin className="h-3 w-3" />
              {listing.location}
            </span>
          ) : null}
        </div>

        {listing.description ? (
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{listing.description}</p>
        ) : null}

        <div className="mt-5">
          <Button variant="hero" size="sm" className="w-full" onClick={() => onContact(listing)}>
            <Mail className="mr-1 h-3.5 w-3.5" />
            {listing.listing_type === "donation" ? "Request Gear" : "Contact Seller"}
          </Button>
        </div>
      </div>
    </div>
  );
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
  const { user, loading } = useAuth();
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

      if (error) {
        throw error;
      }

      setListings((data || []) as Listing[]);
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [user?.id]);

  const categories = useMemo(() => {
    const dynamicCategories = Array.from(
      new Set(listings.map((listing) => (listing.category || "").trim()).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right));

    return ["All", ...dynamicCategories];
  }, [listings]);

  const filteredListings = listings.filter((listing) => {
    const matchesCategory = category === "All" || listing.category === category;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      (listing.title || "").toLowerCase().includes(query) ||
      (listing.description || "").toLowerCase().includes(query) ||
      (listing.location || "").toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  const ownerListings = filteredListings.filter((listing) => listing.is_owner);
  const marketplaceListings = filteredListings.filter((listing) => !listing.is_owner);
  const allPublicListings = listings.filter((listing) => !listing.is_owner);
  const donationCount = allPublicListings.filter((listing) => listing.listing_type === "donation").length;
  const ownerListingCount = listings.filter((listing) => listing.is_owner).length;
  const publicListingCount = allPublicListings.length;
  const categoryCount = Math.max(categories.length - 1, 0);
  const previewCategories = categories.filter((item) => item !== "All").slice(0, 5);

  const handleContact = (listing: Listing) => {
    if (!requireAuth("contact sellers")) {
      return;
    }
    setContactListing(listing);
  };

  const handleCreateListing = () => {
    if (!requireAuth("create a listing")) {
      return;
    }
    setCreateDialogOpen(true);
  };

  const handleDelist = async () => {
    if (!delistingId) {
      return;
    }

    try {
      const { error } = await supabase
        .from("marketplace_listings")
        .update({ is_active: false })
        .eq("id", delistingId)
        .eq("user_id", user?.id);

      if (error) {
        throw error;
      }

      toast({
        title: "Listing removed",
        description: "Your item has been delisted from the marketplace.",
      });
      fetchListings();
    } catch (error) {
      console.error("Error delisting:", error);
      toast({ title: "Failed to delist item", variant: "destructive" });
    } finally {
      setDelistingId(null);
    }
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "your team";

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center pb-16 pt-32">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {user ? (
        <MarketplaceWorkspaceHero
          userName={displayName}
          ownerListingCount={ownerListingCount}
          publicListingCount={publicListingCount}
          donationCount={donationCount}
          onCreateListing={handleCreateListing}
        />
      ) : (
        <MarketplaceGuestLanding
          publicListingCount={publicListingCount}
          donationCount={donationCount}
          categoryCount={categoryCount}
          previewCategories={previewCategories}
        />
      )}

      {user ? (
        <OwnerListingsSection
          ownerListings={ownerListings}
          isLoading={isLoading}
          onCreateListing={handleCreateListing}
          onRefresh={fetchListings}
          onDelist={setDelistingId}
        />
      ) : (
        <section className="border-b border-border py-10">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-6xl">
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-3xl border border-border bg-card/70 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="mt-4 font-display text-2xl font-bold text-foreground">List gear in minutes</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Sign in, add an image, and publish a donation or sale listing into the live feed.
                  </p>
                </div>
                <div className="rounded-3xl border border-border bg-card/70 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
                    <HeartHandshake className="h-5 w-5 text-accent" />
                  </div>
                  <h2 className="mt-4 font-display text-2xl font-bold text-foreground">Community first</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Donation and resale listings stay visible together so players can source the right gear faster.
                  </p>
                </div>
                <div className="rounded-3xl border border-border bg-card/70 p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10">
                    <Store className="h-5 w-5 text-amber-300" />
                  </div>
                  <h2 className="mt-4 font-display text-2xl font-bold text-foreground">Retail fallback</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    When the right used gear is not available, jump straight to East Bay Cricket Shop for new inventory.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <MarketplaceSearchSection
        category={category}
        categories={categories}
        searchQuery={searchQuery}
        onCategoryChange={setCategory}
        onSearchChange={setSearchQuery}
        eyebrow={user ? "Marketplace feed" : "Marketplace preview"}
        title={user ? "Browse Gear" : "Live Gear Feed"}
        description={
          user
            ? "Search the active feed, open donation or sale listings, and connect directly with the seller."
            : "This public preview shows the current live listings. Sign in when you want to list or contact a seller."
        }
      />

      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="border-border/80 bg-background/40">
                <Tag className="mr-1 h-3.5 w-3.5" />
                {publicListingCount} live listings
              </Badge>
              <Badge variant="outline" className="border-border/80 bg-background/40">
                <HeartHandshake className="mr-1 h-3.5 w-3.5" />
                {donationCount} donation items
              </Badge>
              <Badge variant="outline" className="border-border/80 bg-background/40">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Direct contact by email
              </Badge>
            </div>

            {!user ? (
              <Button variant="outline" asChild>
                <Link to="/auth">
                  Sign In to Participate
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>

          {isLoading ? (
            <div className="rounded-3xl border border-border bg-card/70 p-10 text-center text-muted-foreground">
              Loading listings...
            </div>
          ) : marketplaceListings.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card/70 p-10 text-center">
              <p className="mb-4 text-muted-foreground">No marketplace listings found for the current filters.</p>
              <Button variant="outline" size="sm" onClick={handleCreateListing}>
                <Plus className="mr-2 h-4 w-4" />
                Be the first to list
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {marketplaceListings.map((listing) => (
                <MarketplaceCard key={listing.id} listing={listing} onContact={handleContact} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border bg-gradient-card py-10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-xl font-bold text-foreground md:text-2xl">Have Gear to Share?</h2>
            <p className="mb-4 mt-2 text-sm text-muted-foreground">
              Add a listing and keep good cricket gear moving through the community.
            </p>
            <Button variant="hero" size="default" onClick={handleCreateListing}>
              <Plus className="h-4 w-4" />
              List Your Gear
            </Button>
          </div>
        </div>
      </section>

      <MarketplaceRetailPartner />

      <Footer />

      <CreateListingDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSuccess={fetchListings} />

      {contactListing ? (
        <ContactSellerDialog
          open={Boolean(contactListing)}
          onOpenChange={(open) => !open && setContactListing(null)}
          listingId={contactListing.id}
          listingTitle={contactListing.title || "Gear Listing"}
        />
      ) : null}

      <AlertDialog open={Boolean(delistingId)} onOpenChange={() => setDelistingId(null)}>
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
