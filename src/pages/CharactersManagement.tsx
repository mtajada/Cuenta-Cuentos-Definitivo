import { useNavigate } from "react-router-dom";
import { User, Plus, Edit, Trash2, ArrowLeft } from "lucide-react";
import { useCharacterStore } from "../store/character/characterStore";
import { useEffect, useState } from "react";
import { useUserStore } from "../store/user/userStore";
import PageTransition from "../components/PageTransition";
import StoryButton from "../components/StoryButton";
import { motion } from "framer-motion";
import BackButton from "../components/BackButton";
import { useToast } from "@/hooks/use-toast";
import { StoryCharacter } from "../types";

export default function CharactersManagement() {
  const navigate = useNavigate();
  const { savedCharacters, loadCharactersFromSupabase, deleteCharacter, resetCharacter } = useCharacterStore();
  const [isLoading, setIsLoading] = useState(true);
  const [characterToDelete, setCharacterToDelete] = useState<StoryCharacter | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  // Cargar personajes al montar el componente
  useEffect(() => {
    const loadCharacters = async () => {
      setIsLoading(true);
      
      const user = useUserStore.getState().user;
      if (!user) {
        console.error("No hay usuario autenticado para cargar personajes");
        setIsLoading(false);
        return;
      }
      
      // Limpiar personajes existentes antes de cargar
      useCharacterStore.setState({ savedCharacters: [] });
      
      // Forzar recarga limpia desde Supabase
      await loadCharactersFromSupabase();
      
      setIsLoading(false);
    };
    
    loadCharacters();
  }, [loadCharactersFromSupabase]);

  const handleCreateNewCharacter = () => {
    // Resetear el personaje actual para asegurar un ID único
    resetCharacter();
    navigate("/character-name?from=management");
  };

  const handleEditCharacter = (characterId: string) => {
    // Navegar directamente con el ID del personaje para editar
    navigate(`/character-name?from=management&edit=${characterId}`);
  };

  const handleDeleteClick = (character: StoryCharacter) => {
    setCharacterToDelete(character);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (characterToDelete) {
      await deleteCharacter(characterToDelete.id);
      setShowDeleteConfirm(false);
      setCharacterToDelete(null);
      toast({
        title: "Personaje eliminado",
        description: `El personaje ${characterToDelete.name} ha sido eliminado`,
      });
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setCharacterToDelete(null);
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
        className="min-h-screen flex flex-col items-center justify-center relative overflow-auto"
        style={{
          backgroundImage: "url(/fondo_png.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <BackButton onClick={() => navigate("/home")} />
        
        <div className="w-full max-w-2xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-[#BB79D1] text-center mb-6 font-heading drop-shadow-lg">
            Mis Personajes
          </h1>
          
          <div className="mb-8">
            <button 
              onClick={handleCreateNewCharacter}
              className="w-full bg-[#F6A5B7] hover:bg-[#F6A5B7]/80 text-white font-semibold py-4 px-6 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all duration-200 text-lg"
            >
              <Plus size={24} className="text-white" />
              Crear Nuevo Personaje
            </button>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center my-8 bg-white/70 rounded-xl p-6 shadow-md">
              <div className="animate-spin h-10 w-10 border-4 border-[#BB79D1] rounded-full border-t-transparent"></div>
            </div>
          ) : (
            <>
              {savedCharacters.length === 0 ? (
                <div className="bg-white/80 rounded-xl p-8 text-center text-[#222] shadow-md">
                  <User size={48} className="mx-auto mb-4 text-[#BB79D1] opacity-70" />
                  <h3 className="text-xl font-semibold mb-2 text-[#222]">No tienes personajes</h3>
                  <p className="text-[#555] mb-6">
                    Crea tu primer personaje para utilizarlo en tus historias
                  </p>
                  <StoryButton 
                    onClick={handleCreateNewCharacter}
                    variant="secondary"
                    icon={<Plus size={16} />}
                    className="bg-[#F6A5B7] hover:bg-[#F6A5B7]/80 text-white font-semibold py-2 px-4 rounded-xl shadow-md transition-all duration-200"
                  >
                    Crear Personaje
                  </StoryButton>
                </div>
              ) : (
                <motion.div 
                  variants={container}
                  initial="hidden"
                  animate="show"
                  className="space-y-4"
                >
                  {savedCharacters.map((character) => (
                    <motion.div key={character.id} variants={item}>
                      <div className="bg-white/80 rounded-xl p-4 flex items-center shadow-md">
                        <div className="w-12 h-12 rounded-full bg-[#7DC4E0]/20 border-2 border-[#7DC4E0]/40 flex items-center justify-center mr-4 flex-shrink-0">
                          <User size={24} className="text-[#7DC4E0]" />
                        </div>
                        <div className="flex-grow mr-4">
                          <h3 className="text-[#222] font-semibold text-lg">{character.name}</h3>
                          <p className="text-[#555] text-sm">
                            {character.characterType && 
                              `${character.characterType}${character.profession ? ` · ${character.profession}` : ''}`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditCharacter(character.id)}
                            className="w-10 h-10 rounded-full bg-white/70 hover:bg-[#BB79D1]/20 flex items-center justify-center text-[#BB79D1] border border-[#BB79D1]/30 transition-colors shadow-sm"
                            aria-label="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(character)}
                            className="w-10 h-10 rounded-full bg-white/70 hover:bg-[#F6A5B7]/20 flex items-center justify-center text-[#F6A5B7] hover:text-[#F6A5B7] border border-[#F6A5B7]/30 transition-colors shadow-sm"
                            aria-label="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* Modal de confirmación de eliminación */}
        {showDeleteConfirm && characterToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white/90 rounded-xl p-6 max-w-md w-full shadow-lg"
            >
              <h3 className="text-xl font-semibold text-[#BB79D1] mb-2">Eliminar personaje</h3>
              <p className="text-[#222] mb-6">
                ¿Estás seguro de que quieres eliminar a <span className="font-medium text-[#BB79D1]">{characterToDelete.name}</span>? 
                Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  className="flex-1 py-2 px-4 bg-white/80 rounded-xl text-[#222] font-medium hover:bg-white/90 transition-colors border border-[#BB79D1]/30 shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2 px-4 bg-[#F6A5B7] rounded-xl text-white font-medium hover:bg-[#F6A5B7]/80 transition-colors shadow-sm"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
