import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Parks from "./pages/Parks";
import ParkDetail from "./pages/ParkDetail";
import Friends from "./pages/Friends";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import Privacy from "./pages/welcome/Privacy";
import Delight from "./pages/welcome/Delight";
import Promise from "./pages/welcome/Promise";
import WelcomeProfile from "./pages/welcome/Profile";
import Level from "./pages/welcome/Level";
import Location from "./pages/welcome/Location";
import Ready from "./pages/welcome/Ready";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/parks" element={<Parks />} />
          <Route path="/park/:parkId" element={<ParkDetail />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/welcome/privacy" element={<Privacy />} />
          <Route path="/welcome/delight" element={<Delight />} />
          <Route path="/welcome/promise" element={<Promise />} />
          <Route path="/welcome/profile" element={<WelcomeProfile />} />
          <Route path="/welcome/level" element={<Level />} />
          <Route path="/welcome/location" element={<Location />} />
          <Route path="/welcome/ready" element={<Ready />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
