import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export function useRequireAuth() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const requireAuth = (action?: string): boolean => {
    if (!user) {
      toast({
        title: "Login Required",
        description: action ? `Please log in to ${action}.` : "Please log in to continue.",
        variant: "destructive",
      });
      navigate("/auth", { state: { from: location } });
      return false;
    }
    return true;
  };

  return { user, requireAuth };
}
