import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import AuthGuard from "./components/AuthGuard";
import MainLayout from "./components/MainLayout";

// Pages
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SignupSuccess from "./pages/SignupSuccess";
// import ProfileSetup from "./pages/ProfileSetup"; 
import Home from "./pages/Home";
import CharacterSelection from "./pages/CharacterSelection";
import CharacterName from "./pages/CharacterName";
import CharacterHobbies from "./pages/CharacterHobbies";
import CharacterPersonality from "./pages/CharacterPersonality";
import CharacterProfession from "./pages/CharacterProfession";
import DurationSelection from "./pages/DurationSelection";
import StoryCreationMode from "./pages/StoryCreationMode";
import StoryGenre from "./pages/StoryGenre";
import StoryMoral from "./pages/StoryMoral";
import GeneratingStory from "./pages/GeneratingStory";
import StoryViewer from "./pages/StoryViewer";
import StoryAudioPage from "./pages/StoryAudioPage";
import StoryContinuation from "./pages/StoryContinuation";
import SavedStories from "./pages/SavedStories";
import ErrorPage from "./pages/ErrorPage";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";
import CharactersManagement from "./pages/CharactersManagement";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import StoryDetailsInput from "./pages/StoryDetailsInput";
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Contact from "./pages/Contact";
import Changelog from "./pages/Changelog";

// New Pages for Refactor
import ProfileConfigPage from './pages/ProfileConfigPage';
import SettingsPage from './pages/SettingsPage';
import PlansPage from './pages/PlansPage';

// Admin Pages
import AdminIllustratedPdfPanel from './pages/AdminIllustratedPdfPanel';

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AnimatePresence mode="wait">
            <MainLayout>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Welcome />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/signup-success" element={<SignupSuccess />} />
                <Route path="/error" element={<ErrorPage />} />
                <Route path="*" element={<NotFound />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/terms" element={<TermsAndConditions />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/changelog" element={<Changelog />} />
                
                {/* Admin routes - Protected by internal code */}
                <Route path="/admin/illustrated-pdf" element={<AdminIllustratedPdfPanel />} />

                {/* Payment routes */}
                <Route path="/payment-success" element={<AuthGuard><PaymentSuccess /></AuthGuard>} />
                <Route path="/payment-cancel" element={<AuthGuard><PaymentCancel /></AuthGuard>} />

                {/* Protected routes */}
                <Route path="/home" element={<AuthGuard><Home /></AuthGuard>} />
                <Route path="/creation-mode" element={<AuthGuard><StoryCreationMode /></AuthGuard>} />
                <Route path="/duration" element={<AuthGuard><DurationSelection /></AuthGuard>} />
                <Route path="/characters-management" element={<AuthGuard><CharactersManagement /></AuthGuard>} />
                <Route path="/character-selection" element={<AuthGuard><CharacterSelection /></AuthGuard>} />
                <Route path="/character-name" element={<AuthGuard><CharacterName /></AuthGuard>} />
                <Route path="/character-hobbies" element={<AuthGuard><CharacterHobbies /></AuthGuard>} />
                <Route path="/character-personality" element={<AuthGuard><CharacterPersonality /></AuthGuard>} />
                <Route path="/character-profession" element={<AuthGuard><CharacterProfession /></AuthGuard>} />
                <Route path="/story-genre" element={<AuthGuard><StoryGenre /></AuthGuard>} />
                <Route path="/story-moral" element={<AuthGuard><StoryMoral /></AuthGuard>} />
                <Route path="/story-details-input" element={<AuthGuard><StoryDetailsInput /></AuthGuard>} />
                <Route path="/generating" element={<AuthGuard><GeneratingStory /></AuthGuard>} />
                <Route path="/story/:storyId" element={<AuthGuard><StoryViewer /></AuthGuard>} />
                <Route path="/story/:storyId/audio/:chapterId?" element={<AuthGuard><StoryAudioPage /></AuthGuard>} />
                <Route path="/story/:storyId/continue" element={<AuthGuard><StoryContinuation /></AuthGuard>} />
                <Route path="/stories" element={<AuthGuard><SavedStories /></AuthGuard>} />

                {/* New Protected Routes */}
                <Route path="/profile-config" element={<AuthGuard><ProfileConfigPage /></AuthGuard>} />
                <Route path="/settings" element={<AuthGuard><SettingsPage /></AuthGuard>} />
                <Route path="/plans" element={<AuthGuard><PlansPage /></AuthGuard>} />
              </Routes>
            </MainLayout>
          </AnimatePresence>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
