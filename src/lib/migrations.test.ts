import { describe, expect, it } from "vitest";
import { runMigrations, type Migration } from "./migrations";

describe("migrations", () => {
  const fake: Migration[] = [
    // fake v0 -> v1: rename `todos` to `tasks`, priority numbers -> strings
    (d) => {
      const todos = (d["todos"] as { title: string; p: number }[]) ?? [];
      const { todos: _drop, ...rest } = d;
      return { ...rest, tasks: todos.map((t) => ({ title: t.title, priority: t.p >= 2 ? "high" : "low" })) };
    },
  ];

  it("runs v0 -> v1 and stamps schemaVersion", () => {
    const { data, from, to } = runMigrations({ todos: [{ title: "A", p: 3 }, { title: "B", p: 0 }] }, fake, 1);
    expect(from).toBe(0);
    expect(to).toBe(1);
    expect(data.meta?.schemaVersion).toBe(1);
    expect(data["tasks"]).toEqual([{ title: "A", priority: "high" }, { title: "B", priority: "low" }]);
    expect(data["todos"]).toBeUndefined();
  });

  it("is a no-op when already current", () => {
    const input = { meta: { schemaVersion: 1 }, tasks: [] };
    expect(runMigrations(input, fake, 1).data).toBe(input);
  });

  it("refuses data from a newer version", () => {
    expect(() => runMigrations({ meta: { schemaVersion: 5 } }, fake, 1)).toThrow(/newer/);
  });

  it("real v0 -> v1 fills missing collections", () => {
    const { data } = runMigrations({ tasks: [{ id: "x" }] });
    expect(data["habits"]).toEqual([]);
    expect(data["tasks"]).toEqual([{ id: "x" }]);
  });
});
