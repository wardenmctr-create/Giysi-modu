// Sayfa üretici: şablon HTML + build/preview_data.json → tek HTML dosyası.
// Kullanım: node tools/page.mjs <şablon.html> <çıktı.html> [yerel three.js] [yerel jszip]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [tpl, out, localThree, localZip] = process.argv.slice(2);
let html = fs.readFileSync(path.resolve(ROOT, tpl), "utf8");
const data = fs.readFileSync(path.join(ROOT, "build/preview_data.json"), "utf8").replace(/<\//g, "<\\/");
html = html.replace("/*__VERI__*/", data);
if (localThree) html = html.replace("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", localThree);
if (localZip) html = html.replace("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", localZip);
fs.writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} KB)`);
