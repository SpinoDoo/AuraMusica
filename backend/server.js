const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const app = express();
const db = new Database('music.db');
const mm = require('music-metadata');
const multer = require('multer');
const fs = require('fs');

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
        cover: song.cover_path ? `/covers/${song.cover_path}` : null
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

app.listen(3000, '0.0.0.0', () => {
    console.log("Server is running on 3000");
});