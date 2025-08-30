import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import Index from "./pages/Index";
import GameLobby from "./pages/GameLobby";
import { RoomLobby } from "@/components/multiplayer/RoomLobby";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import GameArena from "./pages/GameArena";
import RoundLobby from "./pages/RoundLobby";
import Auth from "./pages/Auth";
import AdminSpotify from "./pages/AdminSpotify";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin/spotify" element={<AdminSpotify />} />
            <Route path="/lobby/:roomCode" element={<RoomLobby />} />
            <Route path="/game/lobby/:roomCode" element={<GameLobby />} />
            <Route path="/game/lobby" element={<GameLobby />} />
            <Route path="/round-lobby/:roomCode" element={<RoundLobby />} />
            <Route path="/game/:roomCode" element={<GameArena />} />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
