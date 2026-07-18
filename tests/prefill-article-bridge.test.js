// Tests for the Ctrl+K palette -> Ask a Question article-bridge.
// Source of truth lives in two files: the publisher in
// src/components/shared/CommandPalette.jsx, and the subscriber in
// src/components/tabs/AskQuestionView.jsx. We mirror their contracts
// here so the logic is exercised under plain Node without React.

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Mirror of the publisher (CommandPalette.run() in production):
function dispatchPrefillEvent(target, slug) {
  // The setItem is the sessionStorage fallback - the listener cleans it.
  target.storage['beetle-prefill-article'] = slug;
  const ev = new target.CustomEvent('beetle-prefill-article', { detail: { slug } });
  target.dispatchEvent(ev);
}

// Mirror of the subscriber (AskQuestionView useEffect in production):
function subscribeToPrefillEvents(target, onSlug) {
  const handler = (e) => {
    const slug = e?.detail?.slug;
    if (!slug) return;
    // Listener also clears the sessionStorage hint.
    delete target.storage['beetle-prefill-article'];
    onSlug(slug);
  };
  target.addEventListener('beetle-prefill-article', handler);
  // Also a mount-time cleanup of any stale sessionStorage value.
  delete target.storage['beetle-prefill-article'];
  return () => target.removeEventListener('beetle-prefill-article', handler);
}

function makeWindow() {
  const listeners = {};
  return {
    storage: {},
    dispatchEvent(ev) {
      const ls = listeners[ev.type] || [];
      for (const fn of ls) fn(ev);
    },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      const ls = listeners[type] || [];
      const i = ls.indexOf(fn);
      if (i >= 0) ls.splice(i, 1);
    },
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
  };
}

test('article bridge: subscriber receives the dispatched slug', () => {
  const win = makeWindow();
  const received = [];
  const unsubscribe = subscribeToPrefillEvents(win, (slug) => received.push(slug));

  dispatchPrefillEvent(win, 'why-is-pc-slow-to-startup');
  assert.deepEqual(received, ['why-is-pc-slow-to-startup']);

  // Idempotent on re-fire
  dispatchPrefillEvent(win, 'how-to-free-disk-space');
  assert.deepEqual(received, ['why-is-pc-slow-to-startup', 'how-to-free-disk-space']);

  unsubscribe();
  // Subscriber detached - no more events
  dispatchPrefillEvent(win, 'should-not-be-seen');
  assert.deepEqual(received, ['why-is-pc-slow-to-startup', 'how-to-free-disk-space']);
});

test('article bridge: dispatch also writes sessionStorage (belt-and-braces fallback)', () => {
  // The listener clears sessionStorage on receipt (so that no re-fires
  // happen on subsequent renders). To observe the write-then-clear
  // sequence, we mount NO listener and verify the dispatch has set
  // the key. A separate test verifies the clear-on-receipt behavior.
  const win = makeWindow();
  dispatchPrefillEvent(win, 'foo');
  assert.equal(win.storage['beetle-prefill-article'], 'foo');
});

test('article bridge: subscriber clears the sessionStorage on receipt', () => {
  const win = makeWindow();
  subscribeToPrefillEvents(win, () => {});

  dispatchPrefillEvent(win, 'foo');
  assert.ok(!('beetle-prefill-article' in win.storage), 'sessionStorage should be cleared by the listener');
});

test('article bridge: subscriber ignores events with missing slug', () => {
  const win = makeWindow();
  const received = [];
  subscribeToPrefillEvents(win, (slug) => received.push(slug));

  // An event with no detail at all -> no detail, so e.detail.slug reads
  // as undefined, which the mirror's `if (!slug) return` catches.
  win.dispatchEvent(new win.CustomEvent('beetle-prefill-article'));
  assert.deepEqual(received, []);
});

test('article bridge: stale sessionStorage value is cleaned on mount', () => {
  const win = makeWindow();
  // Pretend a previous app run left a stale value
  win.storage['beetle-prefill-article'] = 'stale-from-prior-session';

  const received = [];
  subscribeToPrefillEvents(win, (slug) => received.push(slug));

  // The mount-time cleanup should have wiped the stale value
  assert.ok(!('beetle-prefill-article' in win.storage),
    'mount-time cleanup should have removed the stale value');

  // No sendMessage fired - because no event was dispatched, just cleanup
  assert.deepEqual(received, []);
});

test('article bridge: supports multiple subscribers (different views can both listen)', () => {
  const win = makeWindow();
  const a = [];
  const b = [];
  const offA = subscribeToPrefillEvents(win, (slug) => a.push(slug));
  const offB = subscribeToPrefillEvents(win, (slug) => b.push(slug));

  dispatchPrefillEvent(win, 'foo');
  assert.deepEqual(a, ['foo']);
  assert.deepEqual(b, ['foo']);

  // Detach A; B should still receive
  offA();
  dispatchPrefillEvent(win, 'bar');
  assert.deepEqual(a, ['foo']);
  assert.deepEqual(b, ['foo', 'bar']);

  offB();
});
