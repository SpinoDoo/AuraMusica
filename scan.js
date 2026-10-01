const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const mm = require('music-metadata');

const db = new Database('music.db');
const musicDir = path.join(__dirname, 'music');
const coversDir = path.join(__dirname, 'covers');

if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir);

// Finds an existing album by title, or creates one if it doesn't exist yet.
// On creation, seeds release_year and cover_path from this song - existing
// albums are never overwritten by later songs.
function resolveAlbumId(albumTitle, { artist, year, coverPath } = {}) {
  if (!albumTitle) return null;

  const trimmedTitle = albumTitle.trim();
  if (!trimmedTitle) return null;

  let album = db.prepare('SELECT id FROM albums WHERE title = ?').get(trimmedTitle);

  if (!album) {
    const insertAlbum = db.prepare(
      'INSERT INTO albums (title, artist, release_year, cover_path) VALUES (?, ?, ?, ?)'
    );
    const result = insertAlbum.run(trimmedTitle, artist || null, year || null, coverPath || null);
    album = { id: result.lastInsertRowid };
    console.log(`  Created new album: "${trimmedTitle}"`);
  }

  return album.id;
}

async function scan() {
  const filesOnDisk = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
  const existing = db.prepare('SELECT filename FROM songs').all().map(s => s.filename);

  const newFiles = filesOnDisk.filter(f => !existing.includes(f));

  if (newFiles.length === 0) {
    console.log('No new files found.');
    return;
  }

  console.log(`Found ${newFiles.length} new file(s):`, newFiles);

  const insert = db.prepare(`
    INSERT INTO songs (title, artist, filename, cover_path, album_id, track_number)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const filename of newFiles) {
    const filepath = path.join(musicDir, filename);

    let title = filename.replace('.mp3', '');
    let artist = null;
    let coverPath = null;
    let albumId = null;
    let trackNumber = null;

    try {
      const metadata = await mm.parseFile(filepath);

      title = metadata.common.title || title;
      artist = metadata.common.artist || null;
      trackNumber = metadata.common.track?.no || null;

      const picture = metadata.common.picture?.[0];
      if (picture) {
        coverPath = filename.replace('.mp3', '.jpg');
        fs.writeFileSync(path.join(coversDir, coverPath), picture.data);
      }

      if (metadata.common.album) {
        albumId = resolveAlbumId(metadata.common.album, {
          artist,
          year: metadata.common.year || null,
          coverPath
        });
      }
    } catch (err) {
      console.error(`Metadata read failed for ${filename}:`, err.message);
    }

    insert.run(title, artist, filename, coverPath, albumId, trackNumber);
    console.log(`Added: ${title} — ${artist || 'Unknown artist'}${trackNumber ? ` (track ${trackNumber})` : ''}`);
  }

  console.log('Scan complete.');
}

scan();