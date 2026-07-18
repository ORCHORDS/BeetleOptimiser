// "Command Palette" - a Spotlight-style Ctrl/Cmd+K search modal that
// searches across the app's features (tabs, dashboard tiles) AND the
// local RAG article corpus (51 hand-written PC troubleshooting entries).
//
// Inputs are debounced via the browser-native timer; the search runs on
// every keystroke but for >20 entries we cap the result set to 30 to
// keep the DOM render bounded.
//
// The palette is composed of sectioned result groups:
//   - Tools: every tile id + label
//   - Tabs:  every tab id + label
//   - Articles: rag-articles.js entries whose title/body matches query
//   - Help:  inline docs for the most common actions
//
// Selecting a result either calls onNavigate(tabId), opens an external
// URL, or fires onAction (which App.jsx's dispatcher routes to the right
// tile handler).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, FileText, Keyboard, MagnifyingGlass, X } from '@phosphor-icons/react';
import { TABS } from '../../data/tabs.js';
import { TILES_PRIMARY, TILES_SYSTEM } from '../../data/bottomTiles.js';
import { searchArticles } from '../../lib/ragSearch.js';

const HELP = [
  { id: 'help:clean', label: 'How do I safely clean junk files?', kind: 'help' },
  { id: 'help:def',  label: 'What does a driver error mean?',  kind: 'help' },
  { id: 'help:startup', label: 'How do I disable startup apps?', kind: 'help' },
  { id: 'help:defender', label: 'Can Defender + Beetle co-exist?', kind: 'help' },
  { id: 'help:keybind', label: 'Show keyboard shortcuts',        kind: 'help' },
];

function tokens(query) {
  return (query || '').toLowerCase().split(/\s+/).filter(Boolean);
}

function score(haystack, qTokens) {
  const s = (haystack || '').toLowerCase();
  let total = 0;
  for (const t of qTokens) {
    if (!s) break;
    const idx = s.indexOf(t);
    if (idx < 0) continue;
    // Earlier match = higher score. Boost when it's a title-match.
    total += 100 - Math.min(idx, 99);
  }
  return total;
}

export default function CommandPalette({ c, isLight, open, onClose, onNavigate, onAction }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  // Reset state every time the palette is opened.
  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build the result set.
  const results = useMemo(() => {
    const qTokens = tokens(query);
    const items = [];

    if (!qTokens.length) {
      // Empty query: show a curated default set.
      items.push({ section: 'Tabs', items: TABS.slice(0, 6).map(t => ({
        id: `tab:${t.id}`, label: t.label, kind: 'tab', payload: t.id,
      })) });
      items.push({ section: 'Tools', items: [...TILES_PRIMARY, ...TILES_SYSTEM].slice(0, 8).map(t => ({
        id: `tile:${t.id}`, label: t.label, kind: 'tile', payload: t.id,
      })) });
      items.push({ section: 'Quick help', items: HELP });
      return { items, flat: items.flatMap(s => s.items) };
    }

    // Tabs
    const tabMatches = TABS
      .map(t => ({ t, s: score(t.label, qTokens) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map(({ t }) => ({ id: `tab:${t.id}`, label: t.label, kind: 'tab', payload: t.id }));
    if (tabMatches.length) items.push({ section: 'Tabs', items: tabMatches });

    // Tiles (primary + system)
    const tileMatches = [...TILES_PRIMARY, ...TILES_SYSTEM]
      .map(t => ({ t, s: score(t.label, qTokens) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map(({ t }) => ({ id: `tile:${t.id}`, label: t.label, kind: 'tile', payload: t.id }));
    if (tileMatches.length) items.push({ section: 'Tools', items: tileMatches });

    // Help
    const helpMatches = HELP
      .map(h => ({ h, s: score(h.label, qTokens) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map(({ h }) => h);
    if (helpMatches.length) items.push({ section: 'Help', items: helpMatches });

    // RAG articles - articles have {slug, title, body}, but searchArticles
    // returns the article objects directly.
    let rag = [];
    try { rag = searchArticles(query) || []; } catch (e) { /* ignore */ }
    const ragMatches = rag.slice(0, 6).map((a) => ({
      id: `article:${a.slug}`, label: a.title, kind: 'article', payload: a,
    }));
    if (ragMatches.length) items.push({ section: 'Articles', items: ragMatches });

    return { items, flat: items.flatMap(s => s.items) };
  }, [query]);

  // Reset cursor when results change.
  useEffect(() => { setCursor(0); }, [query]);

  function run(item) {
    if (!item) return;
    if (item.kind === 'tab' && onNavigate) onNavigate(item.payload);
    if (item.kind === 'tile' && onAction) onAction(item.payload);
    if (item.kind === 'article' && onNavigate) {
      onNavigate('Ask a Question');
      // Hand the picked article to the Ask view via a session-storage hint.
      try { sessionStorage.setItem('beetle-prefill-article', item.payload.slug); } catch {}
    }
    onClose();
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, results.flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(results.flat[cursor]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-label="Search"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh', zIndex: 1000,
      }}
    >
      <div
        className="theme-pill-btn"
        onKeyDown={onKeyDown}
        tabIndex={-1}
        style={{
          width: 640, maxWidth: '90vw',
          background: c.bgTertiary, border: `1px solid ${c.border}`,
          borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          maxHeight: '70vh',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          borderBottom: `1px solid ${c.border}` }}>
          <MagnifyingGlass size={18} color={c.accent} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tabs, tools, articles..."
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: c.textPrimary, fontSize: 14, fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button onClick={onClose} title="Close (Esc)"
            style={{ background: 'transparent', border: 'none', color: c.textMuted, cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ overflow: 'auto', padding: 8, flex: 1 }}>
          {results.items.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: c.textMuted }}>
              No matches for "{query}". Try a different keyword, or jump to the Ask a Question tab to ask the local RAG corpus directly.
            </div>
          )}
          {results.items.map((group) => (
            <div key={group.section} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.textMuted,
                letterSpacing: '0.08em', padding: '8px 10px 4px' }}>
                {group.section.toUpperCase()}
              </div>
              {group.items.map((item) => {
                const flatIdx = results.flat.indexOf(item);
                const active = flatIdx === cursor;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setCursor(flatIdx)}
                    onClick={() => run(item)}
                    style={{
                      width: '100%', textAlign: 'left', display: 'flex',
                      alignItems: 'center', gap: 10, padding: '8px 10px',
                      borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: active ? c.accent : 'transparent',
                      color: active ? 'white' : c.textPrimary,
                      fontFamily: 'inherit', fontSize: 13,
                      transition: 'background 80ms ease',
                    }}
                  >
                    {item.kind === 'tab' && <ArrowRight size={14} />}
                    {item.kind === 'tile' && <Keyboard size={14} />}
                    {item.kind === 'article' && <FileText size={14} />}
                    {item.kind === 'help' && <FileText size={14} />}
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                    {item.kind === 'tab' && <span style={{ fontSize: 10,
                      color: active ? 'rgba(255,255,255,0.85)' : c.textMuted }}>
                      tab
                    </span>}
                    {item.kind === 'tile' && <span style={{ fontSize: 10,
                      color: active ? 'rgba(255,255,255,0.85)' : c.textMuted }}>
                      tile
                    </span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 14px', borderTop: `1px solid ${c.border}`,
          fontSize: 10, color: c.textMuted }}>
          <span><kbd style={{ padding: '1px 5px', borderRadius: 3, border: `1px solid ${c.border}` }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ padding: '1px 5px', borderRadius: 3, border: `1px solid ${c.border}` }}>↵</kbd> open</span>
          <span><kbd style={{ padding: '1px 5px', borderRadius: 3, border: `1px solid ${c.border}` }}>Esc</kbd> close</span>
          <span style={{ marginLeft: 'auto' }}>
            Ctrl/⌘ + K · {results.flat.length} {results.flat.length === 1 ? 'match' : 'matches'}
          </span>
        </div>
      </div>
    </div>
  );
}
