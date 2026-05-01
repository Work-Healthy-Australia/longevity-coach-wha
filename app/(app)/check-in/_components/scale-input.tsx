"use client";

import { useState } from "react";

type Props = {
  name: string;
  defaultValue?: number;
  lowLabel: string;
  highLabel: string;
};

export function ScaleInput({ name, defaultValue = 5, lowLabel, highLabel }: Props) {
  const [value, setValue] = useState<number>(defaultValue);

  return (
    <div className="lc-checkin-field">
      <input type="hidden" name={name} value={value} />
      <div className="lc-checkin-scale" role="radiogroup" aria-label={name}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            className={`lc-checkin-scale-button${value === n ? " active" : ""}`}
            onClick={() => setValue(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="lc-checkin-scale-endpoints">
        <span>1 · {lowLabel}</span>
        <span>10 · {highLabel}</span>
      </div>
    </div>
  );
}
