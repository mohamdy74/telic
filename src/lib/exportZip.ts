import { buildBackup } from "./backup";
import { noteToMarkdown, sortNotes } from "./notes";
import type { Snapshot, Task } from "./types";
import { zipFiles } from "./zip";

export const BACKUP_ENTRY = "tilth-backup.json";
export const TASKS_ENTRY = "tasks.csv";

/** tilth-export-YYYY-MM-DD.zip — the same naming convention as the JSON export. */
export function exportZipFileName(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    "tilth-export-" + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + ".zip"
  );
}

/** One CSV cell, quoted (and inner quotes doubled) when it contains commas, quotes or newlines. */
export function csvCell(v: string): string {
  return /["\n\r,]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

/** Tasks as UTF-8 CSV (BOM first, so spreadsheets read Arabic correctly). */
export function tasksToCsv(tasks: Task[]): string {
  const header = "id,title,status,priority,dueDate,tags,completedAt,createdAt,updatedAt";
  const rows = tasks.map((t) =>
    [
      t.id,
      csvCell(t.title),
      t.status,
      t.priority,
      t.dueDate ?? "",
      t.tags.join("|"),
      t.completedAt ?? "",
      t.createdAt,
      t.updatedAt,
    ].join(","),
  );
  return "\uFEFF" + [header, ...rows].join("\n") + "\n";
}

/**
 * The one-press archive: the importable JSON backup plus open formats —
 * tasks.csv for spreadsheets and one Markdown file per note. Pure and
 * deterministic (same snapshot + timestamp -> same bytes). Soft-deleted
 * notes stay in the backup only; the Markdown files are the live set.
 */
export function buildZipExport(
  snap: Snapshot,
  exportedAt: string = new Date().toISOString(),
): Uint8Array {
  const enc = new TextEncoder();
  const files: { name: string; data: Uint8Array }[] = [
    {
      name: BACKUP_ENTRY,
      data: enc.encode(JSON.stringify(buildBackup(snap, exportedAt), null, 2)),
    },
    { name: TASKS_ENTRY, data: enc.encode(tasksToCsv(snap.tasks)) },
  ];
  for (const n of sortNotes(snap.notes.filter((x) => !x.deletedAt))) {
    files.push({ name: "notes/" + n.id + ".md", data: enc.encode(noteToMarkdown(n)) });
  }
  return zipFiles(files, new Date(exportedAt));
}
