const knex = require('knex');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/reachout.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = knex({
    client: 'sqlite3',
    connection: { filename: DB_PATH },
    useNullAsDefault: true,
    pool: {
        min: 1,
        max: 1,
        afterCreate: (conn, done) => {
            conn.run('PRAGMA foreign_keys = ON');
            conn.run('PRAGMA journal_mode = WAL');
            done(null, conn);
        }
    }
});

module.exports = db;
