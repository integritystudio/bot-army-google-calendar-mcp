#!/usr/bin/env node
/**
 * copypasta-check.mjs
 *
 * Recursively scans .mjs and .ts files and reports repeated code blocks.
 *
 * Usage:
 *   node copypasta-check.mjs [rootDir] [minLines]
 *
 * Examples:
 *   node copypasta-check.mjs .
 *   node copypasta-check.mjs src 8
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT_DIR = path.resolve(process.argv[2] ?? ".");
const MIN_LINES = Number(process.argv[3] ?? 8);

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);

function walk(dir) {
  const out = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        out.push(...walk(fullPath));
      }
      continue;
    }

    if (entry.isFile() && (fullPath.endsWith(".mjs") || fullPath.endsWith(".ts"))) {
      out.push(fullPath);
    }
  }

  return out;
}

function stripInlineComment(line) {
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (!inDouble && !inTemplate && ch === "'" ) {
      inSingle = !inSingle;
      continue;
    }

    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      continue;
    }

    if (!inSingle && !inDouble && ch === "`") {
      inTemplate = !inTemplate;
      continue;
    }

    if (!inSingle && !inDouble && !inTemplate && ch === "/" && next === "/") {
      return line.slice(0, i);
    }
  }

  return line;
}

function normalizeLines(content) {
  const rawLines = content.split(/\r?\n/);
  const normalized = [];
  const lineMap = [];

  let inBlockComment = false;

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    let out = "";
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let escaped = false;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      const next = line[j + 1];

      if (inBlockComment) {
        if (ch === "*" && next === "/") {
          inBlockComment = false;
          j++;
        }
        continue;
      }

      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }

      if (!inDouble && !inTemplate && ch === "'") {
        inSingle = !inSingle;
        out += ch;
        continue;
      }

      if (!inSingle && !inTemplate && ch === '"') {
        inDouble = !inDouble;
        out += ch;
        continue;
      }

      if (!inSingle && !inDouble && ch === "`") {
        inTemplate = !inTemplate;
        out += ch;
        continue;
      }

      if (!inSingle && !inDouble && !inTemplate && ch === "/" && next === "*") {
        inBlockComment = true;
        j++;
        continue;
      }

      out += ch;
    }

    out = stripInlineComment(out)
      .replace(/\s+/g, " ")
      .trim();

    if (out.length === 0) continue;
    if (out === "{" || out === "}" || out === ");" || out === "(" || out === ")") continue;

    normalized.push(out);
    lineMap.push(i + 1); // original 1-based line number
  }

  return { normalized, lineMap };
}

function hashBlock(lines) {
  return crypto.createHash("sha1").update(lines.join("\n")).digest("hex");
}

function makeBlocks(files, minLines) {
  const blocks = new Map();

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const { normalized, lineMap } = normalizeLines(content);

    if (normalized.length < minLines) continue;

    for (let i = 0; i <= normalized.length - minLines; i++) {
      const slice = normalized.slice(i, i + minLines);
      const key = hashBlock(slice);

      if (!blocks.has(key)) {
        blocks.set(key, {
          block: slice,
          occurrences: [],
        });
      }

      blocks.get(key).occurrences.push({
        file,
        startLine: lineMap[i],
        endLine: lineMap[i + minLines - 1],
      });
    }
  }

  return blocks;
}

function summarizePairs(repeatedBlocks) {
  const pairScores = new Map();

  for (const entry of repeatedBlocks) {
    const uniqueOccurrences = dedupeOccurrences(entry.occurrences);

    for (let i = 0; i < uniqueOccurrences.length; i++) {
      for (let j = i + 1; j < uniqueOccurrences.length; j++) {
        const a = uniqueOccurrences[i];
        const b = uniqueOccurrences[j];

        if (a.file === b.file) continue;

        const pairKey = [a.file, b.file].sort().join(" :: ");
        pairScores.set(pairKey, (pairScores.get(pairKey) ?? 0) + 1);
      }
    }
  }

  return [...pairScores.entries()]
    .map(([pair, score]) => ({ pair, score }))
    .sort((a, b) => b.score - a.score);
}

function dedupeOccurrences(occurrences) {
  const seen = new Set();
  const out = [];

  for (const occ of occurrences) {
    const key = `${occ.file}:${occ.startLine}:${occ.endLine}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(occ);
    }
  }

  return out;
}

function main() {
  if (!Number.isInteger(MIN_LINES) || MIN_LINES < 2) {
    console.error("minLines must be an integer >= 2");
    process.exit(1);
  }

  if (!fs.existsSync(ROOT_DIR) || !fs.statSync(ROOT_DIR).isDirectory()) {
    console.error(`Not a directory: ${ROOT_DIR}`);
    process.exit(1);
  }

  const files = walk(ROOT_DIR);

  if (files.length === 0) {
    console.log("No .mjs or .ts files found.");
    return;
  }

  const allBlocks = makeBlocks(files, MIN_LINES);

  const repeatedBlocks = [...allBlocks.values()]
    .map((entry) => ({
      ...entry,
      occurrences: dedupeOccurrences(entry.occurrences),
    }))
    .filter((entry) => entry.occurrences.length > 1)
    .sort((a, b) => b.occurrences.length - a.occurrences.length);

  console.log(`Scanned ${files.length} .mjs/.ts files under ${ROOT_DIR}`);
  console.log(`Window size: ${MIN_LINES} normalized lines`);
  console.log("");

  if (repeatedBlocks.length === 0) {
    console.log("No repeated blocks found.");
    return;
  }

  const pairScores = summarizePairs(repeatedBlocks);

  console.log("Most suspicious file pairs:");
  for (const { pair, score } of pairScores.slice(0, 15)) {
    console.log(`  ${score.toString().padStart(3)} shared blocks  ${pair}`);
  }

  console.log("");
  console.log("Repeated blocks:");
  console.log("");

  for (const [index, entry] of repeatedBlocks.slice(0, 50).entries()) {
    console.log(`#${index + 1}  repeated in ${entry.occurrences.length} places`);
    for (const occ of entry.occurrences) {
      console.log(`  - ${occ.file}:${occ.startLine}-${occ.endLine}`);
    }

    console.log("  snippet:");
    for (const line of entry.block.slice(0, Math.min(entry.block.length, 8))) {
      console.log(`    ${line}`);
    }
    console.log("");
  }

  if (repeatedBlocks.length > 50) {
    console.log(`...and ${repeatedBlocks.length - 50} more repeated blocks`);
  }
}

main();
