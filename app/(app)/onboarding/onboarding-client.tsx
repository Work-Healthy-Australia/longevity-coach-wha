"use client";

import { useCallback, useState, useTransition } from "react";
import type { FieldDef, ResponsesByStep } from "@/lib/questionnaire/schema";
import { onboardingQuestionnaire } from "@/lib/questionnaire/questions";
import { requiredMissing } from "@/lib/questionnaire/validation";
import { saveDraft, submitAssessment } from "./actions";
import "./onboarding.css";

type Props = { initialResponses: ResponsesByStep };

export function OnboardingClient({ initialResponses }: Props) {
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
        {step.description && <p className="step-desc">{step.description}</p>}
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
              {pending ? "Submitting…" : "Submit assessment"}
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
              value={(value as string | number | undefined) ?? ""}
              onChange={(e) =>
                onChange(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
            {field.suffix && <span className="suffix">{field.suffix}</span>}
          </div>
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
  }
}
