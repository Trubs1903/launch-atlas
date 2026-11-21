import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildDossier } from '../vendor/makefun-board.ts';

const output = process.env.ATLAS_TEST_OUTPUT ?? new URL('../out/', import.meta.url).pathname;
const snapshot = JSON.parse(readFileSync(new URL('../fixtures/snapshot.json', import.meta.url), 'utf8'));
const board = JSON.parse(readFileSync(join(output, 'board.json'), 'utf8')).rows;

function filesIn(directory) {
  return readdirSync(directory).flatMap(name => {
    const path = join(directory, name);
    assert.ok(/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(name), name);
    const info = statSync(path);
    return info.isDirectory() ? filesIn(path) : [{ path, info }];
  });
}

test('dashboard output respects file, byte and external-resource limits', () => {
  const files = filesIn(join(output, 'dashboard'));
  assert.ok(files.length <= 400);
  assert.ok(files.reduce((total, file) => total + file.info.size, 0) <= 4194304);
  assert.ok(files.some(file => file.path.endsWith('/index.html')));
  assert.ok(files.some(file => file.path.endsWith('.css')));
  assert.ok(files.some(file => file.path.endsWith('.js')));
  assert.ok(files.reduce((total, file) => total + file.info.size, 0) <= 65536);
  for (const file of files) {
    assert.ok(file.info.isFile());
    const content = readFileSync(file.path, 'utf8');
    if (file.path.endsWith('.css')) assert.doesNotMatch(content, /https?:\/\//i);
    if (file.path.endsWith('.html')) {
      assert.doesNotMatch(content, /\b(?:href|src|action|poster)\s*=\s*["']https?:\/\//i);
      assert.doesNotMatch(content, /<style[^>]*>[\s\S]*?https?:\/\//i);
    }
    if (file.path.endsWith('.js')) assert.doesNotMatch(content, /\b(?:import|require|from)\s*\(?\s*["']https?:\/\//i);
  }
});

test('board output satisfies every published structural gate', () => {
  assert.ok(statSync(join(output, 'board.json')).size <= 8388608);
  assert.ok(board.length >= 100 && board.length <= 4000);
  const valid = new Set(snapshot.protocols.map(protocol => protocol.slug));
  const seen = new Set();
  for (const [index, protocol] of board.entries()) {
    assert.ok(valid.has(protocol.slug));
    assert.ok(!seen.has(protocol.slug));
    seen.add(protocol.slug);
    assert.ok(protocol.name.trim());
    assert.equal(protocol.rank, index + 1);
    assert.ok(Number.isSafeInteger(protocol.implied_value_usd) && protocol.implied_value_usd > 0 && protocol.implied_value_usd <= 1e14);
    if (index) assert.ok(board[index - 1].implied_value_usd >= protocol.implied_value_usd);
    assert.ok(protocol.farm_steps.length >= 3 && protocol.farm_steps.length <= 12);
    for (const step of protocol.farm_steps) assert.ok(step.trim().length >= 20 && step.trim().length <= 600);
  }
  assert.ok(snapshot.watchlist.every(slug => seen.has(slug)));
  assert.ok(new Set(board.map(protocol => protocol.implied_value_usd)).size > 1);
});

function jpegSize(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9);
  let offset = 2;
  while (offset < bytes.length - 4) {
    assert.equal(bytes[offset], 0xff);
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    offset += 2 + length;
  }
  throw new Error('JPEG has no supported start-of-frame marker');
}

test('screenshots are bounded real JPEG files with the prescribed dimensions', () => {
  const screenshots = filesIn(join(output, 'screenshots'));
  assert.ok(screenshots.length >= 3 && screenshots.length <= 4);
  for (const screenshot of screenshots) {
    assert.ok(screenshot.info.size <= 524288);
    const size = jpegSize(readFileSync(screenshot.path));
    assert.ok(Math.min(size.width, size.height) >= 800);
    assert.ok(Math.max(size.width, size.height) <= 1440);
  }
});

test('dossier exactly matches the unchanged official library and stays below its cap', () => {
  const actual = readFileSync(join(output, 'dossier.json'));
  assert.ok(actual.byteLength <= 1572864);
  const expected = buildDossier(output, { text_max_bytes: 65536,
    screenshots: { max: 4, max_bytes: 524288 }, dashboard: { max_files: 400, max_bytes: 4194304 } });
  assert.ok(actual.equals(Buffer.from(expected)), 'Dossier bytes must match the official library');
});

test('browser data and official board describe the exact same candidate values and plans', () => {
  const script = readFileSync(join(output, 'data.js'), 'utf8');
  const data = JSON.parse(script.slice('globalThis.ATLAS_DATA='.length).trim().replace(/;$/, ''));
  assert.deepEqual(data.rows, board);
  assert.equal(data.as_of, snapshot.as_of);
});
