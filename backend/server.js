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
    destination: (req, res, cb )=> {
        cb(null, 'music/');
    },
    filename: (req, res, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + '.mp3');
    }
});

const upload = multer({
    storage
//   storage,
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype !== 'audio/mpeg') {
//       return cb(new Error('Only MP3 files allowed'));
//     }
//     cb(null, true);
//   }
});

app.post('/api/upload', upload.single('song'), async (req, res) => {
    const file = req.file;
    const { title, artist } = req.body;

    if (!file){
        return res.status(400).json({ error: 'No file uploaded' });
    }

    let cover_path = null;

    try {
        const metadata = await mm.parseFile(file.path);
        const picture = metadata.common.picture?.[0];
        if (picture) {
        cover_path = file.filename.replace('.mp3', '.jpg');
        fs.writeFileSync(`covers/${cover_path}`, picture.data);
        }
    } catch (err) {
        console.error('Cover extraction failed:', err);
    }

    const insert = db.prepare('INSERT INTO songs (title, artist, filename, cover_path) VALUES (?, ?, ?, ?)');
    const result = insert.run(title || file.originalname, artist || null, file.filename, cover_path);

    res.status(201).json({ id: result.lastInsertRowid, title, artist, filename: file.filename });
});

app.get('/api/songs', (req, res) => {
    const songs = db.prepare('SELECT * FROM songs').all();
    const songsWithUrls = songs.map(song => ({
        ...song,
        url: `/music/${song.filename}`,
        cover_url: song.cover_path ? `/covers/${song.cover_path}` : null
    }));
    res.json(songsWithUrls);
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