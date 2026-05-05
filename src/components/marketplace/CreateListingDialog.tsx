import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Camera, Upload, Loader2, Sparkles } from "lucide-react";

interface CreateListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialListingType?: "sale" | "donation";
  listingToEdit?: {
    id: string;
    title: string | null;
    description: string | null;
    category: string | null;
    condition: string | null;
    listing_type: string | null;
    price: number | null;
    location: string | null;
    image_url: string | null;
    contactEmail: string;
  } | null;
}

export function CreateListingDialog({
  open,
  onOpenChange,
  onSuccess,
  initialListingType = "sale",
  listingToEdit = null,
}: CreateListingDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Cricket",
    condition: "Good",
    listingType: initialListingType,
    price: "",
    contactEmail: user?.email || "",
    location: "",
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (listingToEdit) {
      setFormData({
        title: listingToEdit.title || "",
        description: listingToEdit.description || "",
        category: listingToEdit.category || "Cricket",
        condition: listingToEdit.condition || "Good",
        listingType: listingToEdit.listing_type === "donation" ? "donation" : "sale",
        price: typeof listingToEdit.price === "number" ? String(listingToEdit.price) : "",
        contactEmail: listingToEdit.contactEmail || user?.email || "",
        location: listingToEdit.location || "",
      });
      setImagePreview(listingToEdit.image_url || null);
      setImageBase64(listingToEdit.image_url || null);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      listingType: initialListingType,
      contactEmail: user?.email || prev.contactEmail,
    }));
    setImagePreview(null);
    setImageBase64(null);
  }, [open, initialListingType, listingToEdit, user?.email]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      setImageBase64(base64);
      
      // Auto-analyze the image
      await analyzeImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-gear-image", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;

      if (data) {
        setFormData(prev => ({
          ...prev,
          title: data.title || prev.title,
          description: data.description || prev.description,
          category: data.category || prev.category,
          condition: data.condition || prev.condition,
          price: data.suggestedPrice?.toString() || prev.price,
        }));
        toast({ title: "Image analyzed!", description: "Details have been auto-filled. Please review and adjust as needed." });
      }
    } catch (error) {
      console.error("Error analyzing image:", error);
      toast({ 
        title: "Couldn't analyze image", 
        description: "Please fill in the details manually.",
        variant: "destructive" 
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({ title: "Please sign in to create a listing", variant: "destructive" });
      return;
    }

    if (!formData.contactEmail) {
      toast({ title: "Contact email is required", variant: "destructive" });
      return;
    }

    if (formData.listingType === "sale" && !formData.price) {
      toast({ title: "Please enter a price for sale items", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const listingPayload = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        condition: formData.condition,
        listing_type: formData.listingType,
        price: formData.listingType === "sale" ? parseFloat(formData.price) : null,
        location: formData.location || null,
        image_url: imageBase64 || null,
      };

      if (listingToEdit) {
        const { error: listingError } = await supabase
          .from("marketplace_listings")
          .update(listingPayload)
          .eq("id", listingToEdit.id)
          .eq("user_id", user.id);

        if (listingError) throw listingError;

        const { error: contactError } = await supabase
          .from("seller_contacts")
          .upsert(
            {
              listing_id: listingToEdit.id,
              contact_email: formData.contactEmail,
            },
            { onConflict: "listing_id" },
          );

        if (contactError) throw contactError;

        toast({ title: "Listing updated successfully!" });
        onSuccess();
        onOpenChange(false);
        resetForm();
        return;
      }

      const { data: listing, error: listingError } = await supabase
        .from("marketplace_listings")
        .insert({
          user_id: user.id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          condition: formData.condition,
          listing_type: formData.listingType,
          price: formData.listingType === "sale" ? parseFloat(formData.price) : null,
          location: formData.location || null,
          image_url: imageBase64 || null,
          is_active: true,
        })
        .select("id")
        .single();

      if (listingError) throw listingError;

      // Then, store the contact email in the secure seller_contacts table
      const { error: contactError } = await supabase
        .from("seller_contacts")
        .insert({
          listing_id: listing.id,
          contact_email: formData.contactEmail,
        });

      if (contactError) throw contactError;

      toast({ title: "Listing created successfully!" });
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error creating listing:", error);
      toast({ title: "Failed to create listing", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "Cricket",
      condition: "Good",
      listingType: initialListingType,
      price: "",
      contactEmail: user?.email || "",
      location: "",
    });
    setImagePreview(null);
    setImageBase64(null);
  };

  const isDonation = formData.listingType === "donation";
  const isEditing = Boolean(listingToEdit);
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Update Listing" : isDonation ? "Donate Gear" : "Sell Gear"}
          </DialogTitle>
          <DialogDescription>
            Upload an image, review the AI-filled details, and {isEditing ? "save the changes" : "publish the listing"}. Game-Changrs only introduces the two sides. The exchange continues by email offline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Upload Image</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            {imagePreview ? (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-lg"
                />
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles className="h-5 w-5 animate-pulse" />
                      <span>Analyzing image...</span>
                    </div>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-4">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Take a photo or upload an image
                  </p>
                  <p className="text-xs text-muted-foreground">
                    AI will auto-fill details from your image
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Listing Type */}
          <div className="space-y-2">
            <Label>Listing Type</Label>
            <Select
              value={formData.listingType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, listingType: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="donation">Donate (Free)</SelectItem>
                <SelectItem value="sale">Sell</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Cricket Bat - SS Ton"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your item..."
              rows={3}
            />
          </div>

          {/* Category & Condition */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cricket">Cricket</SelectItem>
                  <SelectItem value="Football">Football</SelectItem>
                  <SelectItem value="Basketball">Basketball</SelectItem>
                  <SelectItem value="Tennis">Tennis</SelectItem>
                  <SelectItem value="Running">Running</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select
                value={formData.condition}
                onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Excellent">Excellent</SelectItem>
                  <SelectItem value="Good">Good</SelectItem>
                  <SelectItem value="Fair">Fair</SelectItem>
                  <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Price (only for sale) */}
          {formData.listingType === "sale" && (
            <div className="space-y-2">
              <Label htmlFor="price">Price (₹)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="Enter price in INR"
                required
              />
            </div>
          )}

          {/* Contact Email */}
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Your Contact Email *</Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
              placeholder="your@email.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              Your email stays private until the buyer or recipient is introduced through the marketplace email flow.
            </p>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location (Optional)</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="e.g., Mumbai, Maharashtra"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || isAnalyzing}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {isEditing ? "Updating Listing..." : "Creating Listing..."}
              </>
            ) : (
              isEditing ? "Update Listing" : "Create Listing"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
