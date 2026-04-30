"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { bulkInvite, type BulkInviteResult } from "../actions";
import { parseInviteCSV, type InviteRow } from "@/lib/org/csv-invite";

export function InviteClient() {
  const [preview, setPreview] = useState<InviteRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [csvText, setCsvText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [result, formAction, isPending] = useActionState<BulkInviteResult | null, FormData>(
    bulkInvite,
    null,
  );

  const handleCSV = useCallback((text: string) => {
    setCsvText(text);
    const parsed = parseInviteCSV(text);
    setPreview(parsed.rows);
    setParseErrors(parsed.errors);
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => handleCSV(reader.result as string);
      reader.readAsText(file);
    },
    [handleCSV],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => handleCSV(reader.result as string);
      reader.readAsText(file);
    },
    [handleCSV],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setDragOver(false), []);

  const hasResult = result !== null;
  const showPreview = preview.length > 0 && !hasResult;

  return (
    <div>
      {/* Upload zone */}
      {!hasResult && (
        <div
          className={`inv-dropzone ${dragOver ? "inv-dropzone--active" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={onFileChange}
            className="inv-file-input"
          />
          <p className="inv-dropzone-text">
            {dragOver
              ? "Drop your CSV file here"
              : "Click or drag a CSV file here"}
          </p>
          <p className="inv-dropzone-hint">
            Format: email, name (one per line)
          </p>
        </div>
      )}

      {/* Parse errors */}
      {parseErrors.length > 0 && !hasResult && (
        <div className="inv-errors">
          <strong>Parse warnings:</strong>
          <ul>
            {parseErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview table */}
      {showPreview && (
        <div className="inv-preview">
          <div className="inv-preview-header">
            <span className="inv-preview-count">{preview.length} invite{preview.length !== 1 ? "s" : ""} ready</span>
          </div>
          <table className="inv-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  <td>{row.email}</td>
                  <td>{row.name || <span className="inv-empty-name">--</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <form action={formAction}>
            <input type="hidden" name="csv" value={csvText} />
            <div className="inv-actions">
              <button
                type="button"
                className="inv-btn inv-btn--secondary"
                onClick={() => {
                  setPreview([]);
                  setParseErrors([]);
                  setCsvText("");
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                Clear
              </button>
              <button
                type="submit"
                className="inv-btn inv-btn--primary"
                disabled={isPending}
              >
                {isPending ? "Sending invites..." : `Send ${preview.length} invite${preview.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Results */}
      {hasResult && (
        <div className="inv-results">
          {result.sent > 0 && (
            <div className="inv-badge inv-badge--sent">
              {result.sent} invite{result.sent !== 1 ? "s" : ""} sent
            </div>
          )}
          {result.skipped.length > 0 && (
            <div className="inv-badge inv-badge--skipped">
              {result.skipped.length} skipped
              <ul className="inv-badge-list">
                {result.skipped.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="inv-badge inv-badge--error">
              {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}
              <ul className="inv-badge-list">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            className="inv-btn inv-btn--secondary"
            onClick={() => {
              setPreview([]);
              setParseErrors([]);
              setCsvText("");
              if (fileRef.current) fileRef.current.value = "";
              // Reset result by triggering a re-render — useActionState
              // will reset on next form submission, but we clear the UI state
              window.location.reload();
            }}
          >
            Send more invites
          </button>
        </div>
      )}
    </div>
  );
}
