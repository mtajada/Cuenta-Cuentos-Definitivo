#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const TARGET_WIDTH = 1654;
const TARGET_HEIGHT = 2339;
const VALID_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function usage() {
  console.log('Uso: node scripts/qa/image-audit.js --file urls.txt [url1 url2 ...]');
  console.log('  --file, -f   Archivo de texto con URLs (una por línea)');
  console.log('  URLs         Puedes pasar URLs adicionales como argumentos sueltos');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const urls = [];
  let filePath = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file' || arg === '-f') {
      filePath = args[i + 1] ?? null;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      urls.push(arg);
    }
  }

  if (filePath) {
    const absPath = path.resolve(process.cwd(), filePath);
    const content = fs.readFileSync(absPath, 'utf8');
    const fileUrls = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    urls.push(...fileUrls);
  }

  return urls;
}

function sniffMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

function detectPngSize(buffer) {
  if (buffer.length < 24) return null;
  const signature = buffer.readUInt32BE(0);
  if (signature !== 0x89504e47) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

function detectJpegSize(buffer) {
  if (buffer.length < 4) return null;
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (VALID_SOF_MARKERS.has(marker)) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { width, height };
    }
    const blockLength = buffer.readUInt16BE(offset + 2);
    if (!blockLength || Number.isNaN(blockLength)) {
      break;
    }
    offset += 2 + blockLength;
  }
  return null;
}

function detectImageSize(buffer) {
  const pngSize = detectPngSize(buffer);
  if (pngSize) return pngSize;
  return detectJpegSize(buffer);
}

function pickMime(headerMime, sniffedMime) {
  if (headerMime && headerMime.startsWith('image/')) {
    return headerMime.split(';')[0];
  }
  return sniffedMime;
}

async function downloadImage(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    status: response.status,
    contentType: response.headers.get('content-type'),
    synthIdHint:
      response.headers.get('x-goog-meta-synthid') ||
      response.headers.get('x-goog-safety-label') ||
      response.headers.get('x-synthid') ||
      null,
  };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatIssues(issues) {
  if (!issues.length) return 'OK';
  return issues.join(' | ');
}

async function auditUrl(url) {
  const result = {
    url,
    ok: false,
    issues: [],
    details: {},
  };

  try {
    const download = await downloadImage(url);
    const sniffedMime = sniffMime(download.buffer);
    const resolvedMime = pickMime(download.contentType, sniffedMime);
    const size = detectImageSize(download.buffer);
    const matchesA4 = size ? size.width === TARGET_WIDTH && size.height === TARGET_HEIGHT : false;

    if (resolvedMime !== 'image/jpeg') {
      result.issues.push(`Mime esperado image/jpeg, obtenido ${resolvedMime}`);
    }
    if (!size) {
      result.issues.push('No se pudo leer resolución');
    } else if (!matchesA4) {
      result.issues.push(`Resolución esperada ${TARGET_WIDTH}x${TARGET_HEIGHT}, obtenida ${size.width}x${size.height}`);
    }

    result.details = {
      status: download.status,
      mimeFromHeader: download.contentType ?? 'N/A',
      mimeDetected: sniffedMime,
      mimeFinal: resolvedMime,
      resolution: size ? `${size.width}x${size.height}` : 'desconocida',
      matchesA4,
      bytes: download.buffer.length,
      synthIdHint: download.synthIdHint ?? 'no-header',
    };
    result.ok = result.issues.length === 0;
    return result;
  } catch (error) {
    result.issues.push(error.message);
    return result;
  }
}

async function main() {
  const urls = parseArgs();
  if (!urls.length) {
    usage();
    process.exit(1);
  }

  console.log(`▶️  Auditando ${urls.length} URL(s)...`);
  const results = [];
  for (const url of urls) {
    // eslint-disable-next-line no-await-in-loop
    const audit = await auditUrl(url);
    results.push(audit);
    const { details } = audit;
    console.log(`\nURL: ${url}`);
    console.log(`  Estado: ${audit.ok ? 'OK' : 'FALLO'}`);
    console.log(`  Mime (header/sniff/final): ${details.mimeFromHeader} / ${details.mimeDetected} / ${details.mimeFinal}`);
    console.log(`  Resolución: ${details.resolution} (A4 ${details.matchesA4 ? 'sí' : 'no'})`);
    console.log(`  Peso: ${formatBytes(details.bytes ?? 0)}`);
    console.log(`  SynthID (header): ${details.synthIdHint}`);
    console.log(`  Observaciones: ${formatIssues(audit.issues)}`);
  }

  const stats = results.reduce(
    (acc, item) => {
      if (!item.ok) acc.failures += 1;
      if (item.issues.some((i) => i.startsWith('Mime esperado'))) acc.mimeMismatches += 1;
      if (item.issues.some((i) => i.startsWith('Resolución esperada') || i === 'No se pudo leer resolución')) {
        acc.resolutionMismatches += 1;
      }
      return acc;
    },
    { failures: 0, mimeMismatches: 0, resolutionMismatches: 0 },
  );

  console.log('\nResumen:');
  console.log(`  Total: ${results.length}`);
  console.log(`  OK: ${results.length - stats.failures}`);
  console.log(`  Fallos: ${stats.failures}`);
  console.log(`  Mime incorrecto: ${stats.mimeMismatches}`);
  console.log(`  Resolución incorrecta: ${stats.resolutionMismatches}`);

  if (stats.failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Error inesperado:', error);
  process.exit(1);
});
