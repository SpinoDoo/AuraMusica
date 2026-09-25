const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const app = express();
const db = new Database('music.db');
const mm = require('music-metadata');
const multer = require('multer');
const fs = require('fs');
const bcrypt = require('bcrypt');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_KEY;

app.use('/music', express.static(path.join(__dirname, 'music')));
app.use('/covers', express.static(path.join(__dirname, 'covers')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// async function getCoverArt(filepath) {
//   const metadata = await mm.parseFile(filepath);
//   const picture = metadata.common.picture?.[0];
//   if (!picture) return null;
//   return picture;
// }

function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'no token provided '});
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(403).json({ error: 'invalid or expired token'});
    }
}

app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !password || !email) {
        return res.status(400).json({ error: 'At least one field is empty'});
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        return res.status(409).json({ error: 'Username already taken'});
    }

    const password_hash = await bcrypt.hash(password, 13);
    const insert = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
    const result = insert.run(username, email, password_hash);

    res.status(201).json({ id: result.lastInsertRowid, username });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
        return res.status(401).json({ error: 'Invalid unsername or password'});
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
        return res.status(401).json({ error: 'Invalid unsername or password'});
    }

    const token = jwt.sign({ id: user.id, username: user.username }, '' + JWT_SECRET, { expiresIn: '14d' });
    res.json({ token, username: username });
});

const storage = multer.diskStorage({
    destination: (req, file, cb )=> {
        cb(null, file.fieldname === 'cover' ? 'covers/' : 'music/');
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = file.fieldname === 'cover' ? path.extname(file.originalname) || '.jpg' : '.mp3';
        cb(null, unique + ext);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'song' && file.mimetype !== 'audio/mpeg'){
            return cb(new Error('Only mp3s allowed for the song'));
        }
        if (file.fieldname === 'cover' && !file.mimetype.startsWith('image/')){
            console.log(file.mimetype);
            return cb(new Error('Cover must be an image'));
        }
        cb(null, true);
    }
});

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
  }

  return album.id;
}

app.post('/api/upload', requireAuth, upload.fields([
    { name: 'song', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
]), async (req, res) => {
    const songFile = req.files?.song?.[0];
    const coverFile = req.files?.cover?.[0];
    const { title, artist, album_id, track_number } = req.body;

    if (!songFile) {
        return res.status(400).json({ error: 'No song file uploaded' });
    }

    let cover_path = null;
    let metadata = null;

    try {
        metadata = await mm.parseFile(songFile.path);
    } catch (err) {
        console.error('Metadata read failed:', err);
    }

    if (coverFile) {
        cover_path = coverFile.filename;
    } else if (metadata?.common.picture?.[0]) {
        cover_path = songFile.filename.replace('.mp3', '.jpg');
        fs.writeFileSync(`covers/${cover_path}`, metadata.common.picture[0].data);
    }

    let validAlbumId = null;
    if (album_id) {
        const album = db.prepare('SELECT id FROM albums WHERE id = ?').get(album_id);
        if (!album) return res.status(400).json({ error: 'album not found' });
        validAlbumId = album.id;
    } else if (metadata?.common.album) {
        validAlbumId = resolveAlbumId(metadata.common.album, {
            artist: metadata.common.artist || artist,
            year: metadata.common.year || null,
            coverPath: cover_path
        });
    }

    const resolvedTrackNumber = track_number || metadata?.common.track?.no || null;

    const insert = db.prepare(`
        INSERT INTO songs (title, artist, filename, cover_path, album_id, track_number, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = insert.run(
        title || metadata?.common.title || songFile.originalname,
        artist || metadata?.common.artist || null,
        songFile.filename,
        cover_path,
        validAlbumId,
        resolvedTrackNumber,
        req.user.id
    );

    res.status(201).json({
        id: result.lastInsertRowid,
        title: title || metadata?.common.title,
        artist: artist || metadata?.common.artist,
        album_id: validAlbumId,
        track_number: resolvedTrackNumber
    });
});

app.get('/api/songs', (req, res) => {
    const songs = db.prepare(
        'SELECT songs.*, albums.title as album_title, albums.cover_path as album_cover FROM songs LEFT JOIN albums ON songs.album_id = albums.id').all();
    const songsWithUrls = songs.map(song => ({
        ...song,
        url: `/music/${song.filename}`,
        cover: song.cover_path ? `/covers/${song.cover_path}` : null
    }));
    res.json(songsWithUrls);
});

app.get('/api/albums', (req, res) => {
    const albums = db.prepare('SELECT albums.*, COUNT(songs.id) as song_count FROM albums LEFT JOIN songs ON songs.album_id = albums.id GROUP BY albums.id').all();

    const albumsWithConvers = albums.map(album => ({
        ...album,
        cover: album.cover_path ? `covers/${album.cover_path}` : null
    }));

    res.json(albumsWithConvers);
});

app.get('/api/albums/:id', (req, res) => {
    const album = db.prepare('SELECT * FROM albums WHERE id = ?').get(req.params.id);
    if (!album) return res.status(400).json({ error: 'album not found'});

    const songs = db.prepare('SELECT * FROM songs WHERE album_id = ? ORDER BY track_number').all(req.params.id).map(song => ({
        ...song,
        url: `/music/${song.filename}`,
        cover: song.cover_path ? `/covers/${song.cover_path}` : null
    }));

    return res.json({ ...album, songs });
});

app.post('/api/songs', (req, res) => {
    const { title, artist, filename } = req.body;

    if (!title || !artist){
        return res.status(400).json({ error: 'title and filename are required'});
    }

    const insert = db.prepare('INSERT INTO songs (title, artist, filename) VALUES (?, ?, ?)');
    const result = insert.run(title, artist, filename);

    res.status(201).json({ id: result.lastInsertRowid, title, artist, filename });
});

// app.get('/', (req, res) => {
//     res.send('Server runnen!');
// });

app.get('/api/playlists', requireAuth, (req, res) => {
    const playlists = db.prepare('SELECT * FROM playlists WHERE user_id = ?').all(req.user.id);

    const playlistsWithSongs = playlists.map(playlist => {
        const songs = db.prepare(`
        SELECT songs.* FROM songs
        JOIN playlist_songs ON songs.id = playlist_songs.song_id
        WHERE playlist_songs.playlist_id = ?
        ORDER BY playlist_songs.position
        `).all(playlist.id).map(song => ({
        ...song,
        url: `/music/${song.filename}`,
        cover_url: song.cover_path ? `/covers/${song.cover_path}` : null
        }));

        return {
        id: playlist.id,
        name: playlist.name,
        song_count: songs.length,
        songs
        };
    });

    res.json(playlistsWithSongs);
});

app.post('/api/playlists', requireAuth, (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        console.log('WHAT');
        return res.status(400).json({ error: 'name is required' });
    }

    const insert = db.prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)');
    const result = insert.run(req.user.id, name.trim());

    res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), song_count: 0, songs: [] });
});

app.delete('/api/playlists/:id', requireAuth, (req, res) => {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);

    if (!playlist) {
        return res.status(404).json({ error: 'playlist not found' });
    }
    if (playlist.user_id !== req.user.id) {
        return res.status(403).json({ error: 'not your playlist' });
    }

    db.prepare('DELETE FROM playlists WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

app.post('/api/playlists/:id/songs', requireAuth, (req, res) => {
    const { songId } = req.body;
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);

    if (!playlist) return res.status(404).json({ error: 'playlist not found' });
    if (playlist.user_id !== req.user.id) return res.status(403).json({ error: 'not your playlist' });

    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(songId);
    if (!song) return res.status(404).json({ error: 'song not found' });

    const alreadyIn = db.prepare(
        'SELECT * FROM playlist_songs WHERE playlist_id = ? AND song_id = ?'
    ).get(req.params.id, songId);
    if (alreadyIn) return res.status(409).json({ error: 'song already in playlist' });

    const maxPos = db.prepare(
        'SELECT MAX(position) as maxPos FROM playlist_songs WHERE playlist_id = ?'
    ).get(req.params.id);
    const nextPosition = (maxPos.maxPos ?? -1) + 1;

    db.prepare(
        'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)'
    ).run(req.params.id, songId, nextPosition);

    res.status(201).json({ success: true });
});

app.delete('/api/playlists/:id/songs/:songId', requireAuth, (req, res) => {
    const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);

    if (!playlist) return res.status(404).json({ error: 'playlist not found' });
    if (playlist.user_id !== req.user.id) return res.status(403).json({ error: 'not your playlist' });

    db.prepare(
        'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?'
    ).run(req.params.id, req.params.songId);

    res.json({ success: true });
});
app.listen(3000, '0.0.0.0', () => {
    console.log("Server is running on 3000");
});

const Fuse = require('fuse.js');
const { error } = require('console');

app.get('/api/search', (req, res) => {
    const query = req.query.q;
    if (!query || !query.trim()) return res.json([]);

    const allSongs = db.prepare('SELECT * FROM songs').all();

    const fuse = new Fuse(allSongs, {
        keys: ['title', 'artist'],
        threshold: 0.4,
    });

    const result = fuse.search(query.trim()).map(r => r.item);

    const songsWithUrls = result.map(song => ({
        ...song,
        url: `/music/${song.filename}`,
        cover: song.cover_path ? `/covers/${song.cover_path}` : null
    }));

    res.json(songsWithUrls);
});
