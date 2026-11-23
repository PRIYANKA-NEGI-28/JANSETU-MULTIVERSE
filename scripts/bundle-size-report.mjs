import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const distDir = path.resolve('apps/web/dist');
const assetsDir = path.join(distDir, 'assets');

if (!fs.existsSync(assetsDir)) {
  console.error(`Assets directory not found at ${assetsDir}. Run web build first.`);
  process.exit(1);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} kB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

const files = fs.readdirSync(assetsDir);
const report = [];

let totalRaw = 0;
let totalGzip = 0;

for (const file of files) {
  const filePath = path.join(assetsDir, file);
  const stat = fs.statSync(filePath);
  if (stat.isFile()) {
    const rawBytes = stat.size;
    const content = fs.readFileSync(filePath);
    const gzipBytes = zlib.gzipSync(content).length;

    totalRaw += rawBytes;
    totalGzip += gzipBytes;

    report.push({
      file,
      rawBytes,
      gzipBytes,
      rawFormatted: formatBytes(rawBytes),
      gzipFormatted: formatBytes(gzipBytes),
    });
  }
}

// Sort largest to smallest by gzip size
report.sort((a, b) => b.gzipBytes - a.gzipBytes);

console.log('\n============================================================');
console.log('              JANSETU WEB BUNDLE SIZE REPORT                ');
console.log('============================================================');
console.log(
  'Asset'.padEnd(42) +
  'Raw Size'.padStart(12) +
  'Gzip Size'.padStart(12)
);
console.log('-'.repeat(66));

for (const item of report) {
  console.log(
    item.file.padEnd(42) +
    item.rawFormatted.padStart(12) +
    item.gzipFormatted.padStart(12)
  );
}

console.log('='.repeat(66));
console.log(
  'Total Bundle Size:'.padEnd(42) +
  formatBytes(totalRaw).padStart(12) +
  formatBytes(totalGzip).padStart(12)
);
console.log('============================================================\n');

// Write to GitHub Actions Step Summary if available
if (process.env.GITHUB_STEP_SUMMARY) {
  let md = '### 📦 JanSetu Web Production Bundle Size Report\n\n';
  md += '| Asset | Raw Size | Gzip Size |\n';
  md += '| :--- | :---: | :---: |\n';
  for (const item of report) {
    md += `| \`${item.file}\` | ${item.rawFormatted} | ${item.gzipFormatted} |\n`;
  }
  md += `| **Total** | **${formatBytes(totalRaw)}** | **${formatBytes(totalGzip)}** |\n`;

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md, 'utf8');
}
