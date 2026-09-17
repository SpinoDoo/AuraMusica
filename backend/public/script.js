const API_BASE_URL = "http://localhost:3000/api";

document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    if (!isLoggedIn) {
        window.location.href = 'auth.html';
    }
});

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

function navigateToPage(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".header-left .nav-item").forEach(b => b.classList.remove("active"));

    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add("active");

    const navBtn = document.querySelector(`[data-page="${pageId}"]`);
    if (navBtn) navBtn.classList.add("active");
}

function setupNavigation() {
    document.querySelectorAll("[data-page]").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetPage = btn.getAttribute("data-page");
            navigateToPage(targetPage);
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
    if (!container) return;

    container.innerHTML = songs.map((song, index) => `
        <div class="song-item" data-index="${index}">
            <div class="song-item-left">
                <img class="song-cover" src="${song.coverUrl || 'https://picsum.photos/seed/' + (song.id || index) + '/100'}" alt="">
                <div class="song-details">
                    <span class="song-name">${song.title}</span>
                    <span class="song-artist">${song.artist}</span>
                </div>
            </div>
            <div class="song-item-right">
                <span>${song.duration || '03:30'}</span>
            </div>
        </div>
    `).join("");

    container.querySelectorAll(".song-item").forEach((item, idx) => {
        item.addEventListener("click", () => {
            navigateToPage("player-page");
            playTrack(songs[idx], songs);
            showToast(`Lejátszás: ${songs[idx].title}`);
        });
    });
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

/* ==========================================================================
   PLAYLISTS, KÉP MEGADÁS ÉS LEJÁTSZÁS FELÜLETRE LÉPÉS
   ========================================================================== */

let userPlaylists = JSON.parse(localStorage.getItem("user_playlists")) || [
    { id: 1, name: "Favorites", coverUrl: "", songCount: 0, songs: [] },
    { id: 2, name: "Workout", coverUrl: "", songCount: 0, songs: [] }
];

function savePlaylistsToStorage() {
    localStorage.setItem("user_playlists", JSON.stringify(userPlaylists));
}

window.loadPlaylistsData = async function() {
    const container = document.getElementById("playlists-grid");
    if (!container) return;

    container.innerHTML = userPlaylists.map(p => `
        <div class="playlist-card" data-id="${p.id}">
            <button class="playlist-delete-btn" data-id="${p.id}" title="Lista törlése">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="playlist-cover-box">
                ${p.coverUrl ? `<img class="playlist-cover-img" src="${p.coverUrl}" alt="${p.name}">` : ''}
            </div>
            <div class="playlist-title">${p.name}</div>
            <div class="playlist-count">${p.songs ? p.songs.length : (p.songCount || 0)} song</div>
        </div>
    `).join("");

    container.querySelectorAll(".playlist-card").forEach(card => {
        card.addEventListener("click", () => {
            const id = Number(card.getAttribute("data-id"));
            const playlist = userPlaylists.find(p => p.id === id);
            if (playlist && playlist.songs && playlist.songs.length > 0) {
                navigateToPage("player-page");
                playTrack(playlist.songs[0], playlist.songs);
                showToast(`"${playlist.name}" lejátszása`);
            } else {
                showToast("Ez a lejátszási lista üres!");
            }
        });
    });

    container.querySelectorAll(".playlist-delete-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const id = Number(btn.getAttribute("data-id"));
            deletePlaylist(id);
        });
    });
};

function createNewPlaylist(name, coverUrl = "") {
    if (!name || !name.trim()) return;
    const newPlaylist = {
        id: Date.now(),
        name: name.trim(),
        coverUrl: coverUrl.trim(),
        songCount: 0,
        songs: []
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
    const coverInput = document.getElementById("playlist-cover-input");

    if (createBtn && modal) {
        createBtn.addEventListener("click", () => {
            modal.classList.add("active");
            if (nameInput) nameInput.value = "";
            if (coverInput) coverInput.value = "";
            if (nameInput) nameInput.focus();
        });
    }

    const hideModal = () => {
        if (modal) modal.classList.remove("active");
    };

    if (closeModal) closeModal.addEventListener("click", hideModal);
    if (cancelBtn) cancelBtn.addEventListener("click", hideModal);

    const submitPlaylistForm = () => {
        if (nameInput && nameInput.value.trim()) {
            const coverVal = coverInput ? coverInput.value : "";
            createNewPlaylist(nameInput.value, coverVal);
            hideModal();
        }
    };

    if (saveBtn) saveBtn.addEventListener("click", submitPlaylistForm);

    if (nameInput) {
        nameInput.addEventListener("keyup", (e) => {
            if (e.key === "Enter") submitPlaylistForm();
        });
    }
    if (coverInput) {
        coverInput.addEventListener("keyup", (e) => {
            if (e.key === "Enter") submitPlaylistForm();
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
            icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
        }
    }
});

/* ==========================================================================
   KEDVENCEK, LEJÁTSZÁSI SOR, KEVERÉS, ISMÉTLÉS, LISTÁHOZ ADÁS
   ========================================================================== */

state.isShuffle = false;
state.repeatMode = 'off';

const _basePlayTrack = playTrack;
window.playTrack = function(track, queue = []) {
    _basePlayTrack(track, queue);
    if (state.queue.length > 0) {
        const foundIdx = state.queue.findIndex(s => s.id === track.id || (s.title === track.title && s.artist === track.artist));
        if (foundIdx !== -1) state.currentIndex = foundIdx;
    }
    renderQueue();
    updateLikeButtonUI();
};

function renderQueue() {
    const queueContainer = document.getElementById("queue-container");
    if (!queueContainer) return;

    if (!state.queue || state.queue.length === 0) {
        queueContainer.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px;">A lejátszási sor üres</div>';
        return;
    }

    queueContainer.innerHTML = state.queue.map((song, idx) => `
        <div class="queue-item ${idx === state.currentIndex ? 'active' : ''}" data-index="${idx}">
            <div class="queue-item-left">
                <img class="queue-cover" src="${song.coverUrl || ''}" alt="">
                <div class="song-details">
                    <span class="song-name">${song.title}</span>
                    <span class="song-artist">${song.artist}</span>
                </div>
            </div>
            <div class="queue-item-right">
                <span>${song.duration || '00:00'}</span>
            </div>
        </div>
    `).join("");

    queueContainer.querySelectorAll(".queue-item").forEach(item => {
        item.addEventListener("click", () => {
            const idx = parseInt(item.getAttribute("data-index"));
            state.currentIndex = idx;
            playTrack(state.queue[idx]);
        });
    });
}

function updateLikeButtonUI() {
    const likeBtn = document.getElementById("btn-like");
    if (!likeBtn || !state.currentTrack) return;

    const favList = userPlaylists.find(p => p.name === "Favorites");
    const isLiked = favList && favList.songs && favList.songs.some(s => s.title === state.currentTrack.title && s.artist === state.currentTrack.artist);

    if (isLiked) {
        likeBtn.classList.add("liked");
    } else {
        likeBtn.classList.remove("liked");
    }
}

function toggleLikeCurrentTrack() {
    if (!state.currentTrack) return;

    let favList = userPlaylists.find(p => p.name === "Favorites");
    if (!favList) {
        favList = { id: Date.now(), name: "Favorites", coverUrl: "", songCount: 0, songs: [] };
        userPlaylists.unshift(favList);
    }
    if (!favList.songs) favList.songs = [];

    const existingIdx = favList.songs.findIndex(s => s.title === state.currentTrack.title && s.artist === state.currentTrack.artist);

    if (existingIdx !== -1) {
        favList.songs.splice(existingIdx, 1);
        showToast("Eltávolítva a Kedvencek közül");
    } else {
        favList.songs.push(state.currentTrack);
        showToast("Hozzáadva a Kedvencekhez");
    }

    favList.songCount = favList.songs.length;
    savePlaylistsToStorage();
    updateLikeButtonUI();
    if (document.getElementById("playlist-page").classList.contains("active")) {
        loadPlaylistsData();
    }
}

function playNextTrack() {
    if (!state.queue || state.queue.length === 0) return;

    if (state.repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
        return;
    }

    if (state.isShuffle) {
        state.currentIndex = Math.floor(Math.random() * state.queue.length);
    } else {
        if (state.currentIndex < state.queue.length - 1) {
            state.currentIndex++;
        } else if (state.repeatMode === 'all') {
            state.currentIndex = 0;
        } else {
            return;
        }
    }
    playTrack(state.queue[state.currentIndex]);
}

function playPrevTrack() {
    if (!state.queue || state.queue.length === 0) return;

    if (state.currentIndex > 0) {
        state.currentIndex--;
    } else {
        state.currentIndex = state.queue.length - 1;
    }
    playTrack(state.queue[state.currentIndex]);
}

function openAddToPlaylistModal() {
    if (!state.currentTrack) {
        showToast("Nincs kiválasztva zene!");
        return;
    }
    const modal = document.getElementById("add-to-playlist-modal");
    const container = document.getElementById("playlist-select-list");
    if (!modal || !container) return;

    container.innerHTML = userPlaylists.map(p => `
        <div class="playlist-select-item" data-id="${p.id}">
            ${p.name} (${p.songs ? p.songs.length : 0})
        </div>
    `).join("");

    container.querySelectorAll(".playlist-select-item").forEach(item => {
        item.addEventListener("click", () => {
            const id = Number(item.getAttribute("data-id"));
            const targetPlaylist = userPlaylists.find(p => p.id === id);
            if (targetPlaylist) {
                if (!targetPlaylist.songs) targetPlaylist.songs = [];
                const exists = targetPlaylist.songs.some(s => s.title === state.currentTrack.title && s.artist === state.currentTrack.artist);
                if (!exists) {
                    targetPlaylist.songs.push(state.currentTrack);
                    targetPlaylist.songCount = targetPlaylist.songs.length;
                    savePlaylistsToStorage();
                    showToast(`Hozzáadva a(z) "${targetPlaylist.name}" listához`);
                } else {
                    showToast("Ez a zene már benne van a listában!");
                }
            }
            modal.classList.remove("active");
        });
    });

    modal.classList.add("active");
}

document.addEventListener("DOMContentLoaded", () => {
    const likeBtn = document.getElementById("btn-like");
    if (likeBtn) {
        likeBtn.addEventListener("click", toggleLikeCurrentTrack);
    }

    const shuffleBtn = document.getElementById("btn-shuffle");
    if (shuffleBtn) {
        shuffleBtn.addEventListener("click", () => {
            state.isShuffle = !state.isShuffle;
            shuffleBtn.classList.toggle("active", state.isShuffle);
            showToast(state.isShuffle ? "Keverés bekapcsolva" : "Keverés kikapcsolva");
        });
    }

    const repeatBtn = document.getElementById("btn-repeat");
    if (repeatBtn) {
        repeatBtn.addEventListener("click", () => {
            if (state.repeatMode === 'off') {
                state.repeatMode = 'all';
                repeatBtn.classList.add("active");
                showToast("Összes ismétlése");
            } else if (state.repeatMode === 'all') {
                state.repeatMode = 'one';
                repeatBtn.classList.add("active");
                showToast("Egy szám ismétlése");
            } else {
                state.repeatMode = 'off';
                repeatBtn.classList.remove("active");
                showToast("Ismétlés kikapcsolva");
            }
        });
    }

    const nextBtn = document.getElementById("btn-next");
    if (nextBtn) {
        nextBtn.onclick = playNextTrack;
    }

    const prevBtn = document.getElementById("btn-prev");
    if (prevBtn) {
        prevBtn.onclick = playPrevTrack;
    }

    if (audio) {
        audio.addEventListener("ended", playNextTrack);
    }

    const addPlaylistTrackBtn = document.getElementById("btn-add-to-playlist");
    if (addPlaylistTrackBtn) {
        addPlaylistTrackBtn.addEventListener("click", openAddToPlaylistModal);
    }

    const closeAddModalBtn = document.getElementById("close-add-modal");
    if (closeAddModalBtn) {
        closeAddModalBtn.addEventListener("click", () => {
            document.getElementById("add-to-playlist-modal").classList.remove("active");
        });
    }
});


window.testPlaylist = function(count = 50) {
    const mockSongs = Array.from({ length: count }, (_, i) => {
        const songIndex = (i % 16) + 1;
        return {
            id: `test-song-${i + 1}`,
            title: `Teszt Zene #${i + 1}`,
            artist: `Teszt Előadó ${(i % 5) + 1}`,
            album: `Album ${(i % 3) + 1}`,
            duration: `03:${(10 + (i % 50)).toString().padStart(2, '0')}`,
            coverUrl: `https://picsum.photos/seed/${i + 100}/200`,
            audioUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${songIndex}.mp3`
        };
    });

    let testPlaylist = userPlaylists.find(p => p.name === "Sok Zenés Teszt");
    if (!testPlaylist) {
        testPlaylist = {
            id: Date.now(),
            name: "Sok Zenés Teszt",
            coverUrl: "https://picsum.photos/seed/testlist/300",
            songCount: count,
            songs: mockSongs
        };
        userPlaylists.unshift(testPlaylist);
    } else {
        testPlaylist.songs = mockSongs;
        testPlaylist.songCount = count;
    }

    savePlaylistsToStorage();
    if (typeof loadPlaylistsData === "function") {
        loadPlaylistsData();
    }
    showToast(`${count} db teszt zene sikeresen generálva!`);
};

function toggleAccountMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('account-menu');
    menu.classList.toggle('show');
    
    const username = localStorage.getItem('username') || 'Vendég';
    document.getElementById('user-display-name').textContent = username;
}

window.addEventListener('click', () => {
    const menu = document.getElementById('account-menu');
    if (menu && menu.classList.contains('show')) {
        menu.classList.remove('show');
    }
});

function navigateToAuth() {
    window.location.href = 'auth.html';
}

function handleLogout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    alert('Sikeresen kijelentkeztél!');
    window.location.reload();
}