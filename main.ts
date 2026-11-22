// VELVET VAULT — main.ts
// The entry program: copies game/ and screenshots/ from this repository into
// /output (or MAKEFUN_OUTPUT_DIR when run locally) and writes dossier.json
// with buildDossier from vendor/makefun-game.ts. Standard library only, no
// network, and deterministic: two runs write the same bytes.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';
const ROOT = new URL('.', import.meta.url).pathname;

// Do NOT rmSync OUT: in the grader /output is a volume mount point and
// removing it throws (EBUSY/EPERM — force only ignores ENOENT), which
// exits 1 and fails run_completes. mkdirSync alone is enough (kit starter).
mkdirSync(OUT, { recursive: true });

for (const dir of ['game', 'screenshots']) {
  const src = join(ROOT, dir);
  if (existsSync(src)) cpSync(src, join(OUT, dir), { recursive: true });
}

writeFileSync(join(OUT, 'dossier.json'), buildDossier(OUT, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
}));

console.log('wrote ' + OUT + '/dossier.json');
