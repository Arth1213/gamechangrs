import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const ProfileAvatar = ({ name, imageUrl, size = "md", className }: ProfileAvatarProps) => {
  const sizeClasses = {
    xs: "w-8 h-8 text-xs",
    sm: "w-10 h-10 text-sm",
    md: "w-12 h-12 text-base",
    lg: "w-20 h-20 text-2xl",
    xl: "w-32 h-32 text-4xl",
  };

  return (
    <Avatar className={cn(sizeClasses[size], "border-2 border-border", className)}>
      <AvatarImage src={imageUrl || undefined} alt={name} className="object-cover" />
      <AvatarFallback className="bg-primary/10 text-primary font-bold">
        {name.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
};
