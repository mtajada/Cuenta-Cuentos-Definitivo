import { useNavigate, useLocation } from "react-router-dom";
import { Book, Music, Gamepad, Camera, Utensils, Bike, Dumbbell, Palette, Globe, Computer, Wand2, Theater } from "lucide-react";
import { motion } from "framer-motion";
import { useCharacterStore } from "../store/character/characterStore";
import BackButton from "../components/BackButton";
import StoryButton from "../components/StoryButton";
import PageTransition from "../components/PageTransition";
import { useState, useEffect } from "react";
import { HobbyOption } from "../types";
import { toast } from "sonner";

export default function CharacterHobbies() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentCharacter, updateCharacter, setCurrentCharacter, savedCharacters } = useCharacterStore();
  
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
  
  const characterName = currentCharacter?.name || "tu personaje";
  
  const hobbies: HobbyOption[] = [
    { id: "reading", name: "Leer", icon: <Book /> },
    { id: "music", name: "Música", icon: <Music /> },
    { id: "gaming", name: "Videojuegos", icon: <Gamepad /> },
    { id: "photography", name: "Fotografía", icon: <Camera /> },
    { id: "cooking", name: "Cocinar", icon: <Utensils /> },
    { id: "cycling", name: "Ciclismo", icon: <Bike /> },
    { id: "sports", name: "Deportes", icon: <Dumbbell /> },
    { id: "painting", name: "Pintar", icon: <Palette /> },
    { id: "travel", name: "Viajar", icon: <Globe /> },
    { id: "programming", name: "Programar", icon: <Computer /> },
    { id: "magic", name: "Magia", icon: <Wand2 /> },
    { id: "theater", name: "Teatro", icon: <Theater /> },
  ];
  
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>(
    currentCharacter?.hobbies || []
  );
  
  const toggleHobby = (hobbyId: string) => {
    setSelectedHobbies(prev => {
      if (prev.includes(hobbyId)) {
        return prev.filter(id => id !== hobbyId);
      } else {
        const newSelected = [...prev, hobbyId];
        return newSelected;
      }
    });
  };
  
  const handleContinue = () => {
    updateCharacter({ hobbies: selectedHobbies });
    const params = new URLSearchParams();
    if (fromManagement) params.set('from', 'management');
    if (actionCreate) params.set('action', 'create');
    if (editId) params.set('edit', editId);
    navigate(`/character-personality${params.toString() ? '?' + params.toString() : ''}`);
  };
  
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
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
            ¿Qué le gusta a <span className="text-[#F6A5B7]">{characterName}</span>?
          </h1>
          
          <p className="text-lg text-[#222] bg-white/80 rounded-xl px-4 py-2 text-center mb-6 font-medium shadow-sm">
            Selecciona las aficiones que definen a tu personaje
          </p>
          
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8"
          >
            {hobbies.map((hobby) => (
              <motion.div key={hobby.id} variants={item}>
                <div
                  onClick={() => toggleHobby(hobby.id)}
                  className={`
                    flex flex-col items-center justify-center p-4 cursor-pointer
                    bg-white/70 rounded-xl border-2 
                    ${selectedHobbies.includes(hobby.id) 
                      ? 'ring-4 ring-[#7DC4E0] border-[#7DC4E0] shadow-lg transform scale-105' 
                      : 'border-[#7DC4E0]/30 hover:bg-[#7DC4E0]/10 hover:scale-105 hover:shadow-md'}
                    transition-all duration-300 h-32 sm:h-36
                  `}
                >
                  <div className={`text-3xl mb-3 ${selectedHobbies.includes(hobby.id) ? 'text-[#7DC4E0]' : 'text-[#7DC4E0]/70'}`}>
                    {hobby.icon}
                  </div>
                  <span className="text-[#222] text-center font-medium">{hobby.name}</span>
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
                navigate(`/character-name${params.toString() ? '?' + params.toString() : ''}`);
              }}
              className="w-full sm:w-[48%] py-3 rounded-2xl font-medium bg-white/70 hover:bg-white/90 text-[#BB79D1] border border-[#BB79D1]/30 shadow-md transition-all"
            >
              Atrás
            </button>
            
            <button
              onClick={handleContinue}
              disabled={selectedHobbies.length === 0}
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
