const fs = require('fs');
const path = require('path');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsvLine(cells) {
  return cells.map(escapeCsvCell).join(',');
}

function main() {
  const inPath = path.resolve('testing', 'test-cases.csv');
  const outPath = path.resolve('testing', 'test-cases-visual.csv');

  const raw = fs.readFileSync(inPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    throw new Error('No test cases found in testing/test-cases.csv');
  }

  const header = parseCsvLine(lines[0]);
  const idxMain = header.indexOf('Main PRD');
  const idxSub = header.indexOf('Sub PRD');
  const idxReq = header.indexOf('Requirement description');
  const idxSeq = header.indexOf('Test case sequence');
  const idxInputs = header.indexOf('Test inputs');
  const idxExpected = header.indexOf('Expected result');

  const required = [idxMain, idxSub, idxReq, idxSeq, idxInputs, idxExpected];
  if (required.some((x) => x === -1)) {
    throw new Error('Input CSV header missing one or more required columns.');
  }

  const outLines = [];
  outLines.push(toCsvLine(['S.NO', 'Main PRD', 'Sub PRD', 'Requirement description', 'Test case sequence', 'Test inputs', 'Expected result']));

  let prevMain = null;
  let prevSub = null;
  let groupNo = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const mainPrd = (row[idxMain] ?? '').trim();
    const subPrd = (row[idxSub] ?? '').trim();

    const newMain = mainPrd && mainPrd !== prevMain;
    const newSub = newMain || (subPrd && subPrd !== prevSub);

    if (newMain) groupNo += 1;

    const sNoCell = newMain ? String(groupNo) : '';
    const mainCell = newMain ? mainPrd : '';
    const subCell = newSub ? subPrd : '';

    outLines.push(toCsvLine([
      sNoCell,
      mainCell,
      subCell,
      row[idxReq] ?? '',
      row[idxSeq] ?? '',
      row[idxInputs] ?? '',
      row[idxExpected] ?? '',
    ]));

    prevMain = mainPrd || prevMain;
    prevSub = subPrd || prevSub;
  }

  fs.writeFileSync(outPath, outLines.join('\r\n') + '\r\n', 'utf8');
  process.stdout.write(`Wrote ${outLines.length - 1} rows to ${path.relative(process.cwd(), outPath)}\n`);
}

main();

