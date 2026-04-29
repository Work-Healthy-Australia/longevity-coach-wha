"use client";

import { useCallback, useState, useTransition } from "react";
import type {
  AlcoholValue,
  AllergyEntry,
  CancerHistoryEntry,
  CancerHistoryValue,
  CardConditionType,
  CauseCategory,
  FamilyMemberCard,
  FamilyMemberConditionEntry,
  FamilyRelationship,
  FieldDef,
  ResponsesByStep,
  SmokingValue,
} from "@/lib/questionnaire/schema";
import {
  ALCOHOL_VALUES,
  CARD_CONDITIONS,
  CAUSE_CATEGORIES,
  FAMILY_RELATIONSHIPS,
  SMOKING_VALUES,
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
          <>
            <p className="step-callout">
              <a href="/legal/collection-notice" target="_blank" rel="noreferrer">
                Read the Personal information collection notice (APP 5) →
              </a>
            </p>
            <p className="step-disclosure">
              Longevity Coach does not use your health data to train AI models.
              Your data is used solely to personalise your assessment and coaching.
            </p>
          </>
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
    case "family_members":
      return (
        <FamilyMembersField field={field} value={value} onChange={onChange} />
      );
  }
}

// ---------------------------------------------------------------------------
// Family members — per-relative card UX. Mirrors <CancerHistoryField> shape:
// fully controlled component, internal state limited to expand/collapse only.
// ---------------------------------------------------------------------------

const RELATIONSHIP_LABELS: Record<FamilyRelationship, string> = {
  mother: "Mother",
  father: "Father",
  sister: "Sister",
  brother: "Brother",
  maternal_grandmother: "Maternal grandmother",
  maternal_grandfather: "Maternal grandfather",
  paternal_grandmother: "Paternal grandmother",
  paternal_grandfather: "Paternal grandfather",
  aunt: "Aunt",
  uncle: "Uncle",
};

const CAUSE_LABELS: Record<CauseCategory, string> = {
  cardiovascular: "Heart/Cardiovascular",
  cancer: "Cancer",
  neurovascular: "Stroke/Neurovascular",
  neurodegenerative: "Dementia/Alzheimer's",
  trauma_accident: "Accident/Trauma",
  suicide_mental_health: "Mental Health",
  other: "Other",
  unknown: "Unknown",
};

const SMOKING_LABELS: Record<SmokingValue, string> = {
  never: "Never smoked",
  former: "Former smoker",
  current_social: "Current — social",
  current_light: "Current — light",
  current_moderate: "Current — moderate",
  current_heavy: "Current — heavy",
  unknown: "Don't know",
};

const ALCOHOL_LABELS: Record<AlcoholValue, string> = {
  never: "Never",
  light: "Light",
  moderate: "Moderate",
  heavy: "Heavy",
  unknown: "Don't know",
};

const CONDITION_LABELS: Record<CardConditionType, string> = {
  cardiovascular: "Heart disease / stroke",
  neurodegenerative: "Dementia / Alzheimer's / Parkinson's",
  diabetes: "Type 2 diabetes",
  osteoporosis: "Osteoporosis / fractures",
};

// Smoking options shown when relative is alive vs. deceased.
// Alive: full set. Deceased: drops "former" — final state is what's recorded.
const SMOKING_OPTIONS_ALIVE: readonly SmokingValue[] = SMOKING_VALUES;
const SMOKING_OPTIONS_DECEASED: readonly SmokingValue[] = SMOKING_VALUES.filter(
  (v) => v !== "former",
);

function uid(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Pure helpers exposed for testing — no DOM, no hooks.
export function addCard(cards: FamilyMemberCard[]): FamilyMemberCard[] {
  return [
    ...cards,
    {
      id: uid(),
      relationship: "",
      is_alive: true,
      conditions: [],
    },
  ];
}

export function setCardField<K extends keyof FamilyMemberCard>(
  cards: FamilyMemberCard[],
  id: string,
  key: K,
  value: FamilyMemberCard[K],
): FamilyMemberCard[] {
  return cards.map((c) => (c.id === id ? { ...c, [key]: value } : c));
}

export function toggleCondition(
  cards: FamilyMemberCard[],
  id: string,
  type: CardConditionType,
): FamilyMemberCard[] {
  return cards.map((c) => {
    if (c.id !== id) return c;
    const has = c.conditions.find((e) => e.type === type);
    if (has) {
      return { ...c, conditions: c.conditions.filter((e) => e.type !== type) };
    }
    const entry: FamilyMemberConditionEntry = { type };
    return { ...c, conditions: [...c.conditions, entry] };
  });
}

export function setConditionAge(
  cards: FamilyMemberCard[],
  id: string,
  type: CardConditionType,
  age: number | undefined,
): FamilyMemberCard[] {
  return cards.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      conditions: c.conditions.map((e) =>
        e.type === type ? { ...e, age_onset: age } : e,
      ),
    };
  });
}

export function removeCard(
  cards: FamilyMemberCard[],
  id: string,
): FamilyMemberCard[] {
  return cards.filter((c) => c.id !== id);
}

export function FamilyMembersField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const cards: FamilyMemberCard[] = Array.isArray(value)
    ? (value as FamilyMemberCard[])
    : [];

  // Internal expand/collapse state only. Default-expand any card with empty
  // relationship (fresh adds open up so the member fills them in).
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const init = new Set<string>();
    for (const c of cards) {
      if (!c.relationship) init.add(c.id);
    }
    return init;
  });

  const isExpanded = (id: string) => expanded.has(id);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const next = addCard(cards);
    const newCard = next[next.length - 1]!;
    setExpanded((prev) => {
      const e = new Set(prev);
      e.add(newCard.id);
      return e;
    });
    onChange(next);
  };

  const handleRemove = (id: string) => {
    setExpanded((prev) => {
      const e = new Set(prev);
      e.delete(id);
      return e;
    });
    onChange(removeCard(cards, id));
  };

  const updateField = <K extends keyof FamilyMemberCard>(
    id: string,
    key: K,
    v: FamilyMemberCard[K],
  ) => {
    onChange(setCardField(cards, id, key, v));
  };

  const handleToggleCondition = (id: string, type: CardConditionType) => {
    onChange(toggleCondition(cards, id, type));
  };

  const handleConditionAge = (
    id: string,
    type: CardConditionType,
    age: number | undefined,
  ) => {
    onChange(setConditionAge(cards, id, type, age));
  };

  return (
    <div className="field family-members-field">
      <label>
        {field.label}
        {field.optional && <span className="optional">(optional)</span>}
      </label>
      {field.helpText && <p className="field-help">{field.helpText}</p>}

      <div className="family-members-list">
        {cards.map((card) => {
          const open = isExpanded(card.id);
          const relLabel = card.relationship
            ? RELATIONSHIP_LABELS[card.relationship as FamilyRelationship]
            : "Relative";
          const meta = card.is_alive
            ? `Living · age ${card.current_age ?? "?"}`
            : `Deceased · died at ${card.age_at_death ?? "?"}`;
          const ageValue = card.is_alive ? card.current_age : card.age_at_death;
          const smokingOptions = card.is_alive
            ? SMOKING_OPTIONS_ALIVE
            : SMOKING_OPTIONS_DECEASED;

          return (
            <div
              key={card.id}
              className={`family-card ${open ? "family-card-expanded" : ""}`}
            >
              <div
                className="family-card-head"
                onClick={(e) => {
                  // Don't toggle if the click came from the remove button.
                  if ((e.target as HTMLElement).closest(".family-card-remove")) {
                    return;
                  }
                  toggleExpanded(card.id);
                }}
              >
                <div className="family-card-head-who">
                  <div className="family-card-avatar" aria-hidden="true">
                    👤
                  </div>
                  <div>
                    <div className="family-card-rel">{relLabel}</div>
                    <div className="family-card-meta">{meta}</div>
                  </div>
                </div>
                <div className="family-card-actions">
                  <span className="family-card-chevron" aria-hidden="true">
                    {open ? "▲" : "▼"}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost family-card-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(card.id);
                    }}
                    aria-label={`Remove ${relLabel}`}
                  >
                    ×
                  </button>
                </div>
              </div>

              {open && (
                <div className="family-card-body">
                  <div className="field">
                    <label className="family-card-sub-label">Relationship</label>
                    <select
                      value={card.relationship}
                      onChange={(e) =>
                        updateField(
                          card.id,
                          "relationship",
                          e.target.value as FamilyRelationship | "",
                        )
                      }
                      aria-label="Relationship"
                    >
                      <option value="" disabled>
                        Select…
                      </option>
                      {FAMILY_RELATIONSHIPS.map((r) => (
                        <option key={r} value={r}>
                          {RELATIONSHIP_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="family-card-vital-toggle">
                    <span className="family-card-sub-label">Vital status</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={card.is_alive}
                      aria-label={
                        card.is_alive ? "Living (toggle to deceased)" : "Deceased (toggle to living)"
                      }
                      className={`family-card-switch ${card.is_alive ? "alive" : "deceased"}`}
                      onClick={() =>
                        updateField(card.id, "is_alive", !card.is_alive)
                      }
                    >
                      <span className="family-card-switch-track">
                        <span className="family-card-switch-thumb" />
                      </span>
                      <span className="family-card-switch-text">
                        {card.is_alive ? "Living" : "Deceased"}
                      </span>
                    </button>
                  </div>

                  <div className="field">
                    <label className="family-card-sub-label">
                      {card.is_alive ? "Current age" : "Age at death"}
                    </label>
                    <div className="input-suffix">
                      <input
                        type="number"
                        min={0}
                        max={130}
                        step={1}
                        value={ageValue ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? undefined : Number(e.target.value);
                          updateField(
                            card.id,
                            card.is_alive ? "current_age" : "age_at_death",
                            v,
                          );
                        }}
                        aria-label={card.is_alive ? "Current age" : "Age at death"}
                      />
                      <span className="suffix">years</span>
                    </div>
                  </div>

                  {!card.is_alive && (
                    <div className="field">
                      <label className="family-card-sub-label">Cause of death</label>
                      <div className="family-card-cause-grid">
                        {CAUSE_CATEGORIES.map((cat) => {
                          const on = card.cause_category === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              className={`family-card-cause-btn ${on ? "on" : ""}`}
                              onClick={() => updateField(card.id, "cause_category", cat)}
                            >
                              {CAUSE_LABELS[cat]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="family-card-grid-2">
                    <div className="field">
                      <label className="family-card-sub-label">Smoking</label>
                      <select
                        value={card.smoking_status ?? ""}
                        onChange={(e) =>
                          updateField(
                            card.id,
                            "smoking_status",
                            (e.target.value || undefined) as SmokingValue | undefined,
                          )
                        }
                        aria-label="Smoking status"
                      >
                        <option value="">Select…</option>
                        {smokingOptions.map((s) => (
                          <option key={s} value={s}>
                            {SMOKING_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="family-card-sub-label">Alcohol</label>
                      <select
                        value={card.alcohol_use ?? ""}
                        onChange={(e) =>
                          updateField(
                            card.id,
                            "alcohol_use",
                            (e.target.value || undefined) as AlcoholValue | undefined,
                          )
                        }
                        aria-label="Alcohol use"
                      >
                        <option value="">Select…</option>
                        {ALCOHOL_VALUES.map((a) => (
                          <option key={a} value={a}>
                            {ALCOHOL_LABELS[a]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="field">
                    <label className="family-card-sub-label">Conditions</label>
                    <div className="family-card-conditions-list">
                      {CARD_CONDITIONS.map((type) => {
                        const entry = card.conditions.find((c) => c.type === type);
                        const on = !!entry;
                        return (
                          <div key={type} className="family-card-condition-row">
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              aria-label={CONDITION_LABELS[type]}
                              className={`family-card-condition-btn ${on ? "on" : ""}`}
                              onClick={() => handleToggleCondition(card.id, type)}
                            >
                              <span className="family-card-condition-tick">
                                {on ? "✓" : ""}
                              </span>
                              {CONDITION_LABELS[type]}
                            </button>
                            {on && (
                              <div className="family-card-condition-age">
                                <span>at age</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={130}
                                  step={1}
                                  value={entry?.age_onset ?? ""}
                                  onChange={(e) => {
                                    const v =
                                      e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value);
                                    handleConditionAge(card.id, type, v);
                                  }}
                                  aria-label={`${CONDITION_LABELS[type]} age of onset`}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className="family-card-add"
          onClick={handleAdd}
        >
          + Add family member
        </button>
      </div>
    </div>
  );
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
