import { useCallback, useEffect, useMemo, useState } from 'react';
import { StoryWithChapters, StoryChapter } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Lock, Search, FileText, Download, Loader2 } from 'lucide-react';
import { StoryPdfService, ImageGenerationProgress, StoryImageValidationDetail } from '../services/storyPdfService';
import { Progress } from '../components/ui/progress';
import { APP_CONFIG } from '../config/app';
import { Switch } from '../components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { getImageProviderConfig } from '@/services/ai/imageProviderConfig';
import { getImageLayout, mapAspectRatio } from '@/lib/image-layout';
import { DEFAULT_IMAGE_STYLE_ID } from '@/lib/image-styles';
import { IMAGES_TYPE } from '../constants/story-images.constant';
import { GeneratedImageMetadata, ImageGenerationSummary } from '@/services/ai/imageGenerationService';

const ADMIN_CODE = 'TaleMe2025';

const IMAGE_TYPE_ORDER = [
  IMAGES_TYPE.COVER,
  IMAGES_TYPE.SCENE_1,
  IMAGES_TYPE.SCENE_2,
  IMAGES_TYPE.SCENE_3,
  IMAGES_TYPE.SCENE_4,
  IMAGES_TYPE.CLOSING,
  IMAGES_TYPE.CHARACTER,
] as const;

const IMAGE_TYPE_LABELS: Record<string, string> = {
  [IMAGES_TYPE.COVER]: 'Portada',
  [IMAGES_TYPE.SCENE_1]: 'Escena 1',
  [IMAGES_TYPE.SCENE_2]: 'Escena 2',
  [IMAGES_TYPE.SCENE_3]: 'Escena 3',
  [IMAGES_TYPE.SCENE_4]: 'Escena 4',
  [IMAGES_TYPE.CLOSING]: 'Cierre',
  [IMAGES_TYPE.CHARACTER]: 'Personaje',
};

type LiveGenerationInfo = {
  summary?: ImageGenerationSummary;
  metadataByType?: Partial<Record<string, GeneratedImageMetadata>>;
  imageUrls?: Partial<Record<string, string>>;
};

/**
 * Admin panel for generating illustrated PDFs by story ID
 * Protected with a simple code authentication
 */
export default function AdminIllustratedPdfPanel() {
  const providerConfig = useMemo(() => getImageProviderConfig(), []);
  const aspectRatioInfo = useMemo(
    () => mapAspectRatio(providerConfig.desiredAspectRatio),
    [providerConfig.desiredAspectRatio]
  );
  const layoutSpec = useMemo(
    () => getImageLayout({ aspectRatio: providerConfig.desiredAspectRatio }),
    [providerConfig.desiredAspectRatio]
  );
  const canvasResolution = useMemo(
    () => `${layoutSpec.canvas.width}x${layoutSpec.canvas.height}`,
    [layoutSpec.canvas.height, layoutSpec.canvas.width]
  );

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
  const [liveGenerationInfo, setLiveGenerationInfo] = useState<LiveGenerationInfo | null>(null);
  const [imageDetails, setImageDetails] = useState<Record<string, StoryImageValidationDetail> | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState('');
  const [missingImages, setMissingImages] = useState<string[]>([]);
  const legacyImageTypes = useMemo(() => {
    if (!imageDetails) return [];
    return Object.entries(imageDetails)
      .filter(([, detail]) => detail?.storageBucket && detail.storageBucket !== 'images-stories')
      .map(([type]) => IMAGE_TYPE_LABELS[type] ?? type);
  }, [imageDetails]);
  const hasLegacyImages = legacyImageTypes.length > 0;

  const loadMetadata = useCallback(
    async (targetStoryId: string, targetChapterId: string) => {
      if (!targetStoryId || !targetChapterId) {
        setImageDetails(null);
        setMissingImages([]);
        setLiveGenerationInfo(null);
        return;
      }

      setMetadataLoading(true);
      setMetadataError('');

      try {
        const validation = await StoryPdfService.validateRequiredImages(targetStoryId, targetChapterId, {
          adminCode: ADMIN_CODE,
        });
        setImageDetails(validation.imageDetails ?? null);
        setMissingImages(validation.missingImages ?? []);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar los metadatos de las imágenes.';
        setMetadataError(message);
        console.error('[AdminIllustratedPdfPanel] Error loading metadata:', err);
      } finally {
        setMetadataLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setLiveGenerationInfo(null);
    if (story && selectedChapterId) {
      loadMetadata(story.id, selectedChapterId);
    } else {
      setImageDetails(null);
      setMissingImages([]);
    }
  }, [loadMetadata, selectedChapterId, story]);

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

      const baseOptions =
        parsedOptions || { genre: 'Desconocido', language: 'es', characters: [], moral: '', duration: 'short' };
      const creationMode = storyData.creation_mode || baseOptions.creationMode || 'standard';
      const imageStyle =
        baseOptions.imageStyle ||
        storyData.image_style ||
        DEFAULT_IMAGE_STYLE_ID;

      const optionsWithStyle = {
        ...baseOptions,
        creationMode,
        imageStyle: creationMode === 'image' ? imageStyle : undefined,
      };

      const storyWithChapters: StoryWithChapters = {
        id: storyData.id,
        title: storyData.title,
        content: storyData.content,
        audioUrl: storyData.audioUrl,
        options: optionsWithStyle,
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

  const renderNormalizationInfo = (detail?: StoryImageValidationDetail) => {
    if (!detail) {
      return <span className="text-muted-foreground">—</span>;
    }

    const fromLabel = detail.resizedFrom ?? detail.originalResolution ?? null;
    const toLabel =
      detail.resizedTo ??
      detail.finalResolutionPx ??
      detail.finalResolution?.match(/\d{2,5}x\d{2,5}/)?.[0] ??
      detail.finalResolution ??
      null;

    const isCanvas =
      (toLabel && toLabel === canvasResolution) ||
      detail.finalLayout === layoutSpec.layoutLabel ||
      detail.canvasLabel === layoutSpec.canvasLabel;

    if (!fromLabel && !toLabel) {
      return <Badge variant="outline">Sin cambios</Badge>;
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {fromLabel || toLabel ? (
          <Badge variant="outline">
            {(fromLabel ?? '—') + ' → ' + (toLabel ?? '—')}
          </Badge>
        ) : null}
        {isCanvas ? (
          <Badge variant="secondary">{detail.canvasLabel ?? layoutSpec.canvasLabel}</Badge>
        ) : null}
      </div>
    );
  };

  const renderAspectRatioInfo = (detail?: StoryImageValidationDetail) => {
    const requested = detail?.requestedAspectRatio ?? aspectRatioInfo.requested;
    const effective = detail?.effectiveAspectRatio ?? aspectRatioInfo.resolved;
    const requestSize = detail?.requestSize ?? layoutSpec.openaiFallbackSize;

    if (!requested && !effective && !requestSize) {
      return <span className="text-muted-foreground">—</span>;
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {(requested || effective) && (
          <Badge variant="outline">
            {(requested ?? '—') + (effective ? ` → ${effective}` : '')}
          </Badge>
        )}
        {requestSize ? (
          <Badge variant="secondary">{requestSize}</Badge>
        ) : null}
      </div>
    );
  };

  const renderFinalResolution = (detail?: StoryImageValidationDetail) => {
    if (!detail) {
      return <span className="text-muted-foreground">—</span>;
    }

    const layoutTag = detail.finalLayout ?? detail.canvasLabel ?? null;
    const pxLabel = detail.finalResolutionPx ?? null;
    const fallbackLabel = detail.finalResolution ?? detail.originalResolution ?? '—';

    return (
      <div className="flex flex-col gap-1">
        {layoutTag ? <Badge variant="secondary">{layoutTag}</Badge> : null}
        <span className="text-xs text-muted-foreground">{pxLabel ?? fallbackLabel}</span>
      </div>
    );
  };

  const renderLiveGenerationTelemetry = () => {
    if (!liveGenerationInfo) {
      return null;
    }

    const { summary, metadataByType } = liveGenerationInfo;
    const entries = metadataByType ? Object.entries(metadataByType).filter(([, meta]) => Boolean(meta)) : [];
    const providerStats = entries.reduce<Record<string, number>>((acc, [, meta]) => {
      const provider = meta?.providerUsed ?? 'desconocido';
      acc[provider] = (acc[provider] ?? 0) + 1;
      return acc;
    }, {});
    const fallbackCount = entries.filter(([, meta]) => meta?.fallbackUsed).length;

    return (
      <div className="space-y-2 rounded-lg border border-dashed bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {summary ? (
            <>
              <Badge variant="outline">Default: {summary.defaultProvider.toUpperCase()}</Badge>
              <Badge variant="outline">Fallback: {summary.fallbackProvider.toUpperCase()}</Badge>
              <Badge variant={summary.fallbackApplied ? 'destructive' : 'secondary'}>
                {summary.requestedAspectRatio} → {summary.resolvedAspectRatio}
                {summary.fallbackApplied ? ' (fallback)' : ''}
              </Badge>
            </>
          ) : (
            <Badge variant="outline">Sin summary en vivo</Badge>
          )}
        </div>
        {entries.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Proveedores:{' '}
              {Object.entries(providerStats)
                .map(([provider, count]) => `${provider} (${count})`)
                .join(' · ')}
            </span>
            <span>
              Fallbacks: {fallbackCount}/{entries.length}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aún no hay trazas locales de esta ejecución.</p>
        )}
      </div>
    );
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
    setLiveGenerationInfo(null);

    try {
      const resolvedImageStyle = story.options?.imageStyle || DEFAULT_IMAGE_STYLE_ID;

      const pdfBlob = await StoryPdfService.generateCompleteIllustratedPdf({
        title: `${story.title} - ${selectedChapter.title}`,
        content: selectedChapter.content,
        storyId: story.id,
        chapterId: selectedChapterId,
        imageStyle: resolvedImageStyle,
        onProgress: (progressData) => {
          setProgress(progressData);
          if (progressData.metadataByType || progressData.summary) {
            setLiveGenerationInfo({
              summary: progressData.summary,
              metadataByType: progressData.metadataByType,
              imageUrls: progressData.imageUrls,
            });
          }
        },
        onGenerationResult: (result) => {
          setLiveGenerationInfo({
            summary: result.summary,
            metadataByType: result.metadataByType,
            imageUrls: result.imageUrls,
          });
        },
      });

      // Download PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${story.title.replace(/[^a-z0-9]/gi, '_')}_${selectedChapter.chapterNumber}_ilustrado.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      await loadMetadata(story.id, selectedChapterId);

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

        {/* Providers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Proveedor de imágenes activo</CardTitle>
            <CardDescription>
              Valores actuales de las variables VITE_IMAGE_PROVIDER_DEFAULT y VITE_IMAGE_PROVIDER_FALLBACK
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
                <div>
                  <p className="text-sm font-medium">Proveedor principal</p>
                  <p className="text-xs text-muted-foreground">VITE_IMAGE_PROVIDER_DEFAULT</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge>{providerConfig.defaultProvider.toUpperCase()}</Badge>
                  <Switch checked disabled aria-label="Proveedor principal activo" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
                <div>
                  <p className="text-sm font-medium">Proveedor de respaldo</p>
                  <p className="text-xs text-muted-foreground">VITE_IMAGE_PROVIDER_FALLBACK</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{providerConfig.fallbackProvider.toUpperCase()}</Badge>
                  <Switch checked={false} disabled aria-label="Proveedor de respaldo configurado" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              El payload envía este orden a la Edge <code>generate-image</code>. La función también puede resolverlo
              desde <code>IMAGE_PROVIDER_DEFAULT</code>/<code>IMAGE_PROVIDER_FALLBACK</code> y mantiene fallback automático
              si el proveedor activo falla.
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>
                Ratio preferido:&nbsp;
                <Badge variant="secondary">{aspectRatioInfo.requested}</Badge>
              </span>
              <span>
                Gemini resuelve:&nbsp;
                <Badge variant={aspectRatioInfo.isFallback ? 'destructive' : 'default'}>
                  {aspectRatioInfo.resolved}
                  {aspectRatioInfo.isFallback ? ' (fallback)' : ''}
                </Badge>
              </span>
              <span>
                Lienzo de normalización:&nbsp;
                <Badge variant="outline">{layoutSpec.canvasLabel}</Badge>
              </span>
              <span>
                Tamaño de solicitud (OpenAI fallback):&nbsp;
                <Badge variant="outline">{layoutSpec.openaiFallbackSize}</Badge>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-2xl">Metadatos de ilustraciones</CardTitle>
              <CardDescription>
                Registros más recientes para el capítulo seleccionado
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => story && selectedChapterId && loadMetadata(story.id, selectedChapterId)}
              disabled={!story || !selectedChapterId || metadataLoading}
            >
              {metadataLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Actualizar'
              )}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {metadataError && (
              <Alert variant="destructive">
                <AlertDescription>{metadataError}</AlertDescription>
              </Alert>
            )}

            {metadataLoading && !imageDetails && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando metadatos de ilustraciones...
              </div>
            )}

            {liveGenerationInfo ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Trazas en vivo (última llamada generate-image)
                </p>
                {renderLiveGenerationTelemetry()}
              </div>
            ) : null}

            {imageDetails && Object.keys(imageDetails).length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imagen</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Fallback</TableHead>
                      <TableHead>Aspecto</TableHead>
                      <TableHead>Resolución final</TableHead>
                      <TableHead>Normalización</TableHead>
                      <TableHead>Resolución original</TableHead>
                      <TableHead>Latencia</TableHead>
                      <TableHead>MIME</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>URL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {IMAGE_TYPE_ORDER.filter(type => type !== IMAGES_TYPE.CHARACTER || imageDetails?.[type]).map((type) => {
                      const detail = imageDetails?.[type];
                      const label = IMAGE_TYPE_LABELS[type] ?? type;
                      const isMissing = missingImages.includes(label);

                      return (
                        <TableRow key={type}>
                          <TableCell className="font-medium">{label}</TableCell>
                          <TableCell>
                            {detail?.providerUsed ? (
                              <Badge variant="secondary">{detail.providerUsed.toUpperCase()}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {detail ? (
                              detail.fallbackUsed ? (
                                <Badge variant="destructive">Fallback</Badge>
                              ) : (
                                <Badge variant="outline">Principal</Badge>
                              )
                            ) : isMissing ? (
                              <Badge variant="outline">Pendiente</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{renderAspectRatioInfo(detail)}</TableCell>
                          <TableCell>{renderFinalResolution(detail)}</TableCell>
                          <TableCell>{renderNormalizationInfo(detail)}</TableCell>
                          <TableCell>{detail?.originalResolution ?? '—'}</TableCell>
                          <TableCell>{detail?.latencyMs ? `${detail.latencyMs} ms` : '—'}</TableCell>
                          <TableCell>
                            {detail?.mimeType ? (
                              <Badge variant="secondary">{detail.mimeType}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {detail?.storagePath ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant={detail.storageBucket === 'images-stories' || !detail.storageBucket ? 'secondary' : 'destructive'}>
                                    {detail.storageBucket ?? 'images-stories'}
                                  </Badge>
                                </div>
                                <code className="text-xs break-all">{detail.storagePath}</code>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {detail?.publicUrl ? (
                              <Button asChild variant="link" size="sm" className="px-0">
                                <a href={detail.publicUrl} target="_blank" rel="noopener noreferrer">
                                  Abrir
                                </a>
                              </Button>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : !metadataLoading ? (
              <p className="text-sm text-muted-foreground">
                {story && selectedChapterId
                  ? 'Aún no hay metadatos registrados para este capítulo.'
                  : 'Selecciona una historia y un capítulo para revisar los metadatos disponibles.'}
              </p>
            ) : null}

            {missingImages.length > 0 && (
              <div className="text-sm">
                <p className="font-medium text-amber-600">Imágenes pendientes:</p>
                <p className="text-muted-foreground">
                  {missingImages.join(', ')}
                </p>
              </div>
            )}
            {hasLegacyImages && (
              <Alert>
                <AlertDescription>
                  Fallback temporal al bucket legacy <code>story-images</code> para: {legacyImageTypes.join(', ')}. Ejecuta el backfill a <code>images-stories</code> y elimina el legado en cuanto termine la migración.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
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
