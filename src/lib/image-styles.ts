export type ImageStyleId =
  | 'watercolor_child'
  | 'animation_magic'
  | 'anime_bright'
  | 'storybook_classic'
  | 'realistic_soft';

export type OpenAiImageStyle = 'vivid' | 'natural';

export interface ImageStyleConfig {
  id: ImageStyleId;
  label: string;
  promptDescriptor: string;
  openAiStyle: OpenAiImageStyle;
  description: string;
  thumbnail: string;
  overlayGradient: string;
}

export const DEFAULT_IMAGE_STYLE_ID: ImageStyleId = 'watercolor_child';
export const FALLBACK_IMAGE_STYLE_ID: ImageStyleId = DEFAULT_IMAGE_STYLE_ID;

export const IMAGE_STYLES: ImageStyleConfig[] = [
  {
    id: 'watercolor_child',
    label: 'Acuarela infantil',
    promptDescriptor:
      'acuarela suave con paleta pastel, bordes difuminados y texturas de papel, estética amable para niños',
    openAiStyle: 'vivid',
    description: 'Colores suaves, texturas de papel y bordes difuminados.',
    thumbnail: '/tale-preview/cover.jpeg',
    overlayGradient: 'from-[#FCE7F3]/90 via-[#E0F2FE]/80 to-[#FEF9C3]/80',
  },
  {
    id: 'animation_magic',
    label: 'Animación mágica (tipo Disney)',
    promptDescriptor:
      'animación cinematográfica brillante y expresiva, acabado de estudio, personajes de ojos grandes e iluminación vibrante',
    openAiStyle: 'vivid',
    description: 'Estética cinematográfica, expresiva y luminosa.',
    thumbnail: '/tale-preview/scene_1.jpeg',
    overlayGradient: 'from-[#F6A5B7]/70 via-[#BB79D1]/60 to-[#7DC4E0]/70',
  },
  {
    id: 'anime_bright',
    label: 'Anime luminoso',
    promptDescriptor:
      'estética anime con línea limpia, sombreados suaves, colores saturados y fondos vibrantes',
    openAiStyle: 'vivid',
    description: 'Línea limpia, shading suave y fondos vibrantes.',
    thumbnail: '/tale-preview/scene_2.jpeg',
    overlayGradient: 'from-[#A5D6F6]/80 via-[#E6B7D9]/70 to-[#BB79D1]/70',
  },
  {
    id: 'storybook_classic',
    label: 'Ilustración de cuento clásico',
    promptDescriptor:
      'trazos de tinta con color plano, sensación editorial, texturas ligeras y granulado suave',
    openAiStyle: 'vivid',
    description: 'Trazos de tinta, color plano y sensación editorial.',
    thumbnail: '/tale-preview/scene_3.jpeg',
    overlayGradient: 'from-[#FEF9C3]/80 via-[#F6A5B7]/70 to-[#BB79D1]/60',
  },
  {
    id: 'realistic_soft',
    label: 'Realismo suave',
    promptDescriptor:
      'realismo cálido con luz natural, profundidad de campo ligera y texturas delicadas, sin dureza',
    openAiStyle: 'natural',
    description: 'Luz natural, texturas delicadas y paleta cálida.',
    thumbnail: '/tale-preview/scene_4.jpeg',
    overlayGradient: 'from-[#E0F2FE]/80 via-[#F9DA60]/70 to-[#FCE7F3]/60',
  },
];

const IMAGE_STYLE_MAP = new Map<ImageStyleId, ImageStyleConfig>(
  IMAGE_STYLES.map((style) => [style.id, style]),
);

export function getImageStyleIds(): ImageStyleId[] {
  return IMAGE_STYLES.map((style) => style.id);
}

export function isValidImageStyleId(
  id: string | null | undefined,
): id is ImageStyleId {
  return !!id && IMAGE_STYLE_MAP.has(id as ImageStyleId);
}

export function normalizeImageStyleId(id?: string | null): ImageStyleId {
  return isValidImageStyleId(id) ? (id as ImageStyleId) : DEFAULT_IMAGE_STYLE_ID;
}

export function getImageStyleById(id?: string | null): ImageStyleConfig | undefined {
  if (!isValidImageStyleId(id)) return undefined;
  return IMAGE_STYLE_MAP.get(id);
}

export function getImageStyleLabel(id?: string | null): string {
  const style = getImageStyleById(id);
  return style?.label ?? IMAGE_STYLE_MAP.get(DEFAULT_IMAGE_STYLE_ID)!.label;
}

export function getPromptDescriptorForStyle(id?: string | null): string {
  const style = getImageStyleById(id);
  return style?.promptDescriptor ?? IMAGE_STYLE_MAP.get(DEFAULT_IMAGE_STYLE_ID)!.promptDescriptor;
}

export function getOpenAiStyleForStyleId(id?: string | null): OpenAiImageStyle {
  const style = getImageStyleById(id);
  return style?.openAiStyle ?? IMAGE_STYLE_MAP.get(DEFAULT_IMAGE_STYLE_ID)!.openAiStyle;
}
