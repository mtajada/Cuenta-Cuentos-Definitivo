import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useCharacterStore } from "../store/character/characterStore";
import { useStoryOptionsStore } from "../store/storyOptions/storyOptionsStore";
import StoryOptionCard from "../components/StoryOptionCard";
import BackButton from "../components/BackButton";
import StoryButton from "../components/StoryButton";
import PageTransition from "../components/PageTransition";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Rocket, 
  Search, 
  Shield, 
  Crown, 
  Zap, 
  Wand2, 
  Trophy, 
  GraduationCap 
} from "lucide-react";

const professions = [
  { id: "astronaut", name: "Astronauta", icon: <Rocket /> },
  { id: "explorer", name: "Explorador/a", icon: <Search /> },
  { id: "knight", name: "Caballero", icon: <Shield /> },
  { id: "royalty", name: "Príncipe/Princesa", icon: <Crown /> },
  { id: "superhero", name: "Superhéroe", icon: <Zap /> },
  { id: "wizard", name: "Mago/Maga", icon: <Wand2 /> },
  { id: "athlete", name: "Deportista", icon: <Trophy /> },
  { id: "teacher", name: "Profesor/a", icon: <GraduationCap /> }
];

export default function CharacterProfession() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentCharacter, updateCharacter, saveCurrentCharacter, setCurrentCharacter, savedCharacters } = useCharacterStore();
  const { updateStoryOptions } = useStoryOptionsStore();
  
  // Obtener los parámetros de la URL
  const searchParams = new URLSearchParams(location.search);
  const fromManagement = searchParams.get('from') === 'management';
  const actionCreate = searchParams.get('action') === 'create';
  const editId = searchParams.get('edit');
  
  // Si estamos editando, cargar el personaje correspondiente
  useEffect(() => {
    if (editId) {
      const characterToEdit = savedCharacters.find(char => char.id === editId);
      if (characterToEdit) {
        setCurrentCharacter(characterToEdit);
      }
    }
  }, [editId, savedCharacters, setCurrentCharacter]);
  
  const characterName = currentCharacter?.name || "el personaje";
  const [selectedProfession, setSelectedProfession] = useState("");
  
  // Update selectedProfession when currentCharacter changes
  useEffect(() => {
    if (currentCharacter?.profession) {
      setSelectedProfession(currentCharacter.profession);
    } else {
      setSelectedProfession("");
    }
  }, [currentCharacter]);
  
  const handleSelectProfession = (profession: string) => {
    setSelectedProfession(profession);
  };
  
  const handleContinue = async () => {
    // Update the character
    updateCharacter({ profession: selectedProfession });
    
    // Save and check for errors
    const result = await saveCurrentCharacter();
    
    if (!result || !result.success) {
      if (result?.error && typeof result.error === 'string' && result.error.includes("Ya existe un personaje con el nombre")) {
        toast.error("Nombre duplicado", {
          description: result.error
        });
        // Volver a la página de nombre del personaje para corregir
        const params = new URLSearchParams();
        if (fromManagement) params.set('from', 'management');
        if (actionCreate) params.set('action', 'create');
        if (editId) params.set('edit', editId);
        navigate(`/character-name${params.toString() ? '?' + params.toString() : ''}`);
        return;
      } else if (result?.error) {
        toast.error("Error al guardar", {
          description: typeof result.error === 'string' 
            ? result.error 
            : "Hubo un problema al guardar el personaje"
        });
        return;
      }
    }
    
    // Important: Update story options with the current character
    if (currentCharacter) {
      updateStoryOptions({ 
        character: {
          ...currentCharacter,
          profession: selectedProfession
        }
      });
    }
    
    if (fromManagement) {
      toast.success("¡Personaje guardado!", {
        description: "Volviendo a la gestión de personajes"
      });
      navigate("/characters-management");
    } else if (actionCreate) {
      toast.success("¡Personaje creado!", {
        description: "Volviendo a la selección de personajes"
      });
      navigate("/character-selection");
    } else {
      toast.success("¡Personaje guardado!", {
        description: "Continuando a la selección de género"
      });
      navigate("/story-genre");
    }
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
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{
          backgroundImage: "url(/fondo_png.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <BackButton />
        
        <div className="w-full max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-[#BB79D1] mb-4 text-center font-heading drop-shadow-lg">
            ¿Qué quiere ser <span className="text-[#F6A5B7]">{characterName}</span>?
          </h1>
          
          <p className="text-lg text-[#222] bg-white/80 rounded-xl px-4 py-2 text-center mb-6 font-medium shadow-sm">
            Selecciona una profesión para tu personaje
          </p>
          
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8"
          >
            {professions.map((profession) => (
              <motion.div key={profession.id} variants={item}>
                <div
                  onClick={() => handleSelectProfession(profession.id)}
                  className={`
                    flex flex-col items-center justify-center p-4 cursor-pointer
                    bg-white/70 rounded-xl border-2 
                    ${selectedProfession === profession.id 
                      ? 'ring-4 ring-[#F9DA60] border-[#F9DA60] shadow-lg transform scale-105' 
                      : 'border-[#F9DA60]/30 hover:bg-[#F9DA60]/10 hover:scale-105 hover:shadow-md'}
                    transition-all duration-300 h-32 sm:h-36
                  `}
                >
                  <div className={`text-3xl mb-3 ${selectedProfession === profession.id ? 'text-[#F9DA60]' : 'text-[#F9DA60]/70'}`}>
                    {profession.icon}
                  </div>
                  <span className="text-[#222] text-center font-medium">{profession.name}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
          
          <div className="flex flex-col sm:flex-row justify-between gap-4 w-full max-w-md mx-auto">
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                if (fromManagement) params.set('from', 'management');
                if (actionCreate) params.set('action', 'create');
                if (editId) params.set('edit', editId);
                navigate(`/character-personality${params.toString() ? '?' + params.toString() : ''}`);
              }}
              className="w-full sm:w-[48%] py-3 rounded-2xl font-medium bg-white/70 hover:bg-white/90 text-[#BB79D1] border border-[#BB79D1]/30 shadow-md transition-all"
            >
              Atrás
            </button>
            
            <button
              onClick={handleContinue}
              disabled={!selectedProfession}
              className="w-full sm:w-[48%] py-3 rounded-2xl font-medium bg-[#BB79D1] hover:bg-[#BB79D1]/80 text-white shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
