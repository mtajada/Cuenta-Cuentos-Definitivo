import { GEMINI_PREFERRED_ASPECT_RATIO } from '@/lib/image-layout';
import {
  DEFAULT_IMAGE_STYLE_ID,
  getImageStyleById,
  getOpenAiStyleForStyleId,
  ImageStyleId,
  OpenAiImageStyle,
} from '@/lib/image-styles';

export type ImageProviderId = 'gemini' | 'openai';

const PROVIDER_VALUES: ImageProviderId[] = ['gemini', 'openai'];

function normalizeProvider(value: string | undefined): ImageProviderId | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  return PROVIDER_VALUES.includes(normalized as ImageProviderId) ? (normalized as ImageProviderId) : undefined;
}

export interface ImageProviderConfig {
  defaultProvider: ImageProviderId;
  fallbackProvider: ImageProviderId;
  desiredAspectRatio: string;
  providerTimeoutMs: number;
  openAiModel: string;
  openAiQuality: 'standard' | 'hd';
  openAiStyle: OpenAiImageStyle;
  background: 'opaque';
  styleId: ImageStyleId;
}

/**
 * Reads the active image provider configuration from Vite environment variables.
 * Falls back to Gemini as the default provider and OpenAI as fallback to preserve Fase 1 pipeline.
 */
export function getImageProviderConfig(imageStyleId?: string): ImageProviderConfig {
  const envDefault = normalizeProvider(import.meta.env.VITE_IMAGE_PROVIDER_DEFAULT);
  const envFallback = normalizeProvider(import.meta.env.VITE_IMAGE_PROVIDER_FALLBACK);
  const styleId = getImageStyleById(imageStyleId)?.id ?? DEFAULT_IMAGE_STYLE_ID;
  const openAiStyle = getOpenAiStyleForStyleId(styleId);

  const defaultProvider = envDefault ?? 'gemini';
  let fallbackProvider = envFallback ?? (defaultProvider === 'gemini' ? 'openai' : 'gemini');

  if (fallbackProvider === defaultProvider) {
    fallbackProvider = defaultProvider === 'gemini' ? 'openai' : 'gemini';
  }

  return {
    defaultProvider,
    fallbackProvider,
    desiredAspectRatio: GEMINI_PREFERRED_ASPECT_RATIO,
    providerTimeoutMs: 45000,
    openAiModel: 'gpt-image-1',
    openAiQuality: 'standard',
    openAiStyle,
    background: 'opaque',
    styleId,
  };
}
