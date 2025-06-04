import React, { useEffect } from 'react';
import { useNavigate, Link } from "react-router-dom";
import { Settings, User, Star, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useStoriesStore } from "../store/stories/storiesStore";
import PageTransition from "../components/PageTransition";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const navigate = useNavigate();
  const { hasCompletedProfile, canCreateStory, isPremium, getRemainingMonthlyStories } = useAuth();
  const { generatedStories } = useStoriesStore();
  const { toast } = useToast();

  useEffect(() => {
    const needsProfileSetup = !hasCompletedProfile();
    if (needsProfileSetup) {
      navigate("/profile-config", { replace: true });
    }
  }, [hasCompletedProfile, navigate]);

  if (!hasCompletedProfile()) {
    return null;
  }

  const handleNewStory = () => {
    if (canCreateStory()) {
      navigate("/duration");
    } else {
      toast({
        title: "Límite de historias alcanzado",
        description: isPremium()
          ? "Has alcanzado el límite de historias para tu plan premium. Contacta con soporte para más información."
          : `Has alcanzado el límite mensual de historias gratuitas. Actualiza a premium para crear más historias.`,
        variant: "destructive",
      });
    }
  };

  const premiumUser = isPremium();
  const subscriptionText = premiumUser ? 'Premium' : 'Free';

  return (
    <PageTransition>
      <div
        className="relative min-h-screen flex flex-col items-center justify-center p-0"
        style={{
          backgroundImage: 'url(/fondo_png.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Botones superiores */}
        <div className="absolute top-6 right-6 flex gap-3 z-10">
          <Link
            to="/plans"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl shadow-md text-xs font-semibold transition-all duration-200 bg-white/70 hover:bg-white/90 text-pink-500`}
            aria-label="Ver planes y suscripción"
          >
            <img src="/icono_png.png" alt="icono free/premium" className="h-5 w-5" />
            <span>{subscriptionText}</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-75" />
          </Link>
          <Link
            to="/profile-config"
            className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center text-pink-500 hover:bg-white/90 transition-all shadow-md"
            aria-label="Configuración de Perfil"
          >
            <User className="h-5 w-5" />
          </Link>
          <Link
            to="/settings"
            className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center text-pink-500 hover:bg-white/90 transition-all shadow-md"
            aria-label="Ajustes"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>

        {/* Logo y título */}
        <div className="flex flex-col items-center mt-10 mb-8 select-none">
          <img src="/logo_png.png" alt="TaleMe Logo" className="w-80 max-w-md mx-auto mb-4 drop-shadow-xl" />
        </div>

        {/* Botones principales */}
        <div className="flex flex-col items-center w-full max-w-xs gap-5 -mt-4">
          <button
            className={`w-full py-4 rounded-2xl text-lg font-semibold shadow-lg transition-all duration-200 ${
              canCreateStory()
                ? "bg-[#f6a5b7] hover:bg-[#fbb6ce] text-white"
                : "bg-[#f6a5b7]/50 text-white/90 cursor-not-allowed"
            }`}
            onClick={handleNewStory}
            aria-disabled={!canCreateStory()}
            title={!canCreateStory() ? `Te quedan ${getRemainingMonthlyStories()} historias este mes` : "Crear nueva historia"}
          >
            Generar una Nueva Historia
          </button>
          <button
            className="w-full py-4 rounded-2xl text-white text-lg font-semibold shadow-lg transition-all duration-200 bg-[#f7c59f] hover:bg-[#ffd7ba]"
            onClick={() => navigate("/characters-management")}
          >
            Mis Personajes
          </button>
          {generatedStories.length > 0 && (
            <button
              className="w-full py-4 rounded-2xl text-white text-lg font-semibold shadow-lg transition-all duration-200 bg-[#a5d6f6] hover:bg-[#c8e6fa]"
              onClick={() => navigate("/stories")}
            >
              Mis Historias
            </button>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
