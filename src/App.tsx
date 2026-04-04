import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import TechniqueAI from "./pages/TechniqueAI";
import Analytics from "./pages/Analytics";
import AnalysisDetail from "./pages/AnalysisDetail";
import AnalysisHistory from "./pages/AnalysisHistory";
import Marketplace from "./pages/Marketplace";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Settings from "./pages/Settings";
import FAQ from "./pages/FAQ";
import CoachingMarketplace from "./pages/CoachingMarketplace";
import CoachSignup from "./pages/CoachSignup";
import PlayerSignup from "./pages/PlayerSignup";
import ConnectionVerification from "./pages/ConnectionVerification";
import CoachDashboard from "./pages/CoachDashboard";
import PlayerDashboard from "./pages/PlayerDashboard";
import SessionBooking from "./pages/SessionBooking";
import SessionRating from "./pages/SessionRating";
import CoachProfile from "./pages/CoachProfile";
import PlayerProfile from "./pages/PlayerProfile";
import VerifyConnection from "./pages/VerifyConnection";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/techniqueai" element={<TechniqueAI />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/analysis/:id" element={
              <ProtectedRoute>
                <AnalysisDetail />
              </ProtectedRoute>
            } />
            <Route path="/analysis-history" element={
              <ProtectedRoute>
                <AnalysisHistory />
              </ProtectedRoute>
            } />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/settings" element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/coaching-marketplace" element={<CoachingMarketplace />} />
            <Route path="/coaching-marketplace/coach/:coachId" element={<CoachProfile />} />
            <Route path="/coaching-marketplace/player/:playerId" element={
              <ProtectedRoute>
                <PlayerProfile />
              </ProtectedRoute>
            } />
            <Route path="/coaching-marketplace/coach-signup" element={
              <ProtectedRoute>
                <CoachSignup />
              </ProtectedRoute>
            } />
            <Route path="/coaching-marketplace/player-signup" element={
              <ProtectedRoute>
                <PlayerSignup />
              </ProtectedRoute>
            } />
            <Route path="/coaching-marketplace/connect/:coachId" element={
              <ProtectedRoute>
                <ConnectionVerification />
              </ProtectedRoute>
            } />
            <Route path="/coaching-marketplace/connect-student/:studentId" element={
              <ProtectedRoute>
                <ConnectionVerification />
              </ProtectedRoute>
            } />
            <Route path="/coaching-marketplace/coach-dashboard" element={
              <ProtectedRoute>
                <CoachDashboard />
              </ProtectedRoute>
            } />
            <Route path="/coaching-marketplace/player-dashboard" element={
              <ProtectedRoute>
                <PlayerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/coaching-marketplace/book/:coachId" element={
              <ProtectedRoute>
                <SessionBooking />
              </ProtectedRoute>
            } />
            <Route path="/coaching-marketplace/session/:sessionId/rate" element={
              <ProtectedRoute>
                <SessionRating />
              </ProtectedRoute>
            } />
            <Route path="/coaching-marketplace/verify-connection" element={<VerifyConnection />} />
            <Route path="*" element={<NotFound />} />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
