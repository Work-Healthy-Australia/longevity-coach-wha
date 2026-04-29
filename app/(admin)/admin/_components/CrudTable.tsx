"use client";

import { useState, useTransition } from "react";

export type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

export function CrudTable<T extends { id: string; is_active?: boolean }>({
  rows,
  columns,
  onCreate,
  onPatch,
  createForm,
  emptyText = "No rows yet.",
}: {
  rows: T[];
  columns: Column<T>[];
  onCreate?: (form: HTMLFormElement) => Promise<void>;
  onPatch?: (id: string, body: Record<string, unknown>) => Promise<void>;
  createForm?: React.ReactNode;
  emptyText?: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleActive(row: T) {
    if (!onPatch) return;
    setError(null);
    startTransition(async () => {
      try {
        await onPatch(row.id, { is_active: !row.is_active });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="crud">
      {error && <div className="crud-error">{error}</div>}

      {createForm && (
        <div className="crud-create">
          {!showCreate ? (
            <button type="button" onClick={() => setShowCreate(true)}>+ New</button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!onCreate) return;
                const form = e.currentTarget;
                setError(null);
                startTransition(async () => {
                  try {
                    await onCreate(form);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed");
                    return;
                  }
                  window.location.reload();
                });
              }}
            >
              {createForm}
              <div className="crud-form-actions">
                <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
                <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="muted">{emptyText}</div>
      ) : (
        <table className="crud-table">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={i} className={c.className}>{c.header}</th>
              ))}
              {onPatch && <th>Active</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((c, i) => (
                  <td key={i} className={c.className}>{c.cell(row)}</td>
                ))}
                {onPatch && (
                  <td>
                    <button type="button" disabled={pending} onClick={() => toggleActive(row)}>
                      {row.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
