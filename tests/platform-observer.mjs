// Test-only observation. No game state writes, synthetic lifecycle events or focus recovery.
export function createPlatformObserver(ctx, record, capture) {
  let expected = 'preparing';
  let reason = 'startup';
  let interrupted;
  let capturePending;
  let rejectInterrupted;
  const failure = new Promise((_, reject) => { rejectInterrupted = reject; });
  void failure.catch(() => {});
  const held = new Set();
  const stamp = (event, data = {}) => record(ctx.label, event, {
    operation: ctx.operation, stage: ctx.stage, expected, reason,
    driverHeld: [...held], ...data,
  });
  const interrupt = (kind, data = {}) => {
    if (interrupted || expected === 'closing') return;
    interrupted = new Error(`Unexpected platform interruption: ${kind}`);
    interrupted.code = 'PLATFORM_INTERRUPTED';
    ctx.interruption = { kind, at: new Date().toISOString(), expected, reason, ...data };
    stamp('unexpected-interruption', ctx.interruption);
    // Latch before capture: subsequent key/show calls fail, even while capture is pending.
    capturePending = capture('interruption-first', true).catch(error => {
      stamp('interruption-capture-error', { error: String(error) });
    });
    void capturePending.finally(() => rejectInterrupted(interrupted));
  };
  const check = () => { if (interrupted) throw interrupted; };
  const setExpected = (next, why) => { check(); expected = next; reason = why; stamp('expectation'); };
  return {
    stamp, check,
    get expected() { return expected; },
    get held() { return [...held]; },
    get interrupted() { return Boolean(interrupted); },
    async settled() { await capturePending; },
    async race(fn) {
      check();
      const result = await Promise.race([Promise.resolve().then(fn), failure]);
      check(); // Capture may still be pending when the operation itself completes.
      return result;
    },
    async assertVisible() {
      check();
      const state = await ctx.page.evaluate(() => ({ visible: document.visibilityState, focused: document.hasFocus() }));
      if (state.visible !== 'visible' || !state.focused) {
        interrupt('visibility-or-focus-precondition-lost', state);
        check();
      }
    },
    async show(fn) {
      check();
      // Never use activation to hide an interruption that arrived before its event callback.
      if (expected === 'visible') await this.assertVisible();
      setExpected('preparing', 'real-show-restore-focus');
      stamp('show-request');
      await fn();
      try {
        await ctx.page.waitForFunction(() => document.visibilityState === 'visible' && document.hasFocus(), undefined,
          { polling: 100, timeout: 15000 });
      } catch (error) {
        if (!interrupted && error.name === 'TimeoutError') error.code = 'ENVIRONMENT_PRECONDITION';
        throw error;
      }
      check();
      setExpected('visible', 'interactive-operation');
      stamp('show-complete');
    },
    async hide(fn) {
      check();
      if (expected === 'visible') await this.assertVisible();
      setExpected('hidden', ctx.operation);
      stamp('hide-request');
      await fn();
    },
    async navigation(why) {
      check();
      if (expected === 'visible') await this.assertVisible();
      setExpected('preparing', why);
    },
    close(why) { expected = 'closing'; reason = why; stamp('close-expected'); },
    async key(code, down) {
      check();
      if (expected === 'visible') await this.assertVisible();
      check();
      stamp('key-request', { code, down });
      if (down) held.add(code); else held.delete(code);
      await ctx.page.keyboard[down ? 'down' : 'up'](code);
      stamp('key-delivered', { code, down });
      check();
    },
    async attach(page, target = 'game') {
      const binding = '__platformReport';
      if (target === 'game') {
        await page.exposeBinding(binding, (_source, data) => {
          ctx.lastObservation = data;
          stamp('renderer-' + data.event, { target, ...data });
          if (expected === 'visible' && (data.event === 'blur' || data.visibility === 'hidden')) {
            interrupt(data.event === 'blur' ? 'blur' : 'hidden', { observation: data });
          }
        });
        // Await installation before navigation. Browser timestamps survive reload via timeOrigin.
        await page.addInitScript(() => {
          const held = new Set();
          const send = (event, key) => {
            const data = { event, sourceEpochMs: performance.timeOrigin + performance.now(),
              visibility: document.visibilityState, focused: document.hasFocus(), domHeld: [...held],
              diagnostics: { ...document.querySelector('#diagnostics')?.dataset }, ...key };
            window.__platformLifecycleTrace ??= [];
            if (event !== 'sample') window.__platformLifecycleTrace.push(data);
            void window.__platformReport(data).catch(() => {});
          };
          for (const event of ['visibilitychange', 'focus', 'blur', 'beforeunload', 'pagehide']) {
            (event === 'visibilitychange' ? document : window).addEventListener(event, () => {
              if (event === 'blur' || document.visibilityState === 'hidden') held.clear();
              // Event-time HUD data can precede the host's next refresh; subsequent samples
              // and the first-failure snapshot also retain the resulting input / pause state.
              queueMicrotask(() => send(event));
            });
          }
          for (const event of ['keydown', 'keyup']) window.addEventListener(event, e => {
            if (e.type === 'keydown') held.add(e.code); else held.delete(e.code);
            queueMicrotask(() => send(event, { code: e.code, repeat: e.repeat }));
          });
          setInterval(() => send('sample'), 200);
          send('init');
        });
      }
      page.on('close', () => {
        stamp('page-close', { target });
        if (target === 'game') interrupt('page-close');
      });
      page.on('crash', () => { stamp('page-crash', { target }); interrupt('page-crash', { target }); });
    },
    attachBrowser(browser, context) {
      context.on('close', () => { stamp('context-close'); interrupt('context-close'); });
      browser.on('disconnected', () => { stamp('browser-disconnected'); interrupt('browser-disconnected'); });
    },
    processExit(data) { stamp('native-process-exit', data); interrupt('native-process-exit', data); },
  };
}
