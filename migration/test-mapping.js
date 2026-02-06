const PARADAS_COLUMN_MAPPING = {
  'MOTIVO_2': 'motivo1',
  'COR_2': 'cor1'
};

const csvColumns = ['MOTIVO', 'MOTIVO_2', 'COR', 'COR_2'];
const pgColumns = ['MOTIVO', 'motivo1', 'COR', 'cor1'];

console.log('=== EXTRA COLUMNS TEST ===');
const extraColumns = csvColumns.filter(csvCol => {
  if (!csvCol) return false;
  
  const mappedCol = PARADAS_COLUMN_MAPPING[csvCol];
  if (mappedCol) {
    const found = pgColumns.some(pgCol => pgCol === mappedCol);
    console.log(`CSV: ${csvCol} → Mapped: ${mappedCol}, Found in PG: ${found}, Is Extra: ${!found}`);
    return !found;
  }
  
  const found = pgColumns.some(pgCol => pgCol.toLowerCase() === csvCol.toLowerCase());
  console.log(`CSV: ${csvCol}, Found in PG: ${found}, Is Extra: ${!found}`);
  return !found;
});
console.log('Extra columns:', extraColumns);

console.log('\n=== MISSING COLUMNS TEST ===');
const missingColumns = pgColumns.filter(pgCol => {
  const csvEquivalent = Object.entries(PARADAS_COLUMN_MAPPING).find(
    ([csv, pg]) => pg === pgCol
  );
  if (csvEquivalent) {
    const found = csvColumns.some(c => c === csvEquivalent[0]);
    console.log(`PG: ${pgCol} ← CSV: ${csvEquivalent[0]}, Found in CSV: ${found}, Is Missing: ${!found}`);
    return !found;
  }
  
  const found = csvColumns.some(csvCol => csvCol.toLowerCase() === pgCol.toLowerCase());
  console.log(`PG: ${pgCol}, Found in CSV: ${found}, Is Missing: ${!found}`);
  return !found;
});
console.log('Missing columns:', missingColumns);
