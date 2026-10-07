const fs = require('fs');

const f = 'c:/stc-mezclas-poc/frontend/src/components/ensayos/DetalleMisturaLote.vue';
if(fs.existsSync(f)) {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/str\.match\(\/\[\\s-\]\(\\d\+\)\[\\s-\]\/\)/g, 'str.match(/[\\s-]([\\d\\/]+)(?:[\\s-]|$)/)');
  fs.writeFileSync(f, content);
  console.log('Updated DetalleMisturaLote');
}
