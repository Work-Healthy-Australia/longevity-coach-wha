"use client";

import { useCallback, useState, useTransition } from "react";
import type {
  AllergyEntry,
  CancerHistoryEntry,
  CancerHistoryValue,
  FieldDef,
  ResponsesByStep,
} from "@/lib/questionnaire/schema";
import { CANCER_TYPES, RELATIVES, onboardingQuestionnaire } from "@/lib/questionnaire/questions";
import { requiredMissing } from "@/lib/questionnaire/validation";
import { splitFullName } from "@/lib/profiles/name";
import { saveDraft, submitAssessment } from "./actions";
import "./onboarding.css";

type Props = {
  initialResponses: ResponsesByStep;
  userFullName: string | null;
  isEditing?: boolean;
};

export function OnboardingClient({
  initialResponses,
  userFullName,
  isEditing = false,
}: Props) {
  const { firstName } = splitFullName(userFullName);
  const steps = onboardingQuestionnaire.steps;
  const [stepIdx, setStepIdx] = useState(0);
  const [responses, setResponses] = useState<ResponsesByStep>(initialResponses);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const step = steps[stepIdx]!;
  const stepResponses = responses[step.id] ?? {};

  const setField = useCallback(
    (fieldId: string, value: unknown) => {
      setResponses((prev) => ({
        ...prev,
        [step.id]: { ...(prev[step.id] ?? {}), [fieldId]: value },
      }));
    },
    [step.id],
  );

  const persist = useCallback(
    (next: ResponsesByStep) => {
      startTransition(async () => {
        const result = await saveDraft(next);
        if (result.error) setError(result.error);
        else {
          setError(null);
          setSavedAt(new Date());
        }
      });
    },
    [],
  );

  const onNext = () => {
    const missing = requiredMissing(step, stepResponses);
    if (missing) {
      setError(`Please complete: ${missing}`);
      return;
    }
    setError(null);
    persist(responses);
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  const onBack = () => {
    setError(null);
    setStepIdx((i) => Math.max(i - 1, 0));
  };

  const onSubmit = () => {
    const missing = requiredMissing(step, stepResponses);
    if (missing) {
      setError(`Please complete: ${missing}`);
      return;
    }
    startTransition(async () => {
      const result = await submitAssessment(responses);
      if (result.error) setError(result.error);
    });
  };

  const isLast = stepIdx === steps.length - 1;

  return (
    <div className="lc-onboarding">
      {isEditing && (
        <div className="edit-banner" role="status">
          <strong>Editing your previous responses.</strong> Any changes you submit
          will replace the most recent answers; your earlier submission stays in your
          record for audit.
        </div>
      )}
      <div className="progress">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={`step ${i < stepIdx ? "done" : ""} ${i === stepIdx ? "active" : ""}`}
            onClick={() => setStepIdx(i)}
          >
            <div className="dot">{i < stepIdx ? "✓" : i + 1}</div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>{step.label}</h2>
        {step.id === "basics" && firstName && (
          <p className="step-greeting">Hi {firstName} — a few details to get you started.</p>
        )}
        {step.description && <p className="step-desc">{step.description}</p>}
        {step.id === "consent" && (
          <p className="step-callout">
            <a href="/legal/collection-notice" target="_blank" rel="noreferrer">
              Read the Personal information collection notice (APP 5) →
            </a>
          </p>
        )}
        {error && <div className="err">{error}</div>}
        <div className="fields">
          {step.fields.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={stepResponses[field.id]}
              onChange={(v) => setField(field.id, v)}
            />
          ))}
        </div>

        <div className="footer">
          {stepIdx > 0 ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onBack}
              disabled={pending}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <span className="save-state">
            {pending ? "Saving…" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : ""}
          </span>
          {isLast ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSubmit}
              disabled={pending}
            >
              {pending
                ? "Submitting…"
                : isEditing
                  ? "Save updated responses"
                  : "Submit assessment"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onNext}
              disabled={pending}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const labelEl = (
    <label htmlFor={field.id}>
      {field.label}
      {field.optional && <span className="optional">(optional)</span>}
    </label>
  );

  switch (field.type) {
    case "text":
      return (
        <div className="field">
          {labelEl}
          <input
            id={field.id}
            type="text"
            placeholder={field.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "textarea":
      return (
        <div className="field">
          {labelEl}
          <textarea
            id={field.id}
            placeholder={field.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "number":
      return (
        <div className="field">
          {labelEl}
          <div className="input-suffix">
            <input
              id={field.id}
              type="number"
              placeholder={field.placeholder}
              min={field.min}
              max={field.max}
              step={field.step}
              value={(value as string | number | undefined) ?? ""}
              onChange={(e) =>
                onChange(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
            {field.suffix && <span className="suffix">{field.suffix}</span>}
          </div>
        </div>
      );
    case "date":
      return (
        <div className="field">
          {labelEl}
          <input
            id={field.id}
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "select":
      return (
        <div className="field">
          {labelEl}
          <select
            id={field.id}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="" disabled>
              Select…
            </option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    case "multiselect": {
      const selected = (value as string[] | undefined) ?? [];
      return (
        <div className="field">
          {labelEl}
          <div className="chips">
            {field.options?.map((opt) => {
              const isOn = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={`chip ${isOn ? "selected" : ""}`}
                  onClick={() =>
                    onChange(isOn ? selected.filter((s) => s !== opt) : [...selected, opt])
                  }
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case "chips": {
      const selected = (value as string[] | undefined) ?? [];
      const limit = field.maxSelect ?? Infinity;
      return (
        <div className="field">
          {labelEl}
          <div className="chips">
            {field.options?.map((opt) => {
              const isOn = selected.includes(opt);
              const atLimit = selected.length >= limit && !isOn;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={atLimit}
                  className={`chip ${isOn ? "selected" : ""}`}
                  onClick={() =>
                    onChange(isOn ? selected.filter((s) => s !== opt) : [...selected, opt])
                  }
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {field.maxSelect && selected.length > 0 && (
            <span className="chip-counter">
              {selected.length}/{field.maxSelect} selected
            </span>
          )}
        </div>
      );
    }
    case "toggle":
      return (
        <label className="toggle-row" htmlFor={field.id}>
          <span className="toggle-label">{field.label}</span>
          <input
            id={field.id}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
        </label>
      );
    case "allergy_list":
      return (
        <AllergyListField field={field} value={value} onChange={onChange} />
      );
    case "cancer_history":
      return (
        <CancerHistoryField field={field} value={value} onChange={onChange} />
      );
  }
}

function CancerHistoryField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const cv: CancerHistoryValue =
    value && typeof value === "object" && "status" in (value as object)
      ? (value as CancerHistoryValue)
      : { status: "no" };
  const entries = cv.entries ?? [];
  const selectedTypes = new Set(entries.map((e) => e.type));

  const setStatus = (status: CancerHistoryValue["status"]) => {
    if (status === "yes") {
      onChange({ status, entries: cv.entries ?? [] });
    } else {
      // Drop entries when the answer is no/unknown — keeps stored data honest.
      onChange({ status });
    }
  };

  const toggleType = (type: string) => {
    if (selectedTypes.has(type)) {
      onChange({ ...cv, entries: entries.filter((e) => e.type !== type) });
    } else {
      const newEntry: CancerHistoryEntry = { type };
      onChange({ ...cv, entries: [...entries, newEntry] });
    }
  };

  const updateEntry = (type: string, patch: Partial<CancerHistoryEntry>) => {
    onChange({
      ...cv,
      entries: entries.map((e) => (e.type === type ? { ...e, ...patch } : e)),
    });
  };

  const statusOptions: Array<{ value: CancerHistoryValue["status"]; label: string }> = [
    { value: "no", label: "No" },
    { value: "yes", label: "Yes" },
    { value: "unknown", label: "Don't know" },
  ];

  return (
    <div className="field cancer-history">
      <label>
        {field.label}
        {field.optional && <span className="optional">(optional)</span>}
      </label>
      {field.helpText && <p className="field-help">{field.helpText}</p>}

      <div className="cancer-status">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`chip ${cv.status === opt.value ? "selected" : ""}`}
            onClick={() => setStatus(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {cv.status === "yes" && (
        <div className="cancer-detail">
          <p className="field-help">Tap any types that apply. Skip the age if you don't know it.</p>
          <div className="chips">
            {CANCER_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${selectedTypes.has(t) ? "selected" : ""}`}
                onClick={() => toggleType(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {entries.map((entry) => (
            <div key={entry.type} className="cancer-entry">
              <div className="cancer-entry-head">
                <strong>{entry.type}</strong>
                <button
                  type="button"
                  className="btn btn-ghost cancer-remove"
                  onClick={() => toggleType(entry.type)}
                  aria-label={`Remove ${entry.type}`}
                >
                  ×
                </button>
              </div>

              {entry.type === "Other" && (
                <input
                  type="text"
                  placeholder="Which cancer? (e.g. stomach, kidney, brain)"
                  value={entry.otherText ?? ""}
                  onChange={(e) => updateEntry(entry.type, { otherText: e.target.value })}
                />
              )}

              <div className="cancer-entry-grid">
                <div>
                  <label className="cancer-sub-label">Affected relatives</label>
                  <div className="chips">
                    {RELATIVES.filter((r) => r !== "None").map((rel) => {
                      const on = (entry.relatives ?? []).includes(rel);
                      return (
                        <button
                          key={rel}
                          type="button"
                          className={`chip ${on ? "selected" : ""}`}
                          onClick={() => {
                            const cur = entry.relatives ?? [];
                            updateEntry(entry.type, {
                              relatives: on ? cur.filter((r) => r !== rel) : [...cur, rel],
                            });
                          }}
                        >
                          {rel}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="cancer-sub-label">Earliest age of onset</label>
                  <div className="cancer-onset">
                    <div className="input-suffix">
                      <input
                        type="number"
                        placeholder="e.g. 55"
                        disabled={entry.onsetUnknown}
                        value={entry.onsetAge ?? ""}
                        onChange={(e) =>
                          updateEntry(entry.type, {
                            onsetAge: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                      <span className="suffix">years</span>
                    </div>
                    <label className="cancer-unknown">
                      <input
                        type="checkbox"
                        checked={entry.onsetUnknown ?? false}
                        onChange={(e) =>
                          updateEntry(entry.type, {
                            onsetUnknown: e.target.checked,
                            onsetAge: e.target.checked ? undefined : entry.onsetAge,
                          })
                        }
                      />
                      Don't know
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ALLERGY_CATEGORIES: Array<{ value: AllergyEntry["category"]; label: string }> = [
  { value: "medication", label: "Medication" },
  { value: "food", label: "Food" },
  { value: "environment", label: "Environmental" },
  { value: "biologic", label: "Biologic" },
  { value: "other", label: "Other" },
];

const ALLERGY_CRITICALITIES: Array<{ value: AllergyEntry["criticality"]; label: string }> = [
  { value: "low", label: "Low" },
  { value: "high", label: "High (life-threatening / severe)" },
  { value: "unable-to-assess", label: "Unable to assess" },
];

function AllergyListField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const entries: AllergyEntry[] = Array.isArray(value) ? (value as AllergyEntry[]) : [];

  const update = (idx: number, patch: Partial<AllergyEntry>) => {
    onChange(entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };
  const add = () =>
    onChange([
      ...entries,
      { substance: "", category: "medication", criticality: "low" } satisfies AllergyEntry,
    ]);
  const remove = (idx: number) => onChange(entries.filter((_, i) => i !== idx));

  return (
    <div className="field">
      <label>
        {field.label}
        {field.optional && <span className="optional">(optional)</span>}
      </label>
      {field.helpText && <p className="field-help">{field.helpText}</p>}
      <div className="allergy-list">
        {entries.length === 0 && (
          <p className="allergy-empty">No allergies recorded.</p>
        )}
        {entries.map((entry, idx) => (
          <div key={idx} className="allergy-row">
            <input
              type="text"
              placeholder="Substance (e.g. penicillin)"
              value={entry.substance}
              onChange={(e) => update(idx, { substance: e.target.value })}
            />
            <select
              value={entry.category}
              onChange={(e) =>
                update(idx, { category: e.target.value as AllergyEntry["category"] })
              }
            >
              {ALLERGY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select
              value={entry.criticality}
              onChange={(e) =>
                update(idx, { criticality: e.target.value as AllergyEntry["criticality"] })
              }
            >
              {ALLERGY_CRITICALITIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Reaction (optional)"
              value={entry.reaction ?? ""}
              onChange={(e) => update(idx, { reaction: e.target.value })}
            />
            <button
              type="button"
              className="btn btn-ghost allergy-remove"
              onClick={() => remove(idx)}
              aria-label="Remove allergy"
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost allergy-add" onClick={add}>
          + Add allergy
        </button>
      </div>
    </div>
  );
}
