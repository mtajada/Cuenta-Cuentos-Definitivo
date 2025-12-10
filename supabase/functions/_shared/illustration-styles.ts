export type IllustrationStyleId =
  | 'watercolor_child'
  | 'animation_magic'
  | 'anime_bright'
  | 'storybook_classic'
  | 'realistic_soft';

export type OpenAiImageStyle = 'vivid' | 'natural';

export interface IllustrationStyleConfig {
  id: IllustrationStyleId;
  label: string;
  promptDescriptor: string;
  openAiStyle: OpenAiImageStyle;
}

export const DEFAULT_IMAGE_STYLE_ID: IllustrationStyleId = 'watercolor_child';
export const FALLBACK_IMAGE_STYLE_ID: IllustrationStyleId = DEFAULT_IMAGE_STYLE_ID;

export const ILLUSTRATION_STYLES: IllustrationStyleConfig[] = [
  {
    id: 'watercolor_child',
    label: 'Acuarela infantil',
    promptDescriptor:
      'acuarela suave con paleta pastel, bordes difuminados y texturas de papel, estética amable para niños',
    openAiStyle: 'vivid',
  },
  {
    id: 'animation_magic',
    label: 'Animación mágica (tipo Disney)',
    promptDescriptor:
      'animación cinematográfica brillante y expresiva, acabado de estudio, personajes de ojos grandes e iluminación vibrante',
    openAiStyle: 'vivid',
  },
  {
    id: 'anime_bright',
    label: 'Anime luminoso',
    promptDescriptor:
      'estética anime con línea limpia, sombreados suaves, colores saturados y fondos vibrantes',
    openAiStyle: 'vivid',
  },
  {
    id: 'storybook_classic',
    label: 'Ilustración de cuento clásico',
    promptDescriptor:
      'trazos de tinta con color plano, sensación editorial, texturas ligeras y granulado suave',
    openAiStyle: 'vivid',
  },
  {
    id: 'realistic_soft',
    label: 'Realismo suave',
    promptDescriptor:
      'realismo cálido con luz natural, profundidad de campo ligera y texturas delicadas, sin dureza',
    openAiStyle: 'natural',
  },
];

const STYLE_MAP = new Map<IllustrationStyleId, IllustrationStyleConfig>(
  ILLUSTRATION_STYLES.map((style) => [style.id, style]),
);

export function getValidIllustrationStyleIds(): IllustrationStyleId[] {
  return Array.from(STYLE_MAP.keys());
}

export function isValidIllustrationStyleId(
  id: string | null | undefined,
): id is IllustrationStyleId {
  return !!id && STYLE_MAP.has(id as IllustrationStyleId);
}

export function normalizeIllustrationStyleId(
  id?: string | null,
): IllustrationStyleId {
  if (isValidIllustrationStyleId(id)) return id;
  return DEFAULT_IMAGE_STYLE_ID;
}

export function getPromptDescriptorForStyleId(id?: string | null): string {
  const style = STYLE_MAP.get(
    (isValidIllustrationStyleId(id) ? id : DEFAULT_IMAGE_STYLE_ID) as IllustrationStyleId,
  );
  return style?.promptDescriptor ?? STYLE_MAP.get(DEFAULT_IMAGE_STYLE_ID)!.promptDescriptor;
}

export function getOpenAiStyleForStyleId(
  id?: string | null,
): OpenAiImageStyle {
  const style = STYLE_MAP.get(
    (isValidIllustrationStyleId(id) ? id : DEFAULT_IMAGE_STYLE_ID) as IllustrationStyleId,
  );
  return style?.openAiStyle ?? STYLE_MAP.get(DEFAULT_IMAGE_STYLE_ID)!.openAiStyle;
}
