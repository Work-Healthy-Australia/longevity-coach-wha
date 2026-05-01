import type { LogEntry } from "./check-in-form";

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

type DayCell = {
  date: Date;
  iso: string;
  log: LogEntry | null;
  isToday: boolean;
};

function moodClass(mood: number | null): string {
  if (mood == null) return "";
  if (mood >= 7) return "green";
  if (mood >= 4) return "amber";
  return "red";
}

function streak(logs: LogEntry[]): number {
  if (logs.length === 0) return 0;
  // logs are descending by date; count consecutive days back from most recent
  let count = 1;
  for (let i = 1; i < logs.length; i++) {
    const prev = new Date(logs[i - 1]!.log_date);
    const curr = new Date(logs[i]!.log_date);
    const diff = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) count++;
    else break;
  }
  return count;
}

export function RecentStrip({ logs }: { logs: LogEntry[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells: DayCell[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const log = logs.find((l) => l.log_date === iso) ?? null;
    return { date: d, iso, log, isToday: iso === today.toISOString().slice(0, 10) };
  });

  const s = streak(logs);

  return (
    <section className="lc-checkin-recent">
      <div className="lc-checkin-recent-header">
        <h2>Last 7 days</h2>
        {s >= 2 && (
          <span className="lc-checkin-streak">
            {s}-day streak ✦
          </span>
        )}
      </div>

      <div className="lc-checkin-strip">
        {cells.map((cell) => {
          if (!cell.log) {
            return (
              <div
                key={cell.iso}
                className={`lc-checkin-strip-day empty${cell.isToday ? " today" : ""}`}
              >
                <span className="lc-checkin-strip-weekday">
                  {WEEKDAY_LETTERS[cell.date.getDay()]}
                </span>
                <span className="lc-checkin-strip-date">{cell.date.getDate()}</span>
                <span className="lc-checkin-strip-empty-label">—</span>
              </div>
            );
          }

          return (
            <div
              key={cell.iso}
              className={`lc-checkin-strip-day${cell.isToday ? " today" : ""}`}
              title={cell.log.notes ?? undefined}
            >
              <span className="lc-checkin-strip-weekday">
                {WEEKDAY_LETTERS[cell.date.getDay()]}
              </span>
              <span className="lc-checkin-strip-date">{cell.date.getDate()}</span>
              <span
                className={`lc-checkin-strip-mood-dot ${moodClass(cell.log.mood)}`}
                aria-label={cell.log.mood != null ? `Mood ${cell.log.mood}/10` : "No mood"}
              />
              <span className="lc-checkin-strip-stat">
                {cell.log.sleep_hours != null
                  ? `${cell.log.sleep_hours}h`
                  : <span className="lc-checkin-strip-stat-faint">—</span>}
              </span>
              <span className="lc-checkin-strip-stat">
                {cell.log.steps != null
                  ? cell.log.steps >= 1000
                    ? `${(cell.log.steps / 1000).toFixed(1)}k`
                    : cell.log.steps
                  : <span className="lc-checkin-strip-stat-faint">—</span>}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
