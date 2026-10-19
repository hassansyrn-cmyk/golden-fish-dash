const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

const sourcePath = new URL('../src/game/managers/AdManager.ts', `file://${__filename}`).pathname;
const source = fs.readFileSync(sourcePath, 'utf8').replace(/import\.meta\.env/g, '__env');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const events = { Rewarded: 'reward', Dismissed: 'dismiss', FailedToShow: 'failed-to-show' };
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function setup({ prepareFails = false, showFails = false } = {}) {
  const listeners = new Map();
  let showing = false;
  let resolveShow;
  let rejectShow;
  const showPromise = new Promise((resolve, reject) => { resolveShow = resolve; rejectShow = reject; });
  if (showFails) setImmediate(() => rejectShow(new Error('show failed')));
  const AdMob = {
    initialize: async () => {},
    requestConsentInfo: async () => ({ canRequestAds: true, status: 'obtained' }),
    prepareRewardVideoAd: async () => { if (prepareFails) throw new Error('no fill'); },
    addListener: async (event, handler) => {
      assert.equal(listeners.has(event), false, `duplicate listener for ${event}`);
      listeners.set(event, handler);
      return { remove: async () => listeners.delete(event) };
    },
    showRewardVideoAd: () => { showing = true; return showPromise; },
  };
  const context = {
    exports: {}, __env: { VITE_ADMOB_TESTING: 'false' }, console: { log() {}, warn() {} },
    require(name) {
      if (name === '@capacitor/core') return { Capacitor: { isNativePlatform: () => true } };
      if (name === '@capacitor-community/admob') return {
        AdMob, RewardAdPluginEvents: events, AdmobConsentStatus: { REQUIRED: 'required' },
        MaxAdContentRating: { ParentalGuidance: 'PG' },
      };
      throw new Error(name);
    },
  };
  vm.runInNewContext(js, context, { filename: sourcePath });
  const manager = context.exports.adManager;
  const promise = manager.showRewarded();
  await tick(); await tick();
  return {
    promise, manager, listeners, get showing() { return showing; },
    reward() {
      const reward = { amount: 1, type: 'reward' };
      listeners.get(events.Rewarded)?.(reward);
      resolveShow(reward); // Android resolves native show promise at reward time.
    },
    dismiss() { showing = false; listeners.get(events.Dismissed)?.(); },
    failToShow() { showing = false; listeners.get(events.FailedToShow)?.(); },
    rejectShow() { showing = false; rejectShow(new Error('show failed')); },
  };
}

(async () => {
  const beforeClose = await setup();
  assert.equal(beforeClose.showing, true);
  beforeClose.reward(); await tick();
  let settled = false;
  beforeClose.promise.then(() => { settled = true; });
  await tick();
  assert.equal(settled, false, 'reward event alone must not resolve showRewarded');
  beforeClose.dismiss();
  assert.equal(await beforeClose.promise, true);
  assert.equal(beforeClose.listeners.size, 0, 'listeners removed after rewarded dismissal');

  const noReward = await setup();
  noReward.dismiss();
  assert.equal(await noReward.promise, false, 'dismissal without reward resolves false');
  assert.equal(noReward.listeners.size, 0);

  const noFill = await setup({ prepareFails: true });
  assert.equal(await noFill.promise, false, 'preload failure resolves false');

  const failed = await setup();
  failed.failToShow();
  assert.equal(await failed.promise, false, 'native failed-to-show resolves false');
  assert.equal(failed.listeners.size, 0);

  const rejected = await setup();
  rejected.rejectShow();
  assert.equal(await rejected.promise, false, 'native show rejection resolves false');
  assert.equal(rejected.listeners.size, 0);

  const concurrent = await setup();
  assert.equal(await concurrent.manager.showRewarded(), false, 'overlapping request is rejected');
  concurrent.reward(); concurrent.dismiss();
  assert.equal(await concurrent.promise, true);
  assert.equal(concurrent.listeners.size, 0, 'one listener set removed exactly once');

  console.log('Rewarded-ad lifecycle regression tests passed (reward-close ordering, no reward, failures, concurrency, listener cleanup).');
})().catch((error) => { console.error(error); process.exitCode = 1; });
