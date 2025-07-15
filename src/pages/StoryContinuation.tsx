// src/pages/StoryContinuation.tsx
// VERSIÓN CORREGIDA para manejar la respuesta { content, title } del servicio

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { useStoriesStore } from "../store/stories/storiesStore";
import { useChaptersStore } from "../store/stories/chapters/chaptersStore";
import { useUserStore } from "../store/user/userStore";
import BackButton from "../components/BackButton";
import PageTransition from "../components/PageTransition";
import StoryContinuationOptions from "../components/StoryContinuationOptions";
import StoryContinuationCustomInput from "../components/StoryContinuationCustomInput";
import { toast } from "sonner";
import { Story, StoryChapter as StoryChapterType } from "../types";
import { StoryContinuationService } from "../services/ai/StoryContinuationService";
import { generateId } from "../store/core/utils";
import IconLoadingAnimation from "../components/IconLoadingAnimation";

export default function StoryContinuation() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getStoryById } = useStoriesStore();
  const { getChaptersByStoryId, addChapter } = useChaptersStore();
  const { canContinueStory } = useUserStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [continuationOptions, setContinuationOptions] = useState<{ summary: string }[]>([]);
  const [story, setStory] = useState<Story | null>(null);
  const [chapters, setChapters] = useState<StoryChapterType[]>([]);
  const [shouldGenerateOptions, setShouldGenerateOptions] = useState(true);
  const [isAllowedToContinue, setIsAllowedToContinue] = useState(true);

  useEffect(() => {
    if (!storyId) {
      navigate("/home");
      return;
    }

    const fetchedStory = getStoryById(storyId);
    if (!fetchedStory) {
      toast.error("Historia no encontrada");
      navigate("/saved-stories");
      return;
    }
    setStory(fetchedStory);

    const existingChapters = getChaptersByStoryId(storyId);
    let currentChapters: StoryChapterType[];

    if (existingChapters.length === 0 && fetchedStory.content) {
      const initialChapter: StoryChapterType = {
        chapterNumber: 1,
        title: fetchedStory.title || "Capítulo 1",
        content: fetchedStory.content,
        createdAt: fetchedStory.createdAt,
      };
      currentChapters = [initialChapter];
    } else {
      currentChapters = existingChapters;
    }
    setChapters(currentChapters);

    const allowed = canContinueStory(storyId);
    setIsAllowedToContinue(allowed);
    if (!allowed) {
      toast.info("Has alcanzado el límite de continuación gratuita para esta historia.");
    }

  }, [storyId, getStoryById, getChaptersByStoryId, navigate, canContinueStory]);

  useEffect(() => {
    if (isAllowedToContinue) {
      setShouldGenerateOptions(true);
    }
  }, [location.search, isAllowedToContinue]);

  const generateOptions = useCallback(async () => {
    if (!story || chapters.length === 0 || !isAllowedToContinue) return;

    console.log(`Generating options for story ${story.id}`);
    setIsLoadingOptions(true);
    setContinuationOptions([]);
    try {
      // Obtener profileSettings para pasar childAge y specialNeed
      const profileSettings = useUserStore.getState().profileSettings;
      
      const response = await StoryContinuationService.generateContinuationOptions(
        story, 
        chapters,
        profileSettings?.childAge,
        profileSettings?.specialNeed
      );
      if (response?.options?.length === 3) {
        setContinuationOptions(response.options);
      } else {
        console.warn("generateOptions: No se recibieron 3 opciones válidas. Usando defaults.");
        throw new Error("Fallback");
      }
    } catch (error) {
      console.error("Error generating continuation options:", error);
      toast.error("No se pudieron generar las opciones. Intenta de nuevo.");
      setContinuationOptions([
        { summary: "Explorar el misterioso jardín." },
        { summary: "Seguir al pájaro parlanchín." },
        { summary: "Preguntar al viejo árbol sabio." }
      ]);
    } finally {
      setIsLoadingOptions(false);
    }
  }, [story, chapters, isAllowedToContinue]);

  useEffect(() => {
    if (story && chapters.length > 0 && shouldGenerateOptions && isAllowedToContinue) {
      generateOptions();
      setShouldGenerateOptions(false);
    }
  }, [chapters, story, shouldGenerateOptions, generateOptions, isAllowedToContinue]);

  const handleGenerateAndSaveChapter = useCallback(async (
    generationPromise: Promise<{ content: string; title: string }>,
    generationMethod: StoryChapterType['generationMethod'],
    customInput?: string
  ) => {
    if (!story || !storyId || !isAllowedToContinue) {
      toast.error("No puedes continuar esta historia (límite alcanzado).");
      return;
    }

    setIsLoading(true);
    toast.loading("Generando continuación...");

    try {
      const nextChapterNumber = chapters.length + 1;
      const { content, title } = await generationPromise;

      const newChapter: StoryChapterType = {
        chapterNumber: nextChapterNumber,
        title: title || `Capítulo ${nextChapterNumber}`,
        content: content,
        createdAt: new Date().toISOString(),
        generationMethod: generationMethod,
        ...(customInput && { customInput: customInput })
      };

      await addChapter(storyId, newChapter);

      const updatedChapters = [...chapters, newChapter];
      setChapters(updatedChapters);

      toast.dismiss();
      toast.success("¡Continuación generada con éxito!");

      setShouldGenerateOptions(true);

      navigate(`/story/${storyId}?chapter=${newChapter.chapterNumber - 1}`);

    } catch (error: any) {
      console.error("Error al generar continuación:", error);
      toast.dismiss();
      toast.error("Error al generar la continuación", {
        description: error?.message || "Inténtalo de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [story, storyId, isAllowedToContinue, addChapter, chapters, navigate]);

  const handleSelectFree = () => {
    if (!story) return; // Añadir guarda por si acaso
    // Obtener el estado MÁS ACTUAL de los capítulos ANTES de enviar
    const currentChaptersFromStore = useChaptersStore.getState().getChaptersByStoryId(story.id);
    console.log(`[StoryContinuation] Passing ${currentChaptersFromStore.length} chapters to freeContinuation service.`);

    handleGenerateAndSaveChapter(
      // Pasar los capítulos correctos del store
      StoryContinuationService.generateFreeContinuation(story, currentChaptersFromStore),
      "free"
    );
  };

  const handleSelectOption = (index: number) => {
    if (!story) return; // Añadir guarda
    const selectedOptionSummary = continuationOptions[index]?.summary;
    if (!selectedOptionSummary) {
      toast.error("Opción seleccionada no válida.");
      return;
    }
    // Obtener el estado MÁS ACTUAL de los capítulos ANTES de enviar
    const currentChaptersFromStore = useChaptersStore.getState().getChaptersByStoryId(story.id);
    console.log(`[StoryContinuation] Passing ${currentChaptersFromStore.length} chapters to optionContinuation service.`);

    handleGenerateAndSaveChapter(
      // Pasar los capítulos correctos del store
      StoryContinuationService.generateOptionContinuation(story, currentChaptersFromStore, selectedOptionSummary),
      `option${index + 1}` as "option1" | "option2" | "option3"
    );
  };

  const handleCustomContinuation = (userDirection: string) => {
    if (!story) return; // Añadir guarda
    setShowCustomInput(false);
    // Obtener el estado MÁS ACTUAL de los capítulos ANTES de enviar
    const currentChaptersFromStore = useChaptersStore.getState().getChaptersByStoryId(story.id);
    console.log(`[StoryContinuation] Passing ${currentChaptersFromStore.length} chapters to directedContinuation service.`);

    handleGenerateAndSaveChapter(
      // Pasar los capítulos correctos del store
      StoryContinuationService.generateDirectedContinuation(story, currentChaptersFromStore, userDirection),
      "custom",
      userDirection
    );
  };

  if (isLoading) {
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
              <IconLoadingAnimation message="Generando continuación..." />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 1 }}
              className="bg-white/70 text-[#222] p-4 rounded-xl max-w-sm text-center shadow-md"
            >
              <p className="font-medium">Estamos personalizando una continuación mágica para tu historia...</p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {story?.options?.characters && story.options.characters.length > 0 && (
                  <div className="bg-[#7DC4E0]/20 p-2 rounded-lg border border-[#7DC4E0]/30">
                    <p className="text-xs font-semibold text-[#7DC4E0]">Personajes ({story.options.characters.length})</p>
                    <p className="text-sm truncate">
                      {story.options.characters.map(char => char.name).join(', ')}
                    </p>
                  </div>
                )}

                {story?.options?.genre && (
                  <div className="bg-[#BB79D1]/20 p-2 rounded-lg border border-[#BB79D1]/30">
                    <p className="text-xs font-semibold text-[#BB79D1]">Género</p>
                    <p className="text-sm truncate">{story.options.genre}</p>
                  </div>
                )}

                {story?.options?.duration && (
                  <div className="bg-[#F9DA60]/20 p-2 rounded-lg border border-[#F9DA60]/30">
                    <p className="text-xs font-semibold text-[#F9DA60]">Duración</p>
                    <p className="text-sm truncate">{story.options.duration}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </PageTransition>
    );
  }

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
        <BackButton
          onClick={() => {
            if (showCustomInput) {
              setShowCustomInput(false);
            } else {
              navigate(`/story/${storyId}?chapter=${chapters.length > 0 ? chapters.length - 1 : 0}`);
            }
          }}
        />

        <div className="w-full max-w-2xl mx-auto px-4 py-8">
          {chapters.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white/70 rounded-xl p-4 mb-4 text-[#222] shadow-md"
            >
              <div className="flex items-center">
                <BookOpen size={20} className="mr-2 text-[#BB79D1]" />
                <h2 className="text-lg font-medium truncate" title={chapters[chapters.length - 1].title || `Capítulo ${chapters.length}`}>
                  Continuando: {chapters[chapters.length - 1].title || `Capítulo ${chapters.length}`}
                </h2>
              </div>
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="text-3xl font-bold text-[#BB79D1] text-center mb-4 font-heading drop-shadow-lg"
          >
            ¿Cómo quieres que continúe?
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="text-lg text-[#222] bg-white/80 rounded-xl px-4 py-2 text-center mb-6 font-medium shadow-sm"
          >
            Elige una opción para continuar tu historia
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            {!showCustomInput ? (
              <StoryContinuationOptions
                options={continuationOptions}
                onSelectOption={handleSelectOption}
                onSelectFree={handleSelectFree}
                onSelectCustom={() => setShowCustomInput(true)}
                isLoading={isLoadingOptions}
                disabled={!isAllowedToContinue}
              />
            ) : (
              <StoryContinuationCustomInput
                onSubmit={handleCustomContinuation}
                onBack={() => setShowCustomInput(false)}
                disabled={!isAllowedToContinue}
              />
            )}
          </motion.div>

          {!isAllowedToContinue && chapters.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.4 }}
              className="text-center bg-white/70 rounded-xl p-4 mt-6 shadow-md border-2 border-[#F6A5B7]/30"
            >
              <p className="text-[#F6A5B7] font-semibold">
                Has alcanzado el límite de continuación gratuita para esta historia. ¡Considera hacerte Premium para continuaciones ilimitadas!
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}