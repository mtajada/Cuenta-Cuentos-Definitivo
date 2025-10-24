import { useState } from 'react';
import { StoryWithChapters, StoryChapter } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Lock, Search, FileText, Download, Loader2 } from 'lucide-react';
import { StoryPdfService, ImageGenerationProgress } from '../services/storyPdfService';
import { Progress } from '../components/ui/progress';
import { APP_CONFIG } from '../config/app';

const ADMIN_CODE = 'TaleMe2025';

/**
 * Admin panel for generating illustrated PDFs by story ID
 * Protected with a simple code authentication
 */
export default function AdminIllustratedPdfPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [storyId, setStoryId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [story, setStory] = useState<StoryWithChapters | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState<ImageGenerationProgress | null>(null);

  /**
   * Handles admin code authentication
   */
  const handleAuthenticate = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (authCode === ADMIN_CODE) {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Código incorrecto. Inténtalo de nuevo.');
    }
  };

  /**
   * Fetches story from database by ID using admin Edge Function (bypasses RLS)
   */
  const handleFetchStory = async () => {
    if (!storyId.trim()) {
      setError('Por favor, ingresa un ID de historia');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setStory(null);
    setSelectedChapterId('');

    try {
      // Call admin Edge Function with code validation
      const response = await fetch(`${APP_CONFIG.supabaseUrl}/functions/v1/admin-get-story`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APP_CONFIG.supabaseAnonKey}`,
        },
        body: JSON.stringify({
          storyId: storyId.trim(),
          adminCode: ADMIN_CODE
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cargar la historia');
      }

      const { story: storyData } = await response.json();

      if (!storyData) {
        throw new Error('Historia no encontrada');
      }

      // Parse options if it's a JSON string
      let parsedOptions = storyData.options;
      if (typeof storyData.options === 'string') {
        try {
          parsedOptions = JSON.parse(storyData.options);
        } catch (e) {
          console.error('Error parsing options:', e);
          parsedOptions = { genre: 'Desconocido', language: 'es', characters: [], moral: '', duration: 'short' };
        }
      }

      const storyWithChapters: StoryWithChapters = {
        id: storyData.id,
        title: storyData.title,
        content: storyData.content,
        audioUrl: storyData.audioUrl,
        options: parsedOptions || { genre: 'Desconocido', language: 'es', characters: [], moral: '', duration: 'short' },
        createdAt: storyData.createdAt,
        additional_details: storyData.additional_details,
        chapters: storyData.chapters || [],
        hasMultipleChapters: storyData.hasMultipleChapters || false,
        chaptersCount: storyData.chaptersCount || 0
      };

      setStory(storyWithChapters);
      // Auto-select first chapter if available
      if (storyWithChapters.chapters.length > 0) {
        setSelectedChapterId(storyWithChapters.chapters[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la historia');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Generates illustrated PDF for the selected chapter
   */
  const handleGeneratePdf = async () => {
    if (!story || !selectedChapterId) {
      setError('Selecciona un capítulo para generar el PDF');
      return;
    }

    const selectedChapter = story.chapters.find(ch => ch.id === selectedChapterId);
    if (!selectedChapter) {
      setError('Capítulo no encontrado');
      return;
    }

    setGenerating(true);
    setError('');
    setSuccess('');
    setProgress(null);

    try {
      const pdfBlob = await StoryPdfService.generateCompleteIllustratedPdf({
        title: `${story.title} - ${selectedChapter.title}`,
        content: selectedChapter.content,
        storyId: story.id,
        chapterId: selectedChapterId,
        onProgress: (progressData) => {
          setProgress(progressData);
        }
      });

      // Download PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${story.title.replace(/[^a-z0-9]/gi, '_')}_${selectedChapter.chapterNumber}_ilustrado.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      setSuccess('¡PDF ilustrado generado y descargado exitosamente!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar PDF ilustrado');
      console.error('Error generating illustrated PDF:', err);
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  // Authentication screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Panel de Administración</CardTitle>
            <CardDescription>
              Generación de PDFs Ilustrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuthenticate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auth-code">Código de Acceso</Label>
                <Input
                  id="auth-code"
                  type="password"
                  placeholder="Ingresa el código"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  className="text-center tracking-wider"
                />
              </div>
              
              {authError && (
                <Alert variant="destructive">
                  <AlertDescription>{authError}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full">
                Acceder
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main admin panel
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Panel de PDFs Ilustrados</CardTitle>
            <CardDescription>
              Busca historias por ID y genera PDFs ilustrados con imágenes generadas por IA
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Story Search */}
        <Card>
          <CardHeader>
            <CardTitle>Buscar Historia</CardTitle>
            <CardDescription>Ingresa el ID de la historia de la base de datos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="ID de la historia (ej: 123e4567-e89b-12d3-a456-426614174000)"
                  value={storyId}
                  onChange={(e) => setStoryId(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button 
                onClick={handleFetchStory} 
                disabled={loading || !storyId.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-500 bg-green-50">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Story Details */}
        {story && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl mb-2">{story.title}</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary">
                      ID: {story.id}
                    </Badge>
                    {story.options?.genre && (
                      <Badge variant="outline">
                        {story.options.genre}
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {story.options?.language || 'es'}
                    </Badge>
                    <Badge variant="outline">
                      {story.chaptersCount} capítulo{story.chaptersCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
                <FileText className="w-8 h-8 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Chapter Selection */}
              {story.chapters.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Seleccionar Capítulo</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {story.chapters.map((chapter: StoryChapter) => (
                      <Card
                        key={chapter.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedChapterId === chapter.id
                            ? 'ring-2 ring-purple-500 bg-purple-50'
                            : ''
                        }`}
                        onClick={() => setSelectedChapterId(chapter.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Badge className="mt-1">Cap. {chapter.chapterNumber}</Badge>
                            <div className="flex-1">
                              <h4 className="font-semibold">{chapter.title}</h4>
                              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                {chapter.content.substring(0, 100)}...
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Content Preview */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Contenido Principal</Label>
                <div className="bg-gray-50 p-4 rounded-lg max-h-48 overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {story.content}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              {generating && progress && (
                <div className="space-y-3 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{progress.currentStep}</span>
                    <span className="text-sm text-gray-600">
                      {progress.completedImages} / {progress.totalImages} imágenes
                    </span>
                  </div>
                  <Progress value={progress.progress} className="h-2" />
                  {progress.currentImageType && (
                    <p className="text-xs text-gray-600">
                      Generando imagen: {progress.currentImageType}
                    </p>
                  )}
                </div>
              )}

              {/* Generate Button */}
              <Button
                onClick={handleGeneratePdf}
                disabled={!selectedChapterId || generating}
                size="lg"
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generando PDF Ilustrado...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-5 w-5" />
                    Generar PDF Ilustrado
                  </>
                )}
              </Button>

              <p className="text-sm text-gray-500 text-center">
                Este proceso generará automáticamente las imágenes necesarias (portada y escenas) 
                usando IA y creará un PDF ilustrado completo.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

