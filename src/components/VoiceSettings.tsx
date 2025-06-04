import { useState, useEffect } from 'react';
import { Volume2, ChevronDown, AlertCircle } from 'lucide-react';
import { getAvailableVoices } from '../services/ai/ttsService';
import { useAuth } from '../context/AuthContext';

interface Voice {
  id: string;
  description: string;
}

interface VoiceSettingsProps {
  onSettingsChange: (settings: {
    voiceId: string;
  }) => void;
  className?: string;
}

export default function VoiceSettings({ onSettingsChange, className = '' }: VoiceSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Obtener selectores del userStore
  const {
    isPremium,
    canGenerateVoice,
    getRemainingMonthlyVoiceGenerations,
    getAvailableVoiceCredits
  } = useAuth();

  // Cargar las voces disponibles
  useEffect(() => {
    const loadVoices = async () => {
      setIsLoading(true);
      try {
        const availableVoices = await getAvailableVoices();
        setVoices(availableVoices);
        
        // Seleccionar la primera voz por defecto
        const defaultVoice = availableVoices[0];
        setSelectedVoice(defaultVoice);
        
        onSettingsChange({
          voiceId: defaultVoice.id
        });
      } catch (error) {
        console.error('Error cargando voces:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadVoices();
  }, []);

  const handleVoiceChange = (voice: Voice) => {
    setSelectedVoice(voice);
    onSettingsChange({
      voiceId: voice.id
    });
    setIsOpen(false);
  };

  const toggleSettings = () => {
    setIsOpen(!isOpen);
  };

  // Obtener información de límites
  const remainingMonthly = getRemainingMonthlyVoiceGenerations();
  const availableCredits = getAvailableVoiceCredits();
  const canGenerate = canGenerateVoice();

  return (
    <div className={`voice-settings ${className}`}>
      <div className="text-center mb-2 text-white/90 text-sm font-medium">
        Personalizar narración
      </div>
      
      <div className="mb-6 relative">
        <button
          onClick={toggleSettings}
          className="w-full flex items-center justify-between p-4 bg-white/10 hover:bg-white/15 rounded-xl text-white text-sm backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          disabled={isLoading || !selectedVoice}
        >
          <div className="flex items-center gap-2">
            <Volume2 size={18} className="text-purple-200" />
            <span>{selectedVoice?.description || 'Cargando voces...'}</span>
          </div>
          <ChevronDown size={18} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <div className="absolute mt-1 w-full rounded-xl p-2 bg-white/10 backdrop-blur-xl z-10 animate-fadeIn shadow-xl">
            {voices.map((voice) => (
              <button
                key={voice.id}
                onClick={() => handleVoiceChange(voice)}
                className={`w-full text-left p-3 my-1 rounded-lg flex items-center transition-colors hover:bg-white/10 ${
                  selectedVoice?.id === voice.id ? 'bg-white/20 font-medium' : ''
                }`}
              >
                <span className={`h-2 w-2 rounded-full mr-3 ${voice.description.includes('Femenina') ? 'bg-pink-400' : 'bg-blue-400'}`}></span>
                {voice.description}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Información de límites de generación de voz */}
      {isPremium() ? (
        <div className="text-center text-sm text-white/80">
          {canGenerate ? (
            <div className="flex flex-col gap-1">
              <div className="font-medium text-green-300">
                {remainingMonthly > 0 ? (
                  <span>Te quedan {remainingMonthly} generaciones gratuitas</span>
                ) : (
                  <span>Has usado todas tus generaciones mensuales</span>
                )}
              </div>
              {availableCredits > 0 && (
                <div className="text-purple-300">
                  Tienes {availableCredits} créditos adicionales
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-amber-300">
              <AlertCircle size={16} />
              <span>Necesitas comprar más créditos para generar audio</span>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-sm text-amber-300 flex items-center justify-center gap-2">
          <AlertCircle size={16} />
          <span>Necesitas una suscripción premium para narrar historias</span>
        </div>
      )}
    </div>
  );
}
