import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { mergeRecords, readKey, writeKey } from "./persistence";

const r = (id: string, updatedAt: string, title = id) => ({ id, updatedAt, title });

describe("persistence", () => {
  it("merge keeps newest version of each record and records from both sides", () => {
    const out = mergeRecords(
      [r("a", "2026-01-02", "disk"), r("b", "2026-01-01")],
      [r("a", "2026-01-01", "old"), r("c", "2026-01-01")],
    );
    expect(out.find((x) => x.id === "a")?.title).toBe("disk");
    expect(out.map((x) => x.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("a stale tab write merges instead of overwriting", async () => {
    await writeKey("tasks", [r("a", "2026-01-01")], 0); // rev 1
    // tab B (knows rev 1) writes record b
    await writeKey("tasks", [r("a", "2026-01-01"), r("b", "2026-01-02")], 1); // rev 2
    // tab A still thinks rev 1, writes record c
    const res = await writeKey("tasks", [r("a", "2026-01-01"), r("c", "2026-01-03")], 1);
    expect(res.merged).toBe(true);
    const disk = await readKey("tasks");
    expect((disk!.data as { id: string }[]).map((x) => x.id).sort()).toEqual(["a", "b", "c"]);
    expect(disk!.rev).toBe(3);
  });
});
