type Goals = {
  steps: number;
  sleepHours: number;
  waterGlasses: number;
  meditationMin: number | null;
};

type TodayValues = {
  steps?: number | null;
  sleepHours?: number | null;
  waterGlasses?: number | null;
};

function fillClass(pct: number): string {
  return pct >= 100 ? "" : "partial";
}

function Tile({
  eyebrow,
  value,
  unit,
  target,
  isPct,
}: {
  eyebrow: string;
  value: number | null;
  unit: string;
  target: number;
  isPct?: boolean;
}) {
  const filled = value != null && value > 0;
  const pct = filled ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const fmt = (n: number) =>
    n >= 1000 ? n.toLocaleString() : isPct ? `${n}` : `${n}`;

  return (
    <div className="lc-checkin-tile">
      <span className="lc-checkin-tile-eyebrow">{eyebrow}</span>
      <span className={`lc-checkin-tile-value${filled ? "" : " empty"}`}>
        {filled ? fmt(value!) : "—"}
        {filled && unit && <span className="unit">{unit}</span>}
      </span>
      <div className="lc-checkin-tile-bar">
        <div
          className={`lc-checkin-tile-fill ${fillClass(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="lc-checkin-tile-meta">
        {filled ? `${pct}%` : "Not logged"} of {fmt(target)}{unit ? ` ${unit}` : ""}
      </span>
    </div>
  );
}

export function Scoreboard({
  goals,
  today,
}: {
  goals: Goals;
  today: TodayValues;
}) {
  return (
    <div className="lc-checkin-scoreboard">
      <Tile
        eyebrow="Steps"
        value={today.steps ?? null}
        unit=""
        target={goals.steps}
      />
      <Tile
        eyebrow="Sleep"
        value={today.sleepHours ?? null}
        unit="h"
        target={goals.sleepHours}
      />
      <Tile
        eyebrow="Water"
        value={today.waterGlasses ?? null}
        unit="glasses"
        target={goals.waterGlasses}
      />
      {goals.meditationMin && (
        <Tile
          eyebrow="Meditation"
          value={null}
          unit="min"
          target={goals.meditationMin}
        />
      )}
    </div>
  );
}
