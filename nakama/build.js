const esbuild = require("esbuild");
const path = require("path");
const fs = require("fs");

const isWatch = process.argv.includes("--watch");
const distDir = path.join(__dirname, "dist");
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

const outfile = path.join(__dirname, "dist", "main.js");

const buildOptions = {
    entryPoints: [path.join(__dirname, "src", "main.ts")],
    bundle: true,
    platform: "neutral",
    format: "cjs",
    target: "es2019",
    outfile,
    minify: false,
    sourcemap: false,
    logLevel: "info",
    treeShaking: false,
};

esbuild.build(buildOptions).then(() => {
    // Strip "use strict"; from top — Nakama's Goja runtime treats CJS files
    // in module scope where globalThis != global. Removing "use strict" and
    // the module wrapper makes assignments land in true global scope.
    let content = fs.readFileSync(outfile, "utf8");
    content = content.replace(/^"use strict";\n/, "");
    fs.writeFileSync(outfile, content);
    console.log("[esbuild] Build succeeded → dist/main.js");
}).catch((err) => {
    console.error("[esbuild] Build failed:", err);
    process.exit(1);
});