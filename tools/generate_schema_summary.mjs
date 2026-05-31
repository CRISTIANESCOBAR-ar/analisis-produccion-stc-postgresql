import fs from 'fs';
const inputPath = `c:\\Users\\crist\\AppData\\Roaming\\Code\\User\\workspaceStorage\\386fb8a996e5ba851e5810dc1e3d06f4\\GitHub.copilot-chat\\chat-session-resources\\9e142486-88e4-440e-b173-b63917e74cd8\\call_rOSXef7mZs0hMeMWnSzLmeoZ__vscode-1780164730835\\content.txt`;
const outPath = 'c:\\stc-produccion-v2\\db_schema_summary.md';

const raw = fs.readFileSync(inputPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);
const schemas = {};
for (const line of lines) {
  const parts = line.split('|');
  if (parts.length < 4) continue;
  const [schema, table, column, data_type, precision, is_nullable, column_default] = parts;
  if (!schemas[schema]) schemas[schema] = {};
  if (!schemas[schema][table]) schemas[schema][table] = [];
  const typeStr = precision ? `${data_type}(${precision})` : data_type;
  schemas[schema][table].push({ column, type: typeStr });
}

let md = '# Resumen de tablas y columnas\n\n';
for (const schema of Object.keys(schemas).sort()) {
  md += `## Esquema: ${schema}\n\n`;
  const tables = schemas[schema];
  for (const table of Object.keys(tables).sort()) {
    md += `### ${table}\n\n`;
    const cols = tables[table];
    const colLines = cols.map(c => `- **${c.column}**: ${c.type}`).join('\n');
    md += colLines + '\n\n';
  }
}
fs.writeFileSync(outPath, md, 'utf8');
console.log('WROTE', outPath);
