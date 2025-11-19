import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { normalizeForLayout } from '../functions/generate-image/normalize.ts';

const SOURCE_BUCKET = 'story-images';
const TARGET_BUCKET = 'images-stories';
const VALID_IMAGE_TYPES = new Set([
  'cover',
  'scene_1',
  'scene_2',
  'scene_3',
  'scene_4',
  'closing',
  'character',
]);

const APPLY_CHANGES = Deno.env.get('BACKFILL_APPLY') === 'true';
const DELETE_SOURCE = Deno.env.get('BACKFILL_DELETE_SOURCE') === 'true';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[BACKFILL] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface StorageEntry {
  path: string;
  name: string;
  isFolder: boolean;
  metadata: Record<string, unknown> | null;
}

interface LegacyImageDescriptor {
  storyId: string;
  chapterId: string | null;
  imageType: string;
  extension: string;
  sourcePath: string;
}

interface Summary {
  scanned: number;
  eligible: number;
  processed: number;
  uploads: number;
  metadataUpserts: number;
  originalsDeleted: number;
  skipped: number;
  errors: number;
}

const summary: Summary = {
  scanned: 0,
  eligible: 0,
  processed: 0,
  uploads: 0,
  metadataUpserts: 0,
  originalsDeleted: 0,
  skipped: 0,
  errors: 0,
};

const storyUserCache = new Map<string, string | null>();

function isValidUuid(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeChapterId(chapterId: string | null, storyId: string): string | null {
  if (!isValidUuid(chapterId)) {
    return null;
  }
  return chapterId === storyId ? null : chapterId;
}

function inferMimeType(extension: string): string {
  switch (extension.toLowerCase()) {
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function formatResolution(resolution?: { width: number; height: number } | null): string | null {
  if (!resolution) {
    return null;
  }
  return `${resolution.width}x${resolution.height}`;
}

async function listFolder(prefix: string): Promise<StorageEntry[]> {
  const entries: StorageEntry[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage.from(SOURCE_BUCKET).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      throw new Error(`Failed to list storage entries at "${prefix}": ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      const isFolder = !item.id && !item.metadata;
      entries.push({
        path,
        name: item.name,
        isFolder,
        metadata: item.metadata as Record<string, unknown> | null,
      });
    }

    if (data.length < pageSize) {
      break;
    }
  }

  return entries;
}

async function* walkBucket(prefix = ''): AsyncGenerator<StorageEntry> {
  const entries = await listFolder(prefix);
  for (const entry of entries) {
    if (entry.isFolder) {
      yield* walkBucket(entry.path);
    } else {
      yield entry;
    }
  }
}

function parseLegacyPath(path: string): LegacyImageDescriptor | null {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const segments = cleanPath.split('/').filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const fileName = segments[segments.length - 1];
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) {
    return null;
  }

  const extension = fileName.slice(dotIndex + 1);
  const rawType = fileName.slice(0, dotIndex).toLowerCase();
  const normalizedType = rawType.replace(/[-\s]/g, '_');

  const imageType = VALID_IMAGE_TYPES.has(normalizedType) ? normalizedType : null;
  if (!imageType) {
    return null;
  }

  const storyId = segments[0];
  const chapterId = segments.length === 3 ? segments[1] : null;

  return {
    storyId,
    chapterId,
    imageType,
    extension,
    sourcePath: cleanPath,
  };
}

async function ensureTargetDoesNotExist(targetPath: string): Promise<boolean> {
  const folderSegments = targetPath.split('/');
  const fileName = folderSegments.pop() ?? '';
  const folderPath = folderSegments.join('/');
  const { data, error } = await supabase.storage.from(TARGET_BUCKET).list(folderPath, {
    limit: 10,
    search: fileName,
  });

  if (error) {
    throw new Error(`Failed to check target existence for ${targetPath}: ${error.message}`);
  }

  return !(data && data.some((item: { name: string }) => item.name === fileName));
}

async function downloadLegacyImage(sourcePath: string) {
  const { data, error } = await supabase.storage.from(SOURCE_BUCKET).download(sourcePath);
  if (error || !data) {
    throw new Error(`Failed to download ${sourcePath}: ${error?.message ?? 'unknown error'}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

async function getUserIdForStory(storyId: string): Promise<string | null> {
  if (storyUserCache.has(storyId)) {
    return storyUserCache.get(storyId) ?? null;
  }

  const { data, error } = await supabase
    .from('stories')
    .select('user_id')
    .eq('id', storyId)
    .single();

  if (error) {
    console.error(`[BACKFILL] Failed to fetch story owner for ${storyId}:`, error);
    storyUserCache.set(storyId, null);
    return null;
  }

  const userId = data?.user_id ?? null;
  storyUserCache.set(storyId, userId);
  return userId;
}

async function upsertStoryImageMetadata(input: {
  storyId: string;
  chapterId: string | null;
  imageType: string;
  storagePath: string;
  mimeType: string;
  originalResolution: string | null;
  finalResolution: string | null;
  resizedFrom: string | null;
  resizedTo: string | null;
  userId: string;
}) {
  const normalizedChapterId = normalizeChapterId(input.chapterId, input.storyId);

  const payload = {
    story_id: input.storyId,
    chapter_id: normalizedChapterId,
    image_type: input.imageType,
    storage_path: input.storagePath,
    provider: 'legacy',
    fallback_used: false,
    mime_type: input.mimeType,
    original_resolution: input.originalResolution,
    final_resolution: input.finalResolution,
    resized_from: input.resizedFrom,
    resized_to: input.resizedTo,
    latency_ms: null,
    user_id: input.userId,
  };

  const { error: insertError } = await supabase.from('story_images').insert(payload);

  if (!insertError) {
    summary.metadataUpserts += 1;
    return;
  }

  if (insertError.code !== '23505') {
    throw insertError;
  }

  const updateQuery = supabase
    .from('story_images')
    .update(payload)
    .eq('story_id', input.storyId)
    .eq('image_type', input.imageType);

  if (normalizedChapterId === null) {
    updateQuery.is('chapter_id', null);
  } else {
    updateQuery.eq('chapter_id', normalizedChapterId);
  }

  const { error: updateError } = await updateQuery;
  if (updateError) {
    throw updateError;
  }

  summary.metadataUpserts += 1;
}

function buildTargetPath(descriptor: LegacyImageDescriptor): string {
  const baseName = `${descriptor.imageType}.jpeg`;
  if (descriptor.chapterId && descriptor.chapterId.trim().length > 0) {
    return `${descriptor.storyId}/${descriptor.chapterId}/${baseName}`;
  }
  return `${descriptor.storyId}/${baseName}`;
}

async function maybeDeleteLegacySource(path: string) {
  const { error } = await supabase.storage.from(SOURCE_BUCKET).remove([path]);
  if (error) {
    throw new Error(`Failed to delete legacy object ${path}: ${error.message}`);
  }
  summary.originalsDeleted += 1;
}

async function processLegacyImage(entry: StorageEntry) {
  summary.scanned += 1;

  const descriptor = parseLegacyPath(entry.path);
  if (!descriptor) {
    summary.skipped += 1;
    return;
  }

  summary.eligible += 1;
  const targetPath = buildTargetPath(descriptor);

  console.log(`[BACKFILL] Processing ${descriptor.sourcePath} → ${targetPath}`);

  try {
    const targetAvailable = await ensureTargetDoesNotExist(targetPath);
    if (!targetAvailable) {
      console.warn(`[BACKFILL] Target already exists, skipping upload for ${targetPath}`);
    }

    if (!APPLY_CHANGES) {
      summary.processed += 1;
      return;
    }

    const legacyBytes = await downloadLegacyImage(descriptor.sourcePath);
    const mimeType = (entry.metadata?.['mimetype'] as string) ?? inferMimeType(descriptor.extension);
    const normalized = await normalizeForLayout(legacyBytes, mimeType);

    if (targetAvailable) {
      const { error: uploadError } = await supabase.storage.from(TARGET_BUCKET).upload(targetPath, normalized.buffer, {
        contentType: normalized.mimeType,
        cacheControl: '3600',
        upsert: true,
      });

      if (uploadError) {
        throw new Error(`Upload failed for ${targetPath}: ${uploadError.message}`);
      }

      summary.uploads += 1;
    } else {
      console.log(`[BACKFILL] Skipped upload for ${targetPath} (already present). Updating metadata only.`);
    }

    const userId = await getUserIdForStory(descriptor.storyId);
    if (!userId) {
      throw new Error(`No se pudo determinar el usuario propietario de la historia ${descriptor.storyId}`);
    }

    await upsertStoryImageMetadata({
      storyId: descriptor.storyId,
      chapterId: descriptor.chapterId,
      imageType: descriptor.imageType,
      storagePath: targetPath,
      mimeType: normalized.mimeType,
      originalResolution: formatResolution(normalized.originalResolution),
      finalResolution: formatResolution(normalized.finalResolution),
      resizedFrom: formatResolution(normalized.resizedFrom ?? null),
      resizedTo: formatResolution(normalized.resizedTo ?? null),
      userId,
    });

    if (DELETE_SOURCE) {
      await maybeDeleteLegacySource(descriptor.sourcePath);
    }

    summary.processed += 1;
  } catch (error) {
    summary.errors += 1;
    console.error(`[BACKFILL] Error processing ${descriptor.sourcePath}:`, error);
  }
}

async function main() {
  console.log('[BACKFILL] Starting legacy story image migration');
  console.log(`[BACKFILL] APPLY_CHANGES=${APPLY_CHANGES ? 'true' : 'false'} DELETE_SOURCE=${DELETE_SOURCE ? 'true' : 'false'}`);

  for await (const entry of walkBucket()) {
    await processLegacyImage(entry);
  }

  console.log('[BACKFILL] Completed legacy migration with summary:');
  console.table(summary);

  if (!APPLY_CHANGES) {
    console.log('[BACKFILL] Dry run completed. Set BACKFILL_APPLY=true to apply changes.');
  }
}

main().catch((error) => {
  console.error('[BACKFILL] Unhandled error:', error);
  Deno.exit(1);
});
