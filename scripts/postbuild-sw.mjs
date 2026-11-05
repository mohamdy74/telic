// vite-plugin-pwa generates sw.js in the client build output directory, but the
// nitro build (which assembles .output/public) can finish copying before the
// service worker file is written, leaving /sw.js missing from the final output.
// This script locates the generated sw.js and copies it into .output/public so
// the published app serves the service worker at the expected URL.

import { cpSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SKIP = new Set([".git", "node_modules", ".output", "src", "public", "scripts"]);

function findSwFile(dir, depth) {
  if (depth > 4) return null;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isFile()) {
      if (entry.name === "sw.js") return full;
    } else if (entry.isDirectory() && !SKIP.has(entry.name)) {
      const found = findSwFile(full, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

const dest = join(process.cwd(), ".output", "public", "sw.js");
if (existsSync(dest)) {
  console.log("postbuild-sw: sw.js already present in .output/public");
  process.exit(0);
}
const found = findSwFile(process.cwd(), 0);
if (!found) {
  console.error("postbuild-sw: could not find a generated sw.js anywhere in the build output");
  process.exit(1);
}
cpSync(found, dest);
console.log("postbuild-sw: copied " + found + " -> .output/public/sw.js");
