import { describe, expect, it } from "vitest";
import { buildBackup } from "./backup";
import {
  BACKUP_ENTRY,
  buildZipExport,
  csvCell,
  exportZipFileName,
  TASKS_ENTRY,
  tasksToCsv,
} from "./exportZip";
import { CURRENT_SCHEMA_VERSION, type Snapshot } from "./types";

const stamp = "2026-01-01T00:00:00.000Z";
const enc = new TextEncoder();

/** Minimal reader for STORE-method zips: EOCD count, then local headers. No unzip library. */
function readZip(zip: Uint8Array): { name: string; data: Uint8Array }[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const u16 = (o: number) => view.getUint16(o, true);
  const u32 = (o: number) => view.getUint32(o, true);
  expect(u32(zip.length - 22)).toBe(0x06054b50); // EOCD signature
  const count = u16(zip.length - 22 + 10);
  const dec = new TextDecoder();
  const out: { name: string; data: Uint8Array }[] = [];
  let off = 0;
  for (let i = 0; i < count; i++) {
    expect(u32(off)).toBe(0x04034b50); // local file header signature
    const size = u32(off + 18);
    const nameLen = u16(off + 26);
    const extraLen = u16(off + 28);
    const name = dec.decode(zip.subarray(off + 30, off + 30 + nameLen));
    const data = zip.subarray(off + 30 + nameLen + extraLen, off + 30 + nameLen + extraLen + size);
    out.push({ name, data });
    off += 30 + nameLen + extraLen + size;
  }
  return out;
}

const snapshot = (): Snapshot =>
  ({
    tasks: [
      {
        id: "t1",
        title: "Write, ship, repeat",
        priority: "high",
        status: "done",
        dueDate: "2026-01-02",
        tags: ["work", "focus"],
        subtasks: [],
        completedAt: "2026-01-02T10:00:00.000Z",
        kanbanOrder: 0,
        createdAt: stamp,
        updatedAt: stamp,
      },
      {
        id: "t2",
        title: "Read a book",
        priority: "low",
        status: "todo",
        tags: [],
        subtasks: [],
        kanbanOrder: 1,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
    notes: [
      { id: "n1", title: "Plan", body: "step 1", createdAt: stamp, updatedAt: "2026-01-01T12:00:00.000Z" },
      { id: "n2", title: "خطة", body: "", pinned: true, createdAt: stamp, updatedAt: "2026-01-02T12:00:00.000Z" },
    ],
    habits: [],
    habitLogs: [],
    focusSessions: [],
    achievements: [],
    shopItems: [],
    purchases: [],
    xpLedger: [],
    settings: {
      language: "ar",
      theme: "dark",
      accent: "moss",
      dayStartHour: 0,
      weekStartsOn: 6,
      dashboardCards: {
        priorities: true,
        progress: true,
        deadlines: true,
        habits: true,
        focus: true,
        level: true,
        achievements: true,
      },
      dailyFocusTargetMinutes: 100,
      updatedAt: stamp,
    },
    meta: { schemaVersion: CURRENT_SCHEMA_VERSION, createdAt: stamp, updatedAt: stamp },
  }) as unknown as Snapshot;

const AT = "2026-01-03T00:00:00.000Z";

describe("exportZipFileName", () => {
  it("names the file with the LOCAL date", () => {
    expect(exportZipFileName(new Date(2026, 10, 5))).toBe("tilth-export-2026-11-05.zip");
  });
});

describe("csvCell", () => {
  it("passes plain text through", () => {
    expect(csvCell("abc")).toBe("abc");
  });

  it("quotes commas", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
  });

  it("doubles inner quotes", () => {
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("quotes newlines", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("tasksToCsv", () => {
  it("writes a BOM, the header and one row per task", () => {
    const csv = tasksToCsv(snapshot().tasks);
    expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM, so spreadsheets read Arabic
    expect(csv).toBe(
      "\uFEFFid,title,status,priority,dueDate,tags,completedAt,createdAt,updatedAt\n" +
        't1,"Write, ship, repeat",done,high,2026-01-02,work|focus,2026-01-02T10:00:00.000Z,' +
        stamp +
        "," +
        stamp +
        "\n" +
        "t2,Read a book,todo,low,,,," +
        stamp +
        "," +
        stamp +
        "\n",
    );
  });
});

describe("buildZipExport", () => {
  it("packs the backup, the CSV and one Markdown file per note, pinned first", () => {
    const snap = snapshot();
    const zip = buildZipExport(snap, AT);
    const entries = readZip(zip);
    expect(entries.map((e) => e.name)).toEqual([
      BACKUP_ENTRY,
      TASKS_ENTRY,
      "notes/n2.md",
      "notes/n1.md",
    ]);

    // ignoreBOM so the check proves the CSV's BOM survived the zip round trip.
    const dec = new TextDecoder("utf-8", { ignoreBOM: true });
    const backup = JSON.parse(dec.decode(entries[0]!.data)) as { schemaVersion: number };
    expect(backup).toEqual(buildBackup(snap, AT));
    expect(backup.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(dec.decode(entries[1]!.data)).toBe(tasksToCsv(snap.tasks));
    expect(dec.decode(entries[2]!.data)).toBe("# خطة\n");
    expect(dec.decode(entries[3]!.data)).toBe("# Plan\n\nstep 1\n");
  });

  it("is byte-deterministic for the same snapshot and timestamp", () => {
    const snap = snapshot();
    expect(buildZipExport(snap, AT)).toEqual(buildZipExport(snap, AT));
  });

  it("handles a snapshot with no notes", () => {
    const snap = snapshot();
    snap.notes = [];
    const entries = readZip(buildZipExport(snap, AT));
    expect(entries.map((e) => e.name)).toEqual([BACKUP_ENTRY, TASKS_ENTRY]);
  });
});
