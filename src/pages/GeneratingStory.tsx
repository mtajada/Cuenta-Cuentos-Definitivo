import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { generateStory } from "../store/stories/storyGenerator";
import { useStoriesStore } from "../store/stories/storiesStore";
import { useStoryOptionsStore } from "../store/storyOptions/storyOptionsStore";
import IconLoadingAnimation from "../components/IconLoadingAnimation";
import PageTransition from "../components/PageTransition";
import { getImageStyleLabel } from "@/lib/image-styles";

export default function GeneratingStory() {
  const navigate = useNavigate();
  const { currentStoryOptions } = useStoryOptionsStore();
  const creationMode = currentStoryOptions.creationMode ?? "standard";
  const creationModeLabel = creationMode === "image" ? "Creación con imagen" : "Cuento estándar";
  const isImageMode = creationMode === "image";
  const imageStyleLabel = isImageMode ? getImageStyleLabel(currentStoryOptions.imageStyle) : "No aplica";
  
  useEffect(() => {
    const generate = async () => {
      try {
        const story = await generateStory(currentStoryOptions);
        navigate(`/story/${story.id}`);
      } catch (error) {
        console.error("Error generating story:", error);
        navigate("/error", { state: { error } });
      }
    };
    
    generate();
  }, []);
  
  return (
    <PageTransition>
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{
          backgroundImage: "url(/fondo_png.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="w-full max-w-md flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-10"
          >
            <IconLoadingAnimation message="Creando tu historia..." />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="bg-white/70 text-[#222] p-4 rounded-xl max-w-sm text-center shadow-md"
          >
            <p className="font-medium">Estamos personalizando una historia mágica especialmente para ti...</p>
            
            <div className="mt-4 grid grid-cols-3 gap-2">
              {currentStoryOptions.characters && currentStoryOptions.characters.length > 0 && (
                <div className="bg-[#7DC4E0]/20 p-2 rounded-lg border border-[#7DC4E0]/30">
                  <p className="text-xs font-semibold text-[#7DC4E0]">Personajes ({currentStoryOptions.characters.length})</p>
                  <p className="text-sm truncate">
                    {currentStoryOptions.characters.map(char => char.name).join(', ')}
                  </p>
                </div>
              )}
              
              {currentStoryOptions.genre && (
                <div className="bg-[#BB79D1]/20 p-2 rounded-lg border border-[#BB79D1]/30">
                  <p className="text-xs font-semibold text-[#BB79D1]">Género</p>
                  <p className="text-sm truncate">{currentStoryOptions.genre}</p>
                </div>
              )}
              
              {currentStoryOptions.duration && (
                <div className="bg-[#F9DA60]/20 p-2 rounded-lg border border-[#F9DA60]/30">
                  <p className="text-xs font-semibold text-[#F9DA60]">Duración</p>
                  <p className="text-sm truncate">{currentStoryOptions.duration}</p>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="bg-[#6DD3A8]/20 p-2 rounded-lg border border-[#6DD3A8]/30">
                <p className="text-xs font-semibold text-[#0F766E]">Modo</p>
                <p className="text-sm truncate">{creationModeLabel}</p>
              </div>

              <div className={`p-2 rounded-lg border ${isImageMode ? "bg-[#FFB347]/20 border-[#FFB347]/40" : "bg-gray-100 border-gray-200"}`}>
                <p className="text-xs font-semibold text-[#C2410C]">Estilo de imagen</p>
                <p className="text-sm truncate">{imageStyleLabel}</p>
              </div>
            </div>
          </motion.div>

          {/* Nuevo cuadro de aviso */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="mt-6 bg-white/70 text-[#222] p-4 rounded-xl max-w-sm text-center shadow-md"
          >
            <p className="font-medium">
              ¡Tu cuento está casi listo! Para que la magia continúe, por favor, no abandones esta página mientras se crea. ✨
            </p>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
