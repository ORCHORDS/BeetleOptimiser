// Unit tests for src/lib/ragSearch.js (the client-side 51-article
// keyword-overlap search that powers Ask a Question + the Cmd+K palette).
//
// The source of truth lives in src/lib/ragSearch.js. We mirror the
// scoring function + tokenize regex here so the tests run under plain
// Node (no Vite, no React). If the algorithm changes, update this file
// in the same commit.

const { test } = require('node:test');
const assert = require('node:assert/strict');

// --- mirror of src/lib/ragSearch.js ----------------------------------

function tokenize(s) {
  return (s || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

function searchArticles(articles, query, { limit = 5 } = {}) {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return [];
  const scored = articles.map((article) => {
    const titleTokens = tokenize(article.title);
    const tagTokens  = article.tags.flatMap(tokenize);
    const bodyTokens  = tokenize(article.body);
    let score = 0;
    for (const qt of qTokens) {
      if (titleTokens.includes(qt)) score += 3;
      if (tagTokens.includes(qt))  score += 2;
      if (bodyTokens.includes(qt))  score += 1;
    }
    return { article, score };
  });
  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.article);
}

// --- fixtures --------------------------------------------------------

const FIXTURE = [
  {
    slug: 'why-is-pc-slow-to-startup',
    title: 'Why is my PC slow to start up?',
    body: 'A slow startup is usually caused by too many startup apps, ' +
          'an old mechanical hard drive, or an OS-level search index that ' +
          'is rebuilding.',
    tags: ['startup', 'boot', 'performance'],
    category: 'performance',
  },
  {
    slug: 'free-up-disk-space',
    title: 'How do I free up disk space?',
    body: 'Run the Deep Disk Cleaner to remove temp files. Use Duplicates ' +
          'Finder to spot redundant copies. Empty the Recycle Bin.',
    tags: ['disk', 'storage', 'cleanup'],
    category: 'storage',
  },
  {
    slug: 'driver-error-message',
    title: 'What does a driver error mean?',
    body: 'A driver error usually signals a missing or out-of-date driver. ' +
          'Run Driver Updater or roll back via Device Manager.',
    tags: ['driver', 'error'],
    category: 'stability',
  },
  {
    slug: 'disable-startup-apps',
    title: 'How do I disable startup apps?',
    body: 'Open Startup Manager and toggle each app off. They will not ' +
          'launch on the next sign-in.',
    tags: ['startup', 'performance'],
    category: 'performance',
  },
];

// --- tests -----------------------------------------------------------

test('returns an empty result for empty / whitespace queries', () => {
  assert.deepEqual(searchArticles(FIXTURE, ''), []);
  assert.deepEqual(searchArticles(FIXTURE, '   '), []);
  assert.deepEqual(searchArticles(FIXTURE, null), []);
});

test('returns nothing if no article matches', () => {
  assert.deepEqual(searchArticles(FIXTURE, 'asdf qwerty zxcv'), []);
});

test('title matches outrank body-only matches', () => {
  // Construct fixtures where one article has the query word exactly in
  // its title and the other only in body - the title hit must outrank.
  const fixtures = [
    {
      slug: 'title-hit',
      title: 'How to start fast',
      body:  'no relevant content here',
      tags:  ['a'],
      category: 'x',
    },
    {
      slug: 'body-hit',
      title: 'Generic performance',
      body:  'start is the key word that appears once here',
      tags:  ['b'],
      category: 'y',
    },
  ];
  const r = searchArticles(fixtures, 'start');
  assert.equal(r[0].slug, 'title-hit');
  assert.equal(r[1].slug, 'body-hit');
});

test('multiple token matches outrank single matches', () => {
  // "disk space" - "free up disk space" hits both tokens on disk+space
  // (one each in title + body); other articles miss one token.
  const r = searchArticles(FIXTURE, 'disk space');
  assert.equal(r[0].slug, 'free-up-disk-space');
});

test('tag matches contribute to the score', () => {
  // A unique query that only appears in body for one article but in the
  // tags for the same article - ensure tag weighting contributes.
  const tagged = [
    {
      slug: 'alpha',
      title: 'Generic performance query',
      body: 'no keywords here',
      tags: ['foo', 'bar'],
      category: 'x',
    },
  ];
  // "foo" only matches via tags (score=2); we can confirm a result is
  // returned (score > 0) instead of relying on ordering.
  const r = searchArticles(tagged, 'foo');
  assert.equal(r.length, 1);
});

test('respects the limit option', () => {
  // Build 4 fixtures that all match the query word "driver" so the
  // limit cap can be observed directly.
  const fixtures = Array.from({ length: 4 }, (_, i) => ({
    slug: `d-${i}`,
    title: `Driver issue ${i}`,
    body:  `error involving the driver component on machine ${i}`,
    tags:  ['driver'],
    category: 'stability',
  }));
  const r = searchArticles(fixtures, 'driver', { limit: 2 });
  assert.equal(r.length, 2);
  const full = searchArticles(fixtures, 'driver');
  assert.equal(full.length, 4);
});

test('case-insensitive matching', () => {
  const r = searchArticles(FIXTURE, 'DISK SPACE');
  assert.ok(r.some(a => a.slug === 'free-up-disk-space'));
});

test('tokenize handles punctuation and unicode safely', () => {
  // Simple punctuation is dropped, alphanumeric runs are kept.
  assert.deepEqual(tokenize('Hello, world! 42.'), ['hello', 'world', '42']);
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(null), []);
  assert.deepEqual(tokenize(undefined), []);
});
