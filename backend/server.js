const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const app = express();
const db = new Database('music.db');

app.use('/music', express.static(path.join(__dirname, 'music')));

app.get('/api/songs', (req, res) => {
    const songs = db.prepare('SELECT * FROM songs').all();
    const songsWithUrls = songs.map(song => ({
        ...song,
        url: `/music/${song.filename}`
    }));
    res.json(songsWithUrls);
});

app.use(express.json());

app.post('/api/songs', (req, res) => {
    const { title, artist, filename } = req.body;

    if (!title || !artist){
        return res.status(400).json({ error: 'title and filename are required'});
    }

    const insert = db.prepare('INSERT INTO songs (title, artist, filename) VALUES (?, ?, ?)');
    const result = insert.run(title, artist, filename);

    res.status(201).json({ id: result.lastInsertRowid, title, artist, filename });
});

app.get('/', (req, res) => {
    res.send('Server runnen!');
});

app.listen(3000, () => {
    console.log("Server is running on 3000");
});