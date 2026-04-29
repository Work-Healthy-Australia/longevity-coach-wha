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
  onUpdate,
  createForm,
  editForm,
  emptyText = "No rows yet.",
}: {
  rows: T[];
  columns: Column<T>[];
  onCreate?: (form: HTMLFormElement) => Promise<void>;
  onPatch?: (id: string, body: Record<string, unknown>) => Promise<void>;
  onUpdate?: (id: string, form: HTMLFormElement) => Promise<void>;
  createForm?: React.ReactNode;
  editForm?: (row: T) => React.ReactNode;
  emptyText?: string;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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
              {(onUpdate || editForm) && <th>Edit</th>}
              {onPatch && <th>Active</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isEditing = editingId === row.id;
              return (
                <>
                  <tr key={row.id}>
                    {columns.map((c, i) => (
                      <td key={i} className={c.className}>{c.cell(row)}</td>
                    ))}
                    {(onUpdate || editForm) && (
                      <td>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setEditingId(isEditing ? null : row.id)}
                        >
                          {isEditing ? "Close" : "Edit"}
                        </button>
                      </td>
                    )}
                    {onPatch && (
                      <td>
                        <button type="button" disabled={pending} onClick={() => toggleActive(row)}>
                          {row.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    )}
                  </tr>
                  {isEditing && editForm && onUpdate && (
                    <tr key={`${row.id}-edit`} className="crud-edit-row">
                      <td colSpan={columns.length + (Boolean(onUpdate) && Boolean(editForm) ? 1 : 0) + (onPatch ? 1 : 0)}>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const form = e.currentTarget;
                            setError(null);
                            startTransition(async () => {
                              try {
                                await onUpdate(row.id, form);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Failed");
                                return;
                              }
                              window.location.reload();
                            });
                          }}
                        >
                          {editForm(row)}
                          <div className="crud-form-actions">
                            <button type="submit" disabled={pending}>
                              {pending ? "Saving…" : "Save changes"}
                            </button>
                            <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
