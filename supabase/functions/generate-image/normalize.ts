import FrameBuffer from 'https://deno.land/x/imagescript@1.3.0/v2/framebuffer.mjs';
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

type SupportedImageType = 'jpeg' | 'png' | 'tiff';
type SupportedMimeType = 'image/jpeg' | 'image/jpg' | 'image/png' | 'image/tiff';

const MAGIC_NUMBERS = {
  png: 0x89504e47,
  jpeg: 0xffd8ff,
  tiffLittleEndian: 0x49492a00,
  tiffBigEndian: 0x4d4d002a,
};

const mimeTypeToImageType: Record<SupportedMimeType, SupportedImageType> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/tiff': 'tiff',
};

function concatSegments(segments: Uint8Array[]): Uint8Array {
  const total = segments.reduce((sum, segment) => sum + segment.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;

  for (const segment of segments) {
    result.set(segment, offset);
    offset += segment.byteLength;
  }

  return result;
}

function detectImageType(bytes: Uint8Array): SupportedImageType | 'gif' | null {
  if (bytes.byteLength < 4) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (view.getUint32(0, false) === MAGIC_NUMBERS.png) return 'png';
  if ((view.getUint32(0, false) >>> 8) === MAGIC_NUMBERS.jpeg) return 'jpeg';
  const tiffSignature = view.getUint32(0, false);
  if (tiffSignature === MAGIC_NUMBERS.tiffLittleEndian || tiffSignature === MAGIC_NUMBERS.tiffBigEndian) return 'tiff';
  if ((view.getUint32(0, false) >>> 8) === 0x474946) return 'gif';
  return null;
}

function normalizeMimeType(mimeType: string): SupportedMimeType {
  const normalized = mimeType.trim().toLowerCase() as SupportedMimeType;
  if (!mimeTypeToImageType[normalized]) {
    throw new Error(`Unsupported mime type for normalization: ${mimeType}`);
  }
  return normalized;
}

function validateMimeTypeAgainstContent(bytes: Uint8Array, mimeType: SupportedMimeType): SupportedImageType {
  const expectedType = mimeTypeToImageType[mimeType];
  const detectedType = detectImageType(bytes);

  if (detectedType && detectedType !== expectedType) {
    throw new Error(`Provided mime type (${mimeType}) does not match detected image type (${detectedType})`);
  }

  return expectedType;
}

async function decodeUsingMimeType(bytes: Uint8Array, mimeType: SupportedMimeType): Promise<Image> {
  validateMimeTypeAgainstContent(bytes, mimeType);

  // ImageScript drops EXIF/metadata on decode/encode because it only transports raw pixel data.
  return Image.decode(bytes);
}

function stripExifFromJpeg(bytes: Uint8Array): { buffer: Uint8Array; stripped: boolean } {
  const looksLikeJpeg = bytes.byteLength >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!looksLikeJpeg) return { buffer: bytes, stripped: false };

  const segments: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI marker
  let offset = 2;
  let stripped = false;

  while (offset + 3 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) break;

    const marker = bytes[offset + 1];

    // Start of Scan: copy the remainder (contains entropy-coded data + EOI) and finish.
    if (marker === 0xda) {
      segments.push(bytes.subarray(offset));
      break;
    }

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const segmentEnd = offset + 2 + length;
    if (segmentEnd > bytes.byteLength) break;

    const isExif = marker === 0xe1; // APP1 (EXIF / XMP)
    if (!isExif) {
      segments.push(bytes.subarray(offset, segmentEnd));
    } else {
      stripped = true;
    }

    offset = segmentEnd;
  }

  if (!stripped) {
    return { buffer: bytes, stripped };
  }

  return { buffer: concatSegments(segments), stripped };
}

function resizeToContain(image: Image, maxWidth: number, maxHeight: number) {
  const resizedFrom = { width: image.width, height: image.height };

  const scaleFactor = Math.min(maxWidth / image.width, maxHeight / image.height);
  const targetWidth = Math.max(1, Math.floor(image.width * scaleFactor));
  const targetHeight = Math.max(1, Math.floor(image.height * scaleFactor));

  if (targetWidth === image.width && targetHeight === image.height) {
    return { resizedImage: image.clone(), resizedFrom, resizedTo: { ...resizedFrom } };
  }

  // Use framebuffer resizing with linear interpolation to avoid aliasing artifacts (Image API only exposes nearest-neighbor).
  const framebuffer = new FrameBuffer(image.width, image.height, image.bitmap);
  framebuffer.resize('linear', targetWidth, targetHeight);

  const resizedImage = new Image(targetWidth, targetHeight);
  resizedImage.bitmap.set(framebuffer.u8);

  return {
    resizedImage,
    resizedFrom,
    resizedTo: { width: resizedImage.width, height: resizedImage.height },
  };
}

export async function normalizeForLayout(buffer: Uint8Array | ArrayBuffer, mimeType: string): Promise<NormalizedImage> {
  const sourceBytes = toUint8Array(buffer);
  const normalizedMimeType = normalizeMimeType(mimeType);
  const image = await decodeUsingMimeType(sourceBytes, normalizedMimeType);
  const originalResolution = { width: image.width, height: image.height };

  const canvas = new Image(A4_CANVAS_PIXELS.width, A4_CANVAS_PIXELS.height);
  canvas.fill(Image.rgbToColor(255, 255, 255));

  const safeMargin = DEFAULT_SAFE_MARGIN_PX;
  const safeAreaWidth = Math.max(1, A4_CANVAS_PIXELS.width - safeMargin * 2);
  const safeAreaHeight = Math.max(1, A4_CANVAS_PIXELS.height - safeMargin * 2);

  const workingImage = image.clone();
  const { resizedImage, resizedFrom, resizedTo } = resizeToContain(workingImage, safeAreaWidth, safeAreaHeight);

  const offsetX = Math.floor(safeMargin + (safeAreaWidth - resizedImage.width) / 2);
  const offsetY = Math.floor(safeMargin + (safeAreaHeight - resizedImage.height) / 2);
  canvas.composite(resizedImage, offsetX, offsetY);

  const jpegBuffer = await canvas.encodeJPEG(92);
  // Force-strip any EXIF/XMP that could survive in APP1 segments.
  const { buffer: exifSafeBuffer } = stripExifFromJpeg(jpegBuffer);

  return {
    buffer: exifSafeBuffer,
    mimeType: 'image/jpeg',
    originalResolution,
    resizedFrom,
    resizedTo,
    finalResolution: { ...A4_CANVAS_PIXELS },
  };
}
