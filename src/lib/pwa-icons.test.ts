import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Regression tests for the PWA's real PNG icons (the DOWNFORCE pattern).
 *
 * SVG-only manifest icons never render in Android's WebAPK nor on the iOS
 * home screen — the installed app showed a screenshot instead of the Tilth
 * logo. These tests pin the manifest to real PNGs with the any/any/maskable
 * purposes, pin the base64 icon source to valid PNGs of the declared
 * sizes, and pin the build chain that materializes them.
 */

const root = process.cwd();

const readRepo = (path: string): string => readFileSync(join(root, path), "utf8");

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

function manifestIcons(): ManifestIcon[] {
  const vite = readRepo("vite.config.ts");
  const entry =
    /\{\s*src:\s*"([^"]+)",\s*sizes:\s*"([^"]+)",\s*type:\s*"([^"]+)",\s*purpose:\s*"([^"]+)",?\s*\}/g;
  return [...vite.matchAll(entry)].map((m) => ({
    src: m[1] ?? "",
    sizes: m[2] ?? "",
    type: m[3] ?? "",
    purpose: m[4] ?? "",
  }));
}

interface IconEntry {
  width: number;
  height: number;
  bytes: number;
  base64: string;
}

function iconSource(): Record<string, IconEntry> {
  const parsed = JSON.parse(readRepo("scripts/icons.base64.json")) as { icons: Record<string, IconEntry> };
  return parsed.icons;
}

describe("PWA manifest icons (vite.config.ts)", () => {
  it("declares exactly the three real PNG icons (any/any/maskable)", () => {
    const icons = manifestIcons();
    expect(icons).toHaveLength(3);
    expect(icons.map((i) => i.src)).toEqual([
      "icons/icon-192.png",
      "icons/icon-512.png",
      "icons/icon-maskable-512.png",
    ]);
    expect(icons.map((i) => i.purpose)).toEqual(["any", "any", "maskable"]);
    expect(icons.every((i) => i.type === "image/png")).toBe(true);
  });

  it("declares sizes that match each filename", () => {
    for (const icon of manifestIcons()) {
      const fromName = Number(/-(\d+)\.png$/.exec(icon.src)?.[1]);
      expect(icon.sizes).toBe(`${fromName}x${fromName}`);
    }
  });

  it("never masquerades the favicon or the apple-touch-icon as a manifest icon", () => {
    for (const icon of manifestIcons()) {
      expect(icon.src).not.toMatch(/favicon|apple-touch/);
    }
  });

  it("declares no SVG icons (WebAPK and the iOS home screen ignore them)", () => {
    for (const icon of manifestIcons()) {
      expect(icon.src).not.toMatch(/\.svg$/);
    }
  });
});

describe("scripts/icons.base64.json (the PNG source of truth)", () => {
  it("covers exactly the four icons the app ships", () => {
    expect(Object.keys(iconSource()).sort()).toEqual(
      [
        "icons/apple-touch-icon.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-maskable-512.png",
      ].sort(),
    );
  });

  it("decodes to valid PNGs of the declared dimensions", () => {
    for (const [relPath, entry] of Object.entries(iconSource())) {
      const bytes = Buffer.from(entry.base64, "base64");
      expect(bytes.length).toBe(entry.bytes);
      expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(bytes.readUInt32BE(16)).toBe(entry.width);
      expect(bytes.readUInt32BE(20)).toBe(entry.height);
    }
  });
});

describe("PWA icon build chain", () => {
  it("decodes the icons before vite copies public/", () => {
    const pkg = JSON.parse(readRepo("package.json")) as { scripts: { build?: string } };
    expect(pkg.scripts.build).toMatch(/^node scripts\/decode-icons\.mjs && vite build/);
  });

  it("links the iOS apple-touch-icon as a PNG", () => {
    const head = readRepo("src/routes/__root.tsx");
    expect(head).toMatch(/rel:\s*"apple-touch-icon",\s*href:\s*"\/icons\/apple-touch-icon\.png"/);
  });
});
