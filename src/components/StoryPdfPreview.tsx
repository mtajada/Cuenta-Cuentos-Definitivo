import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Loader2, Heart, Palette, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Progress } from "./ui/progress";
import { APP_CONFIG } from "../config/app";
import { StoryPdfService, ImageGenerationProgress } from "../services/storyPdfService";

interface StoryPdfPreviewProps {
  title: string;
  author?: string;
  content: string;
  onClose?: () => void;
  isOpen: boolean;
  storyId: string;
  chapterId: string;
}

export default function StoryPdfPreview({
  title,
  author,
  content,
  onClose,
  isOpen,
  storyId,
  chapterId
}: StoryPdfPreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingIllustrated, setIsGeneratingIllustrated] = useState(false);
  const [isValidatingImages, setIsValidatingImages] = useState(false);
  const [needsImageGeneration, setNeedsImageGeneration] = useState(false);
  const [showConfirmGeneration, setShowConfirmGeneration] = useState(false);
  const [imageValidationResult, setImageValidationResult] = useState<{
    canGenerate: boolean;
    reason?: string;
    missingImages?: string[];
  } | null>(null);
  const [generationProgress, setGenerationProgress] = useState<ImageGenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<'cover' | 'content' | 'backCover'>('cover');
  
  // Reset states when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setNeedsImageGeneration(false);
      setShowConfirmGeneration(false);
      setImageValidationResult(null);
      setGenerationProgress(null);
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const handleGenerateStandard = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      
      // Generate standard PDF using service
      const pdfBlob = await StoryPdfService.generateStandardPdf({
        title,
        author,
        content,
        storyId,
        chapterId
      });
      
      // Download PDF using service
      StoryPdfService.downloadPdf(pdfBlob, title, false);
      
      if (onClose) onClose();
    } catch (err) {
      console.error('[StoryPdfPreview] Error generating standard PDF:', err);
      setError('Ocurrió un error al generar el PDF. Por favor intenta nuevamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateIllustrated = async () => {
    try {
      setIsValidatingImages(true);
      setError(null);
      
      console.log('[StoryPdfPreview] Starting illustrated story generation...');
      
      // Check if images exist
      const validationResult = await StoryPdfService.canGenerateIllustratedPdf(storyId, chapterId);
      setImageValidationResult(validationResult);
      
      if (validationResult.canGenerate) {
        // Images exist, proceed directly with PDF generation
        console.log('[StoryPdfPreview] ✅ All required images exist. Proceeding with illustrated PDF generation...');
        await generateIllustratedPdfDirectly();
      } else {
        // Images missing, show confirmation dialog
        console.log('[StoryPdfPreview] ❌ Missing images detected:', validationResult.missingImages);
        setNeedsImageGeneration(true);
        setShowConfirmGeneration(true);
      }
      
    } catch (err) {
      console.error('[StoryPdfPreview] Error checking images:', err);
      setError('Ocurrió un error al verificar las imágenes. Por favor intenta nuevamente.');
    } finally {
      setIsValidatingImages(false);
    }
  };

  const handleConfirmImageGeneration = async () => {
    try {
      setShowConfirmGeneration(false);
      setIsGeneratingIllustrated(true);
      
      console.log('[StoryPdfPreview] User confirmed image generation. Starting complete illustrated PDF process...');
      
      // Generate illustrated PDF with automatic image generation and progress tracking
      const pdfBlob = await StoryPdfService.generateCompleteIllustratedPdf({
        title,
        author,
        content,
        storyId,
        chapterId,
        onProgress: (progress) => {
          setGenerationProgress(progress);
        }
      });
      
      // Download illustrated PDF
      StoryPdfService.downloadPdf(pdfBlob, title, true);
      
      if (onClose) onClose();
      
    } catch (err) {
      console.error('[StoryPdfPreview] Error generating complete illustrated PDF:', err);
      setError('Ocurrió un error al generar el cuento ilustrado. Por favor intenta nuevamente.');
    } finally {
      setIsGeneratingIllustrated(false);
      setGenerationProgress(null);
    }
  };

  const generateIllustratedPdfDirectly = async () => {
    try {
      setIsGeneratingIllustrated(true);
      
      // Validate required images exist in storage using service
      const imageValidation = await StoryPdfService.validateRequiredImages(storyId, chapterId);
      
      if (!imageValidation.allValid) {
        setError(`Faltan imágenes necesarias: ${imageValidation.missingImages.join(', ')}. Por favor, genera las imágenes del cuento primero.`);
        return;
      }
      
      console.log('[StoryPdfPreview] ✅ All required images validated. Proceeding with illustrated PDF generation...');
      
      // Generate illustrated PDF with validated image URLs
      const pdfBlob = await StoryPdfService.generateIllustratedPdf({
        title,
        author,
        content,
        storyId,
        chapterId,
        imageUrls: {
          cover: imageValidation.imageUrls!.cover!,
          scene_1: imageValidation.imageUrls!.scene_1!,
          scene_2: imageValidation.imageUrls!.scene_2!
        }
      });
      
      // Download illustrated PDF
      StoryPdfService.downloadPdf(pdfBlob, title, true);
      
      if (onClose) onClose();
      
    } catch (err) {
      console.error('[StoryPdfPreview] Error generating illustrated story:', err);
      setError('Ocurrió un error al generar el cuento ilustrado. Por favor intenta nuevamente.');
    } finally {
      setIsGeneratingIllustrated(false);
    }
  };

  const handleCancelGeneration = () => {
    setShowConfirmGeneration(false);
    setNeedsImageGeneration(false);
    setImageValidationResult(null);
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Cabecera */}
        <div className="p-4 bg-[#BB79D1] text-white">
          <h2 className="text-xl font-bold">Generar versión imprimible</h2>
        </div>
        
        {/* Cuerpo */}
        <div className="p-6">
          {/* Selector de vista previa */}
          <div className="flex justify-center space-x-3 mb-4">
            <button 
              className={`px-4 py-1 rounded-full transition-all ${activePreview === 'cover' 
                ? 'bg-[#BB79D1] text-white' 
                : 'bg-gray-100 hover:bg-gray-200'}`}
              onClick={() => setActivePreview('cover')}
            >
              Portada
            </button>
            <button 
              className={`px-4 py-1 rounded-full transition-all ${activePreview === 'content' 
                ? 'bg-[#BB79D1] text-white' 
                : 'bg-gray-100 hover:bg-gray-200'}`}
              onClick={() => setActivePreview('content')}
            >
              Contenido
            </button>
            <button 
              className={`px-4 py-1 rounded-full transition-all ${activePreview === 'backCover' 
                ? 'bg-[#BB79D1] text-white' 
                : 'bg-gray-100 hover:bg-gray-200'}`}
              onClick={() => setActivePreview('backCover')}
            >
              Contraportada
            </button>
          </div>
          
          {/* Vista previa según la selección */}
          {activePreview === 'cover' && (
            <div className="mb-6 bg-[#fff6e0] p-4 rounded-lg border border-amber-200 h-80 flex flex-col justify-center">
              <div className="text-center">
                <img 
                  src="/logo_png.png" 
                  alt={APP_CONFIG.name} 
                  className="h-16 mx-auto mb-4"
                />
                <h3 className="text-xl font-bold text-[#BB79D1] mb-1">{title}</h3>
                {author && (
                  <p className="text-gray-600 italic">por {author}</p>
                )}
              </div>
            </div>
          )}
          
          {activePreview === 'content' && (
            <div className="mb-6 bg-[#fff6e0] p-4 rounded-lg border border-amber-200">
              <p className="text-sm text-gray-600 mb-2">
                Vista previa del contenido:
              </p>
              
              <div className="max-h-64 overflow-y-auto text-base border border-amber-100 p-3 rounded bg-white">
                {content.split("\n").slice(0, 5).map((paragraph, i) => (
                  <p key={i} className="mb-2 font-bold text-[#ce9789]">
                    {paragraph || "..."}
                  </p>
                ))}
                {content.split("\n").length > 5 && (
                  <p className="text-gray-400 italic text-sm text-center mt-2">
                    (más contenido no mostrado en la vista previa)
                  </p>
                )}
              </div>
            </div>
          )}
          
          {activePreview === 'backCover' && (
            <div className="mb-6 bg-[#fff6e0] p-4 rounded-lg border border-amber-200 h-80 flex flex-col justify-center">
              <div className="text-center">
                <img 
                  src="/logo_png.png" 
                  alt={APP_CONFIG.name} 
                  className="h-16 mx-auto mb-6"
                />
                <p className="text-[#BB79D1] font-bold mb-1 text-base">
                  Generado con <Heart className="inline h-4 w-4 mx-0.5 fill-[#BB79D1]" /> por
                </p>
                <h3 className="text-2xl font-bold text-[#ce9789] mb-4">{APP_CONFIG.name}!</h3>
                <p className="text-gray-500 text-sm">{new Date().getFullYear()}</p>
              </div>
            </div>
          )}
          
          {/* Progress Bar y Confirmation Dialog - COMENTADOS PARA DEMO */}
          {generationProgress && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center mb-2">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  {generationProgress.currentStep}
                </span>
              </div>
              <Progress value={generationProgress.progress} className="mb-2" />
              <div className="text-xs text-blue-600">
                {generationProgress.progress.toFixed(0)}% completado
                {generationProgress.currentImageType && (
                  <span className="ml-2">• {generationProgress.currentImageType}</span>
                )}
              </div>
            </div>
          )}

          {showConfirmGeneration && imageValidationResult && !imageValidationResult.canGenerate && (
            <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-orange-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-orange-800 mb-2">
                    Generación de imágenes requerida
                  </h4>
                  <p className="text-sm text-orange-700 mb-3">
                    Para generar el cuento ilustrado necesitamos llenarlo de magia con imágenes y color. 
                  </p>
                  <p className="text-sm text-orange-700 mb-4">
                    Este proceso puede tomar 2-3 minutos. ¿Deseas continuar?
                  </p>
                  <div className="flex space-x-3">
                    <Button
                      onClick={handleConfirmImageGeneration}
                      disabled={isGeneratingIllustrated}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                      size="sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Sí, generar imágenes
                    </Button>
                    <Button
                      onClick={handleCancelGeneration}
                      variant="outline"
                      size="sm"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Opciones de generación */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Generar PDF:</h3>
            
            {/* Opción 1: Formato TaleMe */}
            <div className="mb-3 p-4 border border-pink-200 rounded-lg bg-pink-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <FileText className="h-5 w-5 text-pink-600 mr-2" />
                    <h4 className="font-semibold text-pink-800">Cuento Formato TaleMe!</h4>
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      GRATIS
                    </span>
                  </div>
                  <p className="text-sm text-pink-700">
                    PDF con el formato tradicional de TaleMe (solo texto)
                  </p>
                </div>
                <Button
                  onClick={handleGenerateStandard}
                  disabled={isGenerating}
                  className="ml-4 bg-[#F6A5B7] hover:bg-[#F6A5B7]/90"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>Generar</>
                  )}
                </Button>
              </div>
            </div>

            {/* Opción 2: Cuento Ilustrado - COMENTADO PARA DEMO */}
            <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <Palette className="h-5 w-5 text-purple-600 mr-2" />
                    <h4 className="font-semibold text-purple-800">Cuento Ilustrado</h4>
                    <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                      8,99€
                    </span>
                  </div>
                  <p className="text-sm text-purple-700">
                    PDF con imágenes generadas por IA que ilustran el cuento
                  </p>
                </div>
                <Button
                  onClick={handleGenerateIllustrated}
                  disabled={isGeneratingIllustrated || isGenerating || isValidatingImages || showConfirmGeneration}
                  className="ml-4 bg-purple-600 hover:bg-purple-700"
                >
                  {isValidatingImages ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validando...
                    </>
                  ) : isGeneratingIllustrated ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>Generar</>
                  )}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isGenerating}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// NOTA: Las siguientes funciones están temporalmente comentadas para la demo
// pero siguen disponibles para cuando se reactive la funcionalidad ilustrada:
// - handleGenerateIllustrated
// - handleConfirmImageGeneration
// - generateIllustratedPdfDirectly
// - handleCancelGeneration
// - Estados: isGeneratingIllustrated, isValidatingImages, needsImageGeneration, 
//   showConfirmGeneration, imageValidationResult, generationProgress