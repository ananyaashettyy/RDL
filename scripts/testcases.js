#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const readline = require("readline");

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function parseCsv(text) {
  const records = [];
  let record = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      record.push(field);
      field = "";
      continue;
    }

    if (ch === "\r") continue;
    if (ch === "\n") {
      record.push(field);
      field = "";
      const isBlankLine = record.every((v) => (v ?? "").trim() === "");
      if (!isBlankLine) records.push(record);
      record = [];
      continue;
    }

    field += ch;
  }

  if (inQuotes) throw new Error("Invalid CSV: unterminated quote.");

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    const isBlankLine = record.every((v) => (v ?? "").trim() === "");
    if (!isBlankLine) records.push(record);
  }

  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((r) => {
    const obj = {};
    for (let i = 0; i < headers.length; i += 1) obj[headers[i]] = r[i] ?? "";
    return obj;
  });

  return { headers, rows };
}

function fillDown(rows, columns) {
  const last = Object.fromEntries(columns.map((c) => [c, ""]));
  for (const row of rows) {
    for (const col of columns) {
      const v = String(row[col] ?? "").trim();
      if (v) last[col] = v;
      else if (last[col]) row[col] = last[col];
    }
  }
  return rows;
}

function escapeCsv(value) {
  const s = value == null ? "" : String(value);
  const mustQuote = /[",\n\r]/.test(s) || /^\s|\s$/.test(s);
  if (!mustQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(headers, rows) {
  const lines = [];
  lines.push(headers.map(escapeCsv).join(","));
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function escapeXml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnName(n) {
  let num = n;
  let name = "";
  while (num > 0) {
    const rem = (num - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    num = Math.floor((num - 1) / 26);
  }
  return name;
}

function toSheetXml(headers, rows) {
  const cols = headers.length;
  const lines = [];
  lines.push(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
      `<sheetData>`
  );

  const emitRow = (rIndex, values) => {
    lines.push(`<row r="${rIndex}">`);
    for (let c = 0; c < cols; c += 1) {
      const addr = `${columnName(c + 1)}${rIndex}`;
      const v = values[c] ?? "";
      const text = escapeXml(v);
      lines.push(
        `<c r="${addr}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`
      );
    }
    lines.push(`</row>`);
  };

  emitRow(1, headers);
  for (let i = 0; i < rows.length; i += 1) {
    emitRow(i + 2, headers.map((h) => rows[i][h] ?? ""));
  }

  lines.push(`</sheetData></worksheet>`);
  return lines.join("");
}

function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i += 1) {
    let c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime(new Date());

  const writeUInt16LE = (n) => {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(n, 0);
    return b;
  };
  const writeUInt32LE = (n) => {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n >>> 0, 0);
    return b;
  };

  for (const e of entries) {
    const name = String(e.name).replace(/\\/g, "/");
    const nameBuf = Buffer.from(name, "utf8");
    const dataBuf = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data ?? "", "utf8");
    const c = crc32(dataBuf);
    const size = dataBuf.length;

    const localHeader = Buffer.concat([
      writeUInt32LE(0x04034b50),
      writeUInt16LE(20),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(dosTime),
      writeUInt16LE(dosDate),
      writeUInt32LE(c),
      writeUInt32LE(size),
      writeUInt32LE(size),
      writeUInt16LE(nameBuf.length),
      writeUInt16LE(0),
      nameBuf,
    ]);

    localParts.push(localHeader, dataBuf);

    const centralHeader = Buffer.concat([
      writeUInt32LE(0x02014b50),
      writeUInt16LE(20),
      writeUInt16LE(20),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(dosTime),
      writeUInt16LE(dosDate),
      writeUInt32LE(c),
      writeUInt32LE(size),
      writeUInt32LE(size),
      writeUInt16LE(nameBuf.length),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt16LE(0),
      writeUInt32LE(0),
      writeUInt32LE(offset),
      nameBuf,
    ]);

    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralDir = Buffer.concat(centralParts);
  const centralOffset = offset;
  const centralSize = centralDir.length;

  const end = Buffer.concat([
    writeUInt32LE(0x06054b50),
    writeUInt16LE(0),
    writeUInt16LE(0),
    writeUInt16LE(entries.length),
    writeUInt16LE(entries.length),
    writeUInt32LE(centralSize),
    writeUInt32LE(centralOffset),
    writeUInt16LE(0),
  ]);

  return Buffer.concat([...localParts, centralDir, end]);
}

function buildXlsxBuffer({ sheetName = "Test Cases", headers, rows }) {
  const safeSheetName = String(sheetName || "Sheet1").slice(0, 31);
  const sheetXml = toSheetXml(headers, rows);

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escapeXml(safeSheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`;

  const relsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbookRelsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `</Relationships>`;

  const contentTypesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>`;

  return createZip([
    { name: "[Content_Types].xml", data: contentTypesXml },
    { name: "_rels/.rels", data: relsXml },
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRelsXml },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml },
  ]);
}

function mergeHeaders(h1, h2) {
  const out = [];
  const seen = new Set();
  for (const h of [...(h1 || []), ...(h2 || [])]) {
    const key = String(h ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function rowKey(row, headers) {
  const sno = String(row["S.NO"] ?? "").trim();
  if (sno) return `sno:${sno}`;
  const seq = String(row["Test case sequence"] ?? "").trim();
  if (seq) return `seq:${seq}`;
  const req = String(row["Requirement description"] ?? "").trim();
  if (req) return `req:${req}`;
  return `idx:${headers.map((h) => String(row[h] ?? "")).join("|")}`;
}

function mergeRows(primaryRows, secondaryRows, headers) {
  const map = new Map();

  const upsert = (row) => {
    const key = rowKey(row, headers);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row });
      return;
    }
    const merged = { ...existing };
    for (const h of headers) {
      const a = String(existing[h] ?? "").trim();
      const b = String(row[h] ?? "").trim();
      if (!a && b) merged[h] = row[h];
    }
    map.set(key, merged);
  };

  for (const r of primaryRows) upsert(r);
  for (const r of secondaryRows) upsert(r);

  const out = [...map.values()];
  out.sort((a, b) => {
    const aNum = Number(String(a["S.NO"] ?? a["Test case sequence"] ?? "").trim() || 0);
    const bNum = Number(String(b["S.NO"] ?? b["Test case sequence"] ?? "").trim() || 0);
    if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return aNum - bNum;
    return String(rowKey(a, headers)).localeCompare(String(rowKey(b, headers)));
  });
  return out;
}

function normalizeStatus(input) {
  const v = String(input ?? "").trim().toLowerCase();
  if (v === "p" || v === "pass" || v === "passed") return "Pass";
  if (v === "f" || v === "fail" || v === "failed") return "Fail";
  if (v === "s" || v === "skip" || v === "skipped") return "Skip";
  if (v === "pending" || v === "todo" || v === "tbd") return "";
  return input == null ? "" : String(input).trim();
}

function ensureColumns(headers, required) {
  const set = new Set(headers);
  for (const col of required) if (!set.has(col)) headers.push(col);
  return headers;
}

function matchesFilter(row, args) {
  const main = (args.main ?? "").trim();
  const sub = (args.sub ?? "").trim();
  const sno = (args.sno ?? "").trim();
  if (main && String(row["Main PRD"] ?? "").trim() !== main) return false;
  if (sub && String(row["Sub PRD"] ?? "").trim() !== sub) return false;
  if (sno && String(row["S.NO"] ?? "").trim() !== sno) return false;
  return true;
}

async function prompt(rl, q) {
  return new Promise((resolve) => rl.question(q, resolve));
}

async function runInteractive({ filePath, args }) {
  const abs = path.resolve(process.cwd(), filePath);
  const text = fs.readFileSync(abs, "utf8");
  const { headers: rawHeaders, rows } = parseCsv(text);

  const REQUIRED = ["Actual result", "Status(Pass/Fail)", "Observation"];
  const headers = ensureColumns([...rawHeaders], REQUIRED);

  if (headers.length === 0) throw new Error(`No headers found in ${filePath}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("SIGINT", () => rl.close());

  const onlyPending = args.all ? false : true;
  const allowEdit = Boolean(args.edit);

  const candidates = rows
    .filter((r) => matchesFilter(r, args))
    .filter((r) => {
      const status = String(r["Status(Pass/Fail)"] ?? "").trim();
      if (!allowEdit && onlyPending && status) return false;
      return true;
    })
    .sort((a, b) => Number(a["S.NO"] ?? 0) - Number(b["S.NO"] ?? 0));

  if (candidates.length === 0) {
    console.log("No matching test cases to run.");
    rl.close();
    return;
  }

  console.log(
    [
      `Running ${candidates.length} test case(s) from ${filePath}`,
      args.main ? `Main PRD=${args.main}` : null,
      args.sub ? `Sub PRD=${args.sub}` : null,
      args.sno ? `S.NO=${args.sno}` : null,
      onlyPending && !allowEdit ? "Mode=pending-only" : "Mode=edit",
    ]
      .filter(Boolean)
      .join(" | ")
  );
  console.log("Tip: enter 'q' at any prompt to stop (progress is saved).");

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const row = candidates[idx];

    console.log("");
    console.log(
      `#${row["S.NO"]} [${row["Main PRD"]} / ${row["Sub PRD"]}] ${row["Requirement description"]}`
    );
    console.log(`Test input: ${row["Test inputs"]}`);
    console.log(`Expected:   ${row["Expected result"]}`);
    console.log(`Current:    ${row["Status(Pass/Fail)"] || "(pending)"}`);

    const statusIn = await prompt(rl, "Status (P=Pass, F=Fail, S=Skip, Enter=keep, q=quit): ");
    if (String(statusIn).trim().toLowerCase() === "q") break;
    if (String(statusIn).trim() !== "") row["Status(Pass/Fail)"] = normalizeStatus(statusIn);

    const actualIn = await prompt(rl, "Actual result (Enter=keep, q=quit): ");
    if (String(actualIn).trim().toLowerCase() === "q") break;
    if (String(actualIn).trim() !== "") row["Actual result"] = actualIn.trim();

    const finalStatus = String(row["Status(Pass/Fail)"] ?? "").trim().toLowerCase();
    if (finalStatus === "fail") {
      const obsIn = await prompt(rl, "Observation (required for Fail, Enter=keep, q=quit): ");
      if (String(obsIn).trim().toLowerCase() === "q") break;
      if (String(obsIn).trim() !== "") row["Observation"] = obsIn.trim();
    } else {
      row["Observation"] = "";
    }

    fs.writeFileSync(abs, toCsv(headers, rows), "utf8");
    console.log("Saved.");
  }

  rl.close();
  console.log("Done.");
}

function groupBy(rows, key) {
  const map = new Map();
  for (const r of rows) {
    const k = String(r[key] ?? "").trim() || "(empty)";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

function statusBucket(row) {
  const s = String(row["Status(Pass/Fail)"] ?? "").trim().toLowerCase();
  if (s === "pass") return "pass";
  if (s === "fail") return "fail";
  if (s === "skip") return "skip";
  return "pending";
}

function summarize(rows) {
  const out = { total: rows.length, pass: 0, fail: 0, skip: 0, pending: 0 };
  for (const r of rows) out[statusBucket(r)] += 1;
  return out;
}

function renderReportMd({ filePath, rows }) {
  const now = new Date();
  const sum = summarize(rows);

  const lines = [];
  lines.push(`# Test Report`);
  lines.push(``);
  lines.push(`- Source: ${filePath}`);
  lines.push(`- Generated: ${now.toLocaleString()}`);
  lines.push(``);
  lines.push(`## Summary`);
  lines.push(``);
  lines.push(`- Total: ${sum.total}`);
  lines.push(`- Pass: ${sum.pass}`);
  lines.push(`- Fail: ${sum.fail}`);
  lines.push(`- Skip: ${sum.skip}`);
  lines.push(`- Pending: ${sum.pending}`);
  lines.push(``);

  const byMain = groupBy(rows, "Main PRD");
  lines.push(`## By Main PRD`);
  lines.push(``);
  for (const [main, list] of [...byMain.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const s = summarize(list);
    lines.push(`- ${main}: Total ${s.total} | Pass ${s.pass} | Fail ${s.fail} | Skip ${s.skip} | Pending ${s.pending}`);
  }
  lines.push(``);

  const failed = rows
    .filter((r) => statusBucket(r) === "fail")
    .sort((a, b) => Number(a["S.NO"] ?? 0) - Number(b["S.NO"] ?? 0));

  lines.push(`## Failed Cases`);
  lines.push(``);
  if (failed.length === 0) {
    lines.push(`- None`);
  } else {
    for (const r of failed) {
      const obs = String(r["Observation"] ?? "").trim();
      lines.push(
        `- #${r["S.NO"]} [${r["Main PRD"]} / ${r["Sub PRD"]}] ${r["Requirement description"]}${
          obs ? ` — ${obs}` : ""
        }`
      );
    }
  }
  lines.push(``);

  const pending = rows
    .filter((r) => statusBucket(r) === "pending")
    .sort((a, b) => Number(a["S.NO"] ?? 0) - Number(b["S.NO"] ?? 0));

  lines.push(`## Pending Cases`);
  lines.push(``);
  if (pending.length === 0) {
    lines.push(`- None`);
  } else {
    for (const r of pending) {
      lines.push(`- #${r["S.NO"]} [${r["Main PRD"]} / ${r["Sub PRD"]}] ${r["Requirement description"]}`);
    }
  }
  lines.push(``);

  return lines.join("\n");
}

function runReport({ filePath, outPath }) {
  const abs = path.resolve(process.cwd(), filePath);
  const text = fs.readFileSync(abs, "utf8");
  const { rows } = parseCsv(text);
  const report = renderReportMd({ filePath, rows });

  const outAbs = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, report, "utf8");

  const sum = summarize(rows);
  console.log(`Report written to ${path.relative(process.cwd(), outAbs)}`);
  console.log(`Summary: Total ${sum.total} | Pass ${sum.pass} | Fail ${sum.fail} | Skip ${sum.skip} | Pending ${sum.pending}`);
}

function watchReport({ filePath, outPath }) {
  const abs = path.resolve(process.cwd(), filePath);
  const outAbs = path.resolve(process.cwd(), outPath);

  let timer = null;
  const run = () => {
    try {
      runReport({ filePath, outPath });
    } catch (e) {
      console.error(e?.stack || String(e));
    }
  };

  run();
  console.log(`Watching ${path.relative(process.cwd(), abs)} → ${path.relative(process.cwd(), outAbs)}`);
  console.log("Press Ctrl+C to stop.");

  fs.watch(abs, { persistent: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
}

function runMerge({ in1, in2, out, removeSources = false }) {
  const abs1 = path.resolve(process.cwd(), in1);
  const abs2 = path.resolve(process.cwd(), in2);
  const outAbs = path.resolve(process.cwd(), out);

  const t1 = fs.readFileSync(abs1, "utf8");
  const t2 = fs.readFileSync(abs2, "utf8");
  const p1 = parseCsv(t1);
  const p2 = parseCsv(t2);

  const REQUIRED = ["Actual result", "Status(Pass/Fail)", "Observation"];
  const headers = ensureColumns(mergeHeaders(p1.headers, p2.headers), REQUIRED);
  fillDown(p1.rows, ["S.NO", "Main PRD", "Sub PRD"]);
  fillDown(p2.rows, ["S.NO", "Main PRD", "Sub PRD"]);
  const rows = mergeRows(p1.rows, p2.rows, headers);

  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, toCsv(headers, rows), "utf8");

  if (removeSources) {
    if (path.resolve(abs1) !== path.resolve(outAbs) && fs.existsSync(abs1)) fs.unlinkSync(abs1);
    if (path.resolve(abs2) !== path.resolve(outAbs) && fs.existsSync(abs2)) fs.unlinkSync(abs2);
  }

  console.log(`Merged ${p1.rows.length} + ${p2.rows.length} row(s) → ${path.relative(process.cwd(), outAbs)} (${rows.length} unique)`);
  if (removeSources) console.log("Source files removed.");
}

function runXlsx({ inPath, outPath, sheetName }) {
  const abs = path.resolve(process.cwd(), inPath);
  const t = fs.readFileSync(abs, "utf8");
  const parsed = parseCsv(t);
  const REQUIRED = ["Actual result", "Status(Pass/Fail)", "Observation"];
  const headers = ensureColumns([...parsed.headers], REQUIRED);
  fillDown(parsed.rows, ["S.NO", "Main PRD", "Sub PRD"]);

  const buf = buildXlsxBuffer({
    sheetName: sheetName || "Test Cases",
    headers,
    rows: parsed.rows,
  });

  const outAbs = path.resolve(process.cwd(), outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, buf);
  console.log(`XLSX written to ${path.relative(process.cwd(), outAbs)}`);
}

function printHelp() {
  console.log(`Usage:
  node scripts/testcases.js run [--file <path>] [--main <Main PRD>] [--sub <Sub PRD>] [--sno <S.NO>] [--all] [--edit]
  node scripts/testcases.js report [--file <path>] [--out <path>]
  node scripts/testcases.js watch [--file <path>] [--out <path>]
  node scripts/testcases.js merge --in1 <path> --in2 <path> --out <path> [--remove]
  node scripts/testcases.js xlsx --in <path> --out <path> [--sheet <name>]

Defaults:
  --file testing/test-cases.csv
  report --out testing/test-report.md
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || "help";

  const filePath = args.file || "testing/test-cases.csv";

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }

  if (cmd === "run") {
    await runInteractive({ filePath, args });
    return;
  }

  if (cmd === "report") {
    const outPath = args.out || "testing/test-report.md";
    runReport({ filePath, outPath });
    return;
  }

  if (cmd === "watch") {
    const outPath = args.out || "testing/test-report.md";
    watchReport({ filePath, outPath });
    return;
  }

  if (cmd === "merge") {
    const in1 = args.in1 || "testing/test-cases.csv";
    const in2 = args.in2 || "testing/attendance-system-test-cases.csv";
    const out = args.out || "testing/test-cases.csv";
    runMerge({ in1, in2, out, removeSources: Boolean(args.remove) });
    return;
  }

  if (cmd === "xlsx") {
    const inPath = args.in || args.file || "testing/test-cases.csv";
    const outPath = args.out || "testing/test-cases.xlsx";
    const sheetName = args.sheet || "Test Cases";
    runXlsx({ inPath, outPath, sheetName });
    return;
  }

  printHelp();
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
