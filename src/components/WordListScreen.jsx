import React, { useState, useMemo, useRef } from "react";
import { wordData } from "../data/words";
import { bookletWordData } from "../data/bookletWords";

function buildWordMap() {
  const map = {};

  function addEntry(level, item, type) {
    if (!map[item.word]) map[item.word] = { synonym: null, antonym: null, definition: null, levels: new Set() };
    if (type === "synonyms") map[item.word].synonym = item.match;
    if (type === "antonyms") map[item.word].antonym = item.match;
    if (type === "definitionMatch") map[item.word].definition = item.match;
    map[item.word].levels.add(level);
  }

  for (const [level, types] of Object.entries(wordData)) {
    for (const item of (types.synonyms || [])) addEntry(level, item, "synonyms");
    for (const item of (types.antonyms || [])) addEntry(level, item, "antonyms");
  }

  for (const [level, types] of Object.entries(bookletWordData)) {
    for (const item of (types.synonyms || [])) addEntry(level, item, "synonyms");
    for (const item of (types.antonyms || [])) addEntry(level, item, "antonyms");
    for (const item of (types.definitionMatch || [])) addEntry(level, item, "definitionMatch");
  }

  return Object.entries(map)
    .map(([word, d]) => ({ word, synonym: d.synonym, antonym: d.antonym, definition: d.definition, levels: [...d.levels].sort() }))
    .sort((a, b) => a.word.localeCompare(b.word));
}

const ALL_WORDS = buildWordMap();

async function fetchDefinition(word) {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
  if (!res.ok) return null;
  const data = await res.json();
  const meaning = data[0]?.meanings?.[0];
  if (!meaning) return null;
  const pos  = meaning.partOfSpeech;
  const defn = meaning.definitions?.[0]?.definition;
  return defn ? { pos, defn } : null;
}

function WordItem({ w, isOpen, onToggle }) {
  const [defn, setDefn]     = useState(null);  // { pos, defn } | "loading" | "error"
  const fetchedRef           = useRef(false);

  async function handleToggle() {
    onToggle();
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      setDefn("loading");
      const result = await fetchDefinition(w.word);
      setDefn(result || "error");
    }
  }

  const fallback = [
    w.definition && `Meaning: ${w.definition}`,
    w.synonym && `Same as: ${w.synonym}`,
    w.antonym && `Opposite: ${w.antonym}`,
  ].filter(Boolean).join("  ·  ");

  return (
    <div className="wl-item">
      <button
        className={`wl-row ${isOpen ? "open" : ""}`}
        onClick={handleToggle}
      >
        <span className="wl-word">{w.word}</span>
        <div className="wl-row-right">
          <span className="wl-badges">
            {w.levels.map(l => (
              <span key={l} className={`wl-badge wl-badge--${l.toLowerCase()}`}>{l}</span>
            ))}
          </span>
          <span className="wl-chevron">{isOpen ? "▲" : "▼"}</span>
        </div>
      </button>

      {isOpen && (
        <div className="wl-meaning">
          {defn === "loading" && <span className="wl-loading">Looking up…</span>}
          {defn === "error"   && <span>{fallback}</span>}
          {defn && defn !== "loading" && defn !== "error" && (
            <>
              <span className="wl-pos">{defn.pos}</span>
              <span className="wl-defn">{defn.defn}</span>
              {fallback && <span className="wl-hint">{fallback}</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function WordListScreen() {
  const [search, setSearch]           = useState("");
  const [levelFilter, setLevelFilter] = useState("All");
  const [expanded, setExpanded]       = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ALL_WORDS.filter(w =>
      (levelFilter === "All" || w.levels.includes(levelFilter)) &&
      (!q || w.word.toLowerCase().includes(q))
    );
  }, [search, levelFilter]);

  const grouped = useMemo(() => {
    const g = {};
    for (const w of filtered) {
      const letter = w.word[0].toUpperCase();
      if (!g[letter]) g[letter] = [];
      g[letter].push(w);
    }
    return g;
  }, [filtered]);

  function toggle(word) {
    setExpanded(prev => (prev === word ? null : word));
  }

  return (
    <div className="home-screen">
      <div className="home-card">
        <div className="home-title">
          <span className="home-emoji">📖</span>
          <h1>Word List</h1>
          <p className="home-subtitle">{ALL_WORDS.length} vocabulary words</p>
        </div>

        <div className="wl-controls">
          <input
            className="wl-search"
            placeholder="Search words…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="wl-filter-row">
            {["All", "A", "B", "C"].map(l => (
              <button
                key={l}
                className={`wl-filter-btn ${levelFilter === l ? "active" : ""}`}
                onClick={() => setLevelFilter(l)}
              >
                {l === "All" ? "All" : `Level ${l}`}
              </button>
            ))}
          </div>
        </div>

        <div className="wl-count">{filtered.length} words</div>

        <div className="wl-list">
          {Object.entries(grouped).map(([letter, words]) => (
            <div key={letter} className="wl-group">
              <div className="wl-letter-heading">{letter}</div>
              {words.map(w => (
                <WordItem
                  key={w.word}
                  w={w}
                  isOpen={expanded === w.word}
                  onToggle={() => toggle(w.word)}
                />
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="wl-empty">No words found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
