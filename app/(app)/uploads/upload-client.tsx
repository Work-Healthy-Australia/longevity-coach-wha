"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { recordUpload, deleteUpload } from "./actions";
import type { Database } from "@/lib/supabase/database.types";
import "./uploads.css";

type UploadRow = Database["public"]["Tables"]["patient_uploads"]["Row"];

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp", "image/tiff", "image/heic", "image/heif"];
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
    year: "numeric", month: "short", day: "numeric",
  });
}

interface UploadingFile {
  name: string;
  phase: "uploading" | "analysing";
}

interface Props {
  initialUploads: UploadRow[];
}

export function UploadClient({ initialUploads }: Props) {
  const [uploads, setUploads] = useState<UploadRow[]>(initialUploads);
  const [uploading, setUploading] = useState<UploadingFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

  const processFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Only PDF and image files (JPEG, PNG, GIF, WebP, TIFF, HEIC) are accepted.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("File exceeds the 50 MB limit.");
        return;
      }

      setUploading({ name: file.name, phase: "uploading" });

      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not signed in");

        const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
        const uuid = crypto.randomUUID();
        const storagePath = `${userData.user.id}/${uuid}${ext ? `.${ext}` : ""}`;

        const { error: storageError } = await supabase.storage
          .from("patient-uploads")
          .upload(storagePath, file, {
            upsert: false,
            duplex: "half",
          });

        if (storageError) throw new Error(storageError.message);

        setUploading({ name: file.name, phase: "analysing" });

        startTransition(async () => {
          const result = await recordUpload({
            storagePath,
            originalFilename: file.name,
            mimeType: file.type,
            fileSizeBytes: file.size,
          });

          if (result.error) {
            setError(result.error);
          }
          // Server action calls revalidatePath; re-fetch to show updated rows
          const { data: fresh } = await supabase
            .from("patient_uploads")
            .select("*")
            .order("created_at", { ascending: false });
          if (fresh) setUploads(fresh);
          setUploading(null);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setUploading(null);
      }
    },
    [supabase, startTransition],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const onDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteUpload(id);
      if (result.error) {
        setError(result.error);
      } else {
        setUploads((prev) => prev.filter((u) => u.id !== id));
      }
      setDeletingId(null);
    });
  };

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
        aria-label="Upload a medical document"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={onFileChange}
        />
        <div className="dropzone-icon">📎</div>
        <p className="dropzone-label">
          Drag a file here or <strong>browse</strong>
        </p>
        <p className="dropzone-hint">PDF or image · up to 50 MB</p>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="upload-progress">
          <div className="spinner" aria-hidden="true" />
          {uploading.phase === "uploading"
            ? `Uploading ${uploading.name}…`
            : `Janet is reading ${uploading.name}…`}
        </div>
      )}

      {/* Error */}
      {error && <div className="error-banner" role="alert">{error}</div>}

      {/* File list */}
      {uploads.length === 0 && !uploading ? (
        <div className="empty-state">
          No files yet. Upload any previous pathology, imaging, or test results.
        </div>
      ) : (
        <div className="files-list">
          {uploads.map((u) => (
            <div className="file-card" key={u.id}>
              <div className="file-icon">
                {u.janet_category
                  ? CATEGORY_ICONS[u.janet_category] ?? "📄"
                  : "📄"}
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
                {u.janet_summary && (
                  <p className="file-summary">{u.janet_summary}</p>
                )}
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
