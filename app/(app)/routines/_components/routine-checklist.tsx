"use client";

import { useState, useTransition } from "react";
import { toggleRoutineItem } from "../actions";
import { completionPct, type RoutineItem, type RoutineCategory } from "@/lib/wellness/routines";

type CategoryDef = { key: RoutineCategory; label: string; color: string };

export function RoutineChecklist({
  items,
  categories,
  initialCompleted,
}: {
  items: RoutineItem[];
  categories: CategoryDef[];
  initialCompleted: string[];
}) {
  const [completed, setCompleted] = useState<Set<string>>(
    () => new Set(initialCompleted),
  );
  const [pending, startTransition] = useTransition();

  const overallPct = completionPct(completed, items);

  function toggle(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      const arr = Array.from(next);
      startTransition(() => {
        toggleRoutineItem(arr);
      });
      return next;
    });
  }

  return (
    <>
      <div className="lc-routines-progress">
        <div className="lc-routines-progress-bar">
          <div
            className="lc-routines-progress-fill"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <span className="lc-routines-progress-label">
          {overallPct}% complete{pending ? " · saving…" : ""}
        </span>
      </div>

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat.key);
        if (catItems.length === 0) return null;
        const catPct = completionPct(completed, catItems);

        return (
          <section key={cat.key} className="lc-routines-category">
            <div className="lc-routines-cat-header">
              <span
                className="lc-routines-cat-dot"
                style={{ background: cat.color }}
              />
              <h2>{cat.label}</h2>
              <span className="lc-routines-cat-pct">{catPct}%</span>
            </div>
            <div className="lc-routines-items">
              {catItems.map((item) => {
                const done = completed.has(item.id);
                return (
                  <button
                    key={item.id}
                    className={`lc-routine-item ${done ? "done" : ""}`}
                    onClick={() => toggle(item.id)}
                    aria-pressed={done}
                  >
                    <span className="lc-routine-check">
                      {done ? "✓" : "○"}
                    </span>
                    <span className="lc-routine-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
