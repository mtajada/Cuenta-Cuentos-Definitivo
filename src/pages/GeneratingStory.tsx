import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { generateStory } from "../store/stories/storyGenerator";
import { useStoriesStore } from "../store/stories/storiesStore";
import { useStoryOptionsStore } from "../store/storyOptions/storyOptionsStore";
import IconLoadingAnimation from "../components/IconLoadingAnimation";
import PageTransition from "../components/PageTransition";

export default function GeneratingStory() {
  const navigate = useNavigate();
  const { currentStoryOptions } = useStoryOptionsStore();
  
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
