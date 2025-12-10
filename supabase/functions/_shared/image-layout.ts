export type GeminiAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export const GEMINI_PREFERRED_ASPECT_RATIO = '4:5';

export const GEMINI_SUPPORTED_ASPECT_RATIOS: readonly GeminiAspectRatio[] = [
  '1:1',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
] as const;

const GEMINI_ASPECT_RATIO_ALIASES: Record<string, GeminiAspectRatio> = {
  '4:5': '3:4',
  '2:3': '3:4',
  'portrait': '3:4',
  'vertical': '3:4',
  '5:4': '4:3',
  'landscape': '16:9',
  'wide': '16:9',
  'square': '1:1',
};

const GEMINI_ASPECT_RATIO_PRIORITY: GeminiAspectRatio[] = [
  '3:4',
  '9:16',
  '1:1',
  '4:3',
  '16:9',
];

export const OPENAI_LEGACY_SIZES = {
  '4:5': '1024x1792',
  '3:4': '1024x1792',
  '1:1': '1024x1024',
  '9:16': '1024x1792',
  '16:9': '1792x1024',
  '4:3': '1792x1024',
} as const;

export type OpenAiFallbackSize = (typeof OPENAI_LEGACY_SIZES)[keyof typeof OPENAI_LEGACY_SIZES];

export const MIN_VERTICAL_RENDER_SIZE = { width: 896, height: 1120 };
export const A4_CANVAS_PIXELS = { width: 1654, height: 2339 };
export const A4_CANVAS_LAYOUT_LABEL = 'A4@200dpi';
export const DEFAULT_SAFE_MARGIN_PX = 72;

export function formatCanvasLayout(
  canvas: { width: number; height: number } = A4_CANVAS_PIXELS,
  layoutLabel: string = A4_CANVAS_LAYOUT_LABEL,
): string {
  return `${layoutLabel} (${canvas.width}x${canvas.height})`;
}

function parseRatio(value: string): number | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase();
  if (!cleaned.includes(':')) return null;
  const [w, h] = cleaned.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) {
    return null;
  }
  return w / h;
}

function findClosestGeminiRatio(desired: string): GeminiAspectRatio {
  const direct = GEMINI_SUPPORTED_ASPECT_RATIOS.find(
    (ratio) => ratio === desired
  );
  if (direct) {
    return direct;
  }

  const alias = GEMINI_ASPECT_RATIO_ALIASES[desired];
  if (alias) {
    return alias;
  }

  const numericDesired = parseRatio(desired);
  if (numericDesired === null) {
    return GEMINI_ASPECT_RATIO_PRIORITY[0];
  }

  let closest: GeminiAspectRatio = GEMINI_ASPECT_RATIO_PRIORITY[0];
  let smallestDelta = Number.POSITIVE_INFINITY;
  for (const ratio of GEMINI_SUPPORTED_ASPECT_RATIOS) {
    const numeric = parseRatio(ratio);
    if (numeric === null) continue;
    const delta = Math.abs(numericDesired - numeric);
    if (delta < smallestDelta) {
      smallestDelta = delta;
      closest = ratio;
    }
  }

  return closest;
}

export function mapAspectRatio(
  desired: string = GEMINI_PREFERRED_ASPECT_RATIO
): {
  requested: string;
  resolved: GeminiAspectRatio;
  isFallback: boolean;
} {
  const cleaned = desired.trim().toLowerCase();
  const resolved = findClosestGeminiRatio(cleaned);
  return {
    requested: desired,
    resolved,
    isFallback: resolved !== cleaned,
  };
}

export function getOpenAiFallbackSize(
  desired: string = GEMINI_PREFERRED_ASPECT_RATIO
): OpenAiFallbackSize {
  const cleaned = desired.trim().toLowerCase();
  const directSize = OPENAI_LEGACY_SIZES[cleaned as keyof typeof OPENAI_LEGACY_SIZES];
  if (directSize) {
    return directSize;
  }
  const mapped = mapAspectRatio(cleaned);
  return OPENAI_LEGACY_SIZES[mapped.resolved] ?? OPENAI_LEGACY_SIZES['3:4'];
}

export interface ImageLayoutSpec {
  requestedAspectRatio: string;
  resolvedAspectRatio: GeminiAspectRatio;
  isFallback: boolean;
  canvas: { width: number; height: number };
  layoutLabel: string;
  canvasLabel: string;
  safeMarginPx: { top: number; right: number; bottom: number; left: number };
  minRenderSize: { width: number; height: number };
  openaiFallbackSize: OpenAiFallbackSize;
}

export function getImageLayout(options?: {
  aspectRatio?: string;
  safeMarginPx?: number;
}): ImageLayoutSpec {
  const desired = options?.aspectRatio ?? GEMINI_PREFERRED_ASPECT_RATIO;
  const mapped = mapAspectRatio(desired);
  const safeMargin = options?.safeMarginPx ?? DEFAULT_SAFE_MARGIN_PX;

  return {
    requestedAspectRatio: desired,
    resolvedAspectRatio: mapped.resolved,
    isFallback: mapped.requested.trim().toLowerCase() !== mapped.resolved,
    canvas: { ...A4_CANVAS_PIXELS },
    layoutLabel: A4_CANVAS_LAYOUT_LABEL,
    canvasLabel: formatCanvasLayout(A4_CANVAS_PIXELS, A4_CANVAS_LAYOUT_LABEL),
    safeMarginPx: {
      top: safeMargin,
      right: safeMargin,
      bottom: safeMargin,
      left: safeMargin,
    },
    minRenderSize: { ...MIN_VERTICAL_RENDER_SIZE },
    openaiFallbackSize: getOpenAiFallbackSize(desired),
  };
}
