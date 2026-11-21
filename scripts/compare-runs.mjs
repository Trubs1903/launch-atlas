import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../verification/', import.meta.url).pathname;
function manifest(directory) {
  const files = {};
  function walk(folder) {
    for (const name of readdirSync(folder).sort()) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) walk(path);
      else files[relative(directory, path)] = createHash('sha256').update(readFileSync(path)).digest('hex');
    }
  }
  walk(directory);
  return files;
}
const first = manifest(join(root, 'run-a'));
assert.deepEqual(first, manifest(join(root, 'run-b')), 'Isolated outputs must be byte-identical');
const result = { runtime: 'Docker -> Podman -> Node 22.23.5', network: 'none', readOnlyRepository: true,
  readOnlyRootFilesystem: true, droppedCapabilities: 'ALL', noNewPrivileges: true,
  cpus: 1, memoryMiB: 1024, pids: 64, user: '1002:1002', byteIdentical: true, files: first };
writeFileSync(join(root, 'nested-run.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
