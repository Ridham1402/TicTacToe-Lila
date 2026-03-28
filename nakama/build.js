const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "dist");
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const src = path.join(__dirname, "src", "main.runtime.js");
const dst = path.join(__dirname, "dist", "main.js");

fs.copyFileSync(src, dst);
console.log("[build] Copied src/main.runtime.js → dist/main.js");
console.log("[build] Build complete.");