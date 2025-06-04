import { useState, useEffect, useRef } from "react";
import { Play, Pause, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { generateSpeech, OPENAI_VOICES, OpenAIVoiceType } from "@/services/ai/ttsService";
import { useAudioStore } from "@/store/stories/audio/audioStore";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

// Voice types with their details
export const STORY_VOICES = [
  { 
    id: "el-sabio", 
    name: "El Sabio", 
    description: "Voz grave y serena, ideal para transmitir conocimiento.",
    color: "bg-blue-500",
    icon: "📚"
  },
  { 
    id: "el-capitan", 
    name: "El Capitán", 
    description: "Voz ruda y aventurera, perfecta para historias de acción.",
    color: "bg-red-600",
    icon: "⚓"
  },
  { 
    id: "el-animado", 
    name: "El Animado", 
    description: "Voz aguda y caricaturesca, ideal para historias divertidas.",
    color: "bg-green-500",
    icon: "🎭"
  },
  { 
    id: "el-elegante", 
    name: "El Elegante", 
    description: "Voz refinada y clara, perfecta para cuentos sofisticados.",
    color: "bg-purple-500",
    icon: "🎩"
  },
  { 
    id: "el-aventurero", 
    name: "El Aventurero", 
    description: "Voz dinámica y entusiasta, ideal para historias de aventuras.",
    color: "bg-amber-500",
    icon: "🗺️"
  },
  { 
    id: "el-enigmatico", 
    name: "El Enigmático", 
    description: "Voz pausada y misteriosa, perfecta para cuentos intrigantes.",
    color: "bg-indigo-700",
    icon: "🔮"
  },
  { 
    id: "el-risueno", 
    name: "El Risueño", 
    description: "Voz juguetona y con inflexiones cómicas, para historias alegres.",
    color: "bg-yellow-500",
    icon: "😄"
  },
  { 
    id: "el-tierno", 
    name: "El Tierno", 
    description: "Voz suave y amigable, ideal para cuentos dulces y tiernos.",
    color: "bg-pink-400",
    icon: "🌸"
  }
];

// Function to format time
const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface StoryAudioPlayerProps {
  text: string;
  onClose: () => void;
}

export default function StoryAudioPlayer({ text, onClose }: StoryAudioPlayerProps) {
  const { 
    addAudioToCache, 
    getAudioFromCache, 
    setGenerationStatus, 
    getGenerationStatus,
    setCurrentVoice,
    getCurrentVoice
  } = useAudioStore();
  
  const { canGenerateVoice, isPremium, getRemainingMonthlyVoiceGenerations, getAvailableVoiceCredits } = useAuth();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<typeof STORY_VOICES[0]>(() => {
    const savedVoiceId = getCurrentVoice();
    if (savedVoiceId) {
      const voiceIdx = STORY_VOICES.findIndex(v => v.id === savedVoiceId);
      if (voiceIdx !== -1) {
        return STORY_VOICES[voiceIdx];
      }
    }
    return STORY_VOICES[0];
  });
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showGenerationPopup, setShowGenerationPopup] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Guardar la voz seleccionada en el store
  useEffect(() => {
    setCurrentVoice(selectedVoice.id);
  }, [selectedVoice.id, setCurrentVoice]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (audioUrl && !audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Update time display
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && audioRef.current) {
      interval = setInterval(() => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Update duration when metadata is loaded
  useEffect(() => {
    if (audioRef.current) {
      const handleLoadedMetadata = () => {
        setDuration(audioRef.current?.duration || 0);
      };

      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => {
        audioRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, []);

  // Update audio source when URL changes
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      if (audioUrl.startsWith('blob:')) {
        audioRef.current.src = audioUrl;
      } else {
        fetch(audioUrl)
          .then(response => response.blob())
          .then(blob => {
            const audioObjUrl = URL.createObjectURL(new Blob([blob], { type: 'audio/mp4' }));
            audioRef.current.src = audioObjUrl;
          });
      }
      audioRef.current.load();
    }
  }, [audioUrl]);

  // Update playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const handlePlayPause = async () => {
    if (!audioUrl) {
      setShowGenerationPopup(true);
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play().catch(error => {
            console.error('Safari playback error:', error);
            toast.error("Safari requiere interacción directa - Haz click primero en el botón");
          });
          setIsPlaying(true);
        } catch (error) {
          console.error('Error starting playback:', error);
          setIsPlaying(false);
          toast.error("No se pudo reproducir el audio");
        }
      }
    }
  };

  const handleGenerateAudio = async () => {
    // Verificar si el usuario puede generar audio según su plan y límites
    if (!canGenerateVoice()) {
      const isPremiumUser = isPremium();
      const remainingGenerations = getRemainingMonthlyVoiceGenerations();
      const availableCredits = getAvailableVoiceCredits();
      
      if (isPremiumUser && remainingGenerations <= 0) {
        toast.error("Has alcanzado el límite mensual de generaciones de voz para tu plan premium.");
        return;
      } else if (!isPremiumUser && availableCredits <= 0) {
        toast.error("No tienes créditos disponibles para generar audio. Actualiza a premium para obtener más generaciones mensuales.");
        return;
      }
    }
    
    try {
      setIsLoading(true);
      // Usamos un ID temporal para identificar la generación
      const tempId = "temp-audio";
      
      setGenerationStatus(tempId, "chapter", 'generating', 10);
      setGenerationProgress(10);
      
      // Simulate generation progress (in real implementation, you would get actual progress)
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
          const newValue = prev + Math.random() * 15;
          const progress = newValue > 90 ? 90 : newValue;
          setGenerationStatus(tempId, "chapter", 'generating', progress);
          return progress;
        });
      }, 800);

      // Mapeo de voces de la historia a las voces de OpenAI
      const voiceApiMapping: {[key: string]: OpenAIVoiceType} = {
        "el-sabio": "sage",
        "el-capitan": "onyx",
        "el-animado": "ash",
        "el-elegante": "alloy",
        "el-aventurero": "echo",
        "el-enigmatico": "fable",
        "el-risueno": "nova",
        "el-tierno": "coral"
      };
      
      // Instrucciones específicas según el tipo de narrador
      const narratorInstructions: {[key: string]: string} = {
        "el-sabio": "Narra con un tono grave y reflexivo, haciendo pausas significativas entre oraciones importantes.",
        "el-capitan": "Narra con energía y autoridad, enfatizando las palabras de acción y aventura.",
        "el-animado": "Narra con entusiasmo y diversión, variando el tono para mantener la atención de los niños.",
        "el-elegante": "Narra con un tono refinado y sofisticado, articulando cada palabra con claridad.",
        "el-aventurero": "Narra con emoción y dinamismo, acelerando el ritmo en los momentos de acción.",
        "el-enigmatico": "Narra con un tono misterioso y pausado, generando intriga en cada frase.",
        "el-risueno": "Narra con alegría y optimismo, transmitiendo positividad en la historia.",
        "el-tierno": "Narra con dulzura y calidez, creando un ambiente íntimo y reconfortante."
      };

      // Generar el audio con la nueva API
      const audioBlob = await generateSpeech({
        text,
        voice: voiceApiMapping[selectedVoice.id] || "nova",
        model: 'gpt-4o-mini-tts',
        instructions: narratorInstructions[selectedVoice.id]
      });

      // Crear URL para el blob
      const audioObjUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(audioObjUrl);
      
      // Guardar en caché
      addAudioToCache(tempId, "chapter", selectedVoice.id, audioObjUrl);
      setGenerationStatus(tempId, "chapter", 'completed', 100);
      
      setShowGenerationPopup(false);
      setIsPlaying(true);

      clearInterval(progressInterval);
      setGenerationProgress(100);

      // Reproducir automáticamente después de la generación
      if (audioRef.current) {
        try {
          await audioRef.current.play().catch(error => {
            console.error('Safari playback error:', error);
            toast.error("Safari requiere interacción directa - Haz click primero en el botón");
          });
          setIsPlaying(true);
        } catch (error) {
          console.error('Error auto-playing after generation:', error);
        }
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      toast.error("Error al generar el audio");
      setGenerationStatus("temp-audio", "chapter", 'error', 0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVoiceChange = (voice: typeof STORY_VOICES[0]) => {
    setSelectedVoice(voice);
    setAudioUrl(null);
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  };

  const handleEndedEvent = () => {
    setIsPlaying(false);
    setCurrentTime(duration);
  };

  const handleClose = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "w-full max-w-md mx-auto rounded-3xl overflow-hidden shadow-2xl",
        selectedVoice.color
      )}
    >
      {/* Header with title */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white truncate pr-4">{}</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleClose}
            className="rounded-full text-white hover:bg-white/20"
          >
            <X size={24} />
          </Button>
        </div>
      </div>

      {/* Main player area */}
      <div className="bg-white/15 backdrop-blur-lg p-8 text-white">
        {/* Voice indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="text-4xl">{selectedVoice.icon}</span>
          <div className="text-center">
            <p className="text-lg font-semibold">Narrado por</p>
            <p className="text-2xl font-bold">{selectedVoice.name}</p>
          </div>
        </div>

        {/* Play button */}
        <div className="flex justify-center mb-8">
          <Button
            onClick={handlePlayPause}
            disabled={isLoading}
            className={cn(
              "w-24 h-24 rounded-full border-4 border-white/30",
              "flex items-center justify-center",
              "bg-white/20 hover:bg-white/30 transition-all"
            )}
          >
            {isLoading ? (
              <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-12 h-12" />
            ) : (
              <Play className="w-12 h-12 ml-2" />
            )}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            disabled={!audioUrl}
            className="mb-2"
          />
          <div className="flex justify-between text-sm">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback speed */}
        <div className="mb-4">
          <p className="text-sm mb-2">Velocidad de reproducción</p>
          <div className="flex justify-between gap-2">
            {PLAYBACK_SPEEDS.map(speed => (
              <Button
                key={speed}
                variant={playbackSpeed === speed ? "default" : "outline"}
                size="sm"
                onClick={() => handlePlaybackSpeedChange(speed)}
                className={cn(
                  "flex-1 rounded-full",
                  playbackSpeed === speed 
                    ? "bg-white/30 text-white" 
                    : "bg-transparent text-white border-white/50 hover:bg-white/20"
                )}
              >
                {speed}x
              </Button>
            ))}
          </div>
        </div>

        {/* Voice selector */}
        <div>
          <p className="text-sm mb-2">Seleccionar narrador</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {STORY_VOICES.map(voice => (
              <Button
                key={voice.id}
                variant="ghost"
                size="sm"
                onClick={() => handleVoiceChange(voice)}
                className={cn(
                  "aspect-square p-1 flex items-center justify-center",
                  "rounded-xl border-2 transition-all",
                  selectedVoice.id === voice.id 
                    ? "border-white bg-white/20" 
                    : "border-transparent hover:border-white/50 hover:bg-white/10"
                )}
                title={voice.name}
              >
                <span className="text-2xl">{voice.icon}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Return button */}
        <Button
          variant="outline"
          className="w-full mt-4 rounded-full border-white/50 text-white hover:bg-white/20 hover:text-white"
          onClick={handleClose}
        >
          Volver a la lectura
        </Button>
      </div>

      {/* Audio element (hidden) */}
      <audio
        ref={audioRef}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={handleEndedEvent}
        className="hidden"
      />

      {/* Voice generation popup */}
      {showGenerationPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "w-full max-w-md rounded-3xl p-8 text-white shadow-2xl",
              selectedVoice.color
            )}
          >
            <div className="text-center mb-6">
              <span className="text-5xl mb-4 inline-block">{selectedVoice.icon}</span>
              <h3 className="text-2xl font-bold mb-2">{selectedVoice.name}</h3>
              <p className="text-white/90 mb-6">{selectedVoice.description}</p>
              
              {isLoading ? (
                <>
                  <div className="w-full bg-white/20 rounded-full h-2 mb-4">
                    <div 
                      className="bg-white h-2 rounded-full" 
                      style={{ width: `${generationProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-white/80">Generando audio, por favor espera...</p>
                </>
              ) : (
                <button
                  onClick={handleGenerateAudio}
                  disabled={isLoading || !canGenerateVoice()}
                  className={cn(
                    "flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-full font-medium shadow-md hover:from-purple-600 hover:to-indigo-700 transition-all",
                    (isLoading || !canGenerateVoice()) && "opacity-70 cursor-not-allowed"
                  )}
                  title={!canGenerateVoice() ? "Has alcanzado el límite de generaciones de voz" : ""}
                >
                  {isLoading ? (
                    <>Generando... {Math.round(generationProgress)}%</>
                  ) : (
                    <>
                      Generar Audio
                      {!canGenerateVoice() && <AlertCircle className="ml-1 h-4 w-4" />}
                    </>
                  )}
                </button>
              )}
            </div>
            
            {!isLoading && (
              <Button
                variant="ghost"
                onClick={() => setShowGenerationPopup(false)}
                className="w-full text-white/80 hover:text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
