import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { A4_CANVAS_PIXELS, DEFAULT_SAFE_MARGIN_PX } from '../_shared/image-layout.ts';

export interface NormalizedImage {
  buffer: Uint8Array;
  mimeType: string;
  originalResolution: { width: number; height: number };
  resizedFrom?: { width: number; height: number };
  resizedTo?: { width: number; height: number };
  finalResolution: { width: number; height: number };
}

function toUint8Array(buffer: Uint8Array | ArrayBuffer): Uint8Array {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

export async function normalizeForLayout(buffer: Uint8Array | ArrayBuffer, mimeType: string): Promise<NormalizedImage> {
  const sourceBytes = toUint8Array(buffer);
  const image = await Image.decode(sourceBytes);
  const originalResolution = { width: image.width, height: image.height };

  const canvas = new Image(A4_CANVAS_PIXELS.width, A4_CANVAS_PIXELS.height);
  canvas.fill(Image.rgbToColor(255, 255, 255));

  const safeMargin = DEFAULT_SAFE_MARGIN_PX;
  const safeAreaWidth = Math.max(1, A4_CANVAS_PIXELS.width - safeMargin * 2);
  const safeAreaHeight = Math.max(1, A4_CANVAS_PIXELS.height - safeMargin * 2);

  const workingImage = image.clone();
  const resizedFrom = { width: workingImage.width, height: workingImage.height };
  workingImage.contain(safeAreaWidth, safeAreaHeight, Image.RESIZE_NEAREST_NEIGHBOR);
  const resizedTo = { width: workingImage.width, height: workingImage.height };

  const offsetX = Math.floor(safeMargin + (safeAreaWidth - workingImage.width) / 2);
  const offsetY = Math.floor(safeMargin + (safeAreaHeight - workingImage.height) / 2);
  canvas.composite(workingImage, offsetX, offsetY);

  const jpegBuffer = await canvas.encodeJPEG(92);

  return {
    buffer: jpegBuffer,
    mimeType: 'image/jpeg',
    originalResolution,
    resizedFrom,
    resizedTo,
    finalResolution: { ...A4_CANVAS_PIXELS },
  };
}
