import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BrowseFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filters: {
    experienceLevel?: string;
    location?: string;
    playingRole?: string;
    coachingLevel?: string;
  };
  onFilterChange: (key: string, value: string) => void;
  onClearFilters: () => void;
  filterType: "players" | "coaches";
  locations: string[];
  roles?: string[];
}

const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"];
const COACHING_LEVELS = ["beginner", "intermediate", "advanced"];
const PLAYING_ROLES = [
  "Batsman",
  "Bowler",
  "All-Rounder",
  "Wicket Keeper",
  "Fast Bowler",
  "Spin Bowler",
  "Opening Batsman",
  "Middle Order Batsman",
  "Leg Spinner",
  "Off Spinner",
];

export const BrowseFilters = ({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  onClearFilters,
  filterType,
  locations,
  roles,
}: BrowseFiltersProps) => {
  const hasActiveFilters =
    searchQuery ||
    filters.experienceLevel ||
    filters.location ||
    filters.playingRole ||
    filters.coachingLevel;

  return (
    <div className="rounded-xl bg-gradient-card border border-border p-4 mb-6 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${filterType}...`}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Experience/Coaching Level */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {filterType === "players" ? "Experience Level" : "Coaching Level"}
          </Label>
          <Select
            value={filterType === "players" ? filters.experienceLevel || "" : filters.coachingLevel || ""}
            onValueChange={(value) =>
              onFilterChange(
                filterType === "players" ? "experienceLevel" : "coachingLevel",
                value
              )
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Any level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any level</SelectItem>
              {(filterType === "players" ? EXPERIENCE_LEVELS : COACHING_LEVELS).map(
                (level) => (
                  <SelectItem key={level} value={level} className="capitalize">
                    {level}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Location</Label>
          <Select
            value={filters.location || ""}
            onValueChange={(value) => onFilterChange("location", value)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Any location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any location</SelectItem>
              {locations.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Playing Role (only for players) */}
        {filterType === "players" && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Playing Role</Label>
            <Select
              value={filters.playingRole || ""}
              onValueChange={(value) => onFilterChange("playingRole", value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Any role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any role</SelectItem>
                {(roles || PLAYING_ROLES).map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="h-9 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4 mr-1" />
              Clear filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
