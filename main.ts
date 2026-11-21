import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAtlas, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const root = dirname(fileURLToPath(import.meta.url));
function argument(name, fallback) {
  const position = process.argv.indexOf('--' + name);
  const assignment = process.argv.find(value => value.startsWith('--' + name + '='));
  return assignment ? assignment.slice(name.length + 3) : position >= 0 ? process.argv[position + 1] : fallback;
}

export function build(input, output, options = {}) {
  const snapshot = parseSnapshot(JSON.parse(readFileSync(input, 'utf8')));
  const atlas = buildAtlas(snapshot);
  mkdirSync(output, { recursive: true });
  const copyDirectory = (source, destination) => {
    mkdirSync(destination, { recursive: true });
    for (const name of readdirSync(source).sort()) {
      const path = join(source, name);
      if (!statSync(path).isFile() || !/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(name)) {
        throw new Error('Unexpected asset: ' + name);
      }
      copyFileSync(path, join(destination, name));
    }
  };
  copyDirectory(join(root, 'dashboard'), join(output, 'dashboard'));
  const serialized = JSON.stringify(atlas).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  writeFileSync(join(output, 'data.js'), 'globalThis.ATLAS_DATA=' + serialized + ';\n');
  writeFileSync(join(output, 'board.json'), JSON.stringify({ as_of: atlas.as_of, model: atlas.model, rows: atlas.rows }) + '\n');
  if (!options.preview) {
    copyDirectory(join(root, 'screenshots'), join(output, 'screenshots'));
    writeFileSync(join(output, 'dossier.json'), buildDossier(output, {
      text_max_bytes: 65536,
      screenshots: { max: 4, max_bytes: 524288 },
      dashboard: { max_files: 400, max_bytes: 4194304 }
    }));
  }
  return atlas;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = argument('input', '/input/snapshot.json');
  const output = argument('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
  const result = build(input.endsWith('.json') ? input : join(input, 'snapshot.json'), output, { preview: process.argv.includes('--preview') });
  console.log(JSON.stringify({ counts: result.counts, as_of: result.as_of, output }));
}
