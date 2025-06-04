import { useNavigate } from "react-router-dom";
import { Plus, User } from "lucide-react";
import { useCharacterStore, reloadCharacters } from "../store/character/characterStore";
import { useStoryOptionsStore } from "../store/storyOptions/storyOptionsStore";
import BackButton from "../components/BackButton";
import StoryButton from "../components/StoryButton";
import PageTransition from "../components/PageTransition";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function CharacterSelection() {
  const navigate = useNavigate();
  const { savedCharacters, selectCharacter, currentCharacter, loadCharactersFromSupabase } = useCharacterStore();
  const { updateStoryOptions } = useStoryOptionsStore();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  
  // Cargar personajes al montar el componente
  useEffect(() => {
    const loadCharacters = async () => {
      console.log("[DEBUG] CharacterSelection montado - cargando personajes directamente desde Supabase");
      setIsLoading(true);
      
      if (!user) {
        console.error("[DEBUG] No hay usuario autenticado para cargar personajes");
        setIsLoading(false);
        return;
      }
      
      // Limpiar personajes existentes antes de cargar
      useCharacterStore.setState({ savedCharacters: [] });
      
      // Forzar recarga limpia desde Supabase - el método internamente usa user.id
      await loadCharactersFromSupabase();
      
      // Asegurarnos de que se cargaron los personajes
      const chars = useCharacterStore.getState().savedCharacters;
      console.log(`[DEBUG] Después de cargar: ${chars.length} personajes para usuario ${user.id}`);
      
      setIsLoading(false);
    };
    
    loadCharacters();
  }, [loadCharactersFromSupabase]);
  
  // Mostrar personajes disponibles
  useEffect(() => {
    console.log(`CharacterSelection tiene ${savedCharacters.length} personajes disponibles:`, 
      savedCharacters.map(char => `${char.name} (${char.id})`));
  }, [savedCharacters]);
  
  const handleSelectCharacter = (characterId: string) => {
    selectCharacter(characterId);
    const character = savedCharacters.find(char => char.id === characterId);
    if (character) {
      updateStoryOptions({ character });
    }
    navigate("/story-genre");
  };
  
  const handleCreateNewCharacter = () => {
    // Resetear el personaje actual para asegurar un ID único
    const { resetCharacter } = useCharacterStore.getState();
    resetCharacter();
    navigate("/character-name");
  };
  
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };
  
  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };
  
  return (
    <PageTransition>
      <div
        className="min-h-screen flex flex-col items-center justify-center relative"
        style={{
          backgroundImage: "url(/fondo_png.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <BackButton />
        
        <div className="w-full max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-[#BB79D1] text-center mb-4 font-heading drop-shadow-lg">
            Selecciona un Personaje
          </h1>
          
          <p className="text-lg text-[#222] bg-white/80 rounded-xl px-4 py-2 text-center mb-8 font-medium shadow-sm">
            Elige un personaje para tu historia o crea uno nuevo
          </p>
          
          {isLoading ? (
            <div className="text-center bg-white/70 rounded-xl p-4 shadow-md mb-8">
              <div className="text-[#BB79D1] font-medium">Cargando personajes...</div>
            </div>
          ) : (
            <>
              <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8"
              >
                <motion.div variants={item}>
                  <div 
                    onClick={handleCreateNewCharacter}
                    className="flex flex-col items-center justify-center p-6 h-40 cursor-pointer
                      bg-white/70 rounded-2xl border-2 border-[#F6A5B7]/60
                      hover:bg-[#F6A5B7]/10 hover:scale-105 hover:shadow-md
                      transition-all duration-300"
                  >
                    <Plus size={40} className="text-[#F6A5B7] mb-2" />
                    <span className="text-[#222] text-center font-medium">Crear Nuevo</span>
                  </div>
                </motion.div>
                
                {savedCharacters.map((character) => (
                  <motion.div key={character.id} variants={item}>
                    <div 
                      onClick={() => handleSelectCharacter(character.id)}
                      className={`
                        flex flex-col items-center justify-center p-6 h-40 cursor-pointer
                        bg-white/70 rounded-2xl border-2 border-[#7DC4E0]/60
                        ${currentCharacter && currentCharacter.id === character.id ? 'ring-4 ring-[#7DC4E0] shadow-lg transform scale-105' : 'hover:bg-[#7DC4E0]/10 hover:scale-105 hover:shadow-md'}
                        transition-all duration-300
                      `}
                    >
                      <User size={40} className="text-[#7DC4E0] mb-2" />
                      <span className="text-[#222] text-center font-medium">{character.name}</span>
                      <span className="text-[#555] text-xs">{character.profession}</span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
              
              {savedCharacters.length === 0 && (
                <div className="text-center bg-white/70 rounded-xl p-4 shadow-md mb-8">
                  <div className="text-[#555] font-medium">No tienes personajes guardados. ¡Crea uno nuevo!</div>
                </div>
              )}
              
              {savedCharacters.length > 0 && (
                <div className="flex justify-center w-full mt-2 mb-2">
                  <StoryButton
                    onClick={() => handleSelectCharacter(currentCharacter?.id || "")}
                    isFullWidth={false}
                    disabled={!currentCharacter}
                    className="w-full max-w-xs py-4 rounded-2xl text-white text-lg font-semibold shadow-lg bg-[#BB79D1] hover:bg-[#BB79D1]/90 border-2 border-[#BB79D1]/50 transition-all duration-200"
                  >
                    Continuar
                  </StoryButton>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
