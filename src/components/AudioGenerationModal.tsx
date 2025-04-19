import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { generateSpeech } from "@/services/ai/ttsService";
import { toast } from "sonner";

interface AudioGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AudioGenerationModal({ isOpen, onClose }: AudioGenerationModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handlePlayPause = async () => {
    if (!audioUrl) {
      await handleGenerateAudio();
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (error) {
          console.error('Error starting playback:', error);
          toast.error("No se pudo reproducir el audio");
        }
      }
    }
  };

  const handleGenerateAudio = async () => {
    try {
      setIsLoading(true);
      
      const testText = "Gracias por escuhar mi cuenta cuento, estoy contento de verte";
      
      const audioBlob = await generateSpeech({
        text: testText,
        voice: "nova",
        model: 'gpt-4o-mini-tts'
      });

      const audioObjUrl = URL.createObjectURL(audioBlob);
      
      // Primero limpiamos la URL anterior si existe
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      // Actualizamos la URL y la fuente del audio
      setAudioUrl(audioObjUrl);
      if (audioRef.current) {
        audioRef.current.src = audioObjUrl;
        audioRef.current.load();
      }
      
      toast.success("Audio generado correctamente");
    } catch (error) {
      console.error('Error generating audio:', error);
      toast.error("Error al generar el audio");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Prueba de Audio</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePlayPause}
            disabled={isLoading}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          {!audioUrl && (
            <Button
              onClick={handleGenerateAudio}
              disabled={isLoading}
            >
              {isLoading ? "Generando..." : "Generar Audio"}
            </Button>
          )}
        </div>

        {/* Audio element (hidden) */}
        <audio
          ref={audioRef}
          className="hidden"
        />
      </DialogContent>
    </Dialog>
  );
} 