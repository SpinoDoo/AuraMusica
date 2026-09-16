const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const mm = require('music-metadata');

const db = new Database('music.db');
const musicDir = path.join(__dirname, 'music');
const coversDir = path.join(__dirname, 'covers');

if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir);

async function scan() {
  const filesOnDisk = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
  const existing = db.prepare('SELECT filename FROM songs').all().map(s => s.filename);

  const newFiles = filesOnDisk.filter(f => !existing.includes(f));

  if (newFiles.length === 0) {
    console.log('No new files found.');
    return;
  }

  console.log(`Found ${newFiles.length} new file(s):`, newFiles);

  const insert = db.prepare(
    'INSERT INTO songs (title, artist, filename, cover_path) VALUES (?, ?, ?, ?)'
  );

  for (const filename of newFiles) {
    const filepath = path.join(musicDir, filename);

    let title = filename.replace('.mp3', '');
    let artist = null;
    let coverPath = null;

    try {
      const metadata = await mm.parseFile(filepath);
      title = metadata.common.title || title;
      artist = metadata.common.artist || null;

      const picture = metadata.common.picture?.[0];
      if (picture) {
        coverPath = filename.replace('.mp3', '.jpg');
        fs.writeFileSync(path.join(coversDir, coverPath), picture.data);
      }
    } catch (err) {
      console.error(`Metadata read failed for ${filename}:`, err.message);
    }

    insert.run(title, artist, filename, coverPath);
    console.log(`Added: ${title} — ${artist || 'Unknown artist'}`);
  }

  console.log('Scan complete.');
}

scan();