const API_BASE_URL = "/api";

/* ==========================================================================
   API KOMMUNIKÁCIÓ
   ========================================================================== */
const api = {
    async getRecents() { return this.fetchData("/songs"); },
    async getAlbums() { return this.fetchData("/albums"); },
    async getAlbum(id) { return this.fetchData(`/albums/${id}`); },
    async search(query) { return this.fetchData(`/search?q=${encodeURIComponent(query)}`); },
    async getPlaylists() { return this.fetchData("/playlists"); },
    async createPlaylist(name) { return this.fetchData("/playlists", "POST", { name }); },
    async deletePlaylist(id) { return this.fetchData(`/playlists/${id}`, 'DELETE'); },
    async addSongToPlaylist(playlistId, songId) { return this.fetchData(`/playlists/${playlistId}/songs`, 'POST', { songId }); },
    async removeSongFromPlaylist(playlistId, songId) { return this.fetchData(`/playlists/${playlistId}/${songId}`, 'DELETE'); },
    
    async uploadSong(formData) {
        try {
            const token = localStorage.getItem('token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                headers,
                body: formData
            });

            if (!res.ok) throw new Error('Upload failed');
            return await res.json();
        } catch (err) {
            console.log('Upload failed: ', err);
            return null;
        }
    },
    
    async fetchData(endpoint, method = "GET", body = null) {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const options = { method, headers };
            if (body) options.body = JSON.stringify(body);
            
            const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!res.ok) throw new Error("API hálózati hiba");
            return await res.json();
        } catch (err) {
            console.warn("Backend nem érhető el, mock adatok használata.");
            return null;
        }
    }
};

/* ==========================================================================
   ÁLLAPOT & DOM ELEMEK
   ========================================================================== */
const state = {
    currentTrack: null,
    isPlaying: false,
    queue: [],
    originalQueue: [], 
    currentIndex: 0,
    isShuffle: false,
    repeatMode: 'off'
};

let userPlaylists = [];
let selectedContextSong = null;
let draggedQueueIndex = null;

const audio = document.getElementById("audio-player");
const progressBar = document.getElementById("progress-bar");
const currentTimeEl = document.getElementById("current-time");
const totalDurationEl = document.getElementById("total-duration");
const playBtn = document.getElementById("btn-play");
const playIcon = document.getElementById("play-icon");

/* ==========================================================================
   ZENE HOSSZ LERENDEZÉS ÉS UTILITY-K
   ========================================================================== */
function formatTime(sec) {
    if (isNaN(sec) || sec === null || sec === undefined) return "--:--";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Segédfunkció az audio fájl tényleges hosszának lekéréséhez, ha nincs eltárolva
function getAudioDuration(url) {
    return new Promise((resolve) => {
        if (!url) return resolve("--:--");
        const tempAudio = new Audio();
        tempAudio.src = url;
        tempAudio.addEventListener('loadedmetadata', () => {
            resolve(formatTime(tempAudio.duration));
        });
        tempAudio.addEventListener('error', () => {
            resolve("--:--");
        });
    });
}

/* ==========================================================================
   ALAP ZENELEJÁTSZÁSI MECHANIKÁK
   ========================================================================== */
function playTrack(track, queue = []) {
    state.currentTrack = track;
    
    if (queue.length > 0) {
        state.queue = [...queue];
        state.originalQueue = [...queue];
    }

    if (state.queue.length > 0) {
        const foundIdx = state.queue.findIndex(s => s.id === track.id || (s.title === track.title && s.artist === track.artist));
        if (foundIdx !== -1) state.currentIndex = foundIdx;
    }

    audio.src = track.url || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
    audio.play();
    state.isPlaying = true;

    updatePlayerUI(track);
    renderQueue();
    updateLikeButtonUI();
}

function playNextTrack() {
    if (!state.queue || state.queue.length === 0) return;

    if (state.repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
        return;
    }

    if (state.currentIndex < state.queue.length - 1) {
        state.currentIndex++;
    } else if (state.repeatMode === 'all') {
        state.currentIndex = 0;
    } else {
        return;
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

async function playAlbum(album) {
    const fullAlbum = await api.getAlbum(album.id);

    if (!fullAlbum || !fullAlbum.songs || fullAlbum.songs.length === 0) {
        showToast("This album has no songs yet.");
        return;
    }

    navigateToPage("player-page");
    playTrack(fullAlbum.songs[0], fullAlbum.songs);
    showToast(`Playing "${fullAlbum.title}"`);
}

function toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    const shuffleBtn = document.getElementById("btn-shuffle");
    if (shuffleBtn) shuffleBtn.classList.toggle("active", state.isShuffle);

    if (state.isShuffle) {
        if (state.queue.length > 1) {
            const currentSong = state.queue[state.currentIndex];
            let restSongs = state.queue.filter((_, idx) => idx !== state.currentIndex);
            
            for (let i = restSongs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [restSongs[i], restSongs[j]] = [restSongs[j], restSongs[i]];
            }

            state.queue = [currentSong, ...restSongs];
            state.currentIndex = 0;
        }
        showToast("Keverés bekapcsolva - Sorrend frissítve");
    } else {
        if (state.originalQueue.length > 0) {
            const currentSong = state.queue[state.currentIndex];
            state.queue = [...state.originalQueue];
            const origIdx = state.queue.findIndex(s => s.id === currentSong.id || (s.title === currentSong.title && s.artist === currentSong.artist));
            state.currentIndex = origIdx !== -1 ? origIdx : 0;
        }
        showToast("Keverés kikapcsolva");
    }
    renderQueue();
}

/* ==========================================================================
   UI RENDERELES & QUEUE DRAG-AND-DROP MOZGATÁS
   ========================================================================== */
function updatePlayerUI(track) {
    document.getElementById("mini-title").innerText = track.title;
    document.getElementById("mini-artist").innerText = track.artist;
    document.getElementById("mini-cover").src = track.cover || "";

    document.getElementById("player-title").innerText = track.title;
    document.getElementById("player-artist").innerText = track.artist;
    document.getElementById("player-album").innerText = track.album || "";
    document.getElementById("player-cover").src = track.cover || "";

    playIcon.innerHTML = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
}

function renderGrid(items, containerId, onClick) {
    const container = document.getElementById(containerId);
    if(!container) return;
    
    container.innerHTML = items.map((item, index) => `
        <div class="card" data-index="${index}">
            <img class="card-cover" src="${item.cover || ''}" alt="">
            <div class="card-title">${item.title || item.name}</div>
            <div class="card-subtitle">${item.artist || 'Album'}</div>
        </div>
    `).join("");

    if (onClick) {
        container.querySelectorAll(".card").forEach((card, idx) => {
            card.addEventListener("click", () => onClick(items[idx]));
            card.addEventListener("contextmenu", (e) => {
                if(items[idx].title) showContextMenu(e, items[idx]);
            });
        });
    }
}

function renderSongList(songs, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = songs.map((song, index) => `
        <div class="song-item" data-index="${index}">
            <div class="song-item-left">
                <img class="song-cover" src="${song.cover || 'https://picsum.photos/seed/' + (song.id || index) + '/100'}" alt="">
                <div class="song-details">
                    <span class="song-name">${song.title}</span>
                    <span class="song-artist">${song.artist}</span>
                </div>
            </div>
            <div class="song-item-right">
                <span class="song-duration" data-id="${song.id}">${song.duration || '--:--'}</span>
            </div>
        </div>
    `).join("");

    // Hossz lekérése dinamikusan
    songs.forEach(async (song) => {
        if (!song.duration || song.duration === "00:00" || song.duration === "--:--") {
            const dur = await getAudioDuration(song.url);
            song.duration = dur;
            const el = container.querySelector(`.song-duration[data-id="${song.id}"]`);
            if (el) el.innerText = dur;
        }
    });

    container.querySelectorAll(".song-item").forEach((item, idx) => {
        item.addEventListener("click", () => {
            navigateToPage("player-page");
            playTrack(songs[idx], songs);
            showToast(`Lejátszás: ${songs[idx].title}`);
        });
        item.addEventListener("contextmenu", (e) => showContextMenu(e, songs[idx]));
    });
}

/* QUEUE RENDERELES ÉS DRAG & DROP MOZGATÁS KIJELÖLÉSSEL */
function renderQueue() {
    const queueContainer = document.getElementById("queue-container");
    if (!queueContainer) return;

    if (!state.queue || state.queue.length === 0) {
        queueContainer.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px;">A lejátszási sor üres</div>';
        return;
    }

    queueContainer.innerHTML = state.queue.map((song, idx) => `
        <div class="queue-item ${idx === state.currentIndex ? 'active' : ''}" data-index="${idx}" draggable="true">
            <div class="queue-item-left">
                <img class="queue-cover" src="${song.cover || ''}" alt="">
                <div class="song-details">
                    <span class="song-name">${song.title}</span>
                    <span class="song-artist">${song.artist}</span>
                </div>
            </div>
            <div class="queue-item-right">
                <span class="queue-duration" data-index="${idx}">${song.duration || '--:--'}</span>
            </div>
        </div>
    `).join("");

    // Valós időtartam dinamikus betöltése a queue elemeinek
    state.queue.forEach(async (song, idx) => {
        if (!song.duration || song.duration === "00:00" || song.duration === "--:--") {
            const dur = await getAudioDuration(song.url || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
            song.duration = dur;
            const el = queueContainer.querySelector(`.queue-duration[data-index="${idx}"]`);
            if (el) el.innerText = dur;
        }
    });

    const items = queueContainer.querySelectorAll(".queue-item");
    items.forEach(item => {
        item.addEventListener("click", () => {
            const idx = parseInt(item.getAttribute("data-index"));
            state.currentIndex = idx;
            playTrack(state.queue[idx]);
        });

        item.addEventListener("contextmenu", (e) => {
            const idx = parseInt(item.getAttribute("data-index"));
            showContextMenu(e, state.queue[idx]);
        });

        // Drag and Drop események kijelöléssel
        item.addEventListener("dragstart", (e) => {
            draggedQueueIndex = parseInt(item.getAttribute("data-index"));
            e.dataTransfer.effectAllowed = "move";
            item.classList.add("dragging");
        });

        item.addEventListener("dragend", () => {
            item.classList.remove("dragging");
            clearQueueHighlights();
            draggedQueueIndex = null;
        });

        item.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";

            const targetIndex = parseInt(item.getAttribute("data-index"));
            clearQueueHighlights();

            // Felette és alatta lévő kártyák kijelölése
            if (draggedQueueIndex !== null && targetIndex !== draggedQueueIndex) {
                const rect = item.getBoundingClientRect();
                const offset = e.clientY - rect.top;

                if (offset < rect.height / 2) {
                    item.classList.add("drag-over-above");
                    if (targetIndex > 0) {
                        const prevItem = queueContainer.querySelector(`[data-index="${targetIndex - 1}"]`);
                        if (prevItem) prevItem.classList.add("drag-over-below");
                    }
                } else {
                    item.classList.add("drag-over-below");
                    if (targetIndex < state.queue.length - 1) {
                        const nextItem = queueContainer.querySelector(`[data-index="${targetIndex + 1}"]`);
                        if (nextItem) nextItem.classList.add("drag-over-above");
                    }
                }
            }
        });

        item.addEventListener("dragleave", () => {
            clearQueueHighlights();
        });

        item.addEventListener("drop", (e) => {
            e.preventDefault();
            clearQueueHighlights();
            let targetIndex = parseInt(item.getAttribute("data-index"));

            const rect = item.getBoundingClientRect();
            const offset = e.clientY - rect.top;
            if (offset > rect.height / 2 && targetIndex < state.queue.length - 1) {
                targetIndex++;
            }

            if (draggedQueueIndex !== null && draggedQueueIndex !== targetIndex) {
                moveQueueItem(draggedQueueIndex, targetIndex);
            }
        });
    });
}

function clearQueueHighlights() {
    document.querySelectorAll(".queue-item").forEach(el => {
        el.classList.remove("drag-over-above", "drag-over-below");
    });
}

function moveQueueItem(fromIndex, toIndex) {
    const movedTrack = state.queue.splice(fromIndex, 1)[0];
    state.queue.splice(toIndex, 0, movedTrack);

    if (state.currentIndex === fromIndex) {
        state.currentIndex = toIndex;
    } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
        state.currentIndex--;
    } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
        state.currentIndex++;
    }

    renderQueue();
    showToast("Sorrend frissítve");
}

async function loadHomePageData() {
    const recents = await api.getRecents() || getMockSongs();
    const albums = await api.getAlbums() || getMockAlbums();

    renderGrid(recents, "recents-grid", (item) => playTrack(item, recents));
    renderGrid(albums, "albums-grid", (album) => playAlbum(album));
}

/* ==========================================================================
   JOBB KLIKK MENÜ (CONTEXT MENU) TELJES INTEGRÁCIÓ
   ========================================================================== */
function setupContextMenu() {
    const contextMenu = document.getElementById("context-menu");
    if (!contextMenu) return;

    // Kattintásra vagy görgetésre rejtse el a menüt
    document.addEventListener("click", hideContextMenu);
    window.addEventListener("scroll", hideContextMenu, true);
    window.addEventListener("resize", hideContextMenu);

    document.getElementById("ctx-add-favorite")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (selectedContextSong) {
            let favList = userPlaylists.find(p => p.name === "Favorites");
            if (!favList) {
                favList = await createNewPlaylist('Favorites');
            }
            if (favList) {
                await api.addSongToPlaylist(favList.id, selectedContextSong.id);
                showToast(`"${selectedContextSong.title}" hozzáadva a kedvencekhez!`);
                await loadPlaylistsData();
                updateLikeButtonUI();
            }
        }
        hideContextMenu();
    });

    document.getElementById("ctx-add-playlist")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (selectedContextSong) {
            state.currentTrack = selectedContextSong; 
            openAddToPlaylistModal();
        }
        hideContextMenu();
    });

    document.getElementById("ctx-play-next")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (selectedContextSong) {
        // 1. Ellenőrizzük, hogy a dal már szerepel-e a sorban
        const existingIndex = state.queue.findIndex(s => 
            s.id === selectedContextSong.id || 
            (s.title === selectedContextSong.title && s.artist === selectedContextSong.artist)
        );

        // 2. Ha már a sorban van, eltávolítjuk a régi helyéről
        if (existingIndex !== -1) {
            // Ha a jelenleg szóló dalt próbálnánk "következőnek" tenni, nem csinálunk semmit
            if (existingIndex === state.currentIndex) {
                hideContextMenu();
                return;
            }

            state.queue.splice(existingIndex, 1);
            
            // Ha a törölt elem az aktuális lejátszási pozíció előtt volt, kiigazítjuk az indexet
            if (existingIndex < state.currentIndex) {
                state.currentIndex--;
            }
        }

        // 3. Beszúrjuk a dalt az aktuálisan szóló szám mögé
        if (state.queue.length === 0) {
            state.queue = [selectedContextSong];
            state.currentIndex = 0;
        } else {
            const insertIndex = state.currentIndex + 1;
            state.queue.splice(insertIndex, 0, selectedContextSong);
        }

        renderQueue();
        showToast(`"${selectedContextSong.title}" beállítva következőnek!`);
    }
    hideContextMenu();
    });

    document.getElementById("ctx-remove-queue")?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (selectedContextSong) {
            const idx = state.queue.findIndex(s => s.id === selectedContextSong.id || (s.title === selectedContextSong.title && s.artist === selectedContextSong.artist));
            if (idx !== -1) {
                state.queue.splice(idx, 1);
                if (idx < state.currentIndex) {
                    state.currentIndex--;
                }
                renderQueue();
                showToast(`"${selectedContextSong.title}" eltávolítva a sorból.`);
            }
        }
        hideContextMenu();
    });
}

function showContextMenu(e, song) {
    e.preventDefault();
    selectedContextSong = song;

    const contextMenu = document.getElementById("context-menu");
    if (!contextMenu) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const menuWidth = 220;
    const menuHeight = 160;
    let posX = mouseX;
    let posY = mouseY;

    if (mouseX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
    if (mouseY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;

    contextMenu.style.left = `${posX}px`;
    contextMenu.style.top = `${posY}px`;
    contextMenu.classList.add("show");
}

function hideContextMenu() {
    const contextMenu = document.getElementById("context-menu");
    if (contextMenu) contextMenu.classList.remove("show");
}

/* ==========================================================================
   PLAYLIST LOGIKA
   ========================================================================== */
window.loadPlaylistsData = async function() {
    const container = document.getElementById("playlists-grid");
    if (!container) return;

    const playlists = await api.getPlaylists();
    userPlaylists = playlists || [];

    container.innerHTML = userPlaylists.map(p => `
        <div class="playlist-card" data-id="${p.id}">
            <button class="playlist-delete-btn" data-id="${p.id}" title="Lista törlése">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="playlist-cover-box">
                ${p.cover ? `<img class="playlist-cover-img" src="${p.cover}" alt="${p.name}">` : ''}
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

async function createNewPlaylist(name, cover = "") {
    if (!name || !name.trim()) return;
    const result = await api.createPlaylist(name.trim());
    if (!result) {
        showToast('Nem sikerült létrehozni a playlistet');
        return null;
    }
    await loadPlaylistsData();
    showToast(`"${result.name}" lejátszási lista létrehozva`);
    return result;
}

async function deletePlaylist(id) {
    const playlist = userPlaylists.find(p => p.id === id);
    if (!playlist) return;

    const result = await api.deletePlaylist(playlist.id);
    if (!result){
        showToast("Couldn't delete playlist");
        return;
    }
    await loadPlaylistsData();
    showToast(`"${playlist.name}" törölve`);
}

function updateLikeButtonUI() {
    const likeBtn = document.getElementById("btn-like");
    if (!likeBtn || !state.currentTrack) return;

    const favList = userPlaylists.find(p => p.name === "Favorites");
    const isLiked = favList && favList.songs && favList.songs.some(s => s.id === state.currentTrack.id);
    likeBtn.classList.toggle("liked", isLiked);
}

async function toggleLikeCurrentTrack() {
    if (!state.currentTrack) return;

    let favList = userPlaylists.find(p => p.name === "Favorites");
    if (!favList) {
        favList = await createNewPlaylist('Favorites');
        if (!favList) return;
    }
    
    const isLiked = favList.songs && favList.songs.some(s => s.id === state.currentTrack.id);

    if (isLiked) {
        await api.removeSongFromPlaylist(favList.id, state.currentTrack.id);
        showToast('Song removed from liked songs');
    } else {
        await api.addSongToPlaylist(favList.id, state.currentTrack.id);
        showToast('Song added to liked songs');
    }

    await loadPlaylistsData();
    updateLikeButtonUI();
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
        item.addEventListener("click", async () => {
            const id = Number(item.getAttribute("data-id"));
            const result = await api.addSongToPlaylist(id, state.currentTrack.id);
            
            if (!result) {
                showToast('This song is already in the playlist');
            } else {
                const targetPlaylist = userPlaylists.find(s => s.id === id);
                showToast(`Song added to ${targetPlaylist.name}`);
                await loadPlaylistsData();
            }
            modal.classList.remove("active");
        });
    });

    modal.classList.add("active");
}

/* ==========================================================================
   NAVIGÁCIÓ ÉS EGYÉB UTILITYK
   ========================================================================== */
function updateIndicator(targetElement) {
    const indicator = document.querySelector('.nav-indicator');
    const parent = document.querySelector('.header-left');
    if (!indicator || !targetElement || !parent) return;

    const targetRect = targetElement.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();

    // Relatív pozíció és szélesség kiszámítása a szülőhöz képest
    const left = targetRect.left - parentRect.left;
    const width = targetRect.width;

    indicator.style.width = `${width}px`;
    indicator.style.transform = `translateX(${left}px)`;
    indicator.style.opacity = '1';
}

function navigateToPage(pageId) {
    // Oldalak aktív állapotának törlése
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    
    // Cél oldal aktiválása
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.add("active");

    if (pageId === "player-page") {
        // Ha a lejátszó oldalra navigálunk:
        // 1. Megtartjuk / visszaállítjuk az utoljára kiválasztott főmenüpont aktív jelölését
        document.querySelectorAll(".header-left .nav-item").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-page") === activeNavTab);
        });

        // 2. Az indikátort az utoljára aktív főmenüpont alá csúsztatjuk
        const activeNavBtn = document.querySelector(`.header-left [data-page="${activeNavTab}"]`);
        if (activeNavBtn) {
            updateIndicator(activeNavBtn);
        }
    } else {
        activeNavTab = pageId;

        document.querySelectorAll(".header-left .nav-item").forEach(b => {
            b.classList.toggle("active", b.getAttribute("data-page") === pageId);
        });

        const navBtn = document.querySelector(`.header-left [data-page="${pageId}"]`);
        if (navBtn) {
            updateIndicator(navBtn);
        }
    }
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    if(!toast) return;
    toast.innerText = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

function getMockSongs() {
    return [
        { id: 1, title: "Track One", artist: "Artist A", album: "Album X", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", cover: "https://picsum.photos/seed/1/200" },
        { id: 2, title: "Track Two", artist: "Artist B", album: "Album Y", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", cover: "https://picsum.photos/seed/2/200" },
        { id: 3, title: "Track Three", artist: "Artist C", album: "Album Z", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", cover: "https://picsum.photos/seed/3/200" },
        { id: 4, title: "Track Four", artist: "Artist D", album: "Album W", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", cover: "https://picsum.photos/seed/4/200" }
    ];
}

function getMockAlbums() {
    return [
        { id: 1, name: "Album 1", artist: "Artist A" },
        { id: 2, name: "Album 2", artist: "Artist B" }
    ];
}

function toggleAccountMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('account-menu');
    if (menu) menu.classList.toggle('show');
    
    const username = localStorage.getItem('username') || 'Vendég';
    const displayEl = document.getElementById('user-display-name');
    if (displayEl) displayEl.textContent = username;
}

function navigateToAuth() { window.location.href = 'auth.html'; }
function handleLogout() {
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    alert('Sikeresen kijelentkeztél!');
    window.location.reload();
}

/* ==========================================================================
   INICIALIZÁLÁS (DOMCONTENTLOADED)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    loadHomePageData();
    setupContextMenu();

    document.querySelectorAll("[data-page]").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetPage = btn.getAttribute("data-page");
            navigateToPage(targetPage);
            if (targetPage === "playlist-page") loadPlaylistsData();
        });
    });

    const navItems = document.querySelectorAll('.header-left .nav-item');

    

    const initialActive = document.querySelector('.header-left .nav-item.active');
    if (initialActive) {
        requestAnimationFrame(() => updateIndicator(initialActive));
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            navItems.forEach(nav => nav.classList.remove('active'));
            const current = e.currentTarget;
            current.classList.add('active');
            updateIndicator(current);
        });
    });
    
    // Ablak átméretezésekor is tartsa a pontos pozíciót
    window.addEventListener('resize', () => {
        const activeNav = document.querySelector('.header-left .nav-item.active');
        if (activeNav) updateIndicator(activeNav);
    });

    if (playBtn) {
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
    }

    if (audio) {
        audio.addEventListener("timeupdate", () => {
            if (!audio.duration) return;
            progressBar.max = audio.duration;
            progressBar.value = audio.currentTime;
            currentTimeEl.innerText = formatTime(audio.currentTime);
            totalDurationEl.innerText = formatTime(audio.duration);
        });
        audio.addEventListener("ended", playNextTrack);
    }

    if (progressBar) {
        progressBar.addEventListener("input", () => {
            audio.currentTime = progressBar.value;
        });
    }

    document.getElementById("btn-next")?.addEventListener("click", playNextTrack);
    document.getElementById("btn-prev")?.addEventListener("click", playPrevTrack);
    document.getElementById("btn-like")?.addEventListener("click", toggleLikeCurrentTrack);
    document.getElementById("btn-shuffle")?.addEventListener("click", toggleShuffle);
    
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

    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        let timer;
        searchInput.addEventListener("input", (e) => {
            clearTimeout(timer);
            timer = setTimeout(async () => {
                const query = e.target.value.trim();
                if (!query) return;
                const results = await api.search(query) || getMockSongs();
                renderSongList(results, "search-results");
            }, 300);
        });
    }

    const volumeBar = document.getElementById("volume-bar");
    const volumeBtn = document.getElementById("btn-volume-icon");
    let lastVolume = 1;

    function updateVolumeIcon(vol) {
        const icon = document.getElementById("volume-icon");
        if (!icon) return;
        if (vol === 0) {
            icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
        } else {
            icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>`;
        }
    }

    if (volumeBar && audio) {
        audio.volume = volumeBar.value;
        volumeBar.addEventListener("input", (e) => {
            const val = parseFloat(e.target.value);
            audio.volume = val;
            updateVolumeIcon(val);
        });
    }

    if (volumeBtn && volumeBar && audio) {
        volumeBtn.addEventListener("click", () => {
            if (audio.volume > 0) {
                lastVolume = audio.volume;
                audio.volume = 0;
                volumeBar.value = 0;
            } else {
                audio.volume = lastVolume || 1;
                volumeBar.value = audio.volume;
            }
            updateVolumeIcon(audio.volume);
        });
    }

    document.getElementById("btn-add-to-playlist")?.addEventListener("click", openAddToPlaylistModal);
    document.getElementById("close-add-modal")?.addEventListener("click", () => {
        document.getElementById("add-to-playlist-modal").classList.remove("active");
    });

    const playlistModal = document.getElementById("playlist-modal");
    document.getElementById("create-playlist-btn")?.addEventListener("click", () => {
        if (playlistModal) {
            playlistModal.classList.add("active");
            const nameInp = document.getElementById("playlist-name-input");
            if (nameInp) { nameInp.value = ""; nameInp.focus(); }
            const coverInp = document.getElementById("playlist-cover-input");
            if (coverInp) coverInp.value = "";
        }
    });

    const hidePlaylistModal = () => playlistModal?.classList.remove("active");
    document.getElementById("close-modal")?.addEventListener("click", hidePlaylistModal);
    document.getElementById("cancel-playlist-btn")?.addEventListener("click", hidePlaylistModal);
    document.getElementById("save-playlist-btn")?.addEventListener("click", () => {
        const nameInput = document.getElementById("playlist-name-input");
        const coverInput = document.getElementById("playlist-cover-input");
        if (nameInput && nameInput.value.trim()) {
            createNewPlaylist(nameInput.value, coverInput ? coverInput.value : "");
            hidePlaylistModal();
        }
    });

    const songModal = document.getElementById("add-song-modal");
    const hideSongModal = () => songModal?.classList.remove("active");
    
    document.getElementById("add-music-btn")?.addEventListener("click", () => {
        if (songModal) {
            songModal.classList.add("active");
            document.getElementById("song-title-input").value = "";
            document.getElementById("song-artist-input").value = "";
            document.getElementById("song-file-input").value = "";
            document.getElementById("song-cover-file-input").value = "";
        }
    });
    
    document.getElementById("close-add-song-modal")?.addEventListener("click", hideSongModal);
    document.getElementById("cancel-add-song-btn")?.addEventListener("click", hideSongModal);
    document.getElementById("save-song-btn")?.addEventListener("click", async () => {
        const title = document.getElementById("song-title-input").value.trim();
        const artist = document.getElementById("song-artist-input").value.trim();
        const songFile = document.getElementById("song-file-input").files[0];
        const coverFile = document.getElementById("song-cover-file-input").files[0];

        if (!songFile) {
            showToast('Choose an mp3 file!');
            return;        
        }

        const formData = new FormData();
        formData.append('song', songFile);
        if (coverFile) formData.append('cover', coverFile);
        formData.append('title', title);
        formData.append('artist', artist);

        const result = await api.uploadSong(formData);
        if (!result) {
            showToast('Upload failed!');
            return;
        }

        showToast(`"${result.title || title}" uploaded successfully`);
        hideSongModal();
        loadHomePageData();
    });

    window.addEventListener('click', () => {
        const accMenu = document.getElementById('account-menu');
        if (accMenu && accMenu.classList.contains('show')) {
            accMenu.classList.remove('show');
        }
    });
});