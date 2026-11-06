import { describe, expect, it } from "vitest";
import { backupFileName, buildBackup, BackupError, parseBackup } from "./backup";
import { COLLECTION_KEYS, CURRENT_SCHEMA_VERSION, type Snapshot } from "./types";

const stamp = "2026-01-01T00:00:00.000Z";
const rec = (id: string) => ({ id, createdAt: stamp, updatedAt: stamp });

const snapshot = (n = 1): Snapshot =>
  ({
    tasks: Array.from({ length: n }, (_, i) => rec("t" + i)),
    notes: [{ ...rec("n1"), title: "Note one", body: "hello" }],
    habits: [],
    habitLogs: [{ ...rec("l1"), habitId: "h1", localDay: "2026-01-01", status: "done" }],
    focusSessions: [],
    achievements: [],
    shopItems: [],
    purchases: [],
    xpLedger: [
      {
        ...rec("x1"),
        sourceType: "focus",
        sourceId: "s1",
        localDay: "2026-01-01",
        xp: 10,
        coins: 2,
      },
      { ...rec("x2"), sourceType: "task", sourceId: "t0", localDay: "2026-01-01", xp: 5, coins: 1 },
    ],
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

const emptySnap = (): Snapshot => ({ ...snapshot(0), notes: [], habitLogs: [], xpLedger: [] });

const failCode = (text: string): string => {
  try {
    parseBackup(text);
    return "no-error";
  } catch (e) {
    return e instanceof BackupError ? e.code : "wrong-error";
  }
};

describe("buildBackup", () => {
  it("wraps a snapshot in the export envelope", () => {
    const file = buildBackup(snapshot(2), "2026-01-02T00:00:00.000Z");
    expect(Object.keys(file).sort()).toEqual(["data", "exportedAt", "schemaVersion"]);
    expect(file.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(file.exportedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(file.data.tasks).toHaveLength(2);
  });

  it("names the file with the LOCAL date", () => {
    expect(backupFileName(new Date(2026, 10, 5))).toBe("tilth-export-2026-11-05.json");
  });
});

describe("parseBackup validation", () => {
  it("accepts a current-version backup and counts collections", () => {
    const parsed = parseBackup(JSON.stringify(buildBackup(snapshot(3))));
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.migratedFrom).toBeNull();
    expect(parsed.counts.tasks).toBe(3);
    expect(parsed.counts.habitLogs).toBe(1);
    expect(parsed.counts.notes).toBe(1);
    expect(parsed.counts.xpLedger).toBe(2);
    expect(parsed.snapshot.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("rejects non-JSON", () => {
    expect(failCode("{oops")).toBe("invalid-json");
  });

  it("rejects a malformed envelope", () => {
    expect(failCode(JSON.stringify([1]))).toBe("invalid-shape");
    expect(failCode(JSON.stringify({ data: {} }))).toBe("invalid-shape");
    expect(failCode(JSON.stringify({ schemaVersion: "1", data: {} }))).toBe("invalid-shape");
    expect(failCode(JSON.stringify({ schemaVersion: 0.5, data: {} }))).toBe("invalid-shape");
    expect(failCode(JSON.stringify({ schemaVersion: -1, data: {} }))).toBe("invalid-shape");
    expect(failCode(JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION }))).toBe(
      "invalid-shape",
    );
    expect(failCode(JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, data: [] }))).toBe(
      "invalid-shape",
    );
  });

  it("rejects non-list collections", () => {
    const file = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: stamp,
      data: { ...snapshot(1), tasks: "oops" },
    };
    expect(failCode(JSON.stringify(file))).toBe("invalid-shape");
  });

  it("rejects a newer schema version", () => {
    const file = {
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      exportedAt: stamp,
      data: snapshot(1),
    };
    expect(failCode(JSON.stringify(file))).toBe("newer-schema");
  });

  it("rejects an empty backup", () => {
    expect(failCode(JSON.stringify(buildBackup(emptySnap())))).toBe("empty");
  });
});

describe("parseBackup migration", () => {
  it("migrates a v0 backup and preserves exportedAt", () => {
    const v0 = {
      schemaVersion: 0,
      exportedAt: "2026-01-02T03:04:05.000Z",
      data: { tasks: [rec("t0"), rec("t1")], meta: {} },
    };
    const parsed = parseBackup(JSON.stringify(v0));
    expect(parsed.migratedFrom).toBe(0);
    expect(parsed.exportedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(parsed.snapshot.meta.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.snapshot.habits).toEqual([]);
    expect(parsed.snapshot.achievements).toEqual([]);
    expect(parsed.snapshot.shopItems).toEqual([]);
    expect(parsed.snapshot.purchases).toEqual([]);
    expect(parsed.snapshot.notes).toEqual([]);
    expect(parsed.counts.tasks).toBe(2);
  });

  it("counts shop items and purchases", () => {
    const snap = snapshot(1);
    snap.shopItems = [{ ...rec("s1"), name: "Coffee out", price: 20 }] as Snapshot["shopItems"];
    snap.purchases = [
      { ...rec("p1"), itemId: "s1", name: "Coffee out", price: 20, localDay: "2026-01-01" },
    ] as Snapshot["purchases"];
    const parsed = parseBackup(JSON.stringify(buildBackup(snap)));
    expect(parsed.counts.shopItems).toBe(1);
    expect(parsed.counts.purchases).toBe(1);
  });

  it("counts every collection", () => {
    const parsed = parseBackup(JSON.stringify(buildBackup(snapshot(1))));
    for (const k of COLLECTION_KEYS) {
      expect(parsed.counts[k]).toBe(parsed.snapshot[k].length);
    }
  });
});
