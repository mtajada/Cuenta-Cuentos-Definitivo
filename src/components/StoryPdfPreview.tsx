import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import { Loader2, Heart, Palette, FileText, CheckCircle, AlertCircle, Download } from "lucide-react";
import { Progress } from "./ui/progress";
import { APP_CONFIG } from "../config/app";
import { StoryPdfService, ImageGenerationProgress } from "../services/storyPdfService";
import { supabase } from "../supabaseClient";
import { useToast } from "../hooks/use-toast";
import { useLocation } from "react-router-dom";

interface StoryPdfPreviewProps {
  title: string;
  author?: string;
  content: string;
  onClose?: () => void;
  isOpen: boolean;
  storyId: string;
  chapterId: string;
  paymentSuccess?: boolean;
  sessionId?: string | null;
}

export default function StoryPdfPreview({
  title,
  author,
  content,
  onClose,
  isOpen,
  storyId,
  chapterId,
  paymentSuccess: externalPaymentSuccess = false,
  sessionId: externalSessionId = null
}: StoryPdfPreviewProps) {
  const { toast } = useToast();
  const location = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingIllustrated, setIsGeneratingIllustrated] = useState(false);
  const [isValidatingImages, setIsValidatingImages] = useState(false);
  const [needsImageGeneration, setNeedsImageGeneration] = useState(false);
  const [showConfirmGeneration, setShowConfirmGeneration] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [imageValidationResult, setImageValidationResult] = useState<{
    canGenerate: boolean;
    reason?: string;
    missingImages?: string[];
  } | null>(null);
  const [imagesExist, setImagesExist] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<ImageGenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<'cover' | 'content' | 'backCover'>('cover');
  
  // New states for payment success flow
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Reset states when modal opens and check for existing images
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setNeedsImageGeneration(false);
      setShowConfirmGeneration(false);
      setImageValidationResult(null);
      setGenerationProgress(null);
      setImagesExist(false);
      
      // Check if images already exist when modal opens
      const checkExistingImages = async () => {
        try {
          const validationResult = await StoryPdfService.canGenerateIllustratedPdf(storyId, chapterId);
          setImagesExist(validationResult.canGenerate);
          setImageValidationResult(validationResult);
        } catch (error) {
          console.error('[StoryPdfPreview] Error checking existing images:', error);
        }
      };
      
      checkExistingImages();
    }
  }, [isOpen, storyId, chapterId]);

  const startGenerationProcess = useCallback(async (sessionId: string) => {
    try {
      // Get session data from Stripe to verify payment
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('get-checkout-session', {
        body: { sessionId }
      });

      if (sessionError || !sessionData) {
        throw new Error('No se pudo verificar el pago');
      }

      // Payment verified - just show success message
      toast({
        title: '¡Pago exitoso!',
        description: 'Ahora puedes generar y descargar tu cuento ilustrado.',
        variant: 'default'
      });

    } catch (error) {
      console.error('Error verificando el pago:', error);
      toast({
        title: 'Error',
        description: 'Hubo un problema al verificar tu pago. Contacta soporte.',
        variant: 'destructive'
      });
    }
  }, [toast]);

    // Check for payment success when component mounts or external props change
  useEffect(() => {
    // First check external props (from StoryViewer)
    if (externalPaymentSuccess && externalSessionId) {
      console.log('[StoryPdfPreview] External payment success detected, starting generation...');
      setPaymentSuccess(true);
      setSessionId(externalSessionId);
      startGenerationProcess(externalSessionId);
      return;
    }

    // Fallback to URL params (legacy behavior)
    const checkPaymentSuccess = () => {
      const urlParams = new URLSearchParams(location.search);
      const paymentSuccessParam = urlParams.get('payment_success');
      const sessionIdParam = urlParams.get('session_id');
      const storyIdParam = urlParams.get('story_id');
      const chapterIdParam = urlParams.get('chapter_id');

      if (paymentSuccessParam === 'true' && sessionIdParam && 
          storyIdParam === storyId && chapterIdParam === chapterId) {
        console.log('[StoryPdfPreview] URL payment success detected, starting generation...');
        setPaymentSuccess(true);
        setSessionId(sessionIdParam);
        startGenerationProcess(sessionIdParam);
        
        // Clean URL parameters
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    };

    if (isOpen) {
      checkPaymentSuccess();
    }
  }, [isOpen, location.search, storyId, chapterId, externalPaymentSuccess, externalSessionId, startGenerationProcess]);

  const handleDownloadIllustratedPdf = async () => {
    try {
      setIsGeneratingIllustrated(true);
      
      console.log('[StoryPdfPreview] Starting complete illustrated PDF generation using stable service...');
      console.log(`[StoryPdfPreview_DEBUG] Using storyId: ${storyId}, chapterId: ${chapterId}`);
      
      // Use the stable StoryPdfService implementation
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
      
      toast({
        title: '¡Éxito!',
        description: 'Tu cuento ilustrado se ha descargado correctamente.',
        variant: 'default'
      });

      if (onClose) onClose();
      
    } catch (err) {
      console.error('[StoryPdfPreview] Error generating complete illustrated PDF:', err);
      setError('Ocurrió un error al generar el cuento ilustrado. Por favor intenta nuevamente.');
      
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo generar el cuento ilustrado.',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingIllustrated(false);
      setGenerationProgress(null);
    }
  };
   
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

  /**
   * @description Handles illustrated story generation without payment validation (TEMPORARY)
   * TODO: Re-enable payment validation when ready
   */
  const handleGenerateIllustrated = async () => {
    try {
      setIsValidatingImages(true);
      setError(null);
      
      console.log('[StoryPdfPreview] Starting illustrated story generation (NO PAYMENT VALIDATION)...');
      
      // Check if images exist
      const validationResult = await StoryPdfService.canGenerateIllustratedPdf(storyId, chapterId);
      setImageValidationResult(validationResult);
      setImagesExist(validationResult.canGenerate);
      
      if (validationResult.canGenerate) {
        // Images exist, proceed directly with PDF generation and download
        console.log('[StoryPdfPreview] ✅ All required images exist. Proceeding with illustrated PDF generation and download...');
        await handleDownloadIllustratedPdf();
      } else {
        // TEMPORARY: Generate images directly without payment
        // TODO: Uncomment below to re-enable payment flow
        // console.log('[StoryPdfPreview] ❌ Missing images detected:', validationResult.missingImages);
        // setNeedsImageGeneration(true);
        // setShowConfirmGeneration(true);
        
        // TEMPORARY: Direct generation without payment
        console.log('[StoryPdfPreview] ⚠️ Missing images detected, generating directly WITHOUT payment...');
        await handleDownloadIllustratedPdf();
      }
      
    } catch (err) {
      console.error('[StoryPdfPreview] Error checking images:', err);
      setError('Ocurrió un error al verificar las imágenes. Por favor intenta nuevamente.');
    } finally {
      setIsValidatingImages(false);
    }
  };

  const handleConfirmImageGeneration = async () => {
    // This now redirects to payment instead of generating
    await handleCheckout();
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
          scene_2: imageValidation.imageUrls!.scene_2!,
          scene_3: imageValidation.imageUrls!.scene_3!,
          scene_4: imageValidation.imageUrls!.scene_4!
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

  const handleCheckout = async () => {
    setIsCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: JSON.stringify({ 
          item: 'illustrated_story',
          storyId,
          chapterId,
          title,
          author
          // Removed content to avoid Stripe metadata limit
        }),
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No se recibió URL de checkout.');
      }
    } catch (error: Error | unknown) {
      console.error('Error creating illustrated story checkout session:', error);
      toast({ 
        title: 'Error', 
        description: `No se pudo iniciar el pago: ${error instanceof Error ? error.message : 'Error desconocido'}`, 
        variant: 'destructive' 
      });
      setIsCheckoutLoading(false);
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
          
          {/* Progress Bar y Confirmation Dialog */}
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

          {/* Payment success and download button */}
          {paymentSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-green-800 mb-2">
                    ¡Pago exitoso!
                  </h4>
                  <p className="text-sm text-green-700 mb-3">
                    Tu pago ha sido procesado correctamente. Ahora puedes generar y descargar tu cuento ilustrado.
                  </p>
                  <Button
                    onClick={handleDownloadIllustratedPdf}
                    disabled={isGeneratingIllustrated}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white disabled:bg-gray-400 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold"
                    size="sm"
                  >
                    {isGeneratingIllustrated ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <div className="flex items-center mr-2 relative">
                          <Download className="h-4 w-4 animate-bounce" />
                          <div className="absolute h-4 w-4 bg-white/20 rounded-full animate-ping"></div>
                        </div>
                        Ya puedes descargar tu libro
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {showConfirmGeneration && imageValidationResult && !imageValidationResult.canGenerate && !paymentSuccess && (
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
                    <span  className="font-bold">Este proceso puede tomar 2-3 minutos después de la compra. ¿Deseas continuar con el pago?</span>
                  </p>
                  <div className="flex space-x-3">
                    <Button
                      onClick={handleConfirmImageGeneration}
                      disabled={isCheckoutLoading}
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                      size="sm"
                    >
                      {isCheckoutLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Sí, pagar y generar (2.98€)
                        </>
                      )}
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

            {/* Opción 2: Cuento Ilustrado */}
            <div className="p-4 border border-purple-200 rounded-lg bg-purple-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <Palette className="h-5 w-5 text-purple-600 mr-2" />
                    <h4 className="font-semibold text-purple-800">Cuento Ilustrado</h4>
                    {/* TEMPORARY: Free while payment is disabled */}
                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                      GRATIS (temporal)
                    </span>
                    {/* TODO: Re-enable price tag when payment is re-enabled
                    <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                      2.98€
                    </span>
                    */}
                  </div>
                  <p className="text-sm text-purple-700">
                    PDF con imágenes generadas por IA que ilustran el cuento
                  </p>
                </div>
                <Button
                  onClick={handleGenerateIllustrated}
                  disabled={isGeneratingIllustrated || isGenerating || isValidatingImages || showConfirmGeneration || paymentSuccess}
                  className={`ml-4 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl font-semibold ${
                    paymentSuccess 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : imagesExist 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' 
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                  }`}
                >
                  {paymentSuccess ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Comprado
                    </>
                  ) : isValidatingImages ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validando...
                    </>
                  ) : isGeneratingIllustrated ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : imagesExist ? (
                    <>
                      <div className="flex items-center mr-2 relative">
                        <Download className="h-4 w-4 animate-bounce" />
                        <div className="absolute h-4 w-4 bg-white/20 rounded-full animate-ping"></div>
                      </div>
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-green-100">
                        Descargar
                      </span>
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