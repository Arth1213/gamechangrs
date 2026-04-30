import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { buildAuthRoute, buildLocationRedirect } from "@/lib/authRedirect";

export function useRequireAuth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const requireAuth = (action?: string): boolean => {
    if (!user) {
      const redirectPath = buildLocationRedirect(location);
      toast({
        title: "Login Required",
        description: action ? `Please log in to ${action}.` : "Please log in to continue.",
        variant: "destructive",
      });
      navigate(buildAuthRoute(redirectPath), { state: { from: location } });
      return false;
    }
    return true;
  };

  return { user, requireAuth };
}
