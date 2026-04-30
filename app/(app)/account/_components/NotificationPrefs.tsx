'use client';
import { useState, useTransition } from 'react';
import { updateNotificationPref } from '../notification-actions';

type Prefs = {
  check_in_reminders: boolean;
  weekly_digest: boolean;
  alert_emails: boolean;
};

const ROWS: Array<{
  key: keyof Prefs;
  label: string;
  description: string;
}> = [
  {
    key: 'check_in_reminders',
    label: 'Daily check-in reminder',
    description: "We'll nudge you once a day if you haven't logged your sleep, mood, and movement in the last 36 hours.",
  },
  {
    key: 'weekly_digest',
    label: 'Weekly progress digest',
    description: 'Monday morning: a one-paragraph summary of last week — averages, streaks, and any open alerts.',
  },
  {
    key: 'alert_emails',
    label: 'Health-alert emails',
    description: 'Notify me by email when a lab result, repeat-test reminder, or other alert lands on my dashboard.',
  },
];

export function NotificationPrefs({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [, startTransition] = useTransition();

  const toggle = (key: keyof Prefs) => {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    startTransition(() => {
      void updateNotificationPref(key, next);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {ROWS.map((row) => (
        <label
          key={row.key}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            checked={prefs[row.key]}
            onChange={() => toggle(row.key)}
            style={{ marginTop: 4 }}
          />
          <span>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{row.label}</span>
            <span style={{ display: 'block', fontSize: 13, color: '#6B7A82', marginTop: 2 }}>
              {row.description}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}
