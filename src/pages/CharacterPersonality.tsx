import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Smile, Search, Shield, Brain, Users, Cloud, Feather, CheckSquare, Clock, Compass } from "lucide-react";
import { motion } from "framer-motion";
import { useCharacterStore } from "../store/character/characterStore";
import BackButton from "../components/BackButton";
import StoryButton from "../components/StoryButton";
import PageTransition from "../components/PageTransition";

// Define los tipos de personalidad disponibles
const personalityOptions = [
  { id: "alegre", name: "Alegre", icon: <Smile className="w-6 h-6" /> },
  { id: "curioso", name: "Curioso", icon: <Search className="w-6 h-6" /> },
  { id: "valiente", name: "Valiente", icon: <Shield className="w-6 h-6" /> },
  { id: "inteligente", name: "Inteligente", icon: <Brain className="w-6 h-6" /> },
  { id: "amistoso", name: "Amistoso", icon: <Users className="w-6 h-6" /> },
  { id: "soñador", name: "Soñador", icon: <Cloud className="w-6 h-6" /> },
  { id: "travieso", name: "Travieso", icon: <Feather className="w-6 h-6" /> },
  { id: "responsable", name: "Responsable", icon: <CheckSquare className="w-6 h-6" /> },
  { id: "paciente", name: "Paciente", icon: <Clock className="w-6 h-6" /> },
  { id: "aventurero", name: "Aventurero", icon: <Compass className="w-6 h-6" /> },
];

export default function CharacterPersonality() {
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
  
  const [selectedPersonalities, setSelectedPersonalities] = useState<string[]>([]);
  
  // Update selectedPersonalities when currentCharacter changes
  useEffect(() => {
    if (currentCharacter?.personality) {
      setSelectedPersonalities(currentCharacter.personality.split(','));
    } else {
      setSelectedPersonalities([]);
    }
  }, [currentCharacter]);
  
  const characterName = currentCharacter?.name || "tu personaje";
  
  const handlePersonalitySelect = (personalityId: string) => {
    setSelectedPersonalities(prev => {
      if (prev.includes(personalityId)) {
        return prev.filter(id => id !== personalityId);
      } else {
        return [...prev, personalityId];
      }
    });
  };
  
  const handleContinue = () => {
    if (selectedPersonalities.length > 0) {
      updateCharacter({ personality: selectedPersonalities.join(',') });
    }
    const params = new URLSearchParams();
    if (fromManagement) params.set('from', 'management');
    if (actionCreate) params.set('action', 'create');
    if (editId) params.set('edit', editId);
    navigate(`/character-profession${params.toString() ? '?' + params.toString() : ''}`);
  };
  
  const handleBack = () => {
    const params = new URLSearchParams();
    if (fromManagement) params.set('from', 'management');
    if (actionCreate) params.set('action', 'create');
    if (editId) params.set('edit', editId);
    navigate(`/character-hobbies${params.toString() ? '?' + params.toString() : ''}`);
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
        <BackButton onClick={handleBack} />
        
        <div className="w-full max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-[#BB79D1] mb-4 text-center font-heading drop-shadow-lg">
            ¿Cómo es la personalidad de <span className="text-[#F6A5B7]">{characterName}</span>?
          </h1>
          
          <p className="text-lg text-[#222] bg-white/80 rounded-xl px-4 py-2 text-center mb-6 font-medium shadow-sm">
            Selecciona los rasgos de personalidad que mejor definen a tu personaje
          </p>
          
          <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8"
          >
            {personalityOptions.map((personality) => (
              <motion.div key={personality.id} variants={item}>
                <div
                  onClick={() => handlePersonalitySelect(personality.id)}
                  className={`
                    flex flex-col items-center justify-center p-4 cursor-pointer
                    bg-white/70 rounded-xl border-2 
                    ${selectedPersonalities.includes(personality.id) 
                      ? 'ring-4 ring-[#A5D6F6] border-[#A5D6F6] shadow-lg transform scale-105' 
                      : 'border-[#A5D6F6]/30 hover:bg-[#A5D6F6]/10 hover:scale-105 hover:shadow-md'}
                    transition-all duration-300 h-32 sm:h-36
                  `}
                >
                  <div className={`text-3xl mb-3 ${selectedPersonalities.includes(personality.id) ? 'text-[#A5D6F6]' : 'text-[#A5D6F6]/70'}`}>
                    {personality.icon}
                  </div>
                  <span className="text-[#222] text-center font-medium">{personality.name}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
          
          <div className="flex flex-col sm:flex-row justify-between gap-4 w-full max-w-md mx-auto">
            <button
              type="button"
              onClick={handleBack}
              className="w-full sm:w-[48%] py-3 rounded-2xl font-medium bg-white/70 hover:bg-white/90 text-[#BB79D1] border border-[#BB79D1]/30 shadow-md transition-all"
            >
              Atrás
            </button>
            
            <button
              onClick={handleContinue}
              disabled={selectedPersonalities.length === 0}
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