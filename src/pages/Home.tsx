import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from "react-router-dom";
import { Settings, User, Star, ChevronRight, BookOpen, Sparkles, ExternalLink, Download, X } from "lucide-react";
import { motion } from "framer-motion";
import { useUserStore } from "../store/user/userStore";
import { useStoriesStore } from "../store/stories/storiesStore";
import PageTransition from "../components/PageTransition";
import { useToast } from "@/hooks/use-toast";
import IllustratedBooksModal from "../components/IllustratedBooksModal";

export default function Home() {
  const navigate = useNavigate();
  const { hasCompletedProfile, canCreateStory, isPremium, getRemainingMonthlyStories } = useUserStore();
  const { generatedStories } = useStoriesStore();
  const { toast } = useToast();
  const [showIllustratedModal, setShowIllustratedModal] = useState(false);
  const [showPromoRibbon, setShowPromoRibbon] = useState(true);

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

        {/* Cintillo promocional: nuevo formato ilustrado */}
        {showPromoRibbon && (
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-full px-4 mb-6"
          >
            <div className="relative max-w-xl mx-auto rounded-2xl overflow-hidden shadow-lg ring-1 ring-black/5">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-90"></div>
              <div className="relative p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-white">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-semibold leading-tight">Nuevo formato de libro ilustrado mejorado</p>
                    <p className="text-xs text-white/90">Mírala en acción o descárgala como ejemplo.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/previews/book-preview.pdf"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold"
                  >
                    <ExternalLink className="h-4 w-4" /> Ver
                  </a>
                  <a
                    href="/previews/book-preview.pdf"
                    download
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-purple-700 text-xs font-semibold hover:bg-purple-50"
                  >
                    <Download className="h-4 w-4" /> Descargar
                  </a>
                  <button
                    onClick={() => setShowPromoRibbon(false)}
                    className="ml-1 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20"
                    aria-label="Cerrar aviso"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Botones principales */}
        <div className="flex flex-col items-center w-full max-w-xs gap-5 -mt-4">
          <button
            className={`w-full py-4 rounded-2xl text-lg font-semibold shadow-lg transition-all duration-200 ${
              canCreateStory()
                ? "bg-[#f6a5b7] hover:bg-[#fbb6ce] text-white"
                : "bg-[#f6a5b7]/50 text-white/90 cursor-not-allowed"
            }`}
            onClick={handleNewStory}
            // disabled={!canCreateStory()}
            title={!canCreateStory() ? `Te quedan ${getRemainingMonthlyStories()} historias este mes` : ""}
          >
            Generar una Nueva Historia
          </button>
          
          {/* Nuevo botón para libros ilustrados con efectos de pulso y magia */}
          <div className="relative w-full">
            {/* Estrellas flotantes mágicas */}
            <motion.div
              animate={{
                rotate: 360
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute inset-0 pointer-events-none"
            >
              {/* Estrella 1 - Top */}
              <motion.div
                animate={{
                  scale: [0.8, 1.2, 0.8],
                  opacity: [0.6, 1, 0.6]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute -top-3 left-1/2 transform -translate-x-1/2"
              >
                <Star className="h-4 w-4 text-yellow-300 fill-yellow-300" />
              </motion.div>
              
              {/* Estrella 2 - Right */}
              <motion.div
                animate={{
                  scale: [0.6, 1, 0.6],
                  opacity: [0.4, 0.8, 0.4]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5
                }}
                className="absolute top-1/2 -right-4 transform -translate-y-1/2"
              >
                <Star className="h-3 w-3 text-pink-300 fill-pink-300" />
              </motion.div>
              
              {/* Estrella 3 - Left */}
              <motion.div
                animate={{
                  scale: [0.7, 1.1, 0.7],
                  opacity: [0.5, 0.9, 0.5]
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1
                }}
                className="absolute top-1/2 -left-4 transform -translate-y-1/2"
              >
                <Star className="h-3 w-3 text-purple-300 fill-purple-300" />
              </motion.div>
              
              {/* Estrella 4 - Bottom */}
              <motion.div
                animate={{
                  scale: [0.5, 1, 0.5],
                  opacity: [0.3, 0.7, 0.3]
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 1.5
                }}
                className="absolute -bottom-3 left-1/2 transform -translate-x-1/2"
              >
                <Star className="h-3 w-3 text-blue-300 fill-blue-300" />
              </motion.div>
            </motion.div>

            {/* Partículas mágicas flotantes */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  y: [-10, -25, -10],
                  x: [0, (i % 2 === 0 ? 5 : -5), 0],
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0]
                }}
                transition={{
                  duration: 3 + i * 0.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.7
                }}
                className={`absolute w-1 h-1 bg-gradient-to-r from-yellow-300 to-white rounded-full blur-sm`}
                style={{
                  left: `${15 + i * 12}%`,
                  top: `${20 + (i % 3) * 20}%`
                }}
              />
            ))}

            {/* Anillo de pulso exterior */}
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-2xl blur-sm"
            ></motion.div>
            
            {/* Segundo anillo de pulso */}
            <motion.div
              animate={{
                scale: [1, 1.08, 1],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5
              }}
              className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-2xl blur-md"
            ></motion.div>

            <motion.button
              animate={{
                scale: [1, 1.02, 1],
                boxShadow: [
                  "0 10px 25px rgba(168, 85, 247, 0.4)",
                  "0 15px 35px rgba(168, 85, 247, 0.6)",
                  "0 10px 25px rgba(168, 85, 247, 0.4)"
                ]
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              whileHover={{ 
                scale: 1.03,
                boxShadow: "0 20px 40px rgba(168, 85, 247, 0.7)"
              }}
              whileTap={{ scale: 0.98 }}
              className="relative w-full py-4 rounded-2xl text-white text-lg font-semibold transition-all duration-200 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 overflow-hidden z-10"
              onClick={() => setShowIllustratedModal(true)}
            >
              {/* Efectos de brillo internos */}
              <motion.div
                animate={{
                  opacity: [0.2, 0.4, 0.2],
                  x: [-100, 100]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
              ></motion.div>
              
              <motion.div
                animate={{
                  opacity: [0.3, 0.6, 0.3]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-400/20"
              ></motion.div>

              <div className="relative flex items-center justify-center space-x-2">
                {/* Icono de libro con efecto mágico */}
                <div className="relative">
                  <motion.div
                    animate={{
                      rotate: [0, 10, -5, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <BookOpen className="h-5 w-5" />
                  </motion.div>
                  
                  {/* Sparkles alrededor del icono */}
                  <motion.div
                    animate={{
                      scale: [0, 1, 0],
                      rotate: [0, 180]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.3
                    }}
                    className="absolute -top-1 -right-1"
                  >
                    <Sparkles className="h-3 w-3 text-yellow-300" />
                  </motion.div>
                  
                  <motion.div
                    animate={{
                      scale: [0, 1, 0],
                      rotate: [0, -180]
                    }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 1
                    }}
                    className="absolute -bottom-1 -left-1"
                  >
                    <Sparkles className="h-2 w-2 text-pink-300" />
                  </motion.div>
                </div>

                <span className="font-bold">Libros Ilustrados</span>
                
                {/* Indicador NEW pulsante con estrellas */}
                <motion.div
                  animate={{ 
                    scale: [1, 1.3, 1],
                    rotate: [0, 360]
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="flex items-center relative"
                >
                  <motion.div
                    animate={{
                      boxShadow: [
                        "0 0 0 0 rgba(255, 255, 0, 0.7)",
                        "0 0 0 6px rgba(255, 255, 0, 0)",
                        "0 0 0 0 rgba(255, 255, 0, 0)"
                      ]
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeOut"
                    }}
                    className="w-2 h-2 bg-yellow-300 rounded-full"
                  ></motion.div>
                  
                  {/* Mini estrellas alrededor del indicador */}
                  <motion.div
                    animate={{
                      scale: [0, 1, 0],
                      x: [0, 8, 0],
                      y: [0, -8, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute"
                  >
                    <div className="w-1 h-1 bg-white rounded-full"></div>
                  </motion.div>
                  
                  <motion.div
                    animate={{
                      scale: [0, 1, 0],
                      x: [0, -6, 0],
                      y: [0, 6, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.5
                    }}
                    className="absolute"
                  >
                    <div className="w-1 h-1 bg-yellow-100 rounded-full"></div>
                  </motion.div>
                </motion.div>
              </div>
              
              {/* Badge "NUEVO" */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 2, -2, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute -top-1 -right-1 bg-yellow-400 text-purple-900 text-xs font-bold px-2 py-1 rounded-full shadow-lg"
              >
                NUEVO
              </motion.div>
            </motion.button>
          </div>

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

        {/* Modal de libros ilustrados */}
        <IllustratedBooksModal
          isOpen={showIllustratedModal}
          onClose={() => setShowIllustratedModal(false)}
        />
      </div>
    </PageTransition>
  );
}
