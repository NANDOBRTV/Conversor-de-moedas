import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";
import process from "node:process";

const ignoredDirectories = new Set([".git", "node_modules"]);
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) await walk(join(directory, entry.name));
    } else if (entry.isFile() && entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) {
      files.push(join(directory, entry.name));
    }
  }
}

await walk(process.cwd());
let failures = 0;
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failures++;
    process.stderr.write(`\n[ERRO] ${relative(process.cwd(), file)}\n${result.stderr || result.stdout}`);
  }
}
if (failures) {
  process.stderr.write(`\n${failures} arquivo(s) com erro de sintaxe.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Sintaxe JavaScript válida em ${files.length} arquivo(s).\n`);
}
