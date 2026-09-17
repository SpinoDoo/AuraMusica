const Database = require('better-sqlite3');
const db = new Database('music.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT,
    filename TEXT NOT NULL,
    cover_path TEXT,
    uploaded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id INTEGER NOT NULL,
    song_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, song_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  );


`);

  // CREATE TABLE IF NOT EXISTS listen_events (
  //   id INTEGER PRIMARY KEY AUTOINCREMENT,
  //   user_id INTEGER NOT NULL,
  //   song_id INTEGER NOT NULL,
  //   played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  //   seconds_listened INTEGER,
  //   FOREIGN KEY (user_id) REFERENCES users(id),
  //   FOREIGN KEY (song_id) REFERENCES songs(id)
  // );

// const insert = db.prepare('INSERT INTO songs (title, artist, filename, cover_path) VALUES (?, ?, ?)');
// insert.run('Stranded', 'Gojira', 'Stranded.mp3');

console.log('Database created');