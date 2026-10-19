const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../src/game/engine.ts'), 'utf8');
const ast = ts.createSourceFile('engine.ts', source, ts.ScriptTarget.Latest, true);
const extract = name => {
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(node, name);
  return ts.transpileModule(node.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
};
const video = { videoWidth: 2, videoHeight: 4, currentTime: 1 };
for (const contextAvailable of [true, false]) {
  const cache = new Map();
  let disposed = 0, transformed = 0, drawn = 0;
  const context = {
    drawImage() { drawn++; },
    getImageData() { return { data: new Uint8ClampedArray(32) }; },
    putImageData() {}, clearRect() {},
  };
  const canvas = { width: 0, height: 0, getContext: () => contextAvailable ? context : null };
  const sandbox = {
    bossVideoFrameCache: cache,
    document: { createElement: () => canvas },
    createBossWebGLRenderer: () => ({ canvas: {}, render: () => false, dispose() { disposed++; } }),
    transformBossVideoPixels() { transformed++; },
  };
  vm.createContext(sandbox);
  vm.runInContext(extract('getBossVideoFrame'), sandbox);
  const frame = sandbox.getBossVideoFrame({ id: 'test' }, video);
  assert.equal(disposed, 1);
  if (contextAvailable) {
    assert.equal(frame.canvas, canvas);
    assert.equal(drawn, 1);
    assert.equal(transformed, 1);
    assert.equal(cache.get('test').lastTime, 1);
    sandbox.getBossVideoFrame({ id: 'test' }, video);
    assert.equal(transformed, 1, 'cache successful frame');
  } else {
    assert.equal(frame, null);
    assert.equal(cache.size, 0, 'failed fallback must retry on a later frame');
  }
}
for (const mode of ['ok', 'lost', 'error', 'throw']) {
  const gl = new Proxy({
    NO_ERROR: 0,
    isContextLost: () => mode === 'lost',
    getError: () => mode === 'error' ? 1282 : 0,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    texImage2D() { if (mode === 'throw') throw Error('upload failed'); },
  }, { get(target, name) { return name in target ? target[name] : () => ({}); } });
  const sandbox = { Float32Array, document: { createElement: () => ({ width: 0, height: 0, getContext: () => gl }) } };
  vm.createContext(sandbox);
  vm.runInContext(extract('createBossWebGLRenderer'), sandbox);
  const renderer = sandbox.createBossWebGLRenderer(2, 2);
  assert.ok(renderer);
  assert.equal(renderer.render(video, 2, 2), mode === 'ok', mode);
}
console.log('Boss renderer fallback: PASS (successful rendering, context loss, GL error, upload exception, Canvas fallback, failed-context retry, frame caching).');
