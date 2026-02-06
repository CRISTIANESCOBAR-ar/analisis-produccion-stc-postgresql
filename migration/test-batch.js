// Test batch insert con datos de prueba
const numColumns = 66;
const BATCH_SIZE = 454;

// Simularmock records
const validRecords = [];
for (let i = 0; i < 1000; i++) {
  const record = {};
  for (let col = 0; col < numColumns; col++) {
    record[`col${col}`] = `value${i}-${col}`;
  }
  validRecords.push(record);
}

console.log(`Total records: ${validRecords.length}`);
console.log(`Batch size: ${BATCH_SIZE}`);
console.log(`Num columns: ${numColumns}`);

// Simular primer batch
const batch = validRecords.slice(0, BATCH_SIZE);
console.log(`\nFirst batch size: ${batch.length}`);

// Construir placeholders
const valuePlaceholders = [];
const allValues = [];

batch.forEach((record, idx) => {
  const offset = idx * numColumns;
  const placeholders = Array.from({ length: numColumns }, (_, colIdx) => `$${offset + colIdx + 1}`);
  valuePlaceholders.push(`(${placeholders.join(', ')})`);
  allValues.push(...Object.values(record));
});

console.log(`\nTotal placeholders: ${valuePlaceholders.length}`);
console.log(`Total values: ${allValues.length}`);
console.log(`Expected values: ${BATCH_SIZE * numColumns} = ${BATCH_SIZE} × ${numColumns}`);
console.log(`Match: ${allValues.length === BATCH_SIZE * numColumns}`);

// Verificar primer y último placeholder
console.log(`\nFirst placeholder: ${valuePlaceholders[0].substring(0, 50)}...`);
console.log(`Last placeholder: ...${valuePlaceholders[valuePlaceholders.length - 1].slice(-50)}`);
