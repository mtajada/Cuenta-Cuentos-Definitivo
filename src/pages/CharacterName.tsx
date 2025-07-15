import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useCharacterStore } from "../store/character/characterStore";
import BackButton from "../components/BackButton";
import StoryButton from "../components/StoryButton";
import PageTransition from "../components/PageTransition";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Define a type for the window with the nameTimeout property
declare global {
  interface Window {
    nameTimeout: NodeJS.Timeout | undefined;
  }
}

export default function CharacterName() {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateCharacter, savedCharacters } = useCharacterStore();
  
  // Obtener los parámetros de la URL
  const searchParams = new URLSearchParams(location.search);
  const fromManagement = searchParams.get('from') === 'management';
  const actionCreate = searchParams.get('action') === 'create';
  const editCharacterId = searchParams.get('edit');
  
  // Encontrar el personaje a editar si existe
  const editingCharacter = editCharacterId 
    ? savedCharacters.find(char => char.id === editCharacterId)
    : null;
  
  const [name, setName] = useState(editingCharacter?.name || "");
  const [isFocused, setIsFocused] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const [error, setError] = useState("");
  
  // Verificar si el nombre ya existe entre los personajes guardados
  const checkNameExists = (nameToCheck: string): boolean => {
    if (!nameToCheck.trim()) return false;
    
    // Si estamos editando un personaje existente, excluir su propio nombre de la validación
    return savedCharacters.some(
      char => char.name.toLowerCase() === nameToCheck.toLowerCase() && 
              char.id !== editingCharacter?.id
    );
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("Por favor, ingresa un nombre para tu personaje");
      return;
    }
    
    // Verificar si el nombre ya existe
    if (checkNameExists(name)) {
      setError(`Ya tienes un personaje llamado "${name}". Por favor, elige otro nombre.`);
      toast.error("Nombre duplicado", {
        description: "Ya existe un personaje con este nombre"
      });
      return;
    }
    
    // Si no hay error, guardar y continuar
    setError("");
    updateCharacter({ name: name });
    toast.success("¡Nombre guardado!", { 
      duration: 1500,
      description: "Continuando a las aficiones..."
    });
    
    setTimeout(() => {
      const params = new URLSearchParams();
      if (fromManagement) params.set('from', 'management');
      if (actionCreate) params.set('action', 'create');
      if (editCharacterId) params.set('edit', editCharacterId);
      navigate(`/character-hobbies${params.toString() ? '?' + params.toString() : ''}`);
    }, 1000);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    
    // Limpiar el error cuando el usuario escribe
    if (error) {
      setError("");
    }
    
    if (!hasTyped && newName.length > 0) {
      setHasTyped(true);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim()) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  
  useEffect(() => {
    return () => {
      clearTimeout(window.nameTimeout);
    };
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
        <BackButton />
        
        <div className="w-full max-w-md flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-24 h-24 rounded-full bg-[#7DC4E0]/20 border-2 border-[#7DC4E0]/40 flex items-center justify-center mb-6 shadow-md"
          >
            <User size={40} className="text-[#7DC4E0]" />
          </motion.div>
          
          <h1 className="text-3xl font-bold text-[#BB79D1] mb-6 text-center font-heading drop-shadow-lg">
            ¿Cómo se llama tu personaje?
          </h1>
          
          <p className="text-lg text-[#222] bg-white/80 rounded-xl px-4 py-2 text-center mb-8 font-medium shadow-sm">
            Dale un nombre a tu personaje para continuar
          </p>
          
          <form onSubmit={handleSubmit} className="w-full space-y-8">
            <div 
              className={`
                relative transition-all duration-300 ease-in-out
                ${isFocused ? 'scale-105' : 'scale-100'}
              `}
            >
              <Input 
                value={name}
                onChange={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="Nombre del personaje"
                className={`story-input text-xl text-center h-16 font-medium rounded-xl shadow-md ${error ? 'border-[#F6A5B7] text-[#F6A5B7] bg-[#F6A5B7]/10' : 'text-[#222] bg-white/90 border-[#BB79D1]/30'} placeholder:text-[#BB79D1]/50`}
                autoFocus
              />
              
              {error && (
                <div className="mt-2 flex items-center justify-center text-[#F6A5B7] gap-2 p-2 bg-white/80 rounded-lg border border-[#F6A5B7]/30 shadow-sm">
                  <AlertCircle size={16} />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}
            </div>
            
            <div className="flex justify-between w-full">
              <button
                type="button"
                onClick={() => navigate(fromManagement ? "/characters-management" : "/character-selection")}
                className="w-[48%] text-lg py-4 shadow-md hover:shadow-lg transition-all rounded-2xl font-medium bg-white/70 hover:bg-white/90 text-[#BB79D1] border border-[#BB79D1]/30"
              >
                Atrás
              </button>
              
              <button
                type="submit"
                className="w-[48%] text-lg py-4 shadow-md hover:shadow-lg transition-all bg-[#BB79D1] hover:bg-[#BB79D1]/80 text-white rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!name.trim()}
              >
                Continuar
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageTransition>
  );
}
