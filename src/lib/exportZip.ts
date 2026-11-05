import type { Snapshot, Task } from "./types";

export const BACKUP_ENTRY = "tilth-backup.json";
export const TASKS_ENTRY = "tasks.csv";

/** tilth-export-YYYY-MM-DD.zip — the same naming convention as the JSON export. */
export function exportZipFileName(d: Date = new Date()): string {
  void d; // RED stub
  return "";
}

/** One CSV cell, quoted (and inner quotes doubled) when it contains commas, quotes or newlines. */
export function csvCell(v: string): string {
  void v; // RED stub
  return "";
}

/** Tasks as UTF-8 CSV (BOM first, so spreadsheets read Arabic correctly). */
export function tasksToCsv(tasks: Task[]): string {
  void tasks; // RED stub
  return "";
}

/**
 * The one-press archive: the importable JSON backup plus open formats —
 * tasks.csv for spreadsheets and one Markdown file per note. Pure.
 */
export function buildZipExport(
  snap: Snapshot,
  exportedAt: string = new Date().toISOString(),
): Uint8Array {
  void snap; // RED stub
  void exportedAt;
  return new Uint8Array(0);
}
