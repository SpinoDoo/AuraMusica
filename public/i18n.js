/* ==========================================================================
   i18n – többnyelvűség
   Új nyelv hozzáadása: másold le az egyik blokkot a TRANSLATIONS objektumban,
   fordítsd le az értékeket, és vedd fel a nyelvet a LANGUAGES listába.
   A dalok adatai (cím, előadó, album, dalszöveg) nem fordítódnak.
   ========================================================================== */
const LANGUAGES = { hu: 'Magyar', en: 'English' };
const DEFAULT_LANGUAGE = 'hu';
const LANGUAGE_KEY = 'musik-language';

const TRANSLATIONS = {
    hu: {
        'nav.home': 'Kezdőlap', 'nav.search': 'Keresés', 'nav.playlists': 'Lejátszási listák',
        'nav.nowPlaying': 'Jelenlegi lejátszás', 'nav.addMusic': 'Zene hozzáadása', 'nav.settings': 'Beállítások',
        'account.guest': 'Vendég', 'account.login': 'Bejelentkezés / Regisztráció', 'account.logout': 'Kijelentkezés',
        'account.loggedOut': 'Sikeresen kijelentkeztél!',
        'common.recents': 'Legutóbbiak', 'common.album': 'Album',
        'home.albums': 'Albumok neked',
        'search.placeholder': 'Keresés...', 'search.results': 'Találatok',
        'playlists.title': 'Lejátszási listák', 'playlist.delete': 'Lista törlése', 'playlist.songs': '{count} dal',
        'player.nothing': 'Nincs lejátszás', 'player.songName': 'Dal címe', 'player.artist': 'Előadó', 'player.album': 'Album neve', 'player.shuffle': 'Keverés', 'player.repeat': 'Ismétlés',
        'player.sleep': 'Alvás időzítő (15 / 30 / 60 perc)', 'player.volume': 'Hangerő / Némítás',
        'player.panels': 'Lejátszó panelek', 'player.queue': 'Lejátszási sor', 'player.player': 'Lejátszó',
        'player.closeQueue': 'Lejátszási sor bezárása', 'player.lyrics': 'Dalszöveg',
        'action.addFavorite': 'Kedvencekhez adás', 'action.removeFavorite': 'Eltávolítás a kedvencek közül',
        'action.addToPlaylist': 'Hozzáadás lejátszási listához', 'action.playNext': 'Lejátszás következőként',
        'action.removeFromQueue': 'Eltávolítás a sorból',
        'queue.empty': 'A lejátszási sor üres',
        'lyrics.none': 'Nincs betöltött dalszöveg', 'lyrics.noneForSong': 'Ehhez a dalhoz még nincs LRC dalszöveg.',
        'lyrics.synced': '{count} sor szinkronizálva', 'lyrics.load': 'LRC betöltése',
        'lyrics.loaded': 'Dalszöveg betöltve', 'lyrics.noTimestamps': 'Nem találtam időbélyeges LRC sorokat',
        'modal.newPlaylist': 'Új lejátszási lista', 'modal.playlistName': 'Lista neve...',
        'modal.playlistCover': 'Borítókép URL (opcionális)...', 'modal.cancel': 'Mégse', 'modal.create': 'Létrehozás',
        'modal.addToList': 'Hozzáadás listához', 'modal.songName': 'Név...', 'modal.songArtist': 'Előadó...',
        'modal.audioFile': 'Hangfájl (MP3, WAV...)', 'modal.coverFile': 'Borítókép kiválasztása (PNG, JPG...)',
        'modal.lyricsFile': 'Dalszövegfájl (LRC, opcionális)', 'modal.back': 'Vissza', 'modal.add': 'Hozzáadás',

        'toast.playFailed': 'A lejátszás nem indult el', 'toast.albumEmpty': 'Ebben az albumban még nincsenek dalok.',
        'toast.playingAlbum': '"{title}" lejátszása', 'toast.playing': 'Lejátszás: {title}',
        'toast.shuffleOn': 'Keverés bekapcsolva - Sorrend frissítve', 'toast.shuffleOff': 'Keverés kikapcsolva',
        'toast.orderUpdated': 'Sorrend frissítve',
        'toast.favRemoved': '"{title}" eltávolítva a kedvencek közül!', 'toast.favAdded': '"{title}" hozzáadva a kedvencekhez!',
        'toast.playNextSet': '"{title}" beállítva következőnek!', 'toast.removedFromQueue': '"{title}" eltávolítva a sorból.',
        'toast.playlistPlaying': '"{name}" lejátszása', 'toast.playlistEmpty': 'Ez a lejátszási lista üres!',
        'toast.playlistCreateFailed': 'Nem sikerült létrehozni a lejátszási listát',
        'toast.playlistCreated': '"{name}" lejátszási lista létrehozva',
        'toast.playlistDeleteFailed': 'Nem sikerült törölni a lejátszási listát', 'toast.playlistDeleted': '"{name}" törölve',
        'toast.likedRemoved': 'A dal eltávolítva a kedvencek közül', 'toast.likedAdded': 'A dal hozzáadva a kedvencekhez',
        'toast.noTrack': 'Nincs kiválasztva zene!', 'toast.alreadyInPlaylist': 'Ez a dal már szerepel a listában',
        'toast.addedToPlaylist': 'Hozzáadva: {name}',
        'toast.repeatAll': 'Összes ismétlése', 'toast.repeatOne': 'Egy szám ismétlése', 'toast.repeatOff': 'Ismétlés kikapcsolva',
        'toast.chooseMp3': 'Válassz egy mp3 fájlt!', 'toast.uploadFailed': 'A feltöltés nem sikerült!',
        'toast.uploaded': '"{title}" sikeresen feltöltve',
        'toast.normOn': 'Hangerő-normalizálás bekapcsolva', 'toast.normOff': 'Hangerő-normalizálás kikapcsolva',
        'toast.sleepOff': 'Alvás időzítő kikapcsolva', 'toast.sleepSet': 'Leállítás {min} perc múlva',
        'toast.goodNight': 'Jó éjszakát!',

        'settings.subtitle': 'Alakítsd a saját ízlésedre. A változások azonnal láthatók, és ebben a böngészőben megmaradnak.',
        'settings.categories': 'Beállítások kategóriái',
        'settings.appearance': 'Megjelenés', 'settings.appearance.desc': 'Az alkalmazás formája, nyelve, térközei és vizuális effektjei.',
        'settings.language': 'Nyelv', 'settings.language.desc': 'A felület nyelve. A dalok adatai nem változnak.',
        'settings.corners': 'Lekerekítés', 'settings.corners.desc': 'A kártyák és panelek sarkainak formája.',
        'settings.corners.square': 'Szögletes', 'settings.corners.slight': 'Enyhén kerek', 'settings.corners.round': 'Kerek',
        'settings.spacing': 'Térközök', 'settings.spacing.desc': 'Kompakt módban több elem fér a képernyőre.',
        'settings.spacing.compact': 'Kompakt', 'settings.spacing.comfortable': 'Kényelmes',
        'settings.colorMode': 'Színmód', 'settings.colorMode.desc': 'Saját palettát használj, vagy kövesse a lejátszott zenét.',
        'settings.colorMode.manual': 'Saját színek', 'settings.colorMode.cover': 'Borítóból', 'settings.colorMode.song': 'Dalonként',
        'settings.visualizer': 'Vizualizáló', 'settings.visualizer.desc': 'Mozgó effekt a lejátszó oldalon.',
        'settings.visualizer.off': 'Ki', 'settings.visualizer.glow': 'Ragyogás', 'settings.visualizer.bars': 'Sávok',
        'settings.stickyHeader': 'Rögzített fejléc', 'settings.stickyHeader.desc': 'A fejléc görgetéskor is felül marad.',
        'settings.animations': 'Animációk', 'settings.animations.desc': 'Átmenetek és mozgó elemek engedélyezése.',
        'settings.colors': 'Színek',
        'settings.colors.desc': 'Kattints egy színmintára a módosításhoz. Ha a színmód nem „Saját színek”, a zenéhez igazodó paletta felülírhatja ezeket.',
        'settings.advancedColors': 'Haladó színek',
        'settings.playback': 'Lejátszás', 'settings.playback.desc': 'Hangbeállítások és a lejátszó viselkedése.',
        'settings.crossfade': 'Crossfade', 'settings.crossfade.desc': 'A dalok közötti áttűnés hossza. 0 = kikapcsolva.',
        'settings.crossfade.label': 'Crossfade hossza', 'settings.seconds': '{value} mp',
        'settings.normalization': 'Hangerő-normalizálás', 'settings.normalization.desc': 'Kiegyenlíti a dalok közötti hangerőkülönbséget.',
        'settings.mobileSwipe': 'Mobil queue lehúzással zárható', 'settings.mobileSwipe.desc': 'Mobilon a sor lefelé húzással bezárható.',
        'settings.shortcuts': 'Billentyűparancsok',
        'settings.shortcuts.desc': 'Gyorsbillentyűk a lejátszás vezérléséhez. Szövegmezőben gépelés közben nem aktívak. A <kbd>?</kbd> billentyűvel bárhonnan ide léphetsz.',
        'settings.reset': 'Alapértelmezések visszaállítása', 'settings.saved': 'Beállítások mentve.',
        'settings.saveBlocked': 'A megjelenés frissült, de a böngésző nem engedi a mentést.',
        'settings.resetDone': 'Alapértelmezések visszaállítva.',
        'settings.resetBlocked': 'Az alapértékek visszaálltak, de a mentés nem törölhető.',
        'shortcuts.volume': 'Hangerő', 'shortcuts.other': 'Egyéb',
        'shortcuts.playPause': 'Lejátszás / szünet', 'shortcuts.next': 'Következő szám', 'shortcuts.prev': 'Előző szám',
        'shortcuts.back': 'Visszatekerés 5 mp', 'shortcuts.forward': 'Előretekerés 5 mp',
        'shortcuts.volUp': 'Hangerő fel', 'shortcuts.volDown': 'Hangerő le', 'shortcuts.mute': 'Némítás',
        'shortcuts.favorites': 'Kedvencek', 'shortcuts.open': 'Billentyűparancsok megnyitása',
        'music.status.custom': 'A saját színpalettád aktív.', 'music.status.pick': 'Válassz egy dalt a zenei megjelenéshez.',
        'music.status.coverFallback': 'Borító nélkül vagy nem olvasható borítónál a dalonkénti paletta érvényes.',
        'music.status.song': 'A dal címéhez és előadójához tartozó paletta aktív.',
        'music.status.cover': 'A borítóhoz illő színpaletta aktív.',
        'color.bgMain': 'Oldal háttere', 'color.bgHeader': 'Fejléc', 'color.bgCard': 'Kártyák',
        'color.bgCardHover': 'Kártyák kiemelése', 'color.bgElement': 'Elemek háttere', 'color.bgElementHover': 'Elemek kiemelése',
        'color.accent': 'Fő kiemelőszín', 'color.accentHover': 'Gombok kiemelése', 'color.accent2': 'Másodlagos kiemelőszín',
        'color.text': 'Fő szöveg', 'color.text2': 'Másodlagos szöveg', 'color.muted': 'Halvány szöveg',
        'color.slider': 'Csúszkák háttere', 'color.danger': 'Kedvencek és törlés', 'color.dangerHover': 'Törlés kiemelése',
        'color.onAccent': 'Szöveg a kiemelőszínen'
    },
    en: {
        'nav.home': 'Home', 'nav.search': 'Search', 'nav.playlists': 'Playlists',
        'nav.nowPlaying': 'Now playing', 'nav.addMusic': 'Add music', 'nav.settings': 'Settings',
        'account.guest': 'Guest', 'account.login': 'Log in / Register', 'account.logout': 'Log out',
        'account.loggedOut': 'You have been logged out.',
        'common.recents': 'Recents', 'common.album': 'Album',
        'home.albums': 'Albums for you',
        'search.placeholder': 'Search...', 'search.results': 'Results',
        'playlists.title': 'Playlists', 'playlist.delete': 'Delete playlist',
        'playlist.songs_one': '{count} song', 'playlist.songs_other': '{count} songs',
        'player.nothing': 'Nothing playing', 'player.songName': 'Song name', 'player.artist': 'Artist', 'player.album': 'Album name', 'player.shuffle': 'Shuffle', 'player.repeat': 'Repeat',
        'player.sleep': 'Sleep timer (15 / 30 / 60 min)', 'player.volume': 'Volume / Mute',
        'player.panels': 'Player panels', 'player.queue': 'Song queue', 'player.player': 'Player',
        'player.closeQueue': 'Close queue', 'player.lyrics': 'Lyrics',
        'action.addFavorite': 'Add to favorites', 'action.removeFavorite': 'Remove from favorites',
        'action.addToPlaylist': 'Add to playlist', 'action.playNext': 'Play next',
        'action.removeFromQueue': 'Remove from queue',
        'queue.empty': 'The queue is empty',
        'lyrics.none': 'No lyrics loaded', 'lyrics.noneForSong': 'No LRC lyrics for this song yet.',
        'lyrics.synced_one': '{count} line synced', 'lyrics.synced_other': '{count} lines synced',
        'lyrics.load': 'Load LRC', 'lyrics.loaded': 'Lyrics loaded', 'lyrics.noTimestamps': 'No timestamped LRC lines found',
        'modal.newPlaylist': 'New playlist', 'modal.playlistName': 'Playlist name...',
        'modal.playlistCover': 'Cover image URL (optional)...', 'modal.cancel': 'Cancel', 'modal.create': 'Create',
        'modal.addToList': 'Add to playlist', 'modal.songName': 'Name...', 'modal.songArtist': 'Artist...',
        'modal.audioFile': 'Audio file (MP3, WAV...)', 'modal.coverFile': 'Choose cover (PNG, JPG...)',
        'modal.lyricsFile': 'Lyrics file (LRC, optional)', 'modal.back': 'Back', 'modal.add': 'Add',

        'toast.playFailed': 'Playback could not start', 'toast.albumEmpty': 'This album has no songs yet.',
        'toast.playingAlbum': 'Playing "{title}"', 'toast.playing': 'Playing: {title}',
        'toast.shuffleOn': 'Shuffle on - order updated', 'toast.shuffleOff': 'Shuffle off',
        'toast.orderUpdated': 'Order updated',
        'toast.favRemoved': '"{title}" removed from favorites!', 'toast.favAdded': '"{title}" added to favorites!',
        'toast.playNextSet': '"{title}" will play next!', 'toast.removedFromQueue': '"{title}" removed from the queue.',
        'toast.playlistPlaying': 'Playing "{name}"', 'toast.playlistEmpty': 'This playlist is empty!',
        'toast.playlistCreateFailed': "Couldn't create the playlist",
        'toast.playlistCreated': 'Playlist "{name}" created',
        'toast.playlistDeleteFailed': "Couldn't delete the playlist", 'toast.playlistDeleted': '"{name}" deleted',
        'toast.likedRemoved': 'Song removed from liked songs', 'toast.likedAdded': 'Song added to liked songs',
        'toast.noTrack': 'No song selected!', 'toast.alreadyInPlaylist': 'This song is already in the playlist',
        'toast.addedToPlaylist': 'Added to {name}',
        'toast.repeatAll': 'Repeat all', 'toast.repeatOne': 'Repeat one', 'toast.repeatOff': 'Repeat off',
        'toast.chooseMp3': 'Choose an mp3 file!', 'toast.uploadFailed': 'Upload failed!',
        'toast.uploaded': '"{title}" uploaded successfully',
        'toast.normOn': 'Volume normalization on', 'toast.normOff': 'Volume normalization off',
        'toast.sleepOff': 'Sleep timer off', 'toast.sleepSet': 'Stopping in {min} min',
        'toast.goodNight': 'Good night!',

        'settings.subtitle': 'Make it your own. Changes apply instantly and are kept in this browser.',
        'settings.categories': 'Settings categories',
        'settings.appearance': 'Appearance', 'settings.appearance.desc': 'The look, language, spacing and visual effects of the app.',
        'settings.language': 'Language', 'settings.language.desc': 'The interface language. Song data is not translated.',
        'settings.corners': 'Corner style', 'settings.corners.desc': 'The shape of card and panel corners.',
        'settings.corners.square': 'Square', 'settings.corners.slight': 'Slightly rounded', 'settings.corners.round': 'Rounded',
        'settings.spacing': 'Spacing', 'settings.spacing.desc': 'Compact mode fits more items on screen.',
        'settings.spacing.compact': 'Compact', 'settings.spacing.comfortable': 'Comfortable',
        'settings.colorMode': 'Color mode', 'settings.colorMode.desc': 'Use your own palette or follow the music being played.',
        'settings.colorMode.manual': 'Custom colors', 'settings.colorMode.cover': 'From cover', 'settings.colorMode.song': 'Per song',
        'settings.visualizer': 'Visualizer', 'settings.visualizer.desc': 'An animated effect on the player page.',
        'settings.visualizer.off': 'Off', 'settings.visualizer.glow': 'Glow', 'settings.visualizer.bars': 'Bars',
        'settings.stickyHeader': 'Sticky header', 'settings.stickyHeader.desc': 'Keeps the header at the top while scrolling.',
        'settings.animations': 'Animations', 'settings.animations.desc': 'Allow transitions and moving elements.',
        'settings.colors': 'Colors',
        'settings.colors.desc': 'Click a swatch to change it. If the color mode is not “Custom colors”, a palette matching the music may override these.',
        'settings.advancedColors': 'Advanced colors',
        'settings.playback': 'Playback', 'settings.playback.desc': 'Audio options and player behavior.',
        'settings.crossfade': 'Crossfade', 'settings.crossfade.desc': 'Length of the fade between songs. 0 = off.',
        'settings.crossfade.label': 'Crossfade length', 'settings.seconds': '{value} s',
        'settings.normalization': 'Volume normalization', 'settings.normalization.desc': 'Evens out volume differences between songs.',
        'settings.mobileSwipe': 'Swipe down to close queue on mobile', 'settings.mobileSwipe.desc': 'On mobile, the queue can be closed by dragging it down.',
        'settings.shortcuts': 'Keyboard shortcuts',
        'settings.shortcuts.desc': 'Hotkeys for controlling playback. They are inactive while typing in a text field. Press <kbd>?</kbd> anywhere to jump here.',
        'settings.reset': 'Restore defaults', 'settings.saved': 'Settings saved.',
        'settings.saveBlocked': "The appearance was updated, but the browser doesn't allow saving.",
        'settings.resetDone': 'Defaults restored.',
        'settings.resetBlocked': "Defaults were restored, but the saved data couldn't be cleared.",
        'shortcuts.volume': 'Volume', 'shortcuts.other': 'Other',
        'shortcuts.playPause': 'Play / pause', 'shortcuts.next': 'Next track', 'shortcuts.prev': 'Previous track',
        'shortcuts.back': 'Rewind 5 s', 'shortcuts.forward': 'Forward 5 s',
        'shortcuts.volUp': 'Volume up', 'shortcuts.volDown': 'Volume down', 'shortcuts.mute': 'Mute',
        'shortcuts.favorites': 'Favorites', 'shortcuts.open': 'Open keyboard shortcuts',
        'music.status.custom': 'Your own color palette is active.', 'music.status.pick': 'Pick a song to use music-based colors.',
        'music.status.coverFallback': "Without a cover, or if it can't be read, the per-song palette is used.",
        'music.status.song': 'The palette based on the song title and artist is active.',
        'music.status.cover': 'A palette matching the cover is active.',
        'color.bgMain': 'Page background', 'color.bgHeader': 'Header', 'color.bgCard': 'Cards',
        'color.bgCardHover': 'Card highlight', 'color.bgElement': 'Element background', 'color.bgElementHover': 'Element highlight',
        'color.accent': 'Primary accent', 'color.accentHover': 'Button highlight', 'color.accent2': 'Secondary accent',
        'color.text': 'Primary text', 'color.text2': 'Secondary text', 'color.muted': 'Muted text',
        'color.slider': 'Slider track', 'color.danger': 'Favorites and delete', 'color.dangerHover': 'Delete highlight',
        'color.onAccent': 'Text on accent'
    }
};

let currentLanguage = DEFAULT_LANGUAGE;
try {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (stored && TRANSLATIONS[stored]) currentLanguage = stored;
} catch { /* alapnyelv */ }

function getLanguage() { return currentLanguage; }

/** Szöveg lekérése kulcs alapján. {név} helyőrzők és count alapú többesszám (_one / _other) támogatott. */
function t(key, params = {}) {
    const dict = TRANSLATIONS[currentLanguage] || {};
    const fallback = TRANSLATIONS[DEFAULT_LANGUAGE];
    let template;
    if (typeof params.count === 'number') {
        const suffix = params.count === 1 ? '_one' : '_other';
        template = dict[key + suffix] ?? dict[key];
    }
    template = template ?? dict[key] ?? fallback[key] ?? key;
    return template.replace(/\{(\w+)\}/g, (match, name) => (params[name] ?? match));
}

/** Elem szövegének beállítása úgy, hogy nyelvváltáskor automatikusan frissüljön. */
function setText(el, key, params) {
    if (!el) return;
    el.dataset.i18n = key;
    if (params) el.dataset.i18nArgs = JSON.stringify(params); else delete el.dataset.i18nArgs;
    el.textContent = t(key, params);
}

/** Fix (nem fordítandó) szöveg beállítása, pl. dalcím. Leveszi a fordítási jelölést az elemről. */
function setPlain(el, text) {
    if (!el) return;
    delete el.dataset.i18n;
    delete el.dataset.i18nArgs;
    el.textContent = text;
}

function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
        let params;
        try { params = el.dataset.i18nArgs ? JSON.parse(el.dataset.i18nArgs) : undefined; } catch { /* nincs paraméter */ }
        el.textContent = t(el.dataset.i18n, params);
    });
    root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll('[data-i18n-attr]').forEach(el => {
        el.dataset.i18nAttr.split(';').forEach(pair => {
            const [attr, key] = pair.split(':');
            if (attr && key) el.setAttribute(attr.trim(), t(key.trim()));
        });
    });
}

function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) return;
    currentLanguage = lang;
    try { localStorage.setItem(LANGUAGE_KEY, lang); } catch { /* nem mentjük */ }
    document.documentElement.lang = lang;
    applyTranslations();
    const select = document.getElementById('language-select');
    if (select && select.value !== lang) select.value = lang;
    document.dispatchEvent(new CustomEvent('musik:languagechange', { detail: lang }));
}

document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('language-select');
    if (select) {
        select.innerHTML = Object.entries(LANGUAGES).map(([code, name]) => `<option value="${code}">${name}</option>`).join('');
        select.addEventListener('change', () => setLanguage(select.value));
    }
    document.documentElement.lang = currentLanguage;
    if (select) select.value = currentLanguage;
    applyTranslations();
});