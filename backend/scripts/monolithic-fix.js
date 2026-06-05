import fs from 'fs';

const path = 'c:/stc-produccion-v2/backend/server.js';
let content = fs.readFileSync(path, 'utf8');

const startStr = "app.get('/api/calidad/analisis-patrones-teje', async (req, res) => {";
const endStr = "});\r\n\r\n// =====================================================\r\n// GET /api/informe-diario?fecha=YYYY-MM-DD";
const endStr2 = "});\n\n// =====================================================\n// GET /api/informe-diario?fecha=YYYY-MM-DD";

const startIndex = content.indexOf(startStr);
let endIndex = content.indexOf(endStr, startIndex);
if (endIndex === -1) {
    endIndex = content.indexOf(endStr2, startIndex);
}

if (startIndex === -1 || endIndex === -1) {
    console.error("Endpoint boundaries not found!");
    process.exit(1);
}

const newContent = fs.readFileSync('c:/stc-produccion-v2/backend/scripts/new-endpoint.txt', 'utf8');

content = content.substring(0, startIndex) + newContent + content.substring(endIndex);

// 1. Add crypto import
if (!content.includes("import crypto from 'crypto'")) {
    content = content.replace("import fs from 'fs'", "import fs from 'fs'\\nimport crypto from 'crypto'");
}

// 2. Add helper functions
const helpers = fs.readFileSync('c:/stc-produccion-v2/backend/scripts/helpers.txt', 'utf8');

if (!content.includes('function buildCacheKey')) {
    content = content.replace('function buildNarrativaStructuredFields', helpers + '\\nfunction buildNarrativaStructuredFields');
}

fs.writeFileSync(path, content, 'utf8');
console.log("Applied monolithic update flawlessly!");
