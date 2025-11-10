import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { loadJsonFile } from "./extractors/helpers.js";
import { parseSearchResults } from "./extractors/tiktok_parser.js";
import { exportResults } from "./outputs/data_exporter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

function log(level, message, meta) {
const timestamp = new Date().toISOString();
const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
if (meta !== undefined) {
console.log(base, "-", JSON.stringify(meta, null, 2));
} else {
console.log(base);
}
}

function parseArgs(argv) {
const args = {
mode: undefined,
search: undefined,
maxItems: undefined,
endPage: undefined,
input: undefined,
output: undefined
};

const pairs = [...argv];
while (pairs.length) {
const key = pairs.shift();
if (!key.startsWith("--")) continue;
const name = key.slice(2);
const value = pairs[0] && !pairs[0].startsWith("--") ? pairs.shift() : "true";

switch (name) {
case "mode":
args.mode = value;
break;
case "search":
case "keyword":
args.search = value;
break;
case "maxItems":
args.maxItems = Number(value);
break;
case "endPage":
args.endPage = Number(value);
break;
case "input":
case "inputFile":
args.input = value;
break;
case "output":
case "outputFile":
args.output = value;
break;
default:
log("warn", `Unknown CLI argument: --${name}`);
}
}

return args;
}

async function loadSettings() {
const configPath = path.resolve(PROJECT_ROOT, "src", "config", "settings.json");
try {
const raw = await fs.readFile(configPath, "utf8");
const settings = JSON.parse(raw);
return settings;
} catch (err) {
log("error", "Failed to read config file, using defaults", { error: err.message });
return {
mode: "mock",
inputFile: "data/sample_input.json",
outputFile: "data/example_output.json",
maxItems: 100,
endPage: 1,
logLevel: "info"
};
}
}

async function fetchTikTokSearch(searchTerm, { maxItems = 50, endPage = 1 } = {}) {
if (typeof fetch !== "function") {
throw new Error("Global fetch is not available. Use Node 18+ or run in mock mode.");
}

const encodedKeyword = encodeURIComponent(searchTerm);
const count = Math.min(Math.max(maxItems, 1), 100);

const url = `https://www.tiktok.com/api/search/general/full/?keyword=${encodedKeyword}&region=US&count=${count}&cursor=0`;

log("info", "Requesting TikTok search endpoint", { url, maxItems, endPage });

const response = await fetch(url, {
headers: {
"User-Agent":
"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
"(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
"Accept": "application/json, text/plain, */*",
"Referer": "https://www.tiktok.com/",
"Accept-Language": "en-US,en;q=0.9"
}
});

if (!response.ok) {
const text = await response.text().catch(() => "");
throw new Error(
`TikTok search request failed (${response.status} ${response.statusText}): ${text.slice(
0,
200
)}`
);
}

const json = await response.json();
return json;
}

async function run() {
const cli = parseArgs(process.argv.slice(2));
const settings = await loadSettings();

const mode = cli.mode || settings.mode || "mock";
const maxItems = Number.isFinite(cli.maxItems) ? cli.maxItems : settings.maxItems || 100;
const endPage = Number.isFinite(cli.endPage) ? cli.endPage : settings.endPage || 1;

log("info", "Starting TikTok Search Scraper", { mode, maxItems, endPage });

let rawData;

if (mode === "live") {
const searchTerm = cli.search || settings.search;
if (!searchTerm) {
throw new Error(
"Live mode requires a search term. Pass --search \"your keyword\" or define it in settings.json."
);
}
rawData = await fetchTikTokSearch(searchTerm, { maxItems, endPage });
} else {
const inputFile = cli.input || settings.inputFile || "data/sample_input.json";
const inputPath = path.resolve(PROJECT_ROOT, inputFile);
log("info", "Using mock/sample input file", { inputPath });

rawData = await loadJsonFile(inputPath);
}

const parsed = parseSearchResults(rawData, { maxItems });

log("info", "Parsed normalized results", { total: parsed.length });

const outputFile =
cli.output || settings.outputFile || "data/example_output.json";
const outputPath = path.resolve(PROJECT_ROOT, outputFile);

await exportResults(parsed, {
outputFile: outputPath,
includeCsv: true
});

log("info", "Scraping pipeline completed successfully", {
outputJson: outputPath,
outputCsv: outputPath.replace(/\.json$/i, ".csv")
});
}

run().catch((err) => {
log("error", "Fatal error while running TikTok Search Scraper", {
error: err.message,
stack: err.stack
});
process.exitCode = 1;
});