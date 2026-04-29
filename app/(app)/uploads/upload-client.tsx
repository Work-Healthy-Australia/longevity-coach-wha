"use client";

import { useCallback, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { recordUpload, deleteUpload } from "./actions";
import type { Database } from "@/lib/supabase/database.types";
import "./uploads.css";

type UploadRow = Database["public"]["Tables"]["patient_uploads"]["Row"];

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/tiff",
  "image/heic",
  "image/heif",
];
const MAX_BYTES = 52_428_800; // 50 MB

const CATEGORY_LABELS: Record<string, string> = {
  blood_work: "Blood Work",
  imaging: "Imaging",
  genetic: "Genetic",
  microbiome: "Microbiome",
  metabolic: "Metabolic",
  other: "Other",
};

const CATEGORY_ICONS: Record<string, string> = {
  blood_work: "🩸",
  imaging: "🫁",
  genetic: "🧬",
  microbiome: "🦠",
  metabolic: "⚡",
  other: "📄",
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface InFlightFile {
  name: string;
  phase: "uploading" | "analysing";
}

interface Props {
  initialUploads: UploadRow[];
}

export function UploadClient({ initialUploads }: Props) {
  const [uploads, setUploads] = useState<UploadRow[]>(initialUploads);
  // Per-file progress keyed by a local UUID generated at drop/select time.
  const [inFlight, setInFlight] = useState<Map<string, InFlightFile>>(new Map());
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

  // Handles a single file — runs fully independently; never awaited by siblings.
  const processFile = useCallback(
    async (localId: string, file: File) => {
      const addError = (msg: string) =>
        setErrors((prev) => [...prev, msg]);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        addError(`${file.name}: only PDF and images (JPEG, PNG, GIF, WebP, TIFF, HEIC) are accepted`);
        setInFlight((prev) => { const m = new Map(prev); m.delete(localId); return m; });
        return;
      }
      if (file.size > MAX_BYTES) {
        addError(`${file.name}: exceeds the 50 MB limit`);
        setInFlight((prev) => { const m = new Map(prev); m.delete(localId); return m; });
        return;
      }

      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not signed in");

        const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
        const uuid = crypto.randomUUID();
        const storagePath = `${userData.user.id}/${uuid}${ext ? `.${ext}` : ""}`;

        const hashBuffer = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
        const fileHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

        const { error: storageError } = await supabase.storage
          .from("patient-uploads")
          .upload(storagePath, file, { upsert: false, duplex: "half" });

        if (storageError) throw new Error(storageError.message);

        // Transition this file's progress tile to the Janet phase.
        setInFlight((prev) => {
          const m = new Map(prev);
          m.set(localId, { name: file.name, phase: "analysing" });
          return m;
        });

        const result = await recordUpload({
          storagePath,
          originalFilename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          fileHash,
        });

        if (result.error) {
          addError(`${file.name}: ${result.error}`);
        } else if (result.id) {
          // recordUpload returns immediately — Janet analysis runs asynchronously.
          // Poll until janet_status leaves 'processing' (max 90s, 3s intervals).
          const uploadId = result.id;
          for (let i = 0; i < 30; i++) {
            await new Promise<void>((r) => setTimeout(r, 3000));
            const { data: row } = await supabase
              .from("patient_uploads")
              .select("janet_status")
              .eq("id", uploadId)
              .single();
            if (!row || row.janet_status !== "processing") break;
          }
        }
      } catch (err) {
        addError(`${file.name}: ${err instanceof Error ? err.message : "Upload failed"}`);
      } finally {
        // Remove this file's progress tile regardless of outcome.
        setInFlight((prev) => { const m = new Map(prev); m.delete(localId); return m; });
        // Refetch independently per file — each completion shows its result immediately.
        const { data: fresh } = await supabase
          .from("patient_uploads")
          .select("*")
          .order("created_at", { ascending: false });
        if (fresh) setUploads(fresh);
      }
    },
    [supabase],
  );

  // Registers all files in inFlight atomically, then fires each independently.
  const processFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      setErrors([]);

      const additions: [string, InFlightFile][] = files.map((f) => [
        crypto.randomUUID(),
        { name: f.name, phase: "uploading" as const },
      ]);

      // Single state write so all progress tiles appear at once.
      setInFlight((prev) => new Map([...prev, ...additions]));

      // Fire every file's async process without awaiting siblings.
      additions.forEach(([localId], i) => {
        processFile(localId, files[i]!);
      });
    },
    [processFile],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const onDelete = (id: string) => {
    setDeletingId(id);
    // Fire-and-forget — no useTransition needed here, delete is fast.
    void (async () => {
      const result = await deleteUpload(id);
      if (result.error) {
        setErrors((prev) => [...prev, result.error!]);
      } else {
        setUploads((prev) => prev.filter((u) => u.id !== id));
      }
      setDeletingId(null);
    })();
  };

  const inFlightEntries = Array.from(inFlight.entries());

  return (
    <div className="lc-uploads">
      {/* Drop zone */}
      <div
        className={`dropzone${dragOver ? " drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        aria-label="Upload medical documents"
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(",")}
          onChange={onFileChange}
        />
        <div className="dropzone-icon">📎</div>
        <p className="dropzone-label">
          Drag files here or <strong>browse</strong>
        </p>
        <p className="dropzone-hint">PDF or image · up to 50 MB each · multiple files supported</p>
      </div>

      {/* Per-file progress tiles — one per in-flight upload */}
      {inFlightEntries.map(([localId, f]) => (
        <div className="upload-progress" key={localId}>
          <div className="spinner" aria-hidden="true" />
          {f.phase === "uploading"
            ? `Uploading ${f.name}…`
            : `Janet is reading ${f.name}…`}
        </div>
      ))}

      {/* Errors — one line per failed file */}
      {errors.length > 0 && (
        <div className="error-banner" role="alert">
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      {/* File list */}
      {uploads.length === 0 && inFlightEntries.length === 0 ? (
        <div className="empty-state">
          No files yet. Upload any previous pathology, imaging, or test results.
        </div>
      ) : (
        <div className="files-list">
          {uploads.map((u) => (
            <div className="file-card" key={u.id}>
              <div className="file-icon">
                {u.janet_category ? (CATEGORY_ICONS[u.janet_category] ?? "📄") : "📄"}
              </div>
              <div className="file-body">
                <p className="file-name">{u.original_filename}</p>
                <p className="file-meta">
                  {formatBytes(u.file_size_bytes)} · Uploaded {formatDate(u.created_at)}
                </p>
                {u.janet_category && (
                  <span className="category-badge" style={{ marginBottom: 8, display: "inline-block" }}>
                    {CATEGORY_LABELS[u.janet_category] ?? u.janet_category}
                  </span>
                )}
                {u.janet_summary && <p className="file-summary">{u.janet_summary}</p>}
                {u.janet_status === "error" && u.janet_error && (
                  <p className="file-summary" style={{ color: "var(--lc-danger)" }}>
                    Analysis failed: {u.janet_error}
                  </p>
                )}
              </div>
              <div className="file-actions">
                <span className={`badge ${u.janet_status}`}>
                  {u.janet_status === "pending" && "Queued"}
                  {u.janet_status === "processing" && "Reading…"}
                  {u.janet_status === "done" && "Read"}
                  {u.janet_status === "error" && "Error"}
                </span>
                <button
                  className="btn btn-ghost"
                  onClick={() => onDelete(u.id)}
                  disabled={deletingId === u.id}
                  aria-label={`Delete ${u.original_filename}`}
                >
                  {deletingId === u.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
