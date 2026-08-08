import React, { useState, useMemo, useEffect } from "react";
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

export default function WordListScreen() {
  const [search, setSearch]           = useState("");
  const [levelFilter, setLevelFilter] = useState("All");
  const [selectedWord, setSelectedWord] = useState(ALL_WORDS[0]?.word);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ALL_WORDS.filter((w) =>
      (levelFilter === "All" || w.levels.includes(levelFilter)) &&
      (!q || w.word.toLowerCase().includes(q))
    );
  }, [search, levelFilter]);

  // Keep a valid selection as the filter/search changes.
  useEffect(() => {
    if (!filtered.some((w) => w.word === selectedWord)) {
      setSelectedWord(filtered[0]?.word);
    }
  }, [filtered, selectedWord]);

  const sel = ALL_WORDS.find((w) => w.word === selectedWord) || filtered[0];

  return (
    <div className="wordlist">
      <div className="wordlist-head">
        <div className="landing-icon" style={{ background: "#e4f6ff" }}>📖</div>
        <div className="landing-head-txt">
          <h1 className="landing-h1">Word List</h1>
          <div className="landing-sub">{ALL_WORDS.length} vocabulary words</div>
        </div>
      </div>

      <div className="wordlist-controls">
        <input
          className="wl2-search"
          placeholder="Search words…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="wl2-filters">
          {["All", "A", "B", "C"].map((l) => (
            <button
              key={l}
              className={`wl2-filter ${levelFilter === l ? "active" : ""}`}
              onClick={() => setLevelFilter(l)}
            >
              {l === "All" ? "All" : `Level ${l}`}
            </button>
          ))}
        </div>
      </div>

      <div className="wl2-panes">
        {/* Left: list */}
        <div className="wl2-list">
          {filtered.length === 0 && <div className="wl2-empty">No words found.</div>}
          {filtered.map((w) => (
            <button
              key={w.word}
              className={`wl2-row ${selectedWord === w.word ? "active" : ""}`}
              onClick={() => setSelectedWord(w.word)}
            >
              <span className="wl2-word">{w.word}</span>
              <span className="wl2-levels">{w.levels.join(" · ")}</span>
            </button>
          ))}
        </div>

        {/* Right: detail */}
        {sel && (
          <div className="wl2-detail">
            <div className="wl2-detail-word">{sel.word}</div>
            <div className="wl2-detail-levels">
              {sel.levels.map((l) => `Level ${l}`).join(", ")}
            </div>
            {sel.definition && (
              <div className="wl2-defn">{sel.definition}</div>
            )}
            <div className="wl2-rel">
              <div className="wl2-rel-col">
                <div className="wl2-rel-lbl">SAME AS</div>
                <div className="wl2-rel-val">{sel.synonym || "—"}</div>
              </div>
              <div className="wl2-rel-col">
                <div className="wl2-rel-lbl">OPPOSITE</div>
                <div className="wl2-rel-val">{sel.antonym || "—"}</div>
              </div>
            </div>
            {!sel.definition && !sel.synonym && !sel.antonym && (
              <div className="wl2-defn wl2-defn--muted">No extra detail for this word yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
