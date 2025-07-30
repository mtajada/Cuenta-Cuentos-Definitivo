import { useState, useRef, useEffect } from "react";
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
  const [generationProgress, setGenerationProgress] = useState<ImageGenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<'cover' | 'content' | 'backCover'>('cover');
  
  // New states for payment success flow
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    message: string;
    progress?: number;
  }>({ status: 'pending', message: 'Iniciando generación...' });
  const [isIllustratedPdfReady, setIsIllustratedPdfReady] = useState(false);
  const [autoGenerateAfterPayment, setAutoGenerateAfterPayment] = useState(true); // Control auto-generation
  
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
  }, [isOpen, location.search, storyId, chapterId, externalPaymentSuccess, externalSessionId]);

  const startGenerationProcess = async (sessionId: string) => {
    try {
      // Verify the payment was successful and offer immediate generation
      setGenerationStatus({
        status: 'processing',
        message: 'Verificando pago exitoso...'
      });

      // Get session data from Stripe
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('get-checkout-session', {
        body: { sessionId }
      });

      if (sessionError || !sessionData) {
        throw new Error('No se pudo verificar el pago');
      }

      // Payment verified, offer immediate generation
      setGenerationStatus({
        status: 'completed',
        message: '¡Pago exitoso! Tu cuento ilustrado está listo para generar.',
        progress: 100
      });

      setIsIllustratedPdfReady(true);
      
      if (autoGenerateAfterPayment) {
        toast({
          title: '¡Pago exitoso!',
          description: 'Generando tu cuento ilustrado automáticamente...',
          variant: 'default'
        });

        // Auto-start generation after payment success
        setTimeout(() => {
          handleDownloadIllustratedPdf();
        }, 1500);
      } else {
        toast({
          title: '¡Pago exitoso!',
          description: '¿Quieres generar tu cuento ilustrado ahora?',
          variant: 'default'
        });
      }

    } catch (error) {
      console.error('Error verificando el pago:', error);
      setGenerationStatus({
        status: 'failed',
        message: 'Error al verificar el pago. Contacta soporte.',
        progress: 0
      });

      toast({
        title: 'Error',
        description: 'Hubo un problema al verificar tu pago. Contacta soporte.',
        variant: 'destructive'
      });
    }
  };

  const handleDownloadIllustratedPdf = async () => {
    try {
      // First check if images already exist to determine the approach
      setGenerationStatus({
        status: 'processing',
        message: 'Verificando imágenes disponibles...',
        progress: 5
      });

      const validationResult = await StoryPdfService.canGenerateIllustratedPdf(storyId, chapterId);

      if (validationResult.canGenerate) {
        // Images exist, use direct PDF generation (faster)
        console.log('[StoryPdfPreview] Images exist, using direct PDF generation...');
        toast({
          title: 'Imágenes encontradas',
          description: 'Generando PDF con imágenes existentes...',
          variant: 'default'
        });

        await generateIllustratedPdfDirectly();
      } else {
        // Images don't exist, need full generation process
        console.log('[StoryPdfPreview] Images missing, starting full generation process...');
        toast({
          title: 'Generando cuento ilustrado',
          description: 'Por favor espera mientras generamos tu cuento con imágenes...',
          variant: 'default'
        });

        // Generate complete illustrated PDF using StoryPdfService
        const pdfBlob = await StoryPdfService.generateCompleteIllustratedPdf({
          title,
          author,
          content,
          storyId,
          chapterId,
          onProgress: (progress) => {
            setGenerationStatus({
              status: 'processing',
              message: progress.currentStep,
              progress: progress.progress
            });
          }
        });

        setGenerationStatus({
          status: 'completed',
          message: '¡Cuento ilustrado descargado exitosamente!',
          progress: 100
        });

        // Download the PDF
        StoryPdfService.downloadPdf(pdfBlob, title, true);
        
        toast({
          title: '¡Éxito!',
          description: 'Tu cuento ilustrado se ha descargado correctamente.',
          variant: 'default'
        });
      }

      // Reset to allow another download if needed
      setTimeout(() => {
        setGenerationStatus({
          status: 'completed',
          message: paymentSuccess ? '¡Pago verificado! Puedes generar y descargar tu cuento ilustrado.' : '¡Imágenes encontradas! Tu cuento ilustrado está listo.',
          progress: 100
        });
      }, 3000);

    } catch (error) {
      console.error('Error generating illustrated PDF:', error);
      
      setGenerationStatus({
        status: 'failed',
        message: 'Error al generar el cuento ilustrado. Puedes intentar de nuevo.',
        progress: 0
      });

      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo generar el cuento ilustrado.',
        variant: 'destructive'
      });

      // Reset to allow retry
      setTimeout(() => {
        setGenerationStatus({
          status: 'completed',
          message: paymentSuccess ? '¡Pago verificado! Puedes generar y descargar tu cuento ilustrado.' : '¡Tu cuento ilustrado está listo para generar.',
          progress: 100
        });
        setIsIllustratedPdfReady(true);
      }, 3000);
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

  const handleGenerateIllustrated = async () => {
    try {
      setIsValidatingImages(true);
      setError(null);
      
      console.log('[StoryPdfPreview] Starting illustrated story generation...');
      
      // Check if images exist
      const validationResult = await StoryPdfService.canGenerateIllustratedPdf(storyId, chapterId);
      setImageValidationResult(validationResult);
      
      if (validationResult.canGenerate) {
        // Images exist, user already paid - proceed directly with PDF generation and download
        console.log('[StoryPdfPreview] ✅ All required images exist. User already paid. Proceeding with illustrated PDF generation and download...');
        setPaymentSuccess(true); // Set payment success since images exist
        setIsIllustratedPdfReady(true);
        setGenerationStatus({
          status: 'completed',
          message: '¡Imágenes encontradas! Tu cuento ilustrado está listo.',
          progress: 100
        });
        
        // Auto-download the illustrated PDF since payment was already made
        toast({
          title: 'Imágenes encontradas',
          description: 'Generando y descargando tu cuento ilustrado...',
          variant: 'default'
        });
        
        setTimeout(() => {
          handleDownloadIllustratedPdf();
        }, 1000);
      } else {
        // Images missing, show confirmation dialog for payment
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
      setGenerationStatus({
        status: 'processing',
        message: 'Validando imágenes existentes...',
        progress: 10
      });
      
      // Validate required images exist in storage using service
      const imageValidation = await StoryPdfService.validateRequiredImages(storyId, chapterId);
      
      if (!imageValidation.allValid) {
        setError(`Faltan imágenes necesarias: ${imageValidation.missingImages.join(', ')}. Por favor, genera las imágenes del cuento primero.`);
        setGenerationStatus({
          status: 'failed',
          message: 'Error: Faltan imágenes necesarias.',
          progress: 0
        });
        return;
      }
      
      console.log('[StoryPdfPreview] ✅ All required images validated. Proceeding with illustrated PDF generation...');
      
      setGenerationStatus({
        status: 'processing',
        message: 'Generando PDF con imágenes existentes...',
        progress: 50
      });
      
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
      
      setGenerationStatus({
        status: 'completed',
        message: '¡PDF ilustrado generado exitosamente!',
        progress: 100
      });
      
      // Download illustrated PDF
      StoryPdfService.downloadPdf(pdfBlob, title, true);
      
      toast({
        title: '¡Descarga completada!',
        description: 'Tu cuento ilustrado se ha descargado correctamente.',
        variant: 'default'
      });
      
      if (onClose) onClose();
      
    } catch (err) {
      console.error('[StoryPdfPreview] Error generating illustrated story:', err);
      setError('Ocurrió un error al generar el cuento ilustrado. Por favor intenta nuevamente.');
      setGenerationStatus({
        status: 'failed',
        message: 'Error al generar el PDF ilustrado.',
        progress: 0
      });
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

          {/* Payment success and generation status */}
          {paymentSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-medium text-green-800 mb-2">
                    ¡Pago exitoso!
                  </h4>
                  
                  {generationStatus.status === 'processing' && (
                    <div className="mb-3">
                      <div className="flex items-center mb-2">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                        <span className="text-sm text-blue-800">{generationStatus.message}</span>
                      </div>
                      {generationStatus.progress && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${generationStatus.progress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  )}

                  {generationStatus.status === 'completed' && (
                    <div className="mb-3">
                      <p className="text-sm text-green-700 mb-3">
                        {generationStatus.message}
                      </p>
                      {!autoGenerateAfterPayment && (
                        <Button
                          onClick={handleDownloadIllustratedPdf}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          size="sm"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Generar y descargar cuento ilustrado
                        </Button>
                      )}
                      {autoGenerateAfterPayment && !isGeneratingIllustrated && (
                        <div className="flex space-x-2">
                          <Button
                            onClick={handleDownloadIllustratedPdf}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            size="sm"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Generar ahora
                          </Button>
                          <Button
                            onClick={() => setAutoGenerateAfterPayment(false)}
                            variant="outline"
                            size="sm"
                          >
                            Generar después
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {generationStatus.status === 'failed' && (
                    <div className="mb-3">
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="h-4 w-4 mr-2" />
                        <span className="text-sm">{generationStatus.message}</span>
                      </div>
                    </div>
                  )}
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
                      onClick={handleCheckout}
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
                          Comprar y generar (2.98€)
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
                    <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                      2.98€
                    </span>
                  </div>
                  <p className="text-sm text-purple-700">
                    PDF con imágenes generadas por IA que ilustran el cuento
                  </p>
                </div>
                <Button
                  onClick={handleGenerateIllustrated}
                  disabled={isGeneratingIllustrated || isGenerating || isValidatingImages || showConfirmGeneration || paymentSuccess}
                  className={`ml-4 ${paymentSuccess ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
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