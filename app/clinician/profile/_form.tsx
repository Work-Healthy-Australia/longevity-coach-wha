"use client";

import { useActionState } from "react";

import { saveProfile } from "./actions";

export type ProfileRow = {
  user_uuid: string;
  title: string | null;
  full_name: string;
  qualifications: string | null;
  specialties: string[];
  interests: string[];
  bio: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  languages: string[];
  video_link: string | null;
  available_days: number[];
  available_from: string | null;
  available_to: string | null;
  lunch_break_from: string | null;
  lunch_break_to: string | null;
  session_duration_minutes: number;
  timezone: string;
  is_active: boolean;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function csv(arr: string[] | null | undefined): string {
  return (arr ?? []).join(", ");
}

function daysCsv(arr: number[] | null | undefined): string {
  if (!arr) return "";
  return arr.map((n) => DAYS[n] ?? n).join(", ");
}

export function ProfileForm({ initial }: { initial: ProfileRow | null }) {
  const [state, action, pending] = useActionState(saveProfile, null);

  return (
    <form action={action} className="profile-form">
      {state?.error && <div className="cw-error full">{state.error}</div>}
      {state?.success && <div className="cw-success full">{state.success}</div>}

      <label>Title<input name="title" defaultValue={initial?.title ?? ""} placeholder="Dr." /></label>
      <label>Full name<input name="full_name" defaultValue={initial?.full_name ?? ""} required /></label>
      <label className="full">Qualifications<input name="qualifications" defaultValue={initial?.qualifications ?? ""} /></label>

      <label className="full">Specialties (comma-separated)
        <input name="specialties" defaultValue={csv(initial?.specialties)} placeholder="cardiology, longevity" />
      </label>
      <label className="full">Interests (comma-separated)
        <input name="interests" defaultValue={csv(initial?.interests)} />
      </label>

      <label className="full">Bio<textarea name="bio" defaultValue={initial?.bio ?? ""} rows={4} /></label>

      <label>Contact email<input name="contact_email" type="email" defaultValue={initial?.contact_email ?? ""} /></label>
      <label>Contact phone<input name="contact_phone" defaultValue={initial?.contact_phone ?? ""} /></label>

      <label className="full">Languages (comma-separated)
        <input name="languages" defaultValue={csv(initial?.languages)} placeholder="English, Mandarin" />
      </label>

      <label>Video link<input name="video_link" defaultValue={initial?.video_link ?? ""} /></label>
      <label>Timezone<input name="timezone" defaultValue={initial?.timezone ?? "Australia/Sydney"} /></label>

      <label className="full">Available days (comma-separated, e.g. Mon, Tue, Wed)
        <input name="available_days" defaultValue={daysCsv(initial?.available_days)} />
      </label>

      <label>Available from<input name="available_from" type="time" defaultValue={initial?.available_from ?? ""} /></label>
      <label>Available to<input name="available_to" type="time" defaultValue={initial?.available_to ?? ""} /></label>

      <label>Lunch from<input name="lunch_break_from" type="time" defaultValue={initial?.lunch_break_from ?? ""} /></label>
      <label>Lunch to<input name="lunch_break_to" type="time" defaultValue={initial?.lunch_break_to ?? ""} /></label>

      <label>Session duration (mins)
        <input name="session_duration_minutes" type="number" min="5" max="240" defaultValue={initial?.session_duration_minutes ?? 30} />
      </label>
      <label>Status
        <select name="is_active" defaultValue={(initial?.is_active ?? true) ? "true" : "false"}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </label>

      <div className="submit">
        <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
      </div>
    </form>
  );
}
