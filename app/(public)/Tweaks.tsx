"use client";

import { useEffect, useState, type ReactNode } from "react";

type Hero = "a" | "b";
type Accent = "orange" | "teal" | "plum";
type State = { hero: Hero; accent: Accent };

const DEFAULTS: State = { hero: "a", accent: "orange" };
const LS_KEY = "lc-home-tweaks";

/**
 * Wraps the home page content with the .lc-home shell that owns the
 * design-system CSS variables, plus a floating Tweaks panel for
 * switching hero variant and accent color (preserved from the design
 * bundle so prototype reviewers can flip between options live).
 */
export function Tweaks({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(DEFAULTS);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (saved) setState((prev) => ({ ...prev, ...saved }));
    } catch {
      // localStorage unavailable — keep defaults.
    }
  }, []);

  function update<K extends keyof State>(key: K, value: State[K]) {
    setState((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <div className="lc-home" data-hero={state.hero} data-accent={state.accent}>
      {children}

      <div className="tweaks">
        <div className="title">
          Tweaks <span className="k">LIVE</span>
        </div>

        <div className="tw-group">
          <div className="lbl">Hero variant</div>
          <div className="tw-seg">
            {(["a", "b"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`tw-opt${state.hero === v ? " on" : ""}`}
                onClick={() => update("hero", v)}
              >
                {v === "a" ? "Safe" : "Bolder"}
              </button>
            ))}
          </div>
        </div>

        <div className="tw-group">
          <div className="lbl">Accent color</div>
          <div className="tw-seg three">
            {(["orange", "teal", "plum"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`tw-opt swatch${state.accent === v ? " on" : ""}`}
                data-v={v}
                onClick={() => update("accent", v)}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
