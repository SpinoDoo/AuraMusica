const API_BASE_URL = "http://localhost:3000/api";

const api = {
    async getRecents() {
        return this.fetchData("/songs/recents");
    },
    async getAlbums() {
        return this.fetchData("/albums");
    },
    async search(query) {
        return this.fetchData(`/search?q=${encodeURIComponent(query)}`);
    },
    async getPlaylists() {
        return this.fetchData("/playlists");
    },
    async createPlaylist(name) {
        return this.fetchData("/playlists", "POST", { name });
    },
    async fetchData(endpoint, method = "GET", body = null) {
        try {
            const options = { method, headers: { "Content-Type": "application/json" } };
            if (body) options.body = JSON.stringify(body);
            const res = await fetch(`${API_BASE_URL}${endpoint}`);
            if (!res.ok) throw new Error("API hálózati hiba");
            return await res.json();
        } catch (err) {
            console.warn("Backend nem érhető el, mock adatok használata.");
            return null;
        }
    }
};

const state = {
    currentTrack: null,
    isPlaying: false,
    queue: [],
    currentIndex: 0
};

const audio = document.getElementById("audio-player");
const progressBar = document.getElementById("progress-bar");
const currentTimeEl = document.getElementById("current-time");
const totalDurationEl = document.getElementById("total-duration");
const playBtn = document.getElementById("btn-play");
const playIcon = document.getElementById("play-icon");

document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupAudioListeners();
    setupSearch();
    loadHomePageData();
});

function setupNavigation() {
    document.querySelectorAll("[data-page]").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetPage = btn.getAttribute("data-page");
            document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
            document.querySelectorAll(".header-left .nav-item").forEach(b => b.classList.remove("active"));
            
            document.getElementById(targetPage).classList.add("active");
            btn.classList.add("active");

            if (targetPage === "playlist-page") loadPlaylistsData();
        });
    });
}

function playTrack(track, queue = []) {
    state.currentTrack = track;
    if (queue.length > 0) state.queue = queue;

    audio.src = track.audioUrl || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
    audio.play();
    state.isPlaying = true;

    updatePlayerUI(track);
}

function updatePlayerUI(track) {
    document.getElementById("mini-title").innerText = track.title;
    document.getElementById("mini-artist").innerText = track.artist;
    document.getElementById("mini-cover").src = track.coverUrl || "";

    document.getElementById("player-title").innerText = track.title;
    document.getElementById("player-artist").innerText = track.artist;
    document.getElementById("player-album").innerText = track.album || "";
    document.getElementById("player-cover").src = track.coverUrl || "";

    playIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
}

function setupAudioListeners() {
    playBtn.addEventListener("click", () => {
        if (!state.currentTrack) return;
        if (state.isPlaying) {
            audio.pause();
            playIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`;
        } else {
            audio.play();
            playIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
        }
        state.isPlaying = !state.isPlaying;
    });

    audio.addEventListener("timeupdate", () => {
        if (!audio.duration) return;
        progressBar.max = audio.duration;
        progressBar.value = audio.currentTime;
        currentTimeEl.innerText = formatTime(audio.currentTime);
        totalDurationEl.innerText = formatTime(audio.duration);
    });

    progressBar.addEventListener("input", () => {
        audio.currentTime = progressBar.value;
    });

    document.getElementById("btn-next").addEventListener("click", () => {
        if (state.queue.length > 0) {
            state.currentIndex = (state.currentIndex + 1) % state.queue.length;
            playTrack(state.queue[state.currentIndex]);
        }
    });
}

function setupSearch() {
    const input = document.getElementById("search-input");
    let timer;

    input.addEventListener("input", (e) => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
            const query = e.target.value.trim();
            if (!query) return;
            const results = await api.search(query) || getMockSongs();
            renderSongList(results, "search-results");
        }, 300);
    });
}

async function loadHomePageData() {
    const recents = await api.getRecents() || getMockSongs();
    const albums = await api.getAlbums() || getMockAlbums();

    renderGrid(recents, "recents-grid", (item) => playTrack(item, recents));
    renderGrid(albums, "albums-grid");
}

async function loadPlaylistsData() {
    const playlists = await api.getPlaylists() || getMockPlaylists();
    const container = document.getElementById("playlists-grid");
    container.innerHTML = playlists.map(p => `
        <div class="playlist-card">
            <div class="playlist-cover-box"></div>
            <div class="playlist-title">${p.name}</div>
            <div class="playlist-count">${p.songCount || 0} song</div>
        </div>
    `).join("");
}

function renderGrid(items, containerId, onClick) {
    const container = document.getElementById(containerId);
    container.innerHTML = items.map((item, index) => `
        <div class="card" data-index="${index}">
            <img class="card-cover" src="${item.coverUrl || ''}" alt="">
            <div class="card-title">${item.title || item.name}</div>
            <div class="card-subtitle">${item.artist || 'Album'}</div>
        </div>
    `).join("");

    if (onClick) {
        container.querySelectorAll(".card").forEach((card, idx) => {
            card.addEventListener("click", () => onClick(items[idx]));
        });
    }
}

function renderSongList(songs, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = songs.map(song => `
        <div class="song-item">
            <div class="song-item-left">
                <img class="song-cover" src="${song.coverUrl || ''}" alt="">
                <div class="song-details">
                    <span class="song-name">${song.title}</span>
                    <span class="song-artist">${song.artist}</span>
                </div>
            </div>
            <div class="song-item-right">
                <span>${song.duration || '00:00'}</span>
            </div>
        </div>
    `).join("");
}

function formatTime(sec) {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.innerText = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

function getMockSongs() {
    return [
        { id: 1, title: "Track One", artist: "Artist A", album: "Album X", duration: "03:45" },
        { id: 2, title: "Track Two", artist: "Artist B", album: "Album Y", duration: "02:30" }
    ];
}

function getMockAlbums() {
    return [
        { id: 1, name: "Album 1", artist: "Artist A" },
        { id: 2, name: "Album 2", artist: "Artist B" }
    ];
}

function getMockPlaylists() {
    return [
        { id: 1, name: "Favorites", songCount: 12 },
        { id: 2, name: "Workout", songCount: 5 }
    ];
}


let userPlaylists = JSON.parse(localStorage.getItem("user_playlists")) || [
    { id: 1, name: "Favorites", songCount: 12 },
    { id: 2, name: "Workout", songCount: 5 }
];

function savePlaylistsToStorage() {
    localStorage.setItem("user_playlists", JSON.stringify(userPlaylists));
}

window.loadPlaylistsData = async function() {
    const container = document.getElementById("playlists-grid");
    if (!container) return;

    container.innerHTML = userPlaylists.map(p => `
        <div class="playlist-card">
            <button class="playlist-delete-btn" data-id="${p.id}" title="Lista törlése">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="playlist-cover-box"></div>
            <div class="playlist-title">${p.name}</div>
            <div class="playlist-count">${p.songCount || 0} song</div>
        </div>
    `).join("");

    container.querySelectorAll(".playlist-delete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = Number(btn.getAttribute("data-id"));
            deletePlaylist(id);
        });
    });
};

function createNewPlaylist(name) {
    if (!name || !name.trim()) return;
    const newPlaylist = {
        id: Date.now(),
        name: name.trim(),
        songCount: 0
    };
    userPlaylists.push(newPlaylist);
    savePlaylistsToStorage();
    loadPlaylistsData();
    showToast(`"${newPlaylist.name}" lejátszási lista létrehozva`);
}

function deletePlaylist(id) {
    const playlist = userPlaylists.find(p => p.id === id);
    if (!playlist) return;

    userPlaylists = userPlaylists.filter(p => p.id !== id);
    savePlaylistsToStorage();
    loadPlaylistsData();
    showToast(`"${playlist.name}" törölve`);
}

document.addEventListener("DOMContentLoaded", () => {
    const createBtn = document.getElementById("create-playlist-btn");
    const modal = document.getElementById("playlist-modal");
    const closeModal = document.getElementById("close-modal");
    const cancelBtn = document.getElementById("cancel-playlist-btn");
    const saveBtn = document.getElementById("save-playlist-btn");
    const nameInput = document.getElementById("playlist-name-input");

    if (createBtn && modal) {
        createBtn.addEventListener("click", () => {
            modal.classList.add("active");
            if (nameInput) {
                nameInput.value = "";
                nameInput.focus();
            }
        });
    }

    const hideModal = () => {
        if (modal) modal.classList.remove("active");
    };

    if (closeModal) closeModal.addEventListener("click", hideModal);
    if (cancelBtn) cancelBtn.addEventListener("click", hideModal);

    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            if (nameInput && nameInput.value.trim()) {
                createNewPlaylist(nameInput.value);
                hideModal();
            }
        });
    }

    if (nameInput) {
        nameInput.addEventListener("keyup", (e) => {
            if (e.key === "Enter" && nameInput.value.trim()) {
                createNewPlaylist(nameInput.value);
                hideModal();
            }
        });
    }

    const volumeBar = document.getElementById("volume-bar");
    const volumeBtn = document.getElementById("btn-volume-icon");
    const audioEl = document.getElementById("audio-player");
    let lastVolume = 1;

    if (volumeBar && audioEl) {
        audioEl.volume = volumeBar.value;

        volumeBar.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            audioEl.volume = val;
            updateVolumeIcon(val);
        });
    }

    if (volumeBtn && volumeBar && audioEl) {
        volumeBtn.addEventListener("click", () => {
            if (audioEl.volume > 0) {
                lastVolume = audioEl.volume;
                audioEl.volume = 0;
                volumeBar.value = 0;
            } else {
                audioEl.volume = lastVolume || 1;
                volumeBar.value = audioEl.volume;
            }
            updateVolumeIcon(audioEl.volume);
        });
    }

    function updateVolumeIcon(vol) {
        const icon = document.getElementById("volume-icon");
        if (!icon) return;
        if (vol === 0) {
            icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
        } else if (vol < 0.5) {
            icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
        } else {
            icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
        }
    }
});