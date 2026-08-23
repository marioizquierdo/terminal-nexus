import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const markdownFiles = [];

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;

    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    if (entry.isFile() && entry.name.endsWith(".md")) markdownFiles.push(path);
  }
}

collect(root);

const missing = [];
const linkPattern = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g;

/** A malformed escape is not a path; report the link as written rather than throwing on it. */
function decodePath(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

for (const markdownFile of markdownFiles) {
  const contents = readFileSync(markdownFile, "utf8");

  for (const match of contents.matchAll(linkPattern)) {
    const rawTarget = match[1].trim();
    // `<...>` and percent-encoding are how Markdown links carry a path with a space in it, which
    // the concept folder's dated filenames all have. Both are correct links and neither is a path.
    const bracketed = rawTarget.startsWith("<") && rawTarget.endsWith(">");
    const unwrapped = bracketed ? rawTarget.slice(1, -1) : rawTarget;
    const target = decodePath(unwrapped.split("#", 1)[0]);

    if (
      target.length === 0 ||
      target.includes("://") ||
      target.startsWith("mailto:")
    ) {
      continue;
    }

    if (!existsSync(resolve(dirname(markdownFile), target))) {
      missing.push(`${markdownFile.slice(root.length + 1)} -> ${rawTarget}`);
    }
  }
}

if (missing.length > 0) {
  console.error("Broken local Markdown links:");
  for (const link of missing) console.error(`- ${link}`);
  process.exit(1);
}

console.log("Local Markdown links resolved.");

