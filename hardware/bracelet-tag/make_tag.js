// Writes bracelet_tag.scad with the QR pattern baked in.
// Usage: node hardware/bracelet-tag/make_tag.js [SHORT_CODE] [DOMAIN]
//   e.g. node hardware/bracelet-tag/make_tag.js NINO26 genomed-ai-jade.vercel.app
// Then: openscad -D 'part="base"' -o base.stl bracelet_tag.scad  (and part="qr")
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

const code = (process.argv[2] || "NINO26").toUpperCase();
const domain = process.argv[3] || "genomed-ai-jade.vercel.app";
// Capitals let the QR use its compact alphanumeric mode, so the code stays small.
const text = `https://${domain}/B/${code}`.toUpperCase();
const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
const n = qr.modules.size;
const rows = [];
for (let y = 0; y < n; y++) {
  let row = "";
  for (let x = 0; x < n; x++) row += qr.modules.get(y, x) ? "1" : "0";
  rows.push(`  "${row}"`);
}

const template = fs.readFileSync(path.join(__dirname, "bracelet_tag.template.scad"), "utf8");
const out = template
  .replace("/*QR_TEXT*/", text)
  .replace("/*QR_SIZE*/", String(n))
  .replace("/*QR_ROWS*/", rows.join(",\n"));
fs.writeFileSync(path.join(__dirname, "bracelet_tag.scad"), out);
console.log(`${text} → version ${qr.version}, ${n}×${n} → bracelet_tag.scad`);
