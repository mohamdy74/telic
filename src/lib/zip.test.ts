import { describe, expect, it } from "vitest";
import { crc32, zipFiles } from "./zip";

const enc = new TextEncoder();

/** Minimal reader for STORE-method zips: EOCD count, then local headers. No unzip library. */
function readZip(zip: Uint8Array): { name: string; data: Uint8Array; flags: number; method: number }[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const u16 = (o: number) => view.getUint16(o, true);
  const u32 = (o: number) => view.getUint32(o, true);
  expect(u32(zip.length - 22)).toBe(0x06054b50); // EOCD signature
  const count = u16(zip.length - 22 + 10);
  const dec = new TextDecoder();
  const out: { name: string; data: Uint8Array; flags: number; method: number }[] = [];
  let off = 0;
  for (let i = 0; i < count; i++) {
    expect(u32(off)).toBe(0x04034b50); // local file header signature
    const flags = u16(off + 6);
    const method = u16(off + 8);
    const size = u32(off + 18);
    const nameLen = u16(off + 26);
    const extraLen = u16(off + 28);
    const name = dec.decode(zip.subarray(off + 30, off + 30 + nameLen));
    const data = zip.subarray(off + 30 + nameLen + extraLen, off + 30 + nameLen + extraLen + size);
    out.push({ name, data, flags, method });
    off += 30 + nameLen + extraLen + size;
  }
  return out;
}

describe("crc32", () => {
  it("matches the IEEE test vector", () => {
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
  });

  it("empty input is the empty CRC", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe("zipFiles", () => {
  it("writes a single entry we can read back", () => {
    const zip = zipFiles([{ name: "a.txt", data: enc.encode("hello") }]);
    const entries = readZip(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("a.txt");
    expect(entries[0]!.method).toBe(0); // STORE, no compression
    expect(new TextDecoder().decode(entries[0]!.data)).toBe("hello");
  });

  it("keeps the given entry order, including nested paths", () => {
    const zip = zipFiles([
      { name: "tilth-backup.json", data: enc.encode("{}") },
      { name: "tasks.csv", data: enc.encode("id") },
      { name: "notes/a.md", data: enc.encode("# A") },
    ]);
    expect(readZip(zip).map((e) => e.name)).toEqual([
      "tilth-backup.json",
      "tasks.csv",
      "notes/a.md",
    ]);
  });

  it("sets the UTF-8 flag and round-trips Arabic names", () => {
    const zip = zipFiles([{ name: "ملاحظة.md", data: enc.encode("عربي") }]);
    const entries = readZip(zip);
    expect(entries[0]!.flags & 0x0800).toBe(0x0800);
    expect(entries[0]!.name).toBe("ملاحظة.md");
    expect(new TextDecoder().decode(entries[0]!.data)).toBe("عربي");
  });

  it("writes a valid empty archive (EOCD only, 22 bytes)", () => {
    const zip = zipFiles([]);
    expect(zip).toHaveLength(22);
    expect(readZip(zip)).toEqual([]);
  });

  it("is byte-deterministic for the same input and timestamp", () => {
    const files = [
      { name: "a.txt", data: enc.encode("hello") },
      { name: "notes/b.md", data: enc.encode("# B\n") },
    ];
    const at = new Date(2026, 10, 5, 12, 30, 45);
    const a = zipFiles(files, at);
    const b = zipFiles(files, at);
    expect(a).toEqual(b);
  });
});
