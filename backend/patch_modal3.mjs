import fs from 'fs';

const filePath = 'c:\\stc-produccion-v2\\frontend\\src\\components\\inventario\\InventoryManager.vue';
let content = fs.readFileSync(filePath, 'utf8');

const tfootData = fs.readFileSync('c:\\stc-produccion-v2\\backend\\modal_tfoot.html', 'utf8');

const startIndex = content.indexOf('<tfoot class="bg-gray-50 border-t-2 border-gray-300 compact-summary-footer">', 100000); 
const endIndex = content.indexOf('</tfoot>', startIndex) + 8;

if (startIndex !== -1 && endIndex > startIndex) {
    content = content.substring(0, startIndex) + tfootData + content.substring(endIndex);
    fs.writeFileSync(filePath, content);
    console.log('Success! Replaced TFOOT block properly.');
} else {
    console.log('Failed to find exact tags', startIndex, endIndex);
}
