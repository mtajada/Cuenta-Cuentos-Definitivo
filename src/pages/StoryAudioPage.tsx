import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ChevronLeft, ChevronRight, ArrowLeft, Trash2, Brush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { generateSpeech } from "@/services/ai/ttsService";
import { useStoriesStore } from "../store/stories/storiesStore";
import { useChaptersStore } from "../store/stories/chapters/chaptersStore";
import { useAudioStore } from "../store/stories/audio/audioStore";
import { toast } from "sonner";
import WaveForm from "@/components/WaveForm";
import { STORY_VOICES, PLAYBACK_SPEEDS, CUSTOM_VOICE_MAPPING, PREVIEW_FILES } from "@/constants/story-voices.constant";
import { PreviewVoiceModal } from "@/components/PreviewVoiceModal";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Howl } from 'howler';
import { useAuth } from "../context/AuthContext";
import { toastManager } from "@/lib/utils";

// Configuración del cliente de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing. Check your .env file.");
  // Podrías lanzar un error o manejar esto de alguna manera
}

const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Playback speeds


// Audio Wave Loading Animation Component
const AudioWaveLoading = ({ color = "#fff" }) => {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {[1, 2, 3, 4, 5].map((bar) => (
        <motion.div
          key={bar}
          className="w-2 bg-white rounded-full"
          initial={{ height: 10 }}
          animate={{
            height: [10, 32, 10],
            opacity: [0.4, 1, 0.4]
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: bar * 0.15,
            ease: "easeInOut"
          }}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
};

// Format time helper
const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export default function StoryAudioPage() {
  const { storyId, chapterId } = useParams<{ storyId: string, chapterId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getStoryById } = useStoriesStore();
  const { getChaptersByStoryId, loadChaptersFromSupabase } = useChaptersStore();
  const {
    setGenerationStatus,
    getGenerationStatus,
    setCurrentVoice,
    getCurrentVoice,
  } = useAudioStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [playbackSpeedIndex, setPlaybackSpeedIndex] = useState(1); // Default to 1x (index 1)
  const [showGenerationPopup, setShowGenerationPopup] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [audioIntensity, setAudioIntensity] = useState(0.5);
  
  // Referencia a la instancia de Howler
  const howlRef = useRef<Howl | null>(null);
  
  // Timer para actualizar currentTime
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Referencia para análisis de audio (visualización)
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Get selected voice and playback speed
  const selectedVoice = STORY_VOICES[voiceIndex];
  const playbackSpeed = PLAYBACK_SPEEDS[playbackSpeedIndex];

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Set currentVoice in store when it changes
  useEffect(() => {
    setCurrentVoice(selectedVoice.id);
  }, [selectedVoice.id, setCurrentVoice]);

  // Initialize voice from store if available
  useEffect(() => {
    const savedVoice = getCurrentVoice();
    if (savedVoice) {
      const voiceIdx = STORY_VOICES.findIndex(v => v.id === savedVoice);
      if (voiceIdx !== -1) {
        setVoiceIndex(voiceIdx);
      }
    }
  }, [getCurrentVoice]);

  // Load story data
  useEffect(() => {
    if (storyId) {
      // Cargar la historia como ya lo haces
      const story = getStoryById(storyId);
      if (!story) {
        navigate("/not-found");
        return;
      }
      
      // Añadir carga de capítulos frescos
      loadChaptersFromSupabase(storyId).catch(() => 
        toast.error("Error cargando capítulos")
      );
    }
  }, [storyId, navigate, getStoryById, loadChaptersFromSupabase]);

  // Get story content
  const story = storyId ? getStoryById(storyId) : null;
  const chapters = storyId ? getChaptersByStoryId(storyId) : [];
  const currentChapterIndex = chapterId ? parseInt(chapterId, 10) : 0;

  // If no valid chapter or story, use a placeholder
  const title = chapters.length > 0 && currentChapterIndex < chapters.length
    ? chapters[currentChapterIndex].title || story?.title
    : story?.title || "Historia";

  const content = chapters.length > 0 && currentChapterIndex < chapters.length
    ? chapters[currentChapterIndex].content
    : story?.content || "";

  // Estado para controlar si ya se mostró un toast para la combinación actual
  const [lastAudioState, setLastAudioState] = useState<{
    storyId: string | null;
    chapterIndex: number | null;
    voiceId: string | null;
    hasAudio: boolean | null;
  }>({
    storyId: null,
    chapterIndex: null,
    voiceId: null,
    hasAudio: null
  });

  // Nueva función para obtener audio desde Supabase
  const getAudioFromSupabase = async (storyIdToFetch: string, chapterIdx: number, voiceIdToFetch: string) => {
    if (!supabase) {
      console.error("Cliente Supabase no inicializado.");
      return null;
    }
    if (!chapters[chapterIdx]) {
      return null;
    }

    const chapter = chapters[chapterIdx];
    if (!chapter || !chapter.id) {
      return null;
    }

    try {
      // Buscar en la tabla chapter_audio_files
      const { data, error } = await supabase
        .from('audio_files')
        .select('*')
        .eq('chapter_id', chapter.id)
        .eq('voice_id', voiceIdToFetch)
        .eq('user_id', user.id || '')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error al buscar audio existente:', error.message);
        return null;
      }

      // Si encontramos el registro en la base de datos, usar su public_url
      if (data && data.public_url) {
        return data.public_url;
      }
      
      // Si no se encontró el audio, verificar si existe físicamente en Storage
      const expectedPath = `${storyIdToFetch}/${chapter.id}/${voiceIdToFetch}.mp3`;
      
      // Verificar si el archivo existe realmente en el bucket antes de devolver la URL
      const { data: existsData, error: existsError } = await supabase.storage
        .from('narrations')
        .list(storyIdToFetch, {
          search: `${chapter.id}/${voiceIdToFetch}.mp3`
        });
        
      if (existsError) {
        console.error('Error al verificar existencia del archivo:', existsError);
        return null;
      }
      
      
      // Solo si el archivo existe realmente, devolver la URL pública
      if (existsData && existsData.length > 0) {
        const { data: fileData } = await supabase.storage
          .from('narrations')
          .getPublicUrl(expectedPath);
        
        if (fileData && fileData.publicUrl) {
          return fileData.publicUrl;
        }
      }
      
      return null;
    } catch (e) {
      console.error('Error al buscar audio existente:', e);
      return null;
    }
  };

  // Efecto para cargar audio existente con control de toasts mejorado
  useEffect(() => {
    const loadAudio = async () => {
      if (!storyId || currentChapterIndex === undefined || !selectedVoice || chapters.length === 0 || !chapters[currentChapterIndex]) {
        setAudioUrl(null);
        return;
      }

      const chapter = chapters[currentChapterIndex];
      if (!chapter?.id) {
        setAudioUrl(null);
        return;
      }

      // Verificar si ya procesamos esta combinación para evitar toasts duplicados
      const currentState = {
        storyId,
        chapterIndex: currentChapterIndex,
        voiceId: selectedVoice.id,
        hasAudio: null
      };

      const isNewCombination = (
        lastAudioState.storyId !== currentState.storyId ||
        lastAudioState.chapterIndex !== currentState.chapterIndex ||
        lastAudioState.voiceId !== currentState.voiceId
      );

      if (!isNewCombination) {
        return; // No hacer nada si es la misma combinación
      }

      setIsLoading(true);
      setAudioUrl(null);
      
      // Limpiar toasts previos solo cuando cambiamos de combinación
      toastManager.clear();

      try {
        const url = await getAudioFromSupabase(storyId, currentChapterIndex, selectedVoice.id);
        
        const newStateWithAudio = {
          ...currentState,
          hasAudio: !!url
        };
        
        setLastAudioState(newStateWithAudio);
        
        if (url) {
          setAudioUrl(url);
          // Solo mostrar toast de éxito si es una nueva combinación
          if (isNewCombination) {
            toastManager.show('success', "Audio cargado correctamente");
          }
        } else {
          setAudioUrl(null);
          // Solo mostrar toast de info si es una nueva combinación
          if (isNewCombination) {
            toastManager.show('info', "No hay audio grabado para esta voz y capítulo");
          }
        }
      } catch (error) {
        console.error('Error loading audio:', error);
        setAudioUrl(null);
        setLastAudioState({
          ...currentState,
          hasAudio: false
        });
        
        if (isNewCombination) {
          toastManager.show('error', "Error al cargar el audio");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadAudio();
  }, [storyId, currentChapterIndex, selectedVoice?.id, chapters]);


  // Configurar Howler cuando cambia el audioUrl
  useEffect(() => {
    // Limpiar instancia anterior
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }

    // Limpiar timer de actualización
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!audioUrl) return;

    setIsLoading(true);

    // Crear nueva instancia de Howl
    const howl = new Howl({
      src: [audioUrl],
      html5: true, // Mejor para streaming
      preload: true,
      format: ['mp3'],
      onload: () => {
        setIsLoading(false);
        setDuration(howl.duration());
      },
      onloaderror: () => {
        setIsLoading(false);
        toastManager.show('error', "No se pudo cargar el audio", "Posible problema de CORS o formato");
      },
      onplay: () => {
        setIsPlaying(true);
        
        // Actualizar la posición cada 100ms durante la reproducción
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          if (howlRef.current) {
            setCurrentTime(howlRef.current.seek() as number);
          }
        }, 100);
      },
      onpause: () => {
        setIsPlaying(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      },
      onstop: () => {
        setIsPlaying(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      },
      onend: () => {
        setIsPlaying(false);
        setCurrentTime(howl.duration());
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      },
      onseek: () => {
        // Actualizar el tiempo cuando se busca manualmente
        if (howlRef.current) {
          setCurrentTime(howlRef.current.seek() as number);
        }
      }
    });

    // Establecer velocidad de reproducción
    howl.rate(playbackSpeed);
    
    // Guardar referencia
    howlRef.current = howl;
  }, [audioUrl]);

  // Actualizar velocidad de reproducción cuando cambia
  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.rate(playbackSpeed);
    }
  }, [playbackSpeed]);

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      if (howlRef.current) {
        howlRef.current.unload();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handlePreviewVoice = (voiceId: string) => {
   
    const url = PREVIEW_FILES[voiceId];
    if (!url) {
      toastManager.show('error', "Vista previa no disponible para esta voz");
      return;
    }
    setPreviewUrl(url);
    setShowPreviewModal(true);
  };

  // Handle voice change with arrow navigation
  const handlePreviousVoice = () => {
    toastManager.clear(); // Limpiar toasts al cambiar voz
    setVoiceIndex((prev) => (prev === 0 ? STORY_VOICES.length - 1 : prev - 1));
  };

  const handleNextVoice = () => {
    toastManager.clear(); // Limpiar toasts al cambiar voz
    setVoiceIndex((prev) => (prev === STORY_VOICES.length - 1 ? 0 : prev + 1));
  };

  // Handle playback speed change - cycle through speeds
  const handleSpeedChange = () => {
    setPlaybackSpeedIndex((prev) => (prev === PLAYBACK_SPEEDS.length - 1 ? 0 : prev + 1));
  };

  // Manejo de play/pause con Howler
  const handlePlayPause = () => {
    if (!audioUrl) {
      setShowGenerationPopup(true);
      return;
    }

    if (!howlRef.current) {
      toastManager.show('error', "Reproductor no inicializado");
      return;
    }

    if (isPlaying) {
      howlRef.current.pause();
    } else {
      howlRef.current.play();
    }
  };

  // Manejar el avance/retroceso en el slider
  const handleSeek = (value: number[]) => {
    if (!howlRef.current) return;
    
    const seekTime = value[0];
    howlRef.current.seek(seekTime);
    setCurrentTime(seekTime);
  };

  const handleEndedEvent = () => {
    setIsPlaying(false);
    setCurrentTime(duration);
  };

  // Generar audio
  const handleGenerateAudio = async () => {
    try {
      setIsLoading(true);
      setGenerationStatus(storyId || '', currentChapterIndex, 'generating', 10);
      setGenerationProgress(10);

      // Simular progreso
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          const newValue = prev + Math.random() * 15;
          const progress = newValue > 90 ? 90 : newValue;
          setGenerationStatus(storyId || '', currentChapterIndex, 'generating', progress);
          return progress;
        });
      }, 800);

      // Validar capítulo actual
      const chapter = chapters[currentChapterIndex];
      if (!chapter || !chapter.id) {
        toast.error("Error: No se pudo identificar el capítulo");
        setIsLoading(false);
        setShowGenerationPopup(false);
        clearInterval(progressInterval);
        setGenerationStatus(storyId || '', currentChapterIndex, 'error', 0);
        return;
      }

      // Liberar URL anterior y howl
      if (audioUrl) {
        setAudioUrl(null);
      }
      if (howlRef.current) {
        howlRef.current.unload();
        howlRef.current = null;
      }

      // Mapeo de voces para OpenAI
      const mappedVoice = CUSTOM_VOICE_MAPPING[selectedVoice.id] || 'nova';
      
      // Generar audio con OpenAI TTS
      const audioBlob = await generateSpeech({
        text: content,
        voice: mappedVoice,
        model: 'gpt-4o-mini-tts',
        instructions: selectedVoice.instructions
      });

      // Preparar para subir a Supabase
      const audioFile = new File([audioBlob], `${selectedVoice.id}_audio.mp3`, { type: 'audio/mpeg' });

      const formData = new FormData();
      formData.append('userId', user.id || '');
      formData.append('chapterId', chapter.id);
      formData.append('voiceId', selectedVoice.id);
      formData.append('audioFile', audioFile);
      formData.append('storyId', storyId || '');
      
      // Indicar fase de subida
      setGenerationStatus(storyId || '', currentChapterIndex, 'generating', 95);

      if (!supabase) {
        toast.error("Cliente Supabase no inicializado");
        setIsLoading(false);
        setShowGenerationPopup(false);
        clearInterval(progressInterval);
        setGenerationStatus(storyId || '', currentChapterIndex, 'error', 0);
        return;
      }

      // Invocar Edge Function para subir audio
      const { data: functionResponse, error: functionError } = await supabase.functions.invoke(
        'upload-chapter-audio',
        { body: formData }
      );

      clearInterval(progressInterval);

      if (functionError) {
        toast.error(`Error al subir el audio: ${functionError.message || 'Error desconocido'}`);
        setGenerationStatus(storyId || '', currentChapterIndex, 'error', 0);
        setIsLoading(false);
        setShowGenerationPopup(false);
        return;
      }

      if (functionResponse && functionResponse.publicUrl) {
        setAudioUrl(functionResponse.publicUrl);
        setGenerationStatus(storyId || '', currentChapterIndex, 'completed', 100);
        setShowGenerationPopup(false);
        setGenerationProgress(100);
        toast.success("Audio generado y guardado");
      } else {
        toast.error("Error al procesar la respuesta del servidor");
        setGenerationStatus(storyId || '', currentChapterIndex, 'error', 0);
      }
      
    } catch (error) {
      toast.error(`Error: ${error instanceof Error ? error.message : 'Problema desconocido'}`);
      setGenerationStatus(storyId || '', currentChapterIndex, 'error', 0);
    } finally {
      setIsLoading(false);
      setShowGenerationPopup(false);
    }
  };

  // Eliminar funciones de manejo de caché local
  const handleCleanAllAudio = () => {
    if (howlRef.current) {
      howlRef.current.pause();
      howlRef.current.unload();
      howlRef.current = null;
    }
    
    if (audioUrl) {
      setAudioUrl(null);
    }
    
    setIsPlaying(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: 'url("/fondo_png.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Overlay con el color de la voz seleccionada para mantener la identidad visual */}
      <div 
        className="absolute inset-0 z-0 opacity-70"
        style={{ backgroundColor: selectedVoice.color }}
      />
      
      {/* Content container with podcast player design */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl overflow-hidden bg-white/10 backdrop-blur-md shadow-2xl">
        {/* Header with podcast title - Restructured for better title visibility */}
        <div className="p-5 flex flex-col space-y-3">
          {/* Back button and title row - removed width constraints */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate(`/story/${storyId}`)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all flex-shrink-0"
            >
              <ArrowLeft size={20} className="text-gray-800" />
            </button>
            <h1 className="text-lg font-semibold text-gray-800 flex-grow">
              {title}
            </h1>
            {/* <button
              onClick={async () => {
                if (storyId) {
                  toast.info("Refrescando datos de capítulos...");
                  try {
                    await loadChaptersFromSupabase(storyId);
                    toast.success("Capítulos actualizados.");
                  } catch (error) {
                    toast.error("Error al actualizar capítulos.");
                  }
                }
              }}
              title="Refrescar capítulos"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
                <path d="M21 2v6h-6"></path>
                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                <path d="M3 12a9 9 0 0 0 6.7 15L13 22"></path>
                <path d="M14.3 19.1L21 22v-6"></path>
              </svg>
            </button> */}
          </div>
        </div>

        {/* Main content */}
        <div className="relative aspect-square overflow-hidden">
          {/* Waveform background */}
          <div className="absolute inset-0">
            <WaveForm
              isPlaying={isPlaying}
              color={selectedVoice.color}
              intensity={audioIntensity}
            />
          </div>

          {/* Center content with play button */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Narrator indicator - small and subtle */}
            <div className="mb-4 text-center w-32">
              <span className="text-lg opacity-80 text-gray-800">{selectedVoice.icon}</span>
              <p className="text-xs font-medium text-gray-800/80">{selectedVoice.name}</p>
            </div>

            {/* Play button */}
            <button
              onClick={handlePlayPause}
              disabled={isLoading}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg focus:outline-none hover:scale-105 transition-transform"
            >
              {isLoading ? (
                <AudioWaveLoading color={selectedVoice.color} />
              ) : isPlaying ? (
                <Pause className="w-10 h-10" style={{ color: selectedVoice.color }} />
              ) : (
                <Play className="w-10 h-10 ml-1" style={{ color: selectedVoice.color }} />
              )}
            </button>

            {/* Time display */}
            <div className="mt-8 text-center">
              <p className="text-sm font-medium text-gray-800/80">
                {formatTime(currentTime)} / {formatTime(duration || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Controls section */}
        <div className="px-5 pt-4 pb-5 bg-black/10">
          {/* Progress bar */}
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            disabled={!audioUrl}
            className="mb-5"
          />

          {/* Botón para escuchar al narrador */}
          <button
            onClick={() => handlePreviewVoice(selectedVoice.id)}
            className="w-full flex items-center justify-center py-2.5 px-4 rounded-full text-sm font-medium bg-white/20 text-gray-800 hover:bg-white/30 mt-0 mb-4 transition-all"
          >
            <Play size={18} className="mr-2 text-gray-800" />
            Voz de la narración
          </button>

          {/* Voice selector - moved to top of controls for better visibility */}
          <div className="mb-4 flex justify-center items-center bg-white/10 py-2 px-3 rounded-full">
            <button
              onClick={handlePreviousVoice}
              className="p-2 text-gray-800/80 hover:text-gray-800 flex-shrink-0"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="flex flex-col items-center mx-3 flex-grow">
              <span className="text-xl opacity-80 text-gray-800">{selectedVoice.icon}</span>
              <span className="text-sm font-medium text-gray-800/90">{selectedVoice.name}</span>
            </div>
            <button
              onClick={handleNextVoice}
              className="p-2 text-gray-800/80 hover:text-gray-800 flex-shrink-0"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          {/* Bottom controls row */}
          <div className="flex justify-between items-center">
            {/* Return to reading button - enlarged */}
            <button
              onClick={() => navigate(`/story/${storyId}`)}
              className="py-2.5 px-5 rounded-full text-sm font-medium bg-white/20 text-gray-800 hover:bg-white/30 flex-grow-0"
            >
              Volver a la lectura
            </button>
            
            {/* Playback speed - enlarged */}
            <button
              onClick={handleSpeedChange}
              className="py-2.5 px-5 rounded-full text-sm font-medium bg-white/20 text-gray-800 hover:bg-white/30 ml-3"
            >
              {playbackSpeed}x
            </button>
          </div>
        </div>
      </div>

      {/* Voice generation popup */}
      {showGenerationPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-3xl p-6 text-white shadow-2xl"
            style={{ backgroundColor: selectedVoice.color }}
          >
            <div className="text-center mb-4">
              <span className="text-5xl mb-4 inline-block">{selectedVoice.icon}</span>
              <h3 className="text-xl font-bold mb-2">{selectedVoice.name}</h3>
              <p className="text-gray-800 mb-5 text-sm">{selectedVoice.description}</p>

              {isLoading ? (
                <>
                  <div className="w-full bg-white/20 rounded-full h-2 mb-3">
                    <div
                      className="bg-white h-2 rounded-full transition-all duration-300"
                      style={{ width: `${generationProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-gray-800 text-sm">Generando audio, por favor espera...</p>
                </>
              ) : (
                <button
                  onClick={handleGenerateAudio}
                  className="w-full py-3 rounded-full bg-white/20 hover:bg-white/30 text-gray-800"
                >
                  Generar Audio
                </button>
              )}
            </div>

            {!isLoading && (
              <button
                onClick={() => setShowGenerationPopup(false)}
                className="w-full py-2 text-gray-800/80 hover:text-gray-800 hover:bg-white/10 text-sm"
              >
                Cancelar
              </button>
            )}
          </motion.div>
        </div>
      )}
      {previewUrl && (
        <PreviewVoiceModal
          voice={selectedVoice}
          url={previewUrl}
          open={showPreviewModal}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewUrl(null);
          }}
        />
      )}
    </div>
  );
}
