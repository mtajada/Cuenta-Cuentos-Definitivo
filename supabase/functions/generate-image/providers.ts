import { mapAspectRatio, getOpenAiFallbackSize, GEMINI_PREFERRED_ASPECT_RATIO } from '../_shared/image-layout.ts';
import { OpenAI } from "https://esm.sh/openai@4.40.0";

interface BaseProviderConfig {
  prompt: string;
  desiredAspectRatio?: string;
  logPrefix?: string;
}

export interface GeminiProviderConfig extends BaseProviderConfig {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface OpenAiProviderConfig extends BaseProviderConfig {
  client: OpenAI;
  model?: string;
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  sizeOverride?: string;
  background?: 'opaque';
}

export interface ProviderResult {
  buffer: Uint8Array;
  mimeType: string;
  provider: 'gemini' | 'openai';
  finishReason?: string;
  latencyMs: number;
  effectiveAspectRatio?: string;
  requestedAspectRatio: string;
  requestSize?: string;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: 'gemini' | 'openai',
    public readonly status?: number,
    public readonly shouldFallback: boolean = false,
  ) {
    super(message);
    this.name = `${provider.toUpperCase()}ProviderError`;
  }
}

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_IMAGE_MODEL = Deno.env.get('GEMINI_IMAGE_MODEL') ?? 'models/gemini-2.5-flash-image';
const GEMINI_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function generateWithGemini(config: GeminiProviderConfig): Promise<ProviderResult> {
  const { prompt, desiredAspectRatio = GEMINI_PREFERRED_ASPECT_RATIO, signal, timeoutMs, logPrefix = '[GEMINI_IMAGE]' } = config;
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) {
    console.warn(`${logPrefix} Gemini provider not configured. Skipping request.`);
    throw new ProviderError('Gemini provider not configured', 'gemini', 503, true);
  }
  const ratio = mapAspectRatio(desiredAspectRatio);
  const controller = new AbortController();
  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    }
  }
  const combinedSignal = controller.signal;

  let timeoutId: number | undefined;
  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs) as unknown as number;
  }

  console.log(`${logPrefix} Requested aspect ratio: ${ratio.requested} → resolved ${ratio.resolved}${ratio.isFallback ? ' (fallback applied)' : ''}`);

  const endpoint = `${GEMINI_ENDPOINT_BASE}/${GEMINI_IMAGE_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const startedAt = performance.now();

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: combinedSignal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        responseModalities: ['IMAGE'],
        generationConfig: {
          responseMimeType: 'image/png',
        },
        imageGenerationConfig: {
          aspectRatio: ratio.resolved,
        },
      }),
    });
  } catch (error) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    const message = error instanceof Error ? error.message : 'unknown fetch error';
    console.error(`${logPrefix} Gemini request failed before receiving a response:`, message);
    throw new ProviderError(`Gemini request failed: ${message}`, 'gemini', undefined, true);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${logPrefix} Gemini API responded with status ${response.status}: ${errorText}`);
    const shouldFallback = response.status >= 500 || response.status === 429;
    throw new ProviderError(`Gemini request failed with status ${response.status}`, 'gemini', response.status, shouldFallback);
  }

  const payload = await response.json();
  const candidate = payload?.candidates?.[0];
  const finishReason: string | undefined = candidate?.finishReason ?? candidate?.finish_reason;
  const inlinePart = candidate?.content?.parts?.find((part: Record<string, unknown>) => 'inlineData' in part);
  const inlineData = inlinePart?.inlineData as { data?: string; mimeType?: string } | undefined;

  if (!inlineData?.data) {
    const normalizedFinishReason = typeof finishReason === 'string' ? finishReason.toUpperCase() : undefined;
    const isSafetyBlock = normalizedFinishReason === 'SAFETY';
    const status = isSafetyBlock ? 400 : undefined;
    const errorMessage = isSafetyBlock
      ? 'Gemini blocked the prompt due to safety filters.'
      : 'Gemini returned no inline image data.';
    console.error(`${logPrefix} ${errorMessage} finishReason=${finishReason ?? 'unknown'}`);
    throw new ProviderError(errorMessage, 'gemini', status, !isSafetyBlock);
  }

  const buffer = decodeBase64ToUint8Array(inlineData.data);
  const mimeType = inlineData.mimeType ?? 'image/png';
  const latencyMs = Math.round(performance.now() - startedAt);

  console.log(`${logPrefix} Received image with mimeType=${mimeType} after ${latencyMs}ms (finishReason=${finishReason ?? 'unknown'})`);

  return {
    buffer,
    mimeType,
    provider: 'gemini',
    finishReason,
    latencyMs,
    effectiveAspectRatio: ratio.resolved,
    requestedAspectRatio: ratio.requested,
  };
}

export async function generateWithOpenAI(config: OpenAiProviderConfig): Promise<ProviderResult> {
  const {
    prompt,
    client,
    desiredAspectRatio = GEMINI_PREFERRED_ASPECT_RATIO,
    model = 'gpt-image-1',
    quality = 'standard',
    style = 'vivid',
    sizeOverride,
    background,
    logPrefix = '[OPENAI_IMAGE]',
  } = config;

  const size = sizeOverride ?? getOpenAiFallbackSize(desiredAspectRatio);
  const startedAt = performance.now();

  console.log(`${logPrefix} Using size ${size} for desired aspect ratio ${desiredAspectRatio}`);

  const requestPayload: Record<string, unknown> = {
    model,
    prompt: prompt.trim(),
    size,
    quality,
    style,
    response_format: 'b64_json',
    n: 1,
  };

  if (background) {
    requestPayload.background = background;
  }

  const response = await client.images.generate(requestPayload as any);

  if (!response.data?.length) {
    throw new ProviderError('OpenAI returned no image data', 'openai');
  }

  const imageData = response.data[0];
  const base64 = imageData.b64_json as string | undefined;
  if (!base64) {
    throw new ProviderError('OpenAI response missing b64_json field', 'openai');
  }

  const buffer = decodeBase64ToUint8Array(base64);
  const latencyMs = Math.round(performance.now() - startedAt);
  const mimeType = 'image/png';
  const finishReason = (imageData as Record<string, unknown>).finish_reason as string | undefined;

  console.log(`${logPrefix} Image generated in ${latencyMs}ms (finishReason=${finishReason ?? 'n/a'})`);

  return {
    buffer,
    mimeType,
    provider: 'openai',
    finishReason,
    latencyMs,
    effectiveAspectRatio: desiredAspectRatio,
    requestedAspectRatio: desiredAspectRatio,
    requestSize: size,
  };
}
