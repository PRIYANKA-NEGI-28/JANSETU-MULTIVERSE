const neo4j = require('neo4j-driver');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const user = process.env.NEO4J_USERNAME || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

async function clearData() {
  const session = driver.session();
  try {
    console.log('Connecting to Neo4j...');
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('Successfully deleted all Neo4j data.');
  } catch (err) {
    console.error('Error deleting Neo4j data:', err);
  } finally {
    await session.close();
    await driver.close();
  }

  const dbFile = path.join(__dirname, 'db', 'store.sqlite');
  try {
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
      console.log('Successfully deleted SQLite database file.');
    } else {
      console.log('SQLite database file does not exist.');
    }
  } catch (err) {
    console.error('Error deleting SQLite file:', err);
  }
}

clearData();
