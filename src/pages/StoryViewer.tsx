// src/pages/StoryViewer.tsx
// VERSIÓN CORREGIDA: Maneja {content, title} y usa selectores de límites

import React, { useState, useEffect, useCallback } from "react"; // Añadido useCallback
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Share, Printer, Volume2, Home, Award, BookOpen, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react"; // Eliminado ArrowLeft si no se usa
import { motion } from "framer-motion";
import { useStoriesStore } from "../store/stories/storiesStore";
import { useChaptersStore } from "../store/stories/chapters/chaptersStore";
import { useChallengesStore } from "../store/stories/challenges/challengesStore";
import { useAuth } from "../context/AuthContext";
import BackButton from "../components/BackButton";
// import StoryButton from "../components/StoryButton"; // Parece no usarse aquí directamente
import PageTransition from "../components/PageTransition";
import ChallengeSelector from "../components/ChallengeSelector";
import LanguageSelector from "../components/LanguageSelector";
import ChallengeQuestion from "../components/ChallengeQuestion";
import { toast } from "sonner"; // Asegurarse que toast está importado
import { ChallengeCategory, ChallengeQuestion as ChallengeQuestionType, StoryChapter, Story } from "../types"; // Importar Story
import { ChallengeService } from "../services/ai/ChallengeService"; // Asumiendo ruta
import { parseTextToParagraphs } from '@/lib/utils';

export default function StoryViewer() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getStoryById, isLoadingStories } = useStoriesStore(state => ({
    getStoryById: state.getStoryById,
    isLoadingStories: state.isLoadingStories,
  }));
  const { getChaptersByStoryId } = useChaptersStore();
  const { addChallenge } = useChallengesStore();
  // --- Obtener selectores de límites/permisos del userStore ---
  const { profileSettings, canContinueStory, canGenerateVoice } = useAuth();

  // Estado local
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [chapters, setChapters] = useState<StoryChapter[]>([]);
  const [story, setStory] = useState<Story | null>(null); // Para pasar al servicio de desafío/continuación
  const [showChallengeSelector, setShowChallengeSelector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ChallengeCategory | null>(null);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [challengeQuestion, setChallengeQuestion] = useState<ChallengeQuestionType | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isGeneratingContinuation, setIsGeneratingContinuation] = useState(false); // Estado de carga para continuación

  // --- Permisos derivados del store ---
  // Estos se actualizan reactivamente si el estado del userStore cambia
  const isAllowedToContinue = storyId ? canContinueStory(storyId) : false;
  const isAllowedToGenerateVoice = canGenerateVoice();

  // --- Cálculo para saber si es el último capítulo ---
  const totalChapters = chapters.length;
  const currentChapterNumber = currentChapterIndex + 1;
  const isLastChapter = totalChapters > 0 && currentChapterNumber === totalChapters;

  // --- Efecto para cargar historia y capítulos ---
  useEffect(() => {
    if (!storyId) { navigate("/home", { replace: true }); return; }

    // Esperar a que las historias terminen de cargarse
    if (isLoadingStories) {
      console.log("[StoryViewer_DEBUG] Waiting for stories to load...");
      return; // Salir del efecto si aún está cargando
    }
    console.log("[StoryViewer_DEBUG] Stories loaded. Attempting to fetch story:", storyId);

    const fetchedStory = getStoryById(storyId);
    console.log("[StoryViewer_DEBUG] Fetched story from store:", fetchedStory ? `"${fetchedStory.title}"` : 'NOT FOUND');

    if (!fetchedStory) {
      console.error(`[StoryViewer_DEBUG] Story with ID ${storyId} not found after loading! Navigating to /not-found.`);
      navigate("/not-found", { replace: true }); // Usar replace para no ensuciar el historial
      return;
    }
    setStory(fetchedStory); // Guardar la historia base
    
    // No navegar a /profile aquí, checkAuth debería haberlo hecho si es necesario
    
    const storyChapters = getChaptersByStoryId(storyId);
    let chaptersToSet: StoryChapter[];
    if (storyChapters.length === 0 && fetchedStory.content) {
      console.log("[StoryViewer_DEBUG] No chapters found in store, creating initial chapter from story content.");
      // Crear capítulo inicial si no existe en el store de capítulos
      chaptersToSet = [{
        chapterNumber: 1,
        title: fetchedStory.title || "Capítulo 1",
        content: fetchedStory.content,
        createdAt: fetchedStory.createdAt
      }];
      // Nota: No llamamos a addChapter aquí, solo lo mostramos. Se guarda si se continúa.
    } else {
      console.log(`[StoryViewer_DEBUG] Found ${storyChapters.length} chapters in store. Sorting.`);
      chaptersToSet = [...storyChapters].sort((a, b) => a.chapterNumber - b.chapterNumber); // Asegurar orden
    }
    setChapters(chaptersToSet);
    console.log(`[StoryViewer_DEBUG] Set chapters state with ${chaptersToSet.length} chapters.`);

    // Establecer capítulo inicial basado en URL o el último si no hay parámetro
    const searchParams = new URLSearchParams(location.search);
    const chapterParam = searchParams.get('chapter');
    let initialIndex = chaptersToSet.length > 0 ? chaptersToSet.length - 1 : 0; // Default al último capítulo o 0 si no hay
    if (chapterParam !== null) {
      const chapterIndex = parseInt(chapterParam, 10);
      if (!isNaN(chapterIndex) && chapterIndex >= 0 && chapterIndex < chaptersToSet.length) {
        initialIndex = chapterIndex;
      }
    }
    console.log(`[StoryViewer_DEBUG] Setting current chapter index to: ${initialIndex}`);
    setCurrentChapterIndex(initialIndex);

  }, [storyId, location.search, getStoryById, getChaptersByStoryId, navigate, isLoadingStories]); // <- Añadir isLoadingStories como dependencia

  // --- Renderizado Condicional --- (Modificado)
  if (isLoadingStories) {
    console.log("[StoryViewer Render_DEBUG] Rendering loading spinner because isLoadingStories is true.");
    return <div className="gradient-bg min-h-screen flex items-center justify-center text-white">Cargando historia...</div>;
  }

  // Si la carga terminó pero la historia no se encontró (el useEffect ya habrá navegado a /not-found)
  if (!story) {
    console.log("[StoryViewer Render_DEBUG] Rendering 'Historia no encontrada' because story state is null after loading finished.");
    // Podríamos mostrar un mensaje aquí mientras ocurre la navegación del useEffect
    return <div className="gradient-bg min-h-screen flex items-center justify-center text-white">Historia no encontrada. Redirigiendo...</div>;
    // O return null;
  }

  // Si llegamos aquí, la historia está cargada. Renderizar contenido.
  console.log(`[StoryViewer Render_DEBUG] Rendering main content for story: ${story.title}`);

  // --- Manejadores de Acciones ---
  const handleShare = async () => {
    const shareUrl = window.location.href; // URL actual incluyendo el capítulo
    const shareTitle = story?.title || "Mi Historia TaleMe!";
    const shareText = chapters.length > 0 ? chapters[currentChapterIndex]?.title : "Echa un vistazo a esta historia";

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        toast.success("¡Historia compartida!");
      } catch (error) {
        console.error("Error al compartir:", error);
        toast.error("No se pudo compartir", { description: "El navegador canceló la acción o hubo un error." });
      }
    } else {
      // Fallback: Copiar al portapapeles
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.info("Enlace copiado al portapapeles", {
          description: "Puedes pegarlo para compartir la historia."
        });
      } catch (err) {
        console.error('Error al copiar al portapapeles:', err);
        toast.error("No se pudo copiar el enlace", {
          description: "Tu navegador no soporta esta función o hubo un error."
        });
      }
    }
  };

  const handlePrint = () => {
    // Simplemente llama a la función de impresión del navegador
    window.print();
  };

  const toggleAudioPlayer = () => {
    // Usar el estado derivado isAllowedToGenerateVoice
    if (isAllowedToGenerateVoice) {
      navigate(`/story/${storyId}/audio/${currentChapterIndex}`);
    } else {
      toast.error("Límite de voz alcanzado", {
        description: "No tienes generaciones de voz gratuitas o créditos disponibles."
      });
    }
  };

  // --- Manejadores de Desafío (sin cambios lógicos aquí) ---
  const handleShowChallenge = () => setShowChallengeSelector(true);
  const handleSelectCategory = (category: ChallengeCategory) => { /* ... */ setSelectedCategory(category); };
  const handleSelectLanguage = (language: string) => setSelectedLanguage(language);
  const handleContinueAfterLanguage = () => { /* ... */ setShowLanguageSelector(false); generateChallengeQuestion(); };
  const handleContinueAfterCategory = () => { /* ... */ if (selectedCategory === 'language') setShowLanguageSelector(true); else generateChallengeQuestion(); setShowChallengeSelector(false); };
  const handleBackToCategories = () => { /* ... */ setShowLanguageSelector(false); setShowChallengeSelector(true); };
  const handleTryAgain = () => generateChallengeQuestion();
  const handleNextQuestion = () => { /* ... */ setChallengeQuestion(null); setSelectedCategory(null); setSelectedLanguage(null); setShowChallengeSelector(false); };
  const handleChangeChallenge = () => { /* ... */ setChallengeQuestion(null); setSelectedCategory(null); setSelectedLanguage(null); setShowChallengeSelector(true); };

  const generateChallengeQuestion = async () => {
    if (!selectedCategory || !story || !profileSettings) return;
    setIsLoadingQuestion(true);
    try {
      if (selectedCategory === 'language' && !selectedLanguage) throw new Error('Idioma no seleccionado');
      toast.loading('Generando pregunta...');
      const challenge = await ChallengeService.createChallenge(story, selectedCategory, profileSettings, selectedCategory === 'language' ? selectedLanguage : undefined);
      addChallenge(challenge);
      setChallengeQuestion(challenge.questions[0]);
      toast.dismiss();
      toast.success('¡Pregunta lista!');
    } catch (error: any) {
      console.error('Error al generar pregunta:', error);
      toast.dismiss();
      toast.error('No se pudo generar la pregunta', { description: error?.message });
    } finally {
      setIsLoadingQuestion(false);
    }
  };
  // --- Fin Manejadores Desafío ---

  // --- Manejadores de Navegación de Capítulos ---
  const handlePreviousChapter = () => {
    if (currentChapterIndex > 0) setCurrentChapterIndex(currentChapterIndex - 1);
  };
  const handleNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) setCurrentChapterIndex(currentChapterIndex + 1);
  };
  // --- Fin Navegación Capítulos ---

  // --- Manejador para el botón de atrás ---
  const handleGoBack = () => {
    navigate('/'); // Navegar explícitamente a la página de inicio
  };

  // --- *** INICIO: Lógica de Continuación MODIFICADA *** ---
  const goToContinuationPage = () => {
    // Usa el estado derivado isAllowedToContinue
    if (isAllowedToContinue) {
      // Navega a la PÁGINA de continuación, no genera aquí
      navigate(`/story/${storyId}/continue?refresh=${Date.now()}`);
    } else {
      toast.error("Límite de continuación alcanzado", {
        description: "Solo puedes añadir una continuación gratuita por historia."
      });
    }
  };
  // --- *** FIN: Lógica de Continuación MODIFICADA *** ---

  // --- Renderizado ---
  const currentChapter = chapters[currentChapterIndex];
  console.log(`[StoryViewer_DEBUG] Title from current chapter object: "${currentChapter?.title}"`); // <-- ADD THIS
  if (!currentChapter) {
    // Manejar caso donde el índice es inválido (aunque useEffect debería prevenirlo)
    return <div className="gradient-bg min-h-screen flex items-center justify-center text-white">Error: Capítulo no encontrado.</div>;
  }

  return (
    <PageTransition>
      <div
        className="min-h-screen relative pb-24 flex flex-col items-center justify-start"
        style={{
          backgroundImage: "url(/fondo_png.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Botón de Volver atrás */}
        <BackButton onClick={handleGoBack} />

        <div className="absolute top-6 right-6 flex space-x-2 z-10">
          <button
            onClick={handleShare}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#BB79D1] hover:bg-white/40 hover:scale-105 active:scale-95 transition-all shadow-md"
            aria-label="Compartir"
          >
            <Share className="h-5 w-5" />
          </button>
          <button
            onClick={handlePrint}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#BB79D1] hover:bg-white/40 hover:scale-105 active:scale-95 transition-all shadow-md"
            aria-label="Imprimir"
          >
            <Printer className="h-5 w-5" />
          </button>
        </div>

        <div className="w-full max-w-2xl mx-auto pt-20 px-2 sm:px-6 flex-1 flex flex-col">
          {/* Título del Capítulo/Historia */}
          <motion.h1
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl sm:text-3xl font-bold text-center mb-4 text-[#BB79D1] drop-shadow-lg px-2"
            title={currentChapter.title || story.title}
          >
            {chapters.length > 1 ? `Cap. ${currentChapterIndex + 1}: ` : ''}
            {currentChapter.title || story.title || "Historia sin título"}
          </motion.h1>

          {/* Contenido Principal (Historia o Desafío) */}
          {!showChallengeSelector && !showLanguageSelector && !challengeQuestion && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white/80 rounded-2xl p-4 sm:p-8 mb-6 text-[#222] leading-relaxed text-base sm:text-lg shadow-lg max-w-full"
              style={{ minHeight: '40vh', boxShadow: '0 2px 24px 0 rgba(187,121,209,0.10)' }}
            >
              {parseTextToParagraphs(currentChapter.content).map((paragraph, index) => (
                <p key={index} className="mb-4 last:mb-0 text-[1.08em]" style={{ wordBreak: 'break-word' }}>
                  {paragraph}
                </p>
              ))}
            </motion.div>
          )}

          {/* Selectores y Pregunta de Desafío (sin cambios) */}
          {showChallengeSelector && <ChallengeSelector onSelectCategory={handleSelectCategory} onContinue={handleContinueAfterCategory} />}
          {showLanguageSelector && <LanguageSelector currentLanguage={profileSettings?.language || 'es'} onSelectLanguage={handleSelectLanguage} onContinue={handleContinueAfterLanguage} onBack={handleBackToCategories} />}
          {challengeQuestion && <ChallengeQuestion question={challengeQuestion} onNextQuestion={handleNextQuestion} onTryAgain={handleTryAgain} onChangeChallenge={handleChangeChallenge} />}

          {/* --- Barra de Acciones Inferior --- */}
          {!showChallengeSelector && !showLanguageSelector && !challengeQuestion && (
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-4 sm:mt-8"
            >
              {/* Navegación entre Capítulos */}
              <div className="flex justify-between items-center mb-4 px-1 sm:px-2">
                <button onClick={handlePreviousChapter} disabled={currentChapterIndex === 0} className="text-[#BB79D1] bg-white/70 hover:bg-[#F6A5B7]/20 rounded-xl px-3 py-2 text-sm font-semibold shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all">
                  <ChevronLeft size={18} /> Anterior
                </button>
                <span className="text-[#222] text-base sm:text-lg font-bold select-none drop-shadow-sm bg-white/70 px-3 py-1 rounded-xl shadow-sm">
                  Capítulo {currentChapterIndex + 1} / {chapters.length}
                </span>
                <button onClick={handleNextChapter} disabled={currentChapterIndex === chapters.length - 1} className="text-[#BB79D1] bg-white/70 hover:bg-[#F6A5B7]/20 rounded-xl px-3 py-2 text-sm font-semibold shadow disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all">
                  Siguiente <ChevronRight size={18} />
                </button>
              </div>

              {/* Botones de Acción Principales */}
              <div className="flex flex-col items-center space-y-4 sm:space-y-5">
                {/* Primera fila: Acepta el Reto y Continuar Historia */}
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center w-full">
                  <button
                    onClick={handleShowChallenge}
                    className={`flex items-center justify-center px-5 sm:px-6 py-3 sm:py-4 rounded-2xl font-semibold text-white shadow-lg text-base sm:text-lg w-full sm:w-auto bg-[#7DC4E0] hover:bg-[#7DC4E0]/80 active:bg-[#A5D6F6] focus:bg-[#A5D6F6] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed`}
                    disabled={isLoadingQuestion}
                  >
                    <Award size={22} className="mr-2" />
                    {isLoadingQuestion ? "Generando..." : "Acepta el Reto"}
                  </button>

                  <button
                    onClick={goToContinuationPage}
                    // Deshabilitado si NO se permite continuar (plan) O si NO es el último capítulo
                    disabled={!isAllowedToContinue || !isLastChapter}
                    className={`flex items-center justify-center px-5 sm:px-6 py-3 sm:py-4 rounded-2xl font-semibold transition-all shadow-lg text-base sm:text-lg w-full sm:w-auto ${isAllowedToContinue && isLastChapter ? 'bg-[#BB79D1] hover:bg-[#BB79D1]/80 text-white active:bg-[#E6B7D9] focus:bg-[#E6B7D9]' : 'bg-gray-300 cursor-not-allowed text-gray-500'}`}
                    // Título dinámico según la razón de la deshabilitación
                    title={
                      !isAllowedToContinue
                        ? "Límite de continuación gratuita alcanzado"
                        : !isLastChapter
                        ? "Solo puedes continuar desde el último capítulo"
                        : "Continuar la historia"
                    }
                  >
                    <BookOpen size={22} className="mr-2" />
                    Continuar Historia
                  </button>
                </div>

                {/* Segunda fila: Narrar */}
                <button
                  onClick={toggleAudioPlayer}
                  disabled={!isAllowedToGenerateVoice}
                  className={`flex items-center justify-center px-5 sm:px-6 py-3 sm:py-4 rounded-2xl font-semibold transition-all shadow-lg text-base sm:text-lg w-full sm:w-64 ${isAllowedToGenerateVoice ? 'bg-[#f7c59f] hover:bg-[#ffd7ba] text-white active:bg-[#ffd7ba] focus:bg-[#ffd7ba]' : 'bg-gray-300 cursor-not-allowed text-gray-500'}`}
                  title={!isAllowedToGenerateVoice ? "Límite de voz o créditos agotados" : "Escuchar narración"}
                >
                  <Volume2 size={22} className="mr-2" />
                  Narrar
                  {!isAllowedToGenerateVoice && <AlertCircle className="ml-1 h-4 w-4" />}
                </button>

                {/* Tercera fila: Volver al Inicio */}
                <button
                  onClick={() => navigate("/home")}
                  className="flex items-center justify-center px-5 sm:px-6 py-2.5 sm:py-3 rounded-2xl font-semibold bg-white/60 hover:bg-white/80 text-[#BB79D1] transition-all shadow w-full sm:w-48 text-base"
                >
                  <Home size={18} className="mr-2" /> Volver al Inicio
                </button>
              </div>
            </motion.div>
          )}
        </div> {/* Fin container */}
      </div> {/* Fin fondo */}
    </PageTransition>
  );
}

// Estilos CSS reutilizados (puedes ponerlos en tu index.css o similar)
/*
.action-icon-button {
  @apply w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/25 transition-all;
}
.nav-button {
  @apply text-white/80 hover:text-white text-sm inline-flex items-center gap-1 transition-colors;
}
.action-button {
   @apply text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-full font-medium flex items-center justify-center shadow-lg transition-all text-sm sm:text-base w-full sm:w-auto;
}
*/