import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const source = await readFile(new URL('../src/game/bossVideoPixels.ts', import.meta.url), 'utf8');
const js = source.replace(/:\s*(?:Uint8ClampedArray|number|void)/g, '');
const helperUrl = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
const { transformBossVideoPixels } = await import(helperUrl);

function original(data, alphaOffset) {
  for (let index = 0; index < alphaOffset; index += 4) {
    const matte = data[alphaOffset + index];
    if (matte <= 48) {
      data[index] = 0; data[index + 1] = 0; data[index + 2] = 0; data[index + 3] = 0;
      continue;
    }
    const lift = channel => Math.min(255, Math.round(255 * Math.pow(channel / 255, 0.60)));
    data[index] = lift(data[index]); data[index + 1] = lift(data[index + 1]); data[index + 2] = lift(data[index + 2]); data[index + 3] = 255;
  }
}
function compare(data, alphaOffset, label) {
  const expected = data.slice();
  const actual = data.slice();
  original(expected, alphaOffset);
  transformBossVideoPixels(actual, alphaOffset);
  assert.deepEqual(actual, expected, label);
}

// All 256 inputs in each RGB channel, with opaque pixels and matte values at and around threshold.
const exhaustive = new Uint8ClampedArray(256 * 4 + 256 * 4);
for (let i = 0; i < 256; i++) {
  const p = i * 4;
  exhaustive[p] = i; exhaustive[p + 1] = 255 - i; exhaustive[p + 2] = i; exhaustive[p + 3] = (i * 17) & 255;
  exhaustive[256 * 4 + p] = 255;
}
compare(exhaustive, 256 * 4, 'all channel values');
for (const matte of [0, 1, 47, 48, 49, 50, 255]) {
  const data = new Uint8ClampedArray([31, 127, 254, 12, matte, 0, 0, 0]);
  compare(data, 4, `matte ${matte}`);
}
let seed = 0xdecafbad;
const random = length => { const out = new Uint8ClampedArray(length); for (let i = 0; i < length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; out[i] = seed >>> 24; } return out; };
for (const count of [1, 257, 4096, 384 * 384, 512 * 512]) {
  const pixels = random(count * 8);
  compare(pixels, count * 4, `random ${count} pixels`);
}
console.log('Correctness: PASS (all 256 channel inputs, matte boundaries, deterministic random buffers).');

for (const size of [384, 512, 640]) {
  const count = size * size;
  const base = random(count * 8);
  const iterations = size === 384 ? 12 : 7;
  function bench(fn) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn(base.slice());
    return (performance.now() - start) / iterations;
  }
  const oldMs = bench(data => original(data, count * 4));
  const lutMs = bench(data => transformBossVideoPixels(data, count * 4));
  console.log(`${size}x${size}: legacy ${oldMs.toFixed(2)} ms/frame; LUT ${lutMs.toFixed(2)} ms/frame; ${(oldMs / lutMs).toFixed(2)}x speedup`);
}
