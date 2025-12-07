import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { 
  ShoppingBag, Heart, Search, Filter, ChevronDown, 
  Plus, Tag, MapPin, Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Marketplace = () => {
  const [category, setCategory] = useState("All");
  const { toast } = useToast();

  const products = [
    {
      id: 1,
      name: "Cricket Bat - Junior Size",
      price: 25,
      originalPrice: 75,
      condition: "Good",
      location: "Austin, TX",
      image: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=400&h=400&fit=crop",
      category: "Cricket",
      seller: "Coach Mike",
    },
    {
      id: 2,
      name: "Tennis Racket - Wilson",
      price: 35,
      originalPrice: 120,
      condition: "Excellent",
      location: "Houston, TX",
      image: "https://images.unsplash.com/photo-1617083934555-ac7b4d0c8be9?w=400&h=400&fit=crop",
      category: "Tennis",
      seller: "Sarah T.",
    },
    {
      id: 3,
      name: "Cricket Pads - Youth",
      price: 20,
      originalPrice: 60,
      condition: "Good",
      location: "Dallas, TX",
      image: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=400&h=400&fit=crop",
      category: "Cricket",
      seller: "Thunder Hawks",
    },
    {
      id: 4,
      name: "Tennis Shoes - Size 6",
      price: 30,
      originalPrice: 85,
      condition: "Like New",
      location: "San Antonio, TX",
      image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop",
      category: "Tennis",
      seller: "Tennis Academy",
    },
    {
      id: 5,
      name: "Cricket Helmet - Junior",
      price: 15,
      originalPrice: 45,
      condition: "Good",
      location: "Austin, TX",
      image: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&h=400&fit=crop",
      category: "Cricket",
      seller: "Rising Stars",
    },
    {
      id: 6,
      name: "Tennis Ball Hopper",
      price: 18,
      originalPrice: 40,
      condition: "Good",
      location: "Plano, TX",
      image: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400&h=400&fit=crop",
      category: "Tennis",
      seller: "Coach Lisa",
    },
  ];

  const filteredProducts = category === "All" 
    ? products 
    : products.filter(p => p.category === category);

  const handleContact = (seller: string) => {
    toast({
      title: "Contact Sent",
      description: `Your interest has been sent to ${seller}. They'll reach out soon!`,
    });
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
            <p className="text-lg text-muted-foreground mb-8">
              Quality sports equipment at affordable prices. Every purchase helps provide gear to underprivileged young athletes.
            </p>
            <Button variant="accent" size="xl">
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
                <p className="text-muted-foreground text-sm">Items Donated</p>
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
                <p className="font-display font-bold text-2xl text-foreground">$50K+</p>
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
                <option>Tennis</option>
              </select>
              <button className="h-12 px-6 rounded-xl bg-secondary border border-border text-foreground flex items-center gap-2 hover:bg-secondary/80 transition-colors">
                <Filter className="w-5 h-5" />
                More Filters
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="rounded-2xl bg-gradient-card border border-border overflow-hidden hover:border-primary/30 transition-all duration-300 group"
              >
                {/* Image */}
                <div className="aspect-square bg-secondary/50 overflow-hidden">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display font-semibold text-foreground mb-1">
                        {product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">by {product.seller}</p>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Heart className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                      {product.condition}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      <MapPin className="w-3 h-3" />
                      {product.location}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-2xl font-bold text-foreground">
                        ${product.price}
                      </span>
                      <span className="text-muted-foreground line-through text-sm">
                        ${product.originalPrice}
                      </span>
                    </div>
                    <Button 
                      variant="hero" 
                      size="sm"
                      onClick={() => handleContact(product.seller)}
                    >
                      Contact
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Donate CTA */}
      <section className="py-20 bg-gradient-card border-t border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              Have Gear to Share?
            </h2>
            <p className="text-muted-foreground mb-8">
              Your old equipment could be the start of someone's sports journey. Donate or sell at affordable prices to help underprivileged young athletes pursue their dreams.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="hero" size="xl">
                <Heart className="w-5 h-5" />
                Donate Gear
              </Button>
              <Button variant="outline" size="xl">
                <ShoppingBag className="w-5 h-5" />
                List for Sale
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Marketplace;
