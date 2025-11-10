import { writeJsonFile, toCsv, ensureDirForFile } from "../extractors/helpers.js";

/**
* Export normalized TikTok results to JSON and optional CSV.
*
* @param {Array<object>} results - Normalized result objects.
* @param {object} options
* @param {string} options.outputFile - Path to JSON file.
* @param {boolean} [options.includeCsv=true] - Whether to write CSV alongside JSON.
*/
export async function exportResults(results, { outputFile, includeCsv = true } = {}) {
if (!outputFile) {
throw new Error("exportResults requires an outputFile path.");
}

const safeResults = Array.isArray(results) ? results : [];
await writeJsonFile(outputFile, safeResults);

if (includeCsv) {
const csvPath = outputFile.replace(/\.json$/i, ".csv");
const flatRows = safeResults.map((row) => flattenRow(row));
const csv = toCsv(flatRows);

await ensureDirForFile(csvPath);
await BunOrNodeWrite(csvPath, csv);
}
}

/**
* Some CSV consumers prefer simple top-level columns.
* Convert nested structures into dotted keys.
*/
function flattenRow(row, prefix = "") {
const out = {};

for (const [key, value] of Object.entries(row || {})) {
const fullKey = prefix ? `${prefix}.${key}` : key;

if (Array.isArray(value)) {
out[fullKey] = value.join("|");
} else if (value && typeof value === "object") {
Object.assign(out, flattenRow(value, fullKey));
} else {
out[fullKey] = value;
}
}

return out;
}

/**
* Write text content to a file in either Node or Bun runtimes.
* This keeps the exporter flexible while still being fully runnable in Node.
*/
async function BunOrNodeWrite(filePath, content) {
// Bun runtime compatibility: Bun.write exists in Bun, not Node.
if (typeof globalThis.Bun !== "undefined" && typeof Bun.write === "function") {
await Bun.write(filePath, content);
return;
}

const fs = await import("fs/promises");
await fs.writeFile(filePath, content, "utf8");
}