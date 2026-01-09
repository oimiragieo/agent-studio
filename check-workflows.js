const fs = require('fs');
const data = JSON.parse(fs.readFileSync('.claude/context/cuj-registry.json', 'utf-8'));
const withWorkflow = data.cujs.filter(c => c.workflow !== null);
const withoutWorkflow = data.cujs.filter(c => c.workflow === null);

console.log('Total CUJs:', data.cujs.length);
console.log('CUJs with workflow:', withWorkflow.length);
console.log('CUJs without workflow:', withoutWorkflow.length);

console.log('\nSample CUJs with workflows:');
withWorkflow.slice(0, 10).forEach(c => {
  console.log(`  ${c.id}: ${c.workflow}`);
});

console.log('\nSample CUJs without workflows:');
withoutWorkflow.slice(0, 10).forEach(c => {
  console.log(`  ${c.id}: ${c.execution_mode}`);
});
