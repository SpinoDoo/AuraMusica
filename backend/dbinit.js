const Database = require('better-sqlite3');
const db = new Database('music.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT,
    filename TEXT NOT NULL
  );
`);

const insert = db.prepare('INSERT INTO songs (title, artist, filename) VALUES (?, ?, ?)');
insert.run('Stranded', 'Gojira', 'Stranded.mp3');

console.log('DB initialized and seeded.');