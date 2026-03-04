import fs from 'fs';

const filePath = 'c:\\stc-produccion-v2\\frontend\\src\\components\\inventario\\InventoryManager.vue';
let content = fs.readFileSync(filePath, 'utf8');

const tfootStartToken = '<tfoot class="bg-gray-50 border-t-2 border-gray-300 compact-summary-footer">';

const firstIndex = content.indexOf(tfootStartToken);
const secondIndex = content.indexOf(tfootStartToken, firstIndex + 1);

let targetIndexStart = secondIndex;
if (secondIndex === -1) {
    // Maybe only one exists? Let's check with standard replacement or find a unique string in the second footer.
    // The second footer has "TOTALES LOTES" "M1-M{{ mixPlanSimulation.N_identical }}"
}

const sectionStart = content.indexOf('<!-- Resumen Mezcla (Cantidad / Peso) -->', secondIndex !== -1 ? secondIndex - 100 : firstIndex);

// Let's print out some context to debug
console.log("firstIndex:", firstIndex);
console.log("secondIndex:", secondIndex);

const lines = content.split('\n');
for (let i=0; i<lines.length; i++) {
  if (lines[i].includes('compact-summary-footer')) {
    console.log('L' + i + ': ' + lines[i].trim());
  }
}
