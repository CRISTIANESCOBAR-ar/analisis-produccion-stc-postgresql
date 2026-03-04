const items = [
  { id: 'Cam1', stock: 125, r: 0 },
  { id: 'Cam2', stock: 125, r: 0 },
  { id: 'Cam3', stock: 125, r: 0 },
  { id: 'ALAL', stock: 70, r: 0 },
  { id: 'Caram646', stock: 125, r: 0 },
  { id: 'Caram647', stock: 125, r: 0 },
  { id: 'FU1', stock: 25, r: 0 },
  { id: 'FU2', stock: 33, r: 0 },
  { id: 'FU3', stock: 38, r: 0 },
  { id: 'FU4', stock: 34, r: 0 },
];
const TOLER = 4;
const TOTAL_FARDOS = 41;
const REQUIRED_USO = Math.round(TOTAL_FARDOS * 0.9); // 37
const totalStock = items.reduce((s, i) => s + i.stock, 0);

items.forEach(c => {
  c.rawRecipe = c.stock * (REQUIRED_USO / totalStock);
  c.recipe = Math.floor(c.rawRecipe);
  c.remainder = c.rawRecipe - c.recipe;
});

const sumFloor = items.reduce((sum, c) => sum + c.recipe, 0);
let deficit = REQUIRED_USO - sumFloor;

console.log(`Deficit: ${deficit}`);

// LRM (Current logic)
const items_LRM = JSON.parse(JSON.stringify(items));
[...items_LRM]
  .sort((a,b) => b.remainder - a.remainder)
  .slice(0, deficit)
  .forEach(c => c.recipe++);

let max_mix_LRM = Math.min(...items_LRM.map(c => Math.floor(c.stock / c.recipe)));
console.log('LRM max mixes:', max_mix_LRM);

// Smart bottlenect rounding
const items_smart = JSON.parse(JSON.stringify(items));
let loops = deficit;
for(let i=0; i<loops; i++) {
  // We want to pick the +1 that preserves the highest possible bottleneck.
  // Instead of strictly looking at the highest bottleneck among all,
  // we filter to those with a "decent" remainder (e.g., top 150% of the deficit pool size to maintain proportionality),
  // then pick the one whose impact on their OWN capacity is LEAST severe.
  
  // Or simpler: calculate what `max_mix` of the WHOLE PLAN would be if we give +1 to each candidate.
  // and pick the one that gives the highest overall `max_mix`.
  let bestCandidate = null;
  let maxPossibleGlobalBottleneck = -1;
  let bestTies = [];
  
  items_smart.forEach(c => {
    // try giving +1 to c
    c.recipe++;
    let globalLimit = Math.min(...items_smart.map(x => Math.floor(x.stock / x.recipe)));
    if(globalLimit > maxPossibleGlobalBottleneck) {
      maxPossibleGlobalBottleneck = globalLimit;
      bestTies = [c];
    } else if (globalLimit === maxPossibleGlobalBottleneck) {
      bestTies.push(c);
    }
    c.recipe--; // revert
  });
  
  // Tie breaking: Among the candidates that maintain the highest global bottleneck,
  // pick the one with the highest proportional remainder.
  if(bestTies.length > 0) {
    bestTies.sort((a,b) => b.remainder - a.remainder);
    bestTies[0].recipe++;
  } else {
    items_smart[0].recipe++; // fallback
  }
}

let max_mix_smart = Math.min(...items_smart.map(c => Math.floor(c.stock / c.recipe)));
console.log('Smart max mixes:', max_mix_smart);
console.log('Differences:');
for(let i=0; i<items.length; i++) {
   console.log(`${items[i].id.padEnd(10)}: LRM=${items_LRM[i].recipe} (limit ${Math.floor(items_LRM[i].stock/items_LRM[i].recipe)}) | SMART=${items_smart[i].recipe} (limit ${Math.floor(items_smart[i].stock/items_smart[i].recipe)}) | Remainder=${items[i].remainder.toFixed(3)}`);
}

