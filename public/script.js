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
    async removeSongFromPlaylist(playlistId, songId) { return this.fetchData(`/playlists/${playlistId}/songs/${songId}`, 'DELETE'); },
    
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
    repeatMode: 'off',
    lyrics: [],
    activeLyricIndex: -1,
    crossfadeMs: 2500,
    isTransitioning: false,
    normalizeAudio: true,
    mobileQueueSwipe: true
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
function setTrackSource(track) {
    const src = track.url || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
    audio.crossOrigin = isSameOrigin(src) ? 'anonymous' : null;
    audio.src = src;
}

function fadeAudioVolume(from, to, duration = state.crossfadeMs) {
    return new Promise(resolve => {
        const start = performance.now();
        const tick = now => {
            const ratio = Math.min(1, (now - start) / duration);
            audio.volume = from + (to - from) * ratio;
            if (ratio < 1) requestAnimationFrame(tick);
            else resolve();
        };
        requestAnimationFrame(tick);
    });
}

async function playTrack(track, queue = [], options = {}) {
    const requestedVolume = parseFloat(document.getElementById("volume-bar")?.value ?? audio.volume ?? 0.5);
    const shouldFade = options.crossfade !== false && state.currentTrack && state.isPlaying && !state.isTransitioning;
    state.isTransitioning = true;

    if (shouldFade) {
        await fadeAudioVolume(audio.volume, 0, state.crossfadeMs * 0.45);
    }

    state.currentTrack = track;
    
    if (queue.length > 0) {
        state.queue = [...queue];
        state.originalQueue = [...queue];
    }

    if (state.queue.length > 0) {
        const foundIdx = state.queue.findIndex(s => s.id === track.id || (s.title === track.title && s.artist === track.artist));
        if (foundIdx !== -1) state.currentIndex = foundIdx;
    }

    setTrackSource(track);
    audio.volume = shouldFade ? 0 : requestedVolume;
    audio.play()?.catch(err => { if (err.name !== 'AbortError') showToast('A lejátszás nem indult el'); });
    state.isPlaying = true;

    updatePlayerUI(track);
    renderQueue();
    updateLikeButtonUI();
    loadLyricsForTrack(track);

    if (shouldFade) await fadeAudioVolume(0, requestedVolume, state.crossfadeMs * 0.55);
    state.isTransitioning = false;
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
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }

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
    document.dispatchEvent(new CustomEvent('trackchange', { detail: track }));
    document.querySelector('.now-playing-btn').hidden = false;
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
        <div class="queue-item ${idx === state.currentIndex ? 'active' : ''}" data-index="${idx}" draggable="true" tabindex="0">
            <div class="queue-item-left">
                <span class="queue-grip" aria-hidden="true">⠿</span>
                <img class="queue-cover" src="${song.cover || ''}" alt="" draggable="false">
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
        item.addEventListener('keydown', event => {
            if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            const from = Number(item.dataset.index);
            const to = Math.max(0, Math.min(state.queue.length - 1, from + (event.key === 'ArrowUp' ? -1 : 1)));
            moveQueueItem(from, to);
            queueContainer.querySelector(`[data-index="${to}"]`)?.focus();
        });
        item.addEventListener("click", () => {
            const idx = parseInt(item.getAttribute("data-index"));
            state.currentIndex = idx;
            playTrack(state.queue[idx]);
            document.dispatchEvent(new CustomEvent('mobile-queue-close'));
        });

        item.addEventListener("contextmenu", (e) => {
            const idx = parseInt(item.getAttribute("data-index"));
            showContextMenu(e, state.queue[idx]);
        });

        // Drag and Drop események kijelöléssel
        item.addEventListener("dragstart", (e) => {
            draggedQueueIndex = parseInt(item.getAttribute("data-index"));
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData('text/plain', String(draggedQueueIndex));
            item.classList.add("dragging");
            queueContainer.classList.add('is-dragging');
        });

        item.addEventListener("dragend", () => {
            item.classList.remove("dragging");
            clearQueueHighlights();
            queueContainer.classList.remove('is-dragging');
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
                } else {
                    item.classList.add("drag-over-below");
                }
            }
        });

        item.addEventListener("dragleave", (e) => {
            if (!item.contains(e.relatedTarget)) clearQueueHighlights();
        });

        item.addEventListener("drop", (e) => {
            e.preventDefault();
            clearQueueHighlights();
            let targetIndex = parseInt(item.getAttribute("data-index"));

            const rect = item.getBoundingClientRect();
            const offset = e.clientY - rect.top;
            targetIndex = queueDropIndex(draggedQueueIndex, targetIndex, offset > rect.height / 2);

            if (draggedQueueIndex !== null && draggedQueueIndex !== targetIndex) {
                moveQueueItem(draggedQueueIndex, targetIndex);
            }
            draggedQueueIndex = null;
            queueContainer.classList.remove('is-dragging');
            item.classList.remove('dragging');
        });
    });
}

function clearQueueHighlights() {
    document.querySelectorAll(".queue-item").forEach(el => {
        el.classList.remove("drag-over-above", "drag-over-below");
    });
}

function queueDropIndex(fromIndex, targetIndex, after) {
    const insertionIndex = targetIndex + (after ? 1 : 0);
    return insertionIndex - (fromIndex < insertionIndex ? 1 : 0);
}

function moveQueueItem(fromIndex, toIndex) {
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)
        || fromIndex < 0 || toIndex < 0 || fromIndex >= state.queue.length
        || toIndex >= state.queue.length || fromIndex === toIndex) return;
    const previousRows = [...document.querySelectorAll('.queue-item')];
    const previousTops = previousRows.map(row => row.getBoundingClientRect().top);
    const order = previousRows.map((_, index) => index);
    order.splice(toIndex, 0, order.splice(fromIndex, 1)[0]);
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
    const rows = document.querySelectorAll('.queue-item');
    if (designAnimationsEnabled()) {
        rows.forEach((row, index) => {
            const distance = previousTops[order[index]] - row.getBoundingClientRect().top;
            row.animate([{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }], {
                duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
            });
        });
    }
    rows[toIndex]?.classList.add('queue-moved');
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
                const isLiked = favList.songs && favList.songs.some(s => s.id === selectedContextSong.id);

                if (isLiked) {
                    // Eltávolítás a kedvencek közül
                    await api.removeSongFromPlaylist(favList.id, selectedContextSong.id);
                    showToast(`"${selectedContextSong.title}" eltávolítva a kedvencek közül!`);
                } else {
                    // Hozzáadás a kedvencekhez
                    await api.addSongToPlaylist(favList.id, selectedContextSong.id);
                    showToast(`"${selectedContextSong.title}" hozzáadva a kedvencekhez!`);
                }

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
            const existingIndex = state.queue.findIndex(s => 
                s.id === selectedContextSong.id || 
                (s.title === selectedContextSong.title && s.artist === selectedContextSong.artist)
            );

            if (existingIndex !== -1) {
                if (existingIndex === state.currentIndex) {
                    hideContextMenu();
                    return;
                }
                state.queue.splice(existingIndex, 1);
                if (existingIndex < state.currentIndex) {
                    state.currentIndex--;
                }
            }

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

    const favBtn = document.getElementById("ctx-add-favorite");
    if (favBtn) {
        const favList = userPlaylists.find(p => p.name === "Favorites");
        const isLiked = favList && favList.songs && favList.songs.some(s => s.id === song.id);
        const labelSpan = favBtn.querySelector("span");

        if (labelSpan) {
            labelSpan.innerText = isLiked ? "Eltávolítás a kedvencek közül" : "Kedvencekhez adás";
        }
    }

    const removeQueueBtn = document.getElementById("ctx-remove-queue");
    if (removeQueueBtn) {
        const isInQueue = state.queue.some(s => 
            s.id === song.id || (s.title === song.title && s.artist === song.artist)
        );

        if (isInQueue) {
            removeQueueBtn.style.display = "flex";
        } else {
            removeQueueBtn.style.display = "none";
        }
    }

    // 3. Pozicionálás a képernyőn
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
function navigateToPage(pageId) {
    const targetPage = document.getElementById(pageId);
    if (!targetPage) return;
    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page === targetPage));
    document.querySelectorAll('#header [data-page]').forEach(button => {
        const active = button.dataset.page === pageId;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    });
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    if(!toast) return;
    toast.innerText = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

function parseLrc(text) {
    const lines = [];
    const timePattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    for (const rawLine of String(text || '').split(/\r?\n/)) {
        const lyric = rawLine.replace(timePattern, '').trim();
        const stamps = [...rawLine.matchAll(timePattern)];
        for (const stamp of stamps) {
            const minutes = Number(stamp[1]);
            const seconds = Number(stamp[2]);
            const fraction = stamp[3] ? Number(stamp[3].padEnd(3, '0').slice(0, 3)) / 1000 : 0;
            if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
                lines.push({ time: minutes * 60 + seconds + fraction, text: lyric || '...' });
            }
        }
    }
    return lines.sort((a, b) => a.time - b.time);
}

function renderLyrics() {
    const container = document.getElementById('lyrics-container');
    const status = document.getElementById('lyrics-status');
    if (!container) return;
    state.activeLyricIndex = -1;
    if (!state.lyrics.length) {
        container.innerHTML = '<div class="lyrics-empty">Ehhez a dalhoz még nincs LRC dalszöveg.</div>';
        if (status) status.textContent = 'Nincs betöltött dalszöveg';
        return;
    }
    container.innerHTML = state.lyrics.map((line, index) => `
        <div class="lyric-line" data-index="${index}" data-time="${line.time}">
            ${line.text}
        </div>
    `).join('');
    if (status) status.textContent = `${state.lyrics.length} sor szinkronizálva`;
    syncLyrics();
}

function syncLyrics() {
    if (!state.lyrics.length) return;
    const current = audio.currentTime || 0;
    let activeIndex = state.lyrics.findIndex((line, index) => {
        const next = state.lyrics[index + 1];
        return current >= line.time && (!next || current < next.time);
    });
    if (activeIndex < 0 && current >= state.lyrics[state.lyrics.length - 1].time) activeIndex = state.lyrics.length - 1;
    if (activeIndex === state.activeLyricIndex) return;

    const container = document.getElementById('lyrics-container');
    if (!container) return;
    container.querySelector('.lyric-line.active')?.classList.remove('active');
    const activeLine = container.querySelector(`.lyric-line[data-index="${activeIndex}"]`);
    if (activeLine) {
        activeLine.classList.add('active');
        activeLine.scrollIntoView({ block: 'center', behavior: designAnimationsEnabled() ? 'smooth' : 'auto' });
    }
    state.activeLyricIndex = activeIndex;
}

function loadLyricsForTrack(track) {
    const rawLyrics = track?.lrc || track?.lyrics || track?.syncedLyrics || '';
    state.lyrics = parseLrc(rawLyrics);
    renderLyrics();
}

function setupLyricsTools() {
    document.querySelectorAll('[data-player-panel]').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.playerPanel;
            document.querySelectorAll('[data-player-panel]').forEach(item => {
                const active = item === tab;
                item.classList.toggle('active', active);
                item.setAttribute('aria-selected', String(active));
            });
            document.querySelectorAll('.player-panel').forEach(panel => {
                const active = panel.id === targetId;
                panel.classList.toggle('active', active);
                panel.hidden = !active;
            });
            if (targetId === 'lyrics-panel') syncLyrics();
        });
    });

    document.getElementById('lyrics-file-input')?.addEventListener('change', event => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const lrc = String(reader.result || '');
            if (state.currentTrack) state.currentTrack.lrc = lrc;
            state.lyrics = parseLrc(lrc);
            renderLyrics();
            showToast(state.lyrics.length ? 'Dalszöveg betöltve' : 'Nem találtam időbélyeges LRC sorokat');
        };
        reader.readAsText(file);
    });
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
function designAnimationsEnabled() {
    return document.documentElement.dataset.animations !== 'off'
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function validateDesign(saved, defaults) {
    const result = { ...defaults };
    if (!saved || typeof saved !== 'object') return result;
    for (const key of Object.keys(defaults)) {
        const value = saved[key];
        if (key.startsWith('--') ? /^#[\da-f]{6}$/i.test(value)
            : key === 'corners' ? ['0px', '12px', '20px'].includes(value)
            : key === 'spacing' ? ['compact', 'comfortable'].includes(value)
            : key === 'colorMode' ? ['manual', 'cover', 'song'].includes(value)
            : key === 'visualizer' ? ['off', 'glow', 'bars'].includes(value)
            : typeof value === 'boolean') result[key] = value;
    }
    return result;
}

function trackHue(track) {
    let hue = 0;
    for (const character of `${track.artist || ''}|${track.title || ''}`) hue = (hue * 31 + character.codePointAt(0)) % 360;
    return hue;
}

function coverHue(pixels, fallback) {
    let red = 0, green = 0, blue = 0, weight = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) * pixels[i + 3] / 255;
        red += r * saturation; green += g * saturation; blue += b * saturation; weight += saturation;
    }
    if (!weight) return fallback;
    const r = red / weight, g = green / weight, b = blue / weight;
    const max = Math.max(r, g, b), delta = max - Math.min(r, g, b);
    if (delta < 10) return fallback;
    const hue = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return (hue * 60 + 360) % 360;
}

function setupDesignSettings() {
    const form = document.getElementById('design-settings');
    const colorContainer = document.getElementById('theme-colors');
    if (!form || !colorContainer) return;
    const colors = {
        '--bg-main': 'Oldal háttere', '--bg-header': 'Fejléc',
        '--bg-card': 'Kártyák', '--bg-card-hover': 'Kártyák kiemelése',
        '--bg-element': 'Elemek háttere', '--bg-element-hover': 'Elemek kiemelése',
        '--accent-primary': 'Fő kiemelőszín', '--accent-primary-hover': 'Gombok kiemelése',
        '--accent-secondary': 'Másodlagos kiemelőszín', '--text-primary': 'Fő szöveg',
        '--text-secondary': 'Másodlagos szöveg', '--text-muted': 'Halvány szöveg',
        '--slider-track-bg': 'Csúszkák háttere', '--danger': 'Kedvencek és törlés',
        '--danger-hover': 'Törlés kiemelése', '--text-on-accent': 'Szöveg a kiemelőszínen'
    };
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const defaults = { corners: '20px', spacing: 'comfortable', animations: true, colorMode: 'manual', visualizer: 'glow' };
    for (const key of Object.keys(colors)) defaults[key] = styles.getPropertyValue(key).trim();
    let saved;
    try { saved = JSON.parse(localStorage.getItem('musik-design')); } catch { /* Az alapértékekkel is használható. */ }
    let design = validateDesign(saved, defaults);
    const status = document.getElementById('settings-status');
    const advancedContainer = document.getElementById('theme-colors-advanced');
    const primaryColors = ['--bg-main', '--bg-card', '--accent-primary', '--text-primary'];
    for (const [container, advanced] of [['theme-colors', false], ['theme-colors-advanced', true]]) {
        const target = document.getElementById(container);
        if (!target) continue;
        target.innerHTML = Object.entries(colors)
            .filter(([key]) => !advancedContainer || primaryColors.includes(key) !== advanced)
            .map(([key, label]) => `<label>${label}<input type="color" name="${key}" aria-label="${label}"></label>`).join('');
    }
    let selectedTrack = null;
    let colorRequest = 0;
    const musicStatus = document.getElementById('music-design-status');
    function setMusicStatus(message) {
        if (musicStatus) musicStatus.textContent = message;
    }
    function applyMusicPalette(hue) {
        const palette = {
            '--accent-primary': `hsl(${hue} 85% 68%)`, '--accent-secondary': `hsl(${(hue + 40) % 360} 80% 60%)`,
            '--accent-primary-hover': `hsl(${hue} 70% 45%)`, '--bg-main': `hsl(${hue} 35% 7%)`,
            '--bg-header': `hsl(${hue} 32% 10%)`, '--bg-card': `hsl(${hue} 30% 13%)`,
            '--bg-card-hover': `hsl(${hue} 30% 19%)`, '--bg-element': `hsl(${hue} 30% 10%)`,
            '--bg-element-hover': `hsl(${hue} 30% 18%)`, '--slider-track-bg': `hsl(${hue} 25% 22%)`,
            '--text-primary': '#f0f9ff', '--text-secondary': '#b6c2d2', '--text-muted': '#94a3b8', '--text-on-accent': '#0b0f17'
        };
        for (const [key, value] of Object.entries(palette)) root.style.setProperty(key, value);
    }
    function updateMusicColors() {
        const request = ++colorRequest;
        for (const key of Object.keys(colors)) root.style.setProperty(key, design[key]);
        if (!selectedTrack || design.colorMode === 'manual') {
            setMusicStatus(selectedTrack ? 'A saját színpalettád aktív.' : 'Válassz egy dalt a zenei megjelenéshez.');
            return;
        }
        const fallback = trackHue(selectedTrack);
        applyMusicPalette(fallback);
        setMusicStatus(design.colorMode === 'cover'
            ? 'Borító nélkül vagy nem olvasható borítónál a dalonkénti paletta érvényes.'
            : 'A dal címéhez és előadójához tartozó paletta aktív.');
        if (design.colorMode !== 'cover' || !selectedTrack.cover) return;
        const cover = new Image();
        cover.crossOrigin = 'anonymous';
        cover.onload = () => {
            if (request !== colorRequest) return;
            try {
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = 24;
                const context = canvas.getContext('2d', { willReadFrequently: true });
                context.drawImage(cover, 0, 0, 24, 24);
                applyMusicPalette(coverHue(context.getImageData(0, 0, 24, 24).data, fallback));
                setMusicStatus('A borítóhoz illő színpaletta aktív.');
            } catch { /* Külső képnél a böngésző tilthatja a színolvasást; a dalpaletta marad. */ }
        };
        cover.onerror = () => {}; // A dalpaletta már aktív, a lejátszást nem érinti a képhiba.
        cover.src = selectedTrack.cover;
    }
    document.addEventListener('trackchange', event => {
        selectedTrack = event.detail;
        updateMusicColors();
    });
    audio.addEventListener('playing', () => { root.dataset.musicPlaying = 'true'; });
    for (const event of ['pause', 'ended', 'waiting', 'emptied', 'error']) {
        audio.addEventListener(event, () => { root.dataset.musicPlaying = 'false'; });
    }
    function applyDesign() {
        root.style.setProperty('--surface-radius', design.corners);
        root.dataset.spacing = design.spacing;
        root.dataset.animations = design.animations ? 'on' : 'off';
        root.dataset.visualizer = design.visualizer;
        for (const [key, value] of Object.entries(design)) {
            const input = form.elements.namedItem(key);
            if (!input) continue;
            if (input.type === 'checkbox') input.checked = value;
            else input.value = value;
        }
        updateMusicColors();
    }
    form.addEventListener('submit', event => event.preventDefault());
    form.addEventListener('input', event => {
        const input = event.target;
        if (!Object.hasOwn(defaults, input.name)) return;
        design = validateDesign({ ...design, [input.name]: input.type === 'checkbox' ? input.checked : input.value }, defaults);
        applyDesign();
        try {
            localStorage.setItem('musik-design', JSON.stringify(design));
            if (status) status.textContent = 'Beállítások mentve.';
        } catch { if (status) status.textContent = 'A megjelenés frissült, de a böngésző nem engedi a mentést.'; }
    });
    document.getElementById('reset-design')?.addEventListener('click', () => {
        design = { ...defaults };
        applyDesign();
        try {
            localStorage.removeItem('musik-design');
            if (status) status.textContent = 'Alapértelmezések visszaállítva.';
        } catch { if (status) status.textContent = 'Az alapértékek visszaálltak, de a mentés nem törölhető.'; }
    });
    applyDesign();
}

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
            syncLyrics();
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
                if (!query) { document.getElementById("search-results").innerHTML = ""; return; }
                const results = await api.search(query) || getMockSongs();
                renderSongList(results, "search-results");
            }, 300);
        });
    }

    const volumeBar = document.getElementById("volume-bar");
    const volumeBtn = document.getElementById("btn-volume-icon");
    let lastVolume = 0.5;

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
        audio.volume = 0.5;
        volumeBar.value = audio.volume;
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
                audio.volume = lastVolume || 0.5;
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
            document.getElementById("song-lyrics-file-input").value = "";
        }
    });
    
    document.getElementById("close-add-song-modal")?.addEventListener("click", hideSongModal);
    document.getElementById("cancel-add-song-btn")?.addEventListener("click", hideSongModal);
    document.getElementById("save-song-btn")?.addEventListener("click", async () => {
        const title = document.getElementById("song-title-input").value.trim();
        const artist = document.getElementById("song-artist-input").value.trim();
        const songFile = document.getElementById("song-file-input").files[0];
        const coverFile = document.getElementById("song-cover-file-input").files[0];
        const lyricsFile = document.getElementById("song-lyrics-file-input").files[0];

        if (!songFile) {
            showToast('Choose an mp3 file!');
            return;        
        }

        const formData = new FormData();
        formData.append('song', songFile);
        if (coverFile) formData.append('cover', coverFile);
        if (lyricsFile) formData.append('lyrics', lyricsFile);
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
    setupDesignSettings();
    setupLyricsTools();
});

/* ==========================================================================
   KIEGÉSZÍTÉSEK: szinkron, Media Session, gyorsbillentyűk, mentés,
   alvás időzítő, vizualizáló, korábbi keresések
   ========================================================================== */
const SESSION_KEY = 'musik-session';
const RECENT_KEY = 'musik-recent-searches';
const AUDIO_SETTINGS_KEY = 'musik-audio-settings';
const PAUSE_PATH = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
const PLAY_PATH = '<path d="M8 5v14l11-7z"/>';

function isSameOrigin(url) {
    try { return new URL(url, location.href).origin === location.origin; } catch { return false; }
}
function setPlayIcon(playing) { playIcon.innerHTML = playing ? PAUSE_PATH : PLAY_PATH; }

function renderRecentSearches() {
    const box = document.getElementById('recent-searches');
    if (!box) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { /* üres lista */ }
    box.replaceChildren(...list.map(q => {
        const tag = document.createElement('button');
        tag.type = 'button'; tag.className = 'tag'; tag.textContent = q;
        tag.addEventListener('click', () => {
            const input = document.getElementById('search-input');
            input.value = q; input.dispatchEvent(new Event('input'));
        });
        return tag;
    }));
}
function rememberSearch(query) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { /* üres lista */ }
    list = [query, ...list.filter(q => q !== query)].slice(0, 8);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* nem mentjük */ }
    renderRecentSearches();
}

function setupPlaybackSync() {
    audio.addEventListener('play', () => { state.isPlaying = true; setPlayIcon(true); });
    audio.addEventListener('pause', () => { state.isPlaying = false; setPlayIcon(false); });
    const search = document.getElementById('search-input');
    search?.addEventListener('change', () => { if (search.value.trim()) rememberSearch(search.value.trim()); });
}

function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    document.addEventListener('trackchange', e => {
        const t = e.detail;
        ms.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album || '',
            artwork: t.cover ? [{ src: t.cover }] : [] });
    });
    const handlers = {
        play: () => audio.play(), pause: () => audio.pause(),
        previoustrack: playPrevTrack, nexttrack: playNextTrack,
        seekto: d => { audio.currentTime = d.seekTime; }
    };
    for (const [action, fn] of Object.entries(handlers)) {
        try { ms.setActionHandler(action, fn); } catch { /* nem támogatott művelet */ }
    }
}

function setupShortcuts() {
    const volumeBar = document.getElementById('volume-bar');
    const setVolume = v => {
        volumeBar.value = Math.min(1, Math.max(0, v));
        volumeBar.dispatchEvent(new Event('input'));
    };
    document.addEventListener('keydown', e => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target.closest('input, textarea, select, [contenteditable]')) return;
        const key = e.key.toLowerCase();
        if (key === '?' || (e.key === '/' && e.shiftKey)) {
            openShortcutsModal();
            e.preventDefault();
            return;
        }
        const actions = {
            ' ': () => { if (!e.target.closest('button')) playBtn.click(); else return false; },
            arrowright: () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); },
            arrowleft: () => { audio.currentTime = Math.max(0, audio.currentTime - 5); },
            arrowup: () => setVolume(audio.volume + 0.05),
            arrowdown: () => setVolume(audio.volume - 0.05),
            n: playNextTrack, p: playPrevTrack,
            m: () => document.getElementById('btn-volume-icon').click(),
            s: toggleShuffle, r: () => document.getElementById('btn-repeat').click(),
            l: toggleLikeCurrentTrack
        };
        if (actions[key] && actions[key]() !== false) e.preventDefault();
    });
}

function openShortcutsModal() {
    navigateToPage('settings-page');
    selectSettingsTab('shortcuts');
}

function selectSettingsTab(name) {
    const tabs = document.querySelectorAll('.settings-tab');
    const sections = document.querySelectorAll('[data-settings-section]');
    if (![...sections].some(section => section.dataset.settingsSection === name)) return;
    tabs.forEach(tab => {
        const active = tab.dataset.settingsTab === name;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
    });
    sections.forEach(section => { section.hidden = section.dataset.settingsSection !== name; });
    // A visszaállítás gomb csak a testreszabható beállításoknál értelmes.
    const footer = document.getElementById('settings-footer');
    if (footer) footer.hidden = name === 'shortcuts';
}

function setupSettingsTabs() {
    const tabs = [...document.querySelectorAll('.settings-tab')];
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectSettingsTab(tab.dataset.settingsTab));
        tab.addEventListener('keydown', event => {
            const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
            if (!step) return;
            event.preventDefault();
            event.stopPropagation();
            const next = tabs[(index + step + tabs.length) % tabs.length];
            next.focus();
            selectSettingsTab(next.dataset.settingsTab);
        });
    });
    selectSettingsTab('appearance');
}

function loadAudioSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY)) || {}; } catch { /* alapértékek */ }
    state.crossfadeMs = Number.isFinite(saved.crossfadeMs) ? Math.max(0, Math.min(8000, saved.crossfadeMs)) : state.crossfadeMs;
    state.normalizeAudio = typeof saved.normalizeAudio === 'boolean' ? saved.normalizeAudio : true;
    state.mobileQueueSwipe = typeof saved.mobileQueueSwipe === 'boolean' ? saved.mobileQueueSwipe : true;
}

function saveAudioSettings() {
    try {
        localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({
            crossfadeMs: state.crossfadeMs,
            normalizeAudio: state.normalizeAudio,
            mobileQueueSwipe: state.mobileQueueSwipe
        }));
    } catch { /* a lejátszás ettől még működik */ }
}

function setupAudioSettings() {
    loadAudioSettings();
    const crossfade = document.getElementById('crossfade-setting');
    const crossfadeValue = document.getElementById('crossfade-value');
    const normalization = document.getElementById('normalization-setting');
    const mobileSwipe = document.getElementById('mobile-queue-swipe-setting');
    const render = () => {
        if (crossfade) crossfade.value = String(state.crossfadeMs / 1000);
        if (crossfadeValue) crossfadeValue.textContent = `${(state.crossfadeMs / 1000).toFixed(1).replace('.0', '')} mp`;
        if (normalization) normalization.checked = state.normalizeAudio;
        if (mobileSwipe) mobileSwipe.checked = state.mobileQueueSwipe;
    };
    crossfade?.addEventListener('input', event => {
        state.crossfadeMs = Math.round(Number(event.target.value) * 1000);
        render();
        saveAudioSettings();
    });
    normalization?.addEventListener('change', event => {
        state.normalizeAudio = event.target.checked;
        saveAudioSettings();
        document.dispatchEvent(new CustomEvent('audio-settings-change'));
        showToast(state.normalizeAudio ? 'Hangerő-normalizálás bekapcsolva' : 'Hangerő-normalizálás kikapcsolva');
    });
    mobileSwipe?.addEventListener('change', event => {
        state.mobileQueueSwipe = event.target.checked;
        saveAudioSettings();
    });
    render();
}

function setupMobileQueueSheet() {
    const sheet = document.querySelector('.player-right');
    const toggle = document.getElementById('mobile-queue-toggle');
    if (!sheet) return;
    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'mobile-queue-backdrop';
    backdrop.setAttribute('aria-label', 'Queue bezárása');
    sheet.parentElement?.insertBefore(backdrop, sheet);
    const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
    const closeSheet = () => {
        sheet?.classList.remove('queue-sheet-open');
        document.body.classList.remove('mobile-queue-open');
        toggle?.setAttribute('aria-expanded', 'false');
        toggle?.querySelector('span')?.replaceChildren(document.createTextNode('Song queue'));
    };
    const openSheet = () => {
        if (!sheet || !isMobile()) return;
        sheet.classList.add('queue-sheet-open');
        document.body.classList.add('mobile-queue-open');
        toggle?.setAttribute('aria-expanded', 'true');
        toggle?.querySelector('span')?.replaceChildren(document.createTextNode('Lejátszó'));
        requestAnimationFrame(() => {
            const queuePanel = document.getElementById('queue-panel');
            const queueList = document.getElementById('queue-container');
            queuePanel?.setAttribute('tabindex', '-1');
            queuePanel?.focus({ preventScroll: true });
            queueList?.scrollTo({ top: 0 });
        });
    };
    const toggleSheet = () => {
        if (!sheet || !isMobile()) return;
        if (sheet.classList.contains('queue-sheet-open')) closeSheet();
        else openSheet();
    };
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-controls', 'queue-panel');
    toggle?.addEventListener('click', toggleSheet);
    backdrop.addEventListener('click', closeSheet);
    window.addEventListener('resize', () => { if (!isMobile()) closeSheet(); });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeSheet();
    });

    let startY = 0, currentY = 0, dragging = false;
    const canStartSheetDrag = event => {
        if (!state.mobileQueueSwipe || !isMobile() || !sheet.classList.contains('queue-sheet-open')) return false;
        if (event.target.closest('button, input, select, textarea, .queue-item')) return false;
        const scroller = event.target.closest('.queue-list, .lyrics-list');
        return !scroller || scroller.scrollTop <= 0;
    };
    sheet.addEventListener('pointerdown', event => {
        if (!canStartSheetDrag(event)) return;
        dragging = true;
        startY = event.clientY;
        currentY = event.clientY;
        sheet.setPointerCapture?.(event.pointerId);
        sheet.classList.add('queue-sheet-dragging');
    });
    sheet.addEventListener('pointermove', event => {
        if (!dragging) return;
        currentY = event.clientY;
        const offset = Math.max(0, currentY - startY);
        if (offset > 8) event.preventDefault();
        sheet.style.setProperty('--queue-drag-offset', `${offset}px`);
    });
    const finishDrag = () => {
        if (!dragging) return;
        const offset = Math.max(0, currentY - startY);
        sheet.classList.remove('queue-sheet-dragging');
        sheet.style.removeProperty('--queue-drag-offset');
        dragging = false;
        if (offset > 90) closeSheet();
    };
    sheet.addEventListener('pointerup', finishDrag);
    sheet.addEventListener('pointercancel', finishDrag);
    document.addEventListener('mobile-queue-close', closeSheet);
}

function setupSessionStore() {
    const volumeBar = document.getElementById('volume-bar');
    let restoring = true, lastSave = 0;
    const save = () => {
        if (restoring || !state.currentTrack) return;
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                queue: state.queue, original: state.originalQueue, index: state.currentIndex,
                time: audio.currentTime || 0, volume: audio.volume,
                shuffle: state.isShuffle, repeat: state.repeatMode
            }));
        } catch { /* a böngésző nem engedi a mentést */ }
    };
    audio.addEventListener('timeupdate', () => { const now = Date.now(); if (now - lastSave > 3000) { lastSave = now; save(); } });
    audio.addEventListener('pause', save);
    audio.addEventListener('volumechange', save);
    document.addEventListener('trackchange', save);
    window.addEventListener('pagehide', save);

    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { /* nincs mentett állapot */ }
    const track = saved && Array.isArray(saved.queue) ? saved.queue[saved.index] : null;
    if (!track || typeof track.title !== 'string') { restoring = false; return; }

    state.queue = saved.queue;
    state.originalQueue = Array.isArray(saved.original) ? saved.original : [...saved.queue];
    state.currentIndex = saved.index;
    state.currentTrack = track;
    state.repeatMode = ['off', 'all', 'one'].includes(saved.repeat) ? saved.repeat : 'off';
    state.isShuffle = !!saved.shuffle;
    document.getElementById('btn-shuffle').classList.toggle('active', state.isShuffle);
    document.getElementById('btn-repeat').classList.toggle('active', state.repeatMode !== 'off');
    if (typeof saved.volume === 'number') setTimeout(() => {
        volumeBar.value = saved.volume; volumeBar.dispatchEvent(new Event('input'));
    }, 0);
    const src = track.url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
    audio.crossOrigin = isSameOrigin(src) ? 'anonymous' : null;
    audio.src = src;
    audio.addEventListener('loadedmetadata', () => {
        if (saved.time > 0 && saved.time < audio.duration) audio.currentTime = saved.time;
        restoring = false;
    }, { once: true });
    audio.addEventListener('error', () => { restoring = false; }, { once: true });
    updatePlayerUI(track);
    setPlayIcon(false);
    state.isPlaying = false;
    renderQueue();
    updateLikeButtonUI();
}

function setupSleepTimer() {
    const btn = document.getElementById('btn-sleep'), label = document.getElementById('sleep-label');
    const volumeBar = document.getElementById('volume-bar');
    if (!btn) return;
    const steps = [0, 15, 30, 60];
    let step = 0, tick = null, endAt = 0;
    const stop = () => { clearInterval(tick); tick = null; label.textContent = ''; btn.classList.remove('active'); };
    btn.addEventListener('click', () => {
        stop();
        step = (step + 1) % steps.length;
        if (!steps[step]) { showToast('Alvás időzítő kikapcsolva'); return; }
        endAt = Date.now() + steps[step] * 60000;
        btn.classList.add('active');
        showToast(`Leállítás ${steps[step]} perc múlva`);
        tick = setInterval(() => {
            const left = endAt - Date.now();
            label.textContent = `${Math.max(1, Math.ceil(left / 60000))}p`;
            const base = parseFloat(volumeBar.value);
            if (left <= 0) { audio.pause(); audio.volume = base; stop(); step = 0; showToast('Jó éjszakát!'); }
            else if (left <= 10000) audio.volume = base * left / 10000;
        }, 1000);
    });
}

function setupVisualizer() {
    const canvas = document.getElementById('visualizer');
    if (!canvas) return;
    const ctx = canvas.getContext('2d'), root = document.documentElement;
    const fake = new Array(48).fill(0);
    let graph = null, data = null, connectedUrl = '';

    function applyGraphRouting() {
        if (!graph?.source) return;
        try {
            graph.source.disconnect();
            graph.compressor.disconnect();
            graph.analyser.disconnect();
        } catch { /* lehet, hogy még nincs minden node kapcsolva */ }
        if (state.normalizeAudio) {
            graph.source.connect(graph.compressor);
            graph.compressor.connect(graph.analyser);
        } else {
            graph.source.connect(graph.analyser);
        }
        graph.analyser.connect(graph.ac.destination);
    }

    function connect() {
        const url = audio.currentSrc || audio.src || '';
        if (!url || !isSameOrigin(url) || graph?.source) return;
        try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            const source = ac.createMediaElementSource(audio);
            const compressor = ac.createDynamicsCompressor();
            compressor.threshold.value = -24;
            compressor.knee.value = 30;
            compressor.ratio.value = 8;
            compressor.attack.value = 0.006;
            compressor.release.value = 0.22;
            const analyser = ac.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.78;
            graph = { ac, source, compressor, analyser };
            applyGraphRouting();
            connectedUrl = url;
            data = new Uint8Array(analyser.frequencyBinCount);
            audio.addEventListener('play', () => ac.resume());
            ac.resume();
        } catch {
            graph = null;
        }
    }

    document.addEventListener('audio-settings-change', applyGraphRouting);

    document.addEventListener('trackchange', () => {
        if (!graph?.source) connect();
    });

    (function frame() {
        requestAnimationFrame(frame);
        const w = canvas.width, h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        if (root.dataset.visualizer !== 'bars' || root.dataset.musicPlaying !== 'true' || !designAnimationsEnabled()) return;
        if (!graph?.source) connect();
        if (graph?.analyser) graph.analyser.getByteFrequencyData(data);
        const styles = getComputedStyle(root);
        const primary = styles.getPropertyValue('--accent-primary').trim() || '#38bdf8';
        const secondary = styles.getPropertyValue('--accent-secondary').trim() || '#06b6d4';
        const gradient = ctx.createLinearGradient(0, 0, w, 0);
        gradient.addColorStop(0, primary);
        gradient.addColorStop(0.55, secondary);
        gradient.addColorStop(1, primary);
        ctx.fillStyle = gradient;
        ctx.shadowColor = primary;
        ctx.shadowBlur = 12;
        const n = fake.length, bw = w / n;
        for (let i = 0; i < n; i++) {
            let v;
            if (graph?.analyser) {
                const lowBias = Math.pow(i / n, 0.75);
                v = data[Math.floor(lowBias * data.length * 0.92)] / 255;
            } else {
                const pulse = 0.3 + Math.sin(performance.now() / 140 + i * 0.55) * 0.18;
                fake[i] += (pulse - fake[i]) * 0.18;
                v = fake[i];
            }
            const bh = Math.max(4, Math.pow(v, 0.78) * h);
            const x = i * bw + 2;
            const radius = Math.min(6, (bw - 4) / 2);
            const barWidth = Math.max(2, bw - 4);
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(x, h - bh, barWidth, bh, radius);
                ctx.fill();
            } else {
                ctx.fillRect(x, h - bh, barWidth, bh);
            }
        }
        ctx.shadowBlur = 0;
    })();
}

document.addEventListener('DOMContentLoaded', () => {
    setupPlaybackSync();
    setupMediaSession();
    setupAudioSettings();
    setupShortcuts();
    setupSettingsTabs();
    setupMobileQueueSheet();
    setupSleepTimer();
    setupVisualizer();
    renderRecentSearches();
    setupSessionStore();
});