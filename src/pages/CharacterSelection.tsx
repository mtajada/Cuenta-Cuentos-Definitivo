import { useNavigate } from "react-router-dom";
import { Plus, User, Users, UserCheck } from "lucide-react";
import { useCharacterStore, validateMultipleCharacterSelection, getCharacterSelectionMessage } from "../store/character/characterStore";
import { useStoryOptionsStore } from "../store/storyOptions/storyOptionsStore";
import BackButton from "../components/BackButton";
import StoryButton from "../components/StoryButton";
import PageTransition from "../components/PageTransition";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useUserStore } from "../store/user/userStore";

export default function CharacterSelection() {
  const navigate = useNavigate();
  const {
    savedCharacters,
    loadCharactersFromSupabase,
    selectedCharacters,
    toggleCharacterSelection,
    clearSelectedCharacters,
    isCharacterSelected,
    canSelectMoreCharacters
  } = useCharacterStore();
  const { updateStoryOptions, updateSelectedCharacters } = useStoryOptionsStore();
  const [isLoading, setIsLoading] = useState(true);
  // Removido isMultipleMode - ahora siempre permitimos selección múltiple

  // Cargar personajes al montar el componente
  useEffect(() => {
    const loadCharacters = async () => {
      console.log("[DEBUG] CharacterSelection montado - cargando personajes directamente desde Supabase");
      setIsLoading(true);

      const user = useUserStore.getState().user;
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
    // Siempre usar modo selección múltiple - solo toggle, no navegar automáticamente
    toggleCharacterSelection(characterId);
  };

  const handleContinueWithSelection = () => {
    // Validar selección
    const validation = validateMultipleCharacterSelection(selectedCharacters);

    if (!validation.isValid) {
      console.warn("Selección inválida:", validation.errors);
      return;
    }

    // Actualizar story options con personajes seleccionados
    updateSelectedCharacters(selectedCharacters);
    navigate("/story-genre");
  };

  const handleCreateNewCharacter = () => {
    // Resetear el personaje actual para asegurar un ID único
    const { resetCharacter } = useCharacterStore.getState();
    resetCharacter();
    navigate("/character-name?action=create");
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
            Selecciona Personajes
          </h1>

          <p className="text-lg text-[#222] bg-white/80 rounded-xl px-4 py-2 text-center mb-6 font-medium shadow-sm">
            ✨ ¡Puedes elegir hasta 4 personajes para tu historia! Para cuentos cortitos, recomendamos menos personajes para que cada uno brille más.
          </p>

          {/* Contador de selección */}
          {selectedCharacters.length > 0 && (
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-3 px-4 py-2 bg-white/70 rounded-xl border-2 border-[#BB79D1]/60 shadow-sm">
                <Users size={20} className="text-[#BB79D1]" />
                <span className="text-[#222] font-medium">
                  {selectedCharacters.length}/4 personajes seleccionados
                </span>
              </div>
            </div>
          )}

          {/* Mensaje de selección */}
          <div className="text-center mb-4">
            <p className="text-[#555] bg-white/60 rounded-lg px-3 py-2 text-sm">
              {getCharacterSelectionMessage(selectedCharacters.length)}
            </p>
          </div>

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

                {savedCharacters.map((character) => {
                  const isSelected = isCharacterSelected(character.id);
                  const canSelect = canSelectMoreCharacters() || isCharacterSelected(character.id);

                  return (
                    <motion.div key={character.id} variants={item}>
                      <div
                        onClick={() => canSelect && handleSelectCharacter(character.id)}
                        className={`
                          relative flex flex-col items-center justify-center p-6 h-40 cursor-pointer
                          bg-white/70 rounded-2xl border-2 transition-all duration-300
                          ${isSelected
                            ? 'border-[#BB79D1]/80 bg-[#BB79D1]/20 ring-4 ring-[#BB79D1]/50 shadow-lg transform scale-105'
                            : 'border-[#7DC4E0]/60 hover:bg-[#7DC4E0]/10 hover:scale-105 hover:shadow-md'}
                          ${!canSelect ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                      >
                        {/* Checkbox siempre visible */}
                        <div className="absolute top-2 right-2">
                          <Checkbox
                            checked={isCharacterSelected(character.id)}
                            onCheckedChange={(checked) => {
                              if (canSelect) {
                                handleSelectCharacter(character.id);
                              }
                            }}
                            className="w-5 h-5 border-2 border-[#BB79D1] data-[state=checked]:bg-[#BB79D1] data-[state=checked]:border-[#BB79D1]"
                          />
                        </div>

                        {/* Icono de personaje */}
                        {isSelected ? (
                          <UserCheck size={40} className="text-[#BB79D1] mb-2" />
                        ) : (
                          <User size={40} className="text-[#7DC4E0] mb-2" />
                        )}

                        <span className="text-[#222] text-center font-medium">{character.name}</span>
                        <span className="text-[#555] text-xs">{character.profession}</span>

                        {/* Badge de seleccionado */}
                        {isCharacterSelected(character.id) && (
                          <Badge className="absolute -top-2 -left-2 bg-[#BB79D1] text-white text-xs">
                            ✓
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {savedCharacters.length === 0 && (
                <div className="text-center bg-white/70 rounded-xl p-4 shadow-md mb-8">
                  <div className="text-[#555] font-medium">No tienes personajes guardados. ¡Crea uno nuevo!</div>
                </div>
              )}

              {savedCharacters.length > 0 && (
                <div className="flex flex-col items-center gap-4">
                  {/* Botón limpiar selección */}
                  {selectedCharacters.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={clearSelectedCharacters}
                        className="px-4 py-2 text-sm bg-white/70 border border-[#7DC4E0]/60 rounded-lg
                          hover:bg-[#7DC4E0]/10 transition-all duration-200 text-[#555]"
                      >
                        Limpiar Selección
                      </button>
                    </div>
                  )}

                  {/* Botón Continuar */}
                  <div className="flex justify-center w-full">
                    <StoryButton
                      onClick={handleContinueWithSelection}
                      isFullWidth={false}
                      disabled={selectedCharacters.length === 0}
                      className="w-full max-w-xs py-4 rounded-2xl text-white text-lg font-semibold shadow-lg bg-[#BB79D1] hover:bg-[#BB79D1]/90 border-2 border-[#BB79D1]/50 transition-all duration-200"
                    >
                      {selectedCharacters.length === 0
                        ? "Selecciona al menos un personaje"
                        : `Continuar con ${selectedCharacters.length} personaje${selectedCharacters.length !== 1 ? 's' : ''}`
                      }
                    </StoryButton>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
