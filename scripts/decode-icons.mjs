/*
 * Materializes the PWA's real PNG icons into public/icons/ and the tab
 * favicon (public/favicon.png) from scripts/icons.base64.json, before every
 * build.
 *
 * Why base64: binary files cannot be committed through the text-only push
 * path this repo is developed with, so the icons' exact PNG bytes live in
 * scripts/icons.base64.json (text) and are decoded into real files at build
 * time — identically in CI, in Lovable's deploy build and locally. The
 * outputs are gitignored; the JSON file is the only source of truth and
 * src/lib/pwa-icons.test.ts pins every declaration in it.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, "scripts", "icons.base64.json"), "utf8"));
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

mkdirSync(join(root, "public", "icons"), { recursive: true });

for (const [relPath, entry] of Object.entries(manifest.icons)) {
  const fail = (why) => {
    throw new Error(`decode-icons: ${relPath}: ${why}`);
  };
  const bytes = Buffer.from(entry.base64, "base64");
  if (bytes.length !== entry.bytes) fail(`declared ${entry.bytes} bytes, decoded ${bytes.length}`);
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) fail("not a PNG (bad signature)");
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== entry.width || height !== entry.height) {
    fail(`IHDR is ${width}x${height}, expected ${entry.width}x${entry.height}`);
  }
  writeFileSync(join(root, "public", relPath), bytes);
}

// The tab favicon reuses icon-192's exact bytes: the browser tab, bookmarks
// and history must show the Tilth logo, never a scaffold default.
const faviconBytes = Buffer.from(manifest.icons["icons/icon-192.png"].base64, "base64");
writeFileSync(join(root, "public", "favicon.png"), faviconBytes);
console.log("decode-icons: wrote favicon.png into public/");

console.log(
  `decode-icons: wrote ${Object.keys(manifest.icons).length} PNG icons into public/icons/`,
);
