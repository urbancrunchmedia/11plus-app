import React, { useState, useRef, useEffect } from "react";
import Icon from "./Icon";

// A custom-rendered dropdown replacing the native <select> for Level/Length
// pickers — a native <option> can only hold plain text, so a locked option
// had to fake a lock with a 🔒 emoji (wrong font, clashes with the app's own
// flat icon set) and its popup's size/position was entirely up to the
// browser, rendering differently across Chrome/Safari/mobile. This one is
// fully our own markup: real <Icon name="lock">, identical everywhere.
export default function Dropdown({ value, options, onChange, ariaLabel, className }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`hero-select-wrap dd-wrap ${className || ""}`} ref={wrapRef}>
      <button
        type="button"
        className="dd-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span>{current?.label}</span>
        <span className="dd-chev">▾</span>
      </button>
      {open && (
        <ul className="dd-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                className={`dd-opt ${o.value === value ? "active" : ""} ${o.locked ? "locked" : ""}`}
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  setOpen(false);
                  onChange(o.value);
                }}
              >
                <span>{o.label}</span>
                {o.locked && <Icon name="lock" size={13} stroke="currentColor" strokeWidth={2.4} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
