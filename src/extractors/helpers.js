import fs from "fs/promises";

/**
* Safely access a nested property on an object using a dotted path.
* Example: safeGet(obj, "a.b.c", null)
*/
export function safeGet(obj, path, defaultValue = null) {
if (!obj || typeof obj !== "object") return defaultValue;
if (!path) return defaultValue;

const parts = Array.isArray(path) ? path : String(path).split(".");
let current = obj;

for (const key of parts) {
if (current && Object.prototype.hasOwnProperty.call(current, key)) {
current = current[key];
} else {
return defaultValue;
}
}
return current == null ? defaultValue : current;
}

/**
* Convert a UNIX timestamp (seconds) into an ISO string.
* Returns null when invalid.
*/
export function parseUnixTimestamp(value) {
if (value == null) return null;
const num =
typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
if (!Number.isFinite(num)) return null;
const millis = num < 1e12 ? num * 1000 : num;
const date = new Date(millis);
if (Number.isNaN(date.getTime())) return null;
return date.toISOString();
}

/**
* Load JSON from a file path.
*/
export async function loadJsonFile(filePath) {
const raw = await fs.readFile(filePath, "utf8");
try {
return JSON.parse(raw);
} catch (err) {
throw new Error(`Failed to parse JSON file at ${filePath}: ${err.message}`);
}
}

/**
* Write JSON to a file (pretty printed) and ensure parent directory exists.
*/
export async function writeJsonFile(filePath, data) {
await ensureDirForFile(filePath);
const serialized = JSON.stringify(data, null, 2);
await fs.writeFile(filePath, serialized, "utf8");
}

/**
* Ensure directory (parent of a file) exists.
*/
export async function ensureDirForFile(filePath) {
const lastSlash = filePath.lastIndexOf("/");
const lastBackslash = filePath.lastIndexOf("\\");
const index = Math.max(lastSlash, lastBackslash);
if (index === -1) return;

const dir = filePath.slice(0, index);
if (!dir) return;

await fs.mkdir(dir, { recursive: true });
}

/**
* Convert an array of objects to CSV string.
* Handles basic quoting and header generation.
*/
export function toCsv(rows) {
if (!Array.isArray(rows) || rows.length === 0) {
return "";
}

const columns = collectColumns(rows);
const headerLine = columns.join(",");

const lines = rows.map((row) =>
columns
.map((col) => {
const value = row[col];
if (value == null) return "";
const asString =
typeof value === "string" ? value : JSON.stringify(value);
return csvEscape(asString);
})
.join(",")
);

return [headerLine, ...lines].join("\n");
}

function collectColumns(rows) {
const cols = new Set();
for (const row of rows) {
if (!row || typeof row !== "object") continue;
Object.keys(row).forEach((k) => cols.add(k));
}
return Array.from(cols);
}

function csvEscape(value) {
if (
value.includes(",") ||
value.includes("\n") ||
value.includes("\r") ||
value.includes('"')
) {
return `"${value.replace(/"/g, '""')}"`;
}
return value;
}