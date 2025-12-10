#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(__dirname, '..');
  const sourcePath = path.join(projectRoot, 'supabase/functions/_shared/image-layout.ts');
  const targetPath = path.join(projectRoot, 'src/lib/image-layout.ts');

  const source = await readFile(sourcePath, 'utf8');
  const banner = [
    '// This file is auto-generated from supabase/functions/_shared/image-layout.ts',
    '// Run `npm run sync:image-layout` after modifying the shared helper.',
    '',
  ].join('\n');

  await writeFile(targetPath, `${banner}${source}`, 'utf8');
  const relativeTarget = path.relative(projectRoot, targetPath);
  console.log(`Synced image layout helper to ${relativeTarget}`);
}

main().catch((error) => {
  console.error('Failed to sync image layout helper:', error);
  process.exit(1);
});
