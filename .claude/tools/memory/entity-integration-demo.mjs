/**
 * Entity Memory System Integration Demo
 *
 * Demonstrates complete entity extraction, storage, and retrieval workflow
 */

import { EntityExtractor } from './entity-extractor.mjs';
import { EntityMemory } from './entity-memory.mjs';
import { MemoryDatabase } from './database.mjs';
import { join } from 'path';
import { unlinkSync, existsSync } from 'fs';

const DEMO_DB_PATH = join(process.cwd(), '.claude', 'context', 'tmp', 'demo-entity-memory.db');

async function runDemo() {
  console.log('🚀 Entity Memory System Integration Demo\n');

  // Clean up existing demo database
  if (existsSync(DEMO_DB_PATH)) {
    unlinkSync(DEMO_DB_PATH);
  }

  // 1. Initialize components
  console.log('1️⃣  Initializing components...');
  const db = new MemoryDatabase(DEMO_DB_PATH);
  await db.initialize();

  const extractor = new EntityExtractor();
  const memory = new EntityMemory(db);
  await memory.initialize();

  console.log('✅ Components initialized\n');

  // 2. Extract entities from conversation
  console.log('2️⃣  Extracting entities from conversation...');
  const conversation = [
    'Alice decided to use React and TypeScript for the Dashboard project',
    'Bob joined the Engineering Team and started working with Alice',
    'They chose PostgreSQL for the database and Node.js for the backend',
    'The team created a new GitHub repository: acme-corp/dashboard',
  ];

  const allEntities = [];
  for (const message of conversation) {
    const entities = extractor.extractFromText(message);
    allEntities.push(...entities);
    console.log(`   Message: "${message}"`);
    console.log(`   Entities: ${entities.map(e => `${e.value} (${e.type})`).join(', ')}`);
  }

  console.log(`✅ Extracted ${allEntities.length} entities\n`);

  // 3. Store entities and build knowledge graph
  console.log('3️⃣  Building knowledge graph...');
  const entityIds = {};

  for (const entity of allEntities) {
    const id = await memory.createEntity(entity.type, entity.value, {
      confidence: entity.confidence,
      context: entity.context,
    });

    if (!entityIds[entity.value]) {
      entityIds[entity.value] = id;
    }
  }

  // Create relationships
  if (entityIds['Alice'] && entityIds['React']) {
    await memory.addRelationship(entityIds['Alice'], entityIds['React'], 'uses');
  }
  if (entityIds['Alice'] && entityIds['Dashboard']) {
    await memory.addRelationship(entityIds['Alice'], entityIds['Dashboard'], 'contributed_to');
  }
  if (entityIds['Bob'] && entityIds['Alice']) {
    await memory.addRelationship(entityIds['Bob'], entityIds['Alice'], 'worked_with');
  }
  if (entityIds['Bob'] && entityIds['Engineering Team']) {
    await memory.addRelationship(entityIds['Bob'], entityIds['Engineering Team'], 'belongs_to');
  }
  if (entityIds['React'] && entityIds['Dashboard']) {
    await memory.addRelationship(entityIds['React'], entityIds['Dashboard'], 'used_in');
  }
  if (entityIds['PostgreSQL'] && entityIds['Dashboard']) {
    await memory.addRelationship(entityIds['PostgreSQL'], entityIds['Dashboard'], 'used_in');
  }

  console.log(`✅ Created ${Object.keys(entityIds).length} unique entities\n`);

  // 4. Query knowledge graph
  console.log('4️⃣  Querying knowledge graph...');

  // Get Alice's profile
  if (entityIds['Alice']) {
    const alice = await memory.getEntity(entityIds['Alice']);
    console.log(`\n   👤 Alice's Profile:`);
    console.log(`      Type: ${alice.type}`);
    console.log(`      Mentioned: ${alice.occurrence_count} times`);
    console.log(`      Relationships: ${alice.relationships.length}`);
    alice.relationships.forEach(rel => {
      console.log(`         - ${rel.relationship_type}: ${rel.related_value}`);
    });
  }

  // Search for all tools
  const tools = await memory.searchEntities('', 'tool');
  console.log(`\n   🔧 Tools in use:`);
  tools.forEach(tool => {
    console.log(`      - ${tool.value} (mentioned ${tool.occurrence_count}x)`);
  });

  // 5. Format entity context manually (without injection manager to avoid dependencies)
  console.log('\n5️⃣  Entity context format:');
  if (entityIds['Alice']) {
    const alice = await memory.getEntity(entityIds['Alice']);
    console.log(`\n**${alice.value}** (${alice.type})`);
    if (alice.relationships.length > 0) {
      console.log(`- Related: ${alice.relationships.map(r => `${r.relationship_type}: ${r.related_value}`).join(', ')}`);
    }
    console.log(`- Mentioned ${alice.occurrence_count} times`);
  }

  // 6. Get statistics
  console.log('6️⃣  Entity statistics:');
  const stats = await memory.getStats();

  console.log('\n   Entity types:');
  stats.entities.forEach(stat => {
    console.log(`      - ${stat.type}: ${stat.count} entities (${stat.total_occurrences} occurrences)`);
  });

  console.log('\n   Relationship types:');
  stats.relationships.forEach(stat => {
    console.log(
      `      - ${stat.relationship_type}: ${stat.count} (avg strength: ${stat.avg_strength.toFixed(2)})`
    );
  });

  // 7. Entity history
  console.log('\n7️⃣  Entity history (Alice):');
  if (entityIds['Alice']) {
    const history = await memory.getEntityHistory(entityIds['Alice']);
    history.forEach(event => {
      const date = new Date(event.timestamp).toISOString();
      console.log(`      [${date}] ${event.event}: ${event.details}`);
    });
  }

  // Clean up
  db.close();
  if (existsSync(DEMO_DB_PATH)) {
    unlinkSync(DEMO_DB_PATH);
  }

  console.log('\n✨ Demo complete!\n');
}

// Run demo
runDemo().catch(error => {
  console.error('Demo failed:', error);
  process.exit(1);
});
