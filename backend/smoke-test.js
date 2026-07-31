const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const frontend = path.join(__dirname, "..", "frontend");
let failures = [];
for (const file of fs.readdirSync(frontend).filter(f => f.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(frontend, file), "utf8");
  for (const match of html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)) {
    const src = match[1].split("?")[0];
    if (src.startsWith("js/") && !fs.existsSync(path.join(frontend, src))) failures.push(`${file}: missing ${src}`);
  }
  if (/Login Successful/i.test(html)) failures.push(`${file}: contains obsolete login success popup text`);
}
for (const file of fs.readdirSync(path.join(frontend, "js")).filter(f => f.endsWith(".js"))) {
  try { execFileSync(process.execPath, ["--check", path.join(frontend, "js", file)], { stdio: "pipe" }); }
  catch { failures.push(`JavaScript syntax error: ${file}`); }
}
for (const file of fs.readdirSync(path.join(__dirname, "routes")).filter(f => f.endsWith(".js"))) {
  try { execFileSync(process.execPath, ["--check", path.join(__dirname, "routes", file)], { stdio: "pipe" }); }
  catch { failures.push(`Backend syntax error: routes/${file}`); }
}
if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
console.log("HomeServe smoke test passed: script references and JavaScript syntax are valid.");
