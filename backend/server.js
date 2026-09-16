const express = require('express');
const path = require('path');
const app = express();

app.use('/music', express.static(path.join(__dirname, 'music')));

// app.get('/api/songs' (req, res) => {

// });

app.get('/', (req, res) => {
    res.send('Server runnen!');
});

app.listen(3000, () => {
    console.log("Server is running on 3000");
});