import fs from 'fs';
const inputPath = `c:\\Users\\crist\\AppData\\Roaming\\Code\\User\\workspaceStorage\\386fb8a996e5ba851e5810dc1e3d06f4\\GitHub.copilot-chat\\chat-session-resources\\9e142486-88e4-440e-b173-b63917e74cd8\\call_rOSXef7mZs0hMeMWnSzLmeoZ__vscode-1780164730835\\content.txt`;
const outPath = 'c:\\stc-produccion-v2\\db_schema.csv';

if (!fs.existsSync(inputPath)) {
  console.error('Input file not found:', inputPath);
  process.exit(2);
}
const raw = fs.readFileSync(inputPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(Boolean);

function q(v){
  if (v === undefined || v === null) return '';
  return '"' + String(v).replace(/"/g,'""') + '"';
}

const rows = [];
rows.push(['schema','table','column','data_type','precision','is_nullable','column_default'].map(q).join(','));
for (const line of lines) {
  const parts = line.split('|');
  if (parts.length < 4) continue;
  const schema = parts[0] || '';
  const table = parts[1] || '';
  const column = parts[2] || '';
  const data_type = parts[3] || '';
  const precision = parts[4] || '';
  const is_nullable = parts[5] || '';
  const column_default = parts[6] || '';
  rows.push([schema,table,column,data_type,precision,is_nullable,column_default].map(q).join(','));
}
fs.writeFileSync(outPath, rows.join('\r\n'), 'utf8');
console.log('WROTE', outPath);
