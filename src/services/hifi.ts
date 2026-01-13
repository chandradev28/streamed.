/**
 * Unified Music Service
 * Supports TIDAL (public APIs) and HiFi (Subsonic) streaming
 */

// ============================================================================
// Configuration
// ============================================================================

// Public TIDAL API endpoints - ALL use LOSSLESS for playback compatibility
// IMPORTANT: HI_RES_LOSSLESS returns DASH manifests (segments, not playable directly)
// LOSSLESS returns direct .flac URLs that react-native-track-player CAN play
const TIDAL_API_ENDPOINTS = [
    // All endpoints request LOSSLESS (16-bit/44.1kHz FLAC with DIRECT playable URLs)
    { name: 'hund', url: 'https://hund.qqdl.site', maxQuality: 'LOSSLESS' },
    { name: 'katze', url: 'https://katze.qqdl.site', maxQuality: 'LOSSLESS' },
    { name: 'maus', url: 'https://maus.qqdl.site', maxQuality: 'LOSSLESS' },
    { name: 'vogel', url: 'https://vogel.qqdl.site', maxQuality: 'LOSSLESS' },
    { name: 'wolf', url: 'https://wolf.qqdl.site', maxQuality: 'LOSSLESS' },
    { name: 'kinoplus', url: 'https://tidal.kinoplus.online', maxQuality: 'LOSSLESS' },
    { name: 'binimum', url: 'https://tidal-api.binimum.org', maxQuality: 'LOSSLESS' },
];

// HiFi server (Subsonic API - credentials from environment)
const HIFI_API_HOST = process.env.EXPO_PUBLIC_HIFI_HOST || '';
const HIFI_CREDENTIALS = {
    username: process.env.EXPO_PUBLIC_HIFI_USERNAME || '',
    password: process.env.EXPO_PUBLIC_HIFI_PASSWORD || ''
};
const API_VERSION = '1.16.1';
const CLIENT_NAME = 'StreamedApp';

// Track last working endpoint for faster retries
let lastWorkingTidalEndpoint: string = TIDAL_API_ENDPOINTS[0].url;
let lastWorkingTidalQuality: string = 'HI_RES_LOSSLESS';

// ============================================================================
// Qobuz API Configuration (24-bit Hi-Res streaming)
// ============================================================================

// Qobuz API endpoints - squid.wtf for search, all 3 for stream fallback
const QOBUZ_API = {
    search: 'https://qobuz.squid.wtf/api/get-music',
    album: 'https://qobuz.squid.wtf/api/get-album',
    playlist: 'https://qobuz.squid.wtf/api/get-playlist',
    // Stream endpoints with fallback (all return direct 24-bit FLAC URLs)
    stream: [
        { name: 'squid', url: 'https://qobuz.squid.wtf/api/download-music', paramName: 'track_id' },
        { name: 'dab', url: 'https://dab.yeet.su/api/stream', paramName: 'trackId', quality: '7' },
        { name: 'dabmusic', url: 'https://dabmusic.xyz/api/stream', paramName: 'trackId', quality: '7' },
    ],
};

let lastWorkingQobuzStream = 0; // Index of last working stream endpoint

// ============================================================================
// Types
// ============================================================================

export interface HiFiCredentials {
    username: string;
    password: string;
}

export interface HiFiSong {
    id: string;
    title: string;
    album: string;
    albumId: string;
    artist: string;
    artistId: string;
    duration: number;
    track?: number;
    year?: number;
    genre?: string;
    size: number;
    suffix: string;
    bitRate?: number;
    contentType: string;
    coverArt?: string;
    path?: string;
    source?: 'tidal' | 'hifi' | 'qobuz';
}

export interface HiFiAlbum {
    id: string;
    name: string;
    artist: string;
    artistId: string;
    coverArt?: string;
    songCount: number;
    duration: number;
    year?: number;
}

export interface HiFiArtist {
    id: string;
    name: string;
    albumCount?: number;
    coverArt?: string;
}

export interface HiFiSearchResult {
    artist?: HiFiArtist[];
    album?: HiFiAlbum[];
    song?: HiFiSong[];
}

export interface HiFiAlbumDetails extends HiFiAlbum {
    song: HiFiSong[];
}

export interface HiFiArtistDetails extends HiFiArtist {
    album?: HiFiAlbum[];
}

// Unified types for UI
export interface MusicTrack {
    id: string;
    title: string;
    artist: string;
    artistId: string;
    album: string;
    albumId: string;
    duration: number;
    coverArt: string | null;
    quality: string;
    trackNumber?: number;
    year?: number;
    suffix?: string;
    source: 'tidal' | 'hifi' | 'qobuz';
}

export interface MusicAlbum {
    id: string;
    name: string;
    artist: string;
    artistId: string;
    coverArt: string | null;
    year?: number;
    trackCount?: number;
    source: 'tidal' | 'hifi' | 'qobuz';
}

export interface MusicArtist {
    id: string;
    name: string;
    picture: string | null;
    source: 'tidal' | 'hifi' | 'qobuz';
}

export interface MusicPlaylist {
    id: string;
    name: string;
    description?: string;
    coverArt: string | null;
    trackCount: number;
    creator?: string;
    source: 'tidal' | 'hifi' | 'qobuz';
}

export interface MusicSearchResult {
    tracks: MusicTrack[];
    albums: MusicAlbum[];
    artists: MusicArtist[];
    playlists: MusicPlaylist[];
    source: string;
}

// ============================================================================
// Auth Helpers
// ============================================================================

function buildHiFiAuthParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.set('u', HIFI_CREDENTIALS.username);
    params.set('p', HIFI_CREDENTIALS.password);
    params.set('v', API_VERSION);
    params.set('c', CLIENT_NAME);
    params.set('f', 'json');
    return params;
}

// ============================================================================
// Cover Art URL Helpers
// ============================================================================

/**
 * Get TIDAL cover art URL
 */
function getTidalCoverUrl(coverId: string | undefined | null, size: number = 320): string | null {
    if (!coverId) return null;
    const formatted = coverId.replace(/-/g, '/');
    return `https://resources.tidal.com/images/${formatted}/${size}x${size}.jpg`;
}

/**
 * Get HiFi cover art URL
 */
export function getCoverArtUrl(coverArt: string | undefined | null, size: number = 300): string | null {
    if (!coverArt) return null;
    const params = buildHiFiAuthParams();
    params.set('id', coverArt);
    params.set('size', size.toString());
    return `${HIFI_API_HOST}/rest/getCoverArt?${params.toString()}`;
}

// ============================================================================
// TIDAL Search
// ============================================================================

async function searchTidal(query: string): Promise<MusicSearchResult | null> {
    console.log('[TIDAL] Searching for:', query);

    const endpoints = [lastWorkingTidalEndpoint, ...TIDAL_API_ENDPOINTS.map(e => e.url)];
    const uniqueEndpoints = [...new Set(endpoints)];

    for (const endpoint of uniqueEndpoints) {
        try {
            // Fetch tracks, albums, artists, and playlists in parallel
            const [tracksResponse, albumsResponse, artistsResponse, playlistsResponse] = await Promise.all([
                fetch(`${endpoint}/search/?s=${encodeURIComponent(query)}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                }),
                fetch(`${endpoint}/search/?al=${encodeURIComponent(query)}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                }),
                fetch(`${endpoint}/search/?a=${encodeURIComponent(query)}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                }),
                fetch(`${endpoint}/search/?p=${encodeURIComponent(query)}`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                }),
            ]);

            if (!tracksResponse.ok) continue;

            const tracksData = await tracksResponse.json();
            const trackItems = tracksData?.data?.items || tracksData?.items || [];

            if (trackItems.length === 0) continue;

            lastWorkingTidalEndpoint = endpoint;
            console.log(`[TIDAL] Found ${trackItems.length} tracks from ${endpoint}`);

            // Parse tracks
            const tracks: MusicTrack[] = trackItems.map((track: any) => ({
                id: String(track.id),
                title: track.title || 'Unknown',
                artist: track.artist?.name || track.artists?.[0]?.name || 'Unknown Artist',
                artistId: String(track.artist?.id || track.artists?.[0]?.id || ''),
                album: track.album?.title || 'Unknown Album',
                albumId: String(track.album?.id || ''),
                duration: track.duration || 0,
                coverArt: getTidalCoverUrl(track.album?.cover, 320),
                quality: track.audioQuality || 'LOSSLESS',
                trackNumber: track.trackNumber,
                source: 'tidal' as const,
            }));

            // Parse albums
            let albums: MusicAlbum[] = [];
            try {
                if (albumsResponse.ok) {
                    const albumsData = await albumsResponse.json();
                    const albumItems = albumsData?.data?.albums?.items ||
                        albumsData?.data?.topHits?.filter((h: any) => h.type === 'ALBUMS').map((h: any) => h.value) ||
                        [];
                    albums = albumItems.filter((a: any) => a).map((album: any) => ({
                        id: String(album.id),
                        name: album.title || 'Unknown Album',
                        artist: album.artist?.name || album.artists?.[0]?.name || 'Unknown Artist',
                        artistId: String(album.artist?.id || album.artists?.[0]?.id || ''),
                        coverArt: getTidalCoverUrl(album.cover, 320),
                        year: album.releaseDate ? parseInt(album.releaseDate.substring(0, 4)) : undefined,
                        trackCount: album.numberOfTracks,
                        source: 'tidal' as const,
                    }));
                    console.log(`[TIDAL] Found ${albums.length} albums`);
                }
            } catch (e) {
                console.log('[TIDAL] Failed to parse albums');
            }

            // Parse artists
            let artists: MusicArtist[] = [];
            try {
                if (artistsResponse.ok) {
                    const artistsData = await artistsResponse.json();
                    const artistItems = artistsData?.data?.artists?.items ||
                        artistsData?.data?.topHits?.filter((h: any) => h.type === 'ARTISTS').map((h: any) => h.value) ||
                        [];
                    artists = artistItems.filter((a: any) => a).map((artist: any) => ({
                        id: String(artist.id),
                        name: artist.name || 'Unknown Artist',
                        picture: getTidalCoverUrl(artist.picture, 320),
                        source: 'tidal' as const,
                    }));
                    console.log(`[TIDAL] Found ${artists.length} artists`);
                }
            } catch (e) {
                console.log('[TIDAL] Failed to parse artists');
            }

            // Parse playlists
            let playlists: MusicPlaylist[] = [];
            try {
                if (playlistsResponse.ok) {
                    const playlistsData = await playlistsResponse.json();
                    const playlistItems = playlistsData?.data?.playlists?.items || [];
                    playlists = playlistItems.filter((p: any) => p).map((playlist: any) => ({
                        id: playlist.uuid || String(playlist.id),
                        name: playlist.title || 'Unknown Playlist',
                        description: playlist.description,
                        coverArt: getTidalCoverUrl(playlist.squareImage, 320),
                        trackCount: playlist.numberOfTracks || 0,
                        creator: playlist.creator?.name,
                        source: 'tidal' as const,
                    }));
                    console.log(`[TIDAL] Found ${playlists.length} playlists`);
                }
            } catch (e) {
                console.log('[TIDAL] Failed to parse playlists');
            }

            return { tracks, albums, artists, playlists, source: 'tidal' };
        } catch (error) {
            console.log(`[TIDAL] Search failed for ${endpoint}`);
        }
    }

    return null;
}


// ============================================================================
// TIDAL Stream URL
// ============================================================================

/**
 * Get TIDAL stream URL - prioritizes highest quality endpoints
 * Tries HI_RES_LOSSLESS first (24-bit Master), falls back to LOSSLESS (16-bit CD)
 * Each endpoint has 8 second timeout to prevent hanging
 */
export async function getTidalStreamUrl(trackId: string): Promise<string | null> {
    console.log('[TIDAL] Getting stream URL for track:', trackId);

    // Build endpoint list: last working first, then all endpoints in order
    const allEndpoints = TIDAL_API_ENDPOINTS.map(e => ({ url: e.url, quality: e.maxQuality }));

    // If last working endpoint is HI_RES capable, try it first
    const lastWorkingConfig = TIDAL_API_ENDPOINTS.find(e => e.url === lastWorkingTidalEndpoint);
    const orderedEndpoints: { url: string; quality: string }[] = [];

    if (lastWorkingConfig) {
        orderedEndpoints.push({ url: lastWorkingConfig.url, quality: lastWorkingConfig.maxQuality });
    }

    // Add remaining endpoints (HI_RES first, then LOSSLESS)
    for (const ep of allEndpoints) {
        if (!orderedEndpoints.find(e => e.url === ep.url)) {
            orderedEndpoints.push(ep);
        }
    }

    for (const endpoint of orderedEndpoints) {
        try {
            // Use the endpoint's max supported quality
            const requestedQuality = endpoint.quality;
            console.log(`[TIDAL] Trying ${endpoint.url} with quality=${requestedQuality}`);

            // Add 8 second timeout using AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(`${endpoint.url}/track/?id=${trackId}&quality=${requestedQuality}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.log(`[TIDAL] ${endpoint.url} returned ${response.status}`);
                continue;
            }

            const data = await response.json();
            const trackData = data?.data || data;

            if (!trackData?.manifest) {
                console.log(`[TIDAL] ${endpoint.url} - no manifest in response`);
                continue;
            }

            // Decode base64 manifest
            const manifestContent = atob(trackData.manifest);
            const audioQuality = trackData.audioQuality || requestedQuality;
            console.log('[TIDAL] Got response - Quality:', audioQuality, 'Manifest type:', trackData.manifestMimeType);

            // Check if it's JSON format (vnd.tidal.bts) with direct URLs
            if (trackData.manifestMimeType === 'application/vnd.tidal.bts' ||
                manifestContent.startsWith('{')) {
                try {
                    const manifestJson = JSON.parse(manifestContent);
                    if (manifestJson.urls && manifestJson.urls.length > 0) {
                        const streamUrl = manifestJson.urls[0];
                        lastWorkingTidalEndpoint = endpoint.url;
                        lastWorkingTidalQuality = audioQuality;
                        console.log(`[TIDAL] ✓ Got ${audioQuality} stream from ${endpoint.url}`);
                        return streamUrl;
                    }
                } catch (e) {
                    console.log('[TIDAL] Failed to parse JSON manifest');
                }
            }

            // Handle DASH manifest (HI_RES_LOSSLESS format)
            if (trackData.manifestMimeType === 'application/dash+xml' ||
                manifestContent.includes('<MPD')) {
                console.log('[TIDAL] Parsing DASH manifest...');

                // The initialization URL in the SegmentTemplate is the full audio file
                // Format: initialization="https://sp-ad-cf.audio.tidal.com/.../0.mp4?..."
                const initMatch = manifestContent.match(/initialization="([^"]+)"/);
                if (initMatch && initMatch[1]) {
                    let streamUrl = initMatch[1]
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>');

                    if (streamUrl.startsWith('http')) {
                        lastWorkingTidalEndpoint = endpoint.url;
                        lastWorkingTidalQuality = audioQuality;
                        console.log(`[TIDAL] ✓ Got DASH ${audioQuality} init stream from ${endpoint.url}`);
                        return streamUrl;
                    }
                }

                // Try media template URL (segments)
                const mediaMatch = manifestContent.match(/media="([^"]+)"/);
                if (mediaMatch && mediaMatch[1]) {
                    let mediaUrl = mediaMatch[1]
                        .replace(/&amp;/g, '&')
                        .replace(/\$Number\$/g, '1'); // Get first segment

                    if (mediaUrl.startsWith('http')) {
                        lastWorkingTidalEndpoint = endpoint.url;
                        lastWorkingTidalQuality = audioQuality;
                        console.log(`[TIDAL] ✓ Got DASH ${audioQuality} media segment from ${endpoint.url}`);
                        return mediaUrl;
                    }
                }

                // Last resort: find any HTTPS URL ending in .mp4 or .flac
                const urlMatch = manifestContent.match(/https:\/\/[^"<\s]+\.(mp4|flac)[^"<\s]*/);
                if (urlMatch) {
                    const streamUrl = urlMatch[0].replace(/&amp;/g, '&');
                    lastWorkingTidalEndpoint = endpoint.url;
                    lastWorkingTidalQuality = audioQuality;
                    console.log(`[TIDAL] ✓ Got CDN ${audioQuality} stream`);
                    return streamUrl;
                }

                console.log('[TIDAL] DASH manifest parsing failed, will try next endpoint or fallback to LOSSLESS');
            }

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log(`[TIDAL] ${endpoint.url} timed out (8s)`);
            } else {
                console.log(`[TIDAL] Stream fetch failed for ${endpoint.url}:`, error.message || error);
            }
        }
    }

    // Fallback: Try LOSSLESS quality on first available endpoint (returns direct URLs)
    console.log('[TIDAL] HI_RES failed, trying LOSSLESS fallback...');
    for (const endpoint of TIDAL_API_ENDPOINTS) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(`${endpoint.url}/track/?id=${trackId}&quality=LOSSLESS`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) continue;

            const data = await response.json();
            const trackData = data?.data || data;

            if (!trackData?.manifest) continue;

            const manifestContent = atob(trackData.manifest);

            // LOSSLESS returns JSON with direct URLs
            if (trackData.manifestMimeType === 'application/vnd.tidal.bts' ||
                manifestContent.startsWith('{')) {
                try {
                    const manifestJson = JSON.parse(manifestContent);
                    if (manifestJson.urls && manifestJson.urls.length > 0) {
                        lastWorkingTidalEndpoint = endpoint.url;
                        lastWorkingTidalQuality = 'LOSSLESS';
                        console.log(`[TIDAL] ✓ Got LOSSLESS fallback stream from ${endpoint.url}`);
                        return manifestJson.urls[0];
                    }
                } catch (e) {
                    // Continue to next endpoint
                }
            }
        } catch (error) {
            // Continue to next endpoint
        }
    }

    console.error('[TIDAL] ✗ Could not get stream URL for track:', trackId);
    return null;
}


// ============================================================================
// HiFi Search
// ============================================================================

async function searchHiFi(query: string): Promise<MusicSearchResult | null> {
    console.log('[HiFi] Searching for:', query);

    try {
        const params = buildHiFiAuthParams();
        params.set('query', query);
        params.set('songCount', '50');
        params.set('albumCount', '20');
        params.set('artistCount', '20');

        const response = await fetch(`${HIFI_API_HOST}/rest/search3?${params.toString()}`);
        if (!response.ok) return null;

        const data = await response.json();
        const result = data['subsonic-response'];
        if (result?.status === 'failed') return null;

        const searchResult: HiFiSearchResult = result?.searchResult3 || {};

        const tracks: MusicTrack[] = (searchResult.song || []).map((song: HiFiSong) => ({
            id: song.id,
            title: song.title,
            artist: song.artist,
            artistId: song.artistId,
            album: song.album,
            albumId: song.albumId,
            duration: song.duration,
            coverArt: getCoverArtUrl(song.coverArt),
            quality: song.suffix?.toUpperCase() || 'FLAC',
            trackNumber: song.track,
            year: song.year,
            suffix: song.suffix,
            source: 'hifi' as const,
        }));

        const albums: MusicAlbum[] = (searchResult.album || []).map((album: HiFiAlbum) => ({
            id: album.id,
            name: album.name,
            artist: album.artist,
            artistId: album.artistId,
            coverArt: getCoverArtUrl(album.coverArt),
            year: album.year,
            trackCount: album.songCount,
            source: 'hifi' as const,
        }));

        const artists: MusicArtist[] = (searchResult.artist || []).map((artist: HiFiArtist) => ({
            id: artist.id,
            name: artist.name,
            picture: getCoverArtUrl(artist.coverArt),
            source: 'hifi' as const,
        }));

        console.log(`[HiFi] Found ${tracks.length} tracks`);
        // HiFi/Subsonic doesn't support playlist search, return empty array
        return { tracks, albums, artists, playlists: [], source: 'hifi' };
    } catch (error: any) {
        console.error('[HiFi] Search error:', error.message);
        return null;
    }
}

// ============================================================================
// Main Search Function
// ============================================================================

/**
 * Search for music - tries HiFi first (FLAC quality), falls back to TIDAL
 */
export async function search(query: string): Promise<MusicSearchResult | null> {
    if (!query.trim()) return null;

    // Try HiFi first (your server - FLAC quality)
    const hifiResult = await searchHiFi(query);
    if (hifiResult && hifiResult.tracks.length > 0) {
        return hifiResult;
    }

    // Fallback to TIDAL (public APIs)
    console.log('[Music] HiFi has no results, trying TIDAL...');
    return await searchTidal(query);
}

/**
 * Search HiFi server only (no TIDAL fallback)
 * Use when user explicitly selects HiFi source
 */
export async function searchHiFiOnly(query: string): Promise<MusicSearchResult | null> {
    if (!query.trim()) return null;
    console.log('[Music] Searching HiFi only (user preference)');
    return await searchHiFi(query);
}

/**
 * Search TIDAL only (skip HiFi)
 * Use when user explicitly selects TIDAL source
 */
export async function searchTidalOnly(query: string): Promise<MusicSearchResult | null> {
    if (!query.trim()) return null;
    console.log('[Music] Searching TIDAL only (user preference)');
    return await searchTidal(query);
}

// ============================================================================
// Stream URL Functions
// ============================================================================

/**
 * Get HiFi stream URL (sync - for HiFi tracks only)
 */
export function getStreamUrl(songId: string): string {
    const params = buildHiFiAuthParams();
    params.set('id', songId);
    return `${HIFI_API_HOST}/rest/stream?${params.toString()}`;
}

// Alias for compatibility
export const getHiFiStreamUrl = getStreamUrl;

// ============================================================================
// Album & Artist Details (HiFi only)
// ============================================================================

export async function getAlbum(albumId: string): Promise<HiFiAlbumDetails | null> {
    const params = buildHiFiAuthParams();
    params.set('id', albumId);

    try {
        const response = await fetch(`${HIFI_API_HOST}/rest/getAlbum?${params.toString()}`);
        if (!response.ok) return null;

        const data = await response.json();
        const result = data['subsonic-response'];
        if (result?.status === 'failed') return null;

        const albumData = result?.album || null;

        // Transform song cover art UUIDs to full URLs
        if (albumData?.song) {
            albumData.song = albumData.song.map((song: any) => ({
                ...song,
                coverArt: getCoverArtUrl(song.coverArt),
            }));
        }

        // Also transform album's own cover art
        if (albumData?.coverArt && typeof albumData.coverArt === 'string' && !albumData.coverArt.startsWith('http')) {
            albumData.coverArt = getCoverArtUrl(albumData.coverArt);
        }

        return albumData;
    } catch (error) {
        console.error('[HiFi] getAlbum error:', error);
        return null;
    }
}

export async function getArtist(artistId: string): Promise<HiFiArtistDetails | null> {
    const params = buildHiFiAuthParams();
    params.set('id', artistId);

    try {
        const response = await fetch(`${HIFI_API_HOST}/rest/getArtist?${params.toString()}`);
        if (!response.ok) return null;

        const data = await response.json();
        const result = data['subsonic-response'];
        if (result?.status === 'failed') return null;

        const artistData = result?.artist || null;

        // Transform album cover art UUIDs to full URLs
        if (artistData?.album) {
            artistData.album = artistData.album.map((album: any) => ({
                ...album,
                coverArt: getCoverArtUrl(album.coverArt),
            }));
        }

        return artistData;
    } catch (error) {
        console.error('[HiFi] getArtist error:', error);
        return null;
    }
}

// ============================================================================
// TIDAL Album & Artist Details
// ============================================================================

/**
 * Get TIDAL album tracks
 */
export async function getTidalAlbum(albumId: string): Promise<HiFiSong[] | null> {
    console.log('[TIDAL] Getting album tracks for:', albumId);

    const endpoints = [lastWorkingTidalEndpoint, ...TIDAL_API_ENDPOINTS.map(e => e.url)];
    const uniqueEndpoints = [...new Set(endpoints)];

    for (const endpoint of uniqueEndpoints) {
        try {
            const response = await fetch(`${endpoint}/album/?id=${albumId}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) continue;

            const data = await response.json();
            const items = data?.data?.items || data?.items || [];

            if (items.length === 0) continue;

            lastWorkingTidalEndpoint = endpoint;
            console.log(`[TIDAL] Found ${items.length} tracks in album`);

            // Get album cover from the response (might be at data level)
            const albumCover = data?.data?.cover || data?.cover;
            const albumCoverUrl = getTidalCoverUrl(albumCover, 640);
            console.log('[TIDAL] Album cover ID:', albumCover, 'URL:', albumCoverUrl?.substring(0, 60));

            const tracks: HiFiSong[] = items.map((item: any) => {
                const track = item.item || item;
                // Use album's cover if track doesn't have one
                const trackCover = track.album?.cover || albumCover;
                return {
                    id: String(track.id),
                    title: track.title || 'Unknown',
                    album: '',
                    albumId: albumId,
                    artist: track.artist?.name || track.artists?.[0]?.name || 'Unknown Artist',
                    artistId: String(track.artist?.id || track.artists?.[0]?.id || ''),
                    duration: track.duration || 0,
                    track: track.trackNumber,
                    size: 0,
                    suffix: 'FLAC',
                    contentType: 'audio/flac',
                    coverArt: getTidalCoverUrl(trackCover, 640) || undefined,
                    source: 'tidal' as const,
                };
            });

            return tracks;
        } catch (error) {
            console.log(`[TIDAL] Album fetch failed for ${endpoint}`);
        }
    }

    return null;
}


/**
 * Get TIDAL artist top tracks (search for artist name)
 */
export async function getTidalArtistTopTracks(artistName: string): Promise<HiFiSong[] | null> {
    console.log('[TIDAL] Getting top tracks for artist:', artistName);

    const endpoints = [lastWorkingTidalEndpoint, ...TIDAL_API_ENDPOINTS.map(e => e.url)];
    const uniqueEndpoints = [...new Set(endpoints)];

    for (const endpoint of uniqueEndpoints) {
        try {
            const response = await fetch(`${endpoint}/search/?s=${encodeURIComponent(artistName)}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) continue;

            const data = await response.json();
            const items = data?.data?.items || data?.items || [];

            if (items.length === 0) continue;

            lastWorkingTidalEndpoint = endpoint;

            // Filter tracks by this artist
            const tracks: HiFiSong[] = items
                .filter((track: any) => {
                    const trackArtist = track.artist?.name || track.artists?.[0]?.name || '';
                    return trackArtist.toLowerCase().includes(artistName.toLowerCase());
                })
                .slice(0, 20) // Top 20 tracks
                .map((track: any) => ({
                    id: String(track.id),
                    title: track.title || 'Unknown',
                    album: track.album?.title || 'Unknown Album',
                    albumId: String(track.album?.id || ''),
                    artist: track.artist?.name || track.artists?.[0]?.name || 'Unknown Artist',
                    artistId: String(track.artist?.id || track.artists?.[0]?.id || ''),
                    duration: track.duration || 0,
                    size: 0,
                    suffix: 'AAC',
                    contentType: 'audio/mp4',
                    coverArt: getTidalCoverUrl(track.album?.cover, 320) || undefined,
                    source: 'tidal' as const,
                }));

            console.log(`[TIDAL] Found ${tracks.length} tracks for artist`);
            return tracks;
        } catch (error) {
            console.log(`[TIDAL] Artist tracks fetch failed for ${endpoint}`);
        }
    }

    return null;
}

/**
 * Get album tracks - works with TIDAL, HiFi, and Qobuz sources
 */
export async function getAlbumTracks(albumId: string, source: 'tidal' | 'hifi' | 'qobuz'): Promise<HiFiSong[] | null> {
    if (source === 'tidal') {
        return await getTidalAlbum(albumId);
    } else if (source === 'qobuz') {
        // Convert MusicTrack[] to HiFiSong[]
        const qobuzTracks = await getQobuzAlbum(albumId);
        if (!qobuzTracks) return null;
        return qobuzTracks.map(track => ({
            id: track.id,
            title: track.title,
            artist: track.artist,
            artistId: track.artistId,
            album: track.album,
            albumId: track.albumId,
            duration: track.duration,
            coverArt: track.coverArt || undefined,
            size: 0,
            suffix: 'flac',
            contentType: 'audio/flac',
            source: 'qobuz' as const,
        }));
    } else {
        const album = await getAlbum(albumId);
        return album?.song || null;
    }
}

/**
 * Get artist top tracks - works with TIDAL, HiFi, and Qobuz sources
 */
export async function getArtistTopTracks(artistId: string, artistName: string, source: 'tidal' | 'hifi' | 'qobuz'): Promise<HiFiSong[] | null> {
    if (source === 'tidal') {
        return await getTidalArtistTopTracks(artistName);
    } else if (source === 'qobuz') {
        // Search for artist's tracks on Qobuz
        return await getQobuzArtistTopTracks(artistName);
    } else {
        const artist = await getArtist(artistId);
        // HiFi doesn't return top tracks, return null
        return null;
    }
}

/**
 * Get Qobuz artist top tracks by searching for artist name
 */
export async function getQobuzArtistTopTracks(artistName: string): Promise<HiFiSong[] | null> {
    console.log('[Qobuz] Getting top tracks for artist:', artistName);

    try {
        // Search for the artist's tracks
        const searchResult = await searchQobuz(artistName);
        if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
            console.log('[Qobuz] No tracks found for artist:', artistName);
            return null;
        }

        // Filter tracks by the artist name and convert to HiFiSong[]
        const artistTracks = searchResult.tracks
            .filter(track => track.artist.toLowerCase().includes(artistName.toLowerCase()))
            .slice(0, 20) // Limit to top 20 tracks
            .map(track => ({
                id: track.id,
                title: track.title,
                artist: track.artist,
                artistId: track.artistId,
                album: track.album,
                albumId: track.albumId,
                duration: track.duration,
                coverArt: track.coverArt || undefined,
                size: 0,
                suffix: 'flac',
                contentType: 'audio/flac',
                source: 'qobuz' as const,
            }));

        console.log(`[Qobuz] Found ${artistTracks.length} tracks for artist:`, artistName);
        return artistTracks.length > 0 ? artistTracks : null;
    } catch (error: any) {
        console.error('[Qobuz] Error getting artist tracks:', error.message);
        return null;
    }
}

/**
 * Get playlist tracks - supports TIDAL and Qobuz
 */
export async function getPlaylistTracks(playlistId: string, source: 'tidal' | 'qobuz' = 'tidal', playlistName?: string): Promise<MusicTrack[]> {
    if (source === 'qobuz') {
        return await getQobuzPlaylistTracks(playlistId, playlistName);
    }

    console.log('[TIDAL] Getting playlist tracks for:', playlistId);

    const endpoints = [lastWorkingTidalEndpoint, ...TIDAL_API_ENDPOINTS.map(e => e.url)];
    const uniqueEndpoints = [...new Set(endpoints)];

    for (const endpoint of uniqueEndpoints) {
        try {
            const response = await fetch(`${endpoint}/playlist/?id=${encodeURIComponent(playlistId)}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) continue;

            const data = await response.json();
            // API returns items as array with nested .item property
            const items = data?.items || [];

            if (items.length === 0) continue;

            lastWorkingTidalEndpoint = endpoint;
            console.log(`[TIDAL] Found ${items.length} tracks in playlist`);

            return items
                .filter((item: any) => item?.item && item.type === 'track')
                .map((item: any) => {
                    const track = item.item;
                    return {
                        id: String(track.id),
                        title: track.title || 'Unknown',
                        artist: track.artist?.name || track.artists?.[0]?.name || 'Unknown Artist',
                        artistId: String(track.artist?.id || track.artists?.[0]?.id || ''),
                        album: track.album?.title || 'Unknown Album',
                        albumId: String(track.album?.id || ''),
                        duration: track.duration || 0,
                        coverArt: getTidalCoverUrl(track.album?.cover, 320),
                        quality: track.audioQuality || 'LOSSLESS',
                        trackNumber: track.trackNumber,
                        source: 'tidal' as const,
                    };
                });
        } catch (error) {
            console.log(`[TIDAL] Failed to get playlist from ${endpoint}`, error);
        }
    }

    return [];
}

/**
 * Get Qobuz playlist tracks with pagination support
 * Fetches all tracks by making multiple requests with offset pagination
 */
export async function getQobuzPlaylistTracks(playlistId: string, playlistName?: string): Promise<MusicTrack[]> {
    console.log('[Qobuz] Getting playlist tracks for:', playlistId, 'name:', playlistName);

    const allTracks: MusicTrack[] = [];
    const limit = 100; // Max tracks per request
    let offset = 0;
    let totalTracks = 0;
    let hasMore = true;

    try {
        while (hasMore) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            // Use pagination parameters
            const url = `${QOBUZ_API.playlist}?playlist_id=${encodeURIComponent(playlistId)}&limit=${limit}&offset=${offset}`;
            console.log(`[Qobuz] Fetching playlist page: offset=${offset}, limit=${limit}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.log('[Qobuz] Playlist fetch failed:', response.status);
                // Fall back to search if we have playlist name and no tracks yet
                if (allTracks.length === 0 && playlistName) {
                    console.log('[Qobuz] Falling back to search:', playlistName);
                    return await getQobuzPlaylistBySearch(playlistName);
                }
                break;
            }

            const data = await response.json();

            // Get total count from response if available
            const tracksContainer = data?.data?.tracks || data?.tracks || data?.data || data;
            if (offset === 0) {
                totalTracks = tracksContainer?.total || tracksContainer?.tracks_count || 0;
                console.log(`[Qobuz] Playlist has ${totalTracks} total tracks`);
            }

            // Handle different response structures - try all possible paths
            let tracks: any[] = [];

            // Path 1: data.data.tracks.items
            if (data?.data?.tracks?.items?.length > 0) {
                tracks = data.data.tracks.items;
            }
            // Path 2: data.tracks.items
            else if (data?.tracks?.items?.length > 0) {
                tracks = data.tracks.items;
            }
            // Path 3: data.data.tracks
            else if (data?.data?.tracks?.length > 0 && !data.data.tracks.items) {
                tracks = data.data.tracks;
            }
            // Path 4: data.tracks
            else if (data?.tracks?.length > 0 && !data.tracks.items) {
                tracks = data.tracks;
            }
            // Path 5: data.data.items
            else if (data?.data?.items?.length > 0) {
                tracks = data.data.items;
            }
            // Path 6: data.items
            else if (data?.items?.length > 0) {
                tracks = data.items;
            }
            // Path 7: data itself is array
            else if (Array.isArray(data) && data.length > 0) {
                tracks = data;
            }

            if (tracks.length === 0) {
                console.log('[Qobuz] No more tracks found at offset:', offset);
                hasMore = false;
                break;
            }

            console.log(`[Qobuz] Got ${tracks.length} tracks at offset ${offset}`);

            // Parse and add tracks
            const parsedTracks = tracks.map((item: any) => {
                const track = item.item || item.track || item;
                return {
                    id: String(track.id),
                    title: track.title || 'Unknown',
                    artist: track.performer?.name || track.artist?.name || track.composer?.name || 'Unknown Artist',
                    artistId: String(track.performer?.id || track.artist?.id || ''),
                    album: track.album?.title || 'Unknown Album',
                    albumId: String(track.album?.id || ''),
                    duration: track.duration || 0,
                    coverArt: getQobuzCoverUrl(track.album?.image || track.image),
                    quality: (track.maximum_bit_depth || 0) >= 24 ? '24-bit Hi-Res' : 'LOSSLESS',
                    trackNumber: track.track_number,
                    source: 'qobuz' as const,
                };
            });

            allTracks.push(...parsedTracks);
            offset += limit;

            // Check if we have all tracks
            if (totalTracks > 0 && allTracks.length >= totalTracks) {
                hasMore = false;
            } else if (tracks.length < limit) {
                // If we got less than requested, there are no more tracks
                hasMore = false;
            }

            // Safety limit to prevent infinite loops (max 1000 tracks)
            if (allTracks.length >= 1000) {
                console.log('[Qobuz] Reached max track limit (1000)');
                hasMore = false;
            }
        }

        if (allTracks.length === 0 && playlistName) {
            console.log('[Qobuz] No tracks found, trying search fallback');
            return await getQobuzPlaylistBySearch(playlistName);
        }

        console.log(`[Qobuz] ✓ Loaded ${allTracks.length} total tracks from playlist`);
        return allTracks;
    } catch (error: any) {
        console.error('[Qobuz] Playlist fetch error:', error.message);
        // Fall back to search if we have playlist name and no tracks yet
        if (allTracks.length === 0 && playlistName) {
            console.log('[Qobuz] Error occurred, falling back to search:', playlistName);
            return await getQobuzPlaylistBySearch(playlistName);
        }
        return allTracks;
    }
}

/**
 * Fallback: Get Qobuz playlist tracks by searching for the playlist name
 */
async function getQobuzPlaylistBySearch(playlistName: string): Promise<MusicTrack[]> {
    console.log('[Qobuz] Searching for playlist tracks:', playlistName);

    try {
        const searchResult = await searchQobuz(playlistName);
        if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
            console.log('[Qobuz] No tracks found in search for:', playlistName);
            return [];
        }

        console.log(`[Qobuz] Found ${searchResult.tracks.length} tracks via search for:`, playlistName);
        return searchResult.tracks;
    } catch (error: any) {
        console.error('[Qobuz] Search fallback failed:', error.message);
        return [];
    }
}

// ============================================================================
// Connection Test
// ============================================================================

export async function testCredentials(): Promise<boolean> {
    try {
        const params = buildHiFiAuthParams();
        const response = await fetch(`${HIFI_API_HOST}/rest/ping?${params.toString()}`);
        if (!response.ok) return false;
        const data = await response.json();
        return data['subsonic-response']?.status === 'ok';
    } catch {
        return false;
    }
}

export async function ping(): Promise<boolean> {
    return testCredentials();
}

// Re-export for compatibility
export type { HiFiSearchResult as SearchResult };

// ============================================================================
// Qobuz API Functions (24-bit Hi-Res Streaming)
// ============================================================================

/**
 * Get Qobuz cover art URL from image object
 */
function getQobuzCoverUrl(image: any): string | null {
    if (!image) return null;
    return image.large || image.small || image.thumbnail || null;
}

/**
 * Search Qobuz for tracks, albums, artists, playlists
 * Uses pagination to get more results (API returns ~10 per request)
 */
export async function searchQobuz(query: string): Promise<MusicSearchResult | null> {
    console.log('[Qobuz] Searching for:', query);

    const allTracks: MusicTrack[] = [];
    const allAlbums: MusicAlbum[] = [];
    const allArtists: MusicArtist[] = [];
    const allPlaylists: MusicPlaylist[] = [];

    // Fetch 5 pages (API returns ~10 per page = ~50 results per category)
    const maxPages = 5;
    const pageSize = 10; // API seems to return 10 per page

    try {
        for (let page = 0; page < maxPages; page++) {
            const offset = page * pageSize;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${QOBUZ_API.search}?q=${encodeURIComponent(query)}&offset=${offset}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.log('[Qobuz] Search page', page, 'failed:', response.status);
                break;
            }

            const data = await response.json();
            const searchData = data?.data || data;

            // Parse tracks
            const trackItems = searchData?.tracks?.items || [];
            const pageTracks: MusicTrack[] = trackItems.map((track: any) => ({
                id: String(track.id),
                title: track.title || 'Unknown',
                artist: track.performer?.name || 'Unknown Artist',
                artistId: String(track.performer?.id || ''),
                album: track.album?.title || 'Unknown Album',
                albumId: track.album?.id || '',
                duration: track.duration || 0,
                coverArt: getQobuzCoverUrl(track.album?.image),
                quality: track.maximum_bit_depth >= 24 ? '24-bit Hi-Res' : 'LOSSLESS',
                trackNumber: track.track_number,
                year: track.release_date_original ? parseInt(track.release_date_original.substring(0, 4)) : undefined,
                source: 'qobuz' as const,
            }));

            // Parse albums
            const albumItems = searchData?.albums?.items || [];
            const pageAlbums: MusicAlbum[] = albumItems.map((album: any) => ({
                id: album.id || '',
                name: album.title || 'Unknown Album',
                artist: album.artist?.name || 'Unknown Artist',
                artistId: String(album.artist?.id || ''),
                coverArt: getQobuzCoverUrl(album.image),
                year: album.release_date_original ? parseInt(album.release_date_original.substring(0, 4)) : undefined,
                trackCount: album.tracks_count,
                source: 'qobuz' as const,
            }));

            // Parse artists (only on first page, usually no need to paginate)
            if (page === 0) {
                const artistItems = searchData?.artists?.items || [];
                const pageArtists: MusicArtist[] = artistItems.map((artist: any) => ({
                    id: String(artist.id),
                    name: artist.name || 'Unknown Artist',
                    picture: getQobuzCoverUrl(artist.image),
                    source: 'qobuz' as const,
                }));
                allArtists.push(...pageArtists);

                // Parse playlists (only on first page)
                const playlistItems = searchData?.playlists?.items || [];
                const pagePlaylists: MusicPlaylist[] = playlistItems.map((playlist: any) => ({
                    id: String(playlist.id),
                    name: playlist.name || 'Unknown Playlist',
                    description: playlist.description,
                    coverArt: getQobuzCoverUrl(playlist.images?.large || playlist.images),
                    trackCount: playlist.tracks_count || 0,
                    creator: playlist.owner?.name,
                    source: 'qobuz' as const,
                }));
                allPlaylists.push(...pagePlaylists);
            }

            // Dedupe and add to results
            pageTracks.forEach(t => {
                if (!allTracks.find(existing => existing.id === t.id)) {
                    allTracks.push(t);
                }
            });

            pageAlbums.forEach(a => {
                if (!allAlbums.find(existing => existing.id === a.id)) {
                    allAlbums.push(a);
                }
            });

            console.log(`[Qobuz] Page ${page + 1}: got ${pageTracks.length} tracks, ${pageAlbums.length} albums`);

            // If we got fewer results, no need to fetch more pages
            if (trackItems.length === 0 && albumItems.length === 0) {
                break;
            }
        }

        console.log(`[Qobuz] Total: ${allTracks.length} tracks, ${allAlbums.length} albums, ${allArtists.length} artists, ${allPlaylists.length} playlists`);

        return {
            tracks: allTracks,
            albums: allAlbums,
            artists: allArtists,
            playlists: allPlaylists,
            source: 'qobuz'
        };
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log('[Qobuz] Search timed out');
        } else {
            console.error('[Qobuz] Search error:', error.message);
        }

        // Return partial results if we have any
        if (allTracks.length > 0 || allAlbums.length > 0) {
            return {
                tracks: allTracks,
                albums: allAlbums,
                artists: allArtists,
                playlists: allPlaylists,
                source: 'qobuz'
            };
        }
        return null;
    }
}

/**
 * Get Qobuz stream URL with 3-API fallback
 * Returns direct 24-bit FLAC URL
 */
export async function getQobuzStreamUrl(trackId: string): Promise<string | null> {
    console.log('[Qobuz] Getting stream URL for track:', trackId);

    // Build ordered list of endpoints (last working first)
    const endpoints = [
        ...QOBUZ_API.stream.slice(lastWorkingQobuzStream),
        ...QOBUZ_API.stream.slice(0, lastWorkingQobuzStream),
    ];

    for (let i = 0; i < endpoints.length; i++) {
        const endpoint = endpoints[i];
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            // Build URL with correct parameter name
            let url = `${endpoint.url}?${endpoint.paramName}=${trackId}`;
            if (endpoint.quality) {
                url += `&quality=${endpoint.quality}`;
            }

            console.log(`[Qobuz] Trying ${endpoint.name}: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.log(`[Qobuz] ${endpoint.name} returned ${response.status}`);
                continue;
            }

            const data = await response.json();
            const streamUrl = data.url || data.data?.url;

            if (streamUrl) {
                // Update last working endpoint
                const originalIndex = QOBUZ_API.stream.findIndex(e => e.name === endpoint.name);
                if (originalIndex !== -1) {
                    lastWorkingQobuzStream = originalIndex;
                }
                console.log(`[Qobuz] ✓ Got 24-bit stream from ${endpoint.name}`);
                return streamUrl;
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log(`[Qobuz] ${endpoint.name} timed out`);
            } else {
                console.log(`[Qobuz] ${endpoint.name} failed:`, error.message);
            }
        }
    }

    console.error('[Qobuz] ✗ All stream endpoints failed for track:', trackId);
    return null;
}

/**
 * Get Qobuz album tracks
 */
export async function getQobuzAlbum(albumId: string): Promise<MusicTrack[] | null> {
    console.log('[Qobuz] Getting album tracks for:', albumId);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${QOBUZ_API.album}?album_id=${encodeURIComponent(albumId)}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.log('[Qobuz] Album fetch failed:', response.status);
            return null;
        }

        const data = await response.json();
        const albumData = data?.data || data;
        const tracks = albumData?.tracks?.items || [];

        if (tracks.length === 0) {
            console.log('[Qobuz] No tracks in album');
            return null;
        }

        const albumCover = getQobuzCoverUrl(albumData?.image);
        console.log(`[Qobuz] Found ${tracks.length} tracks in album`);

        return tracks.map((track: any) => ({
            id: String(track.id),
            title: track.title || 'Unknown',
            artist: track.performer?.name || albumData?.artist?.name || 'Unknown Artist',
            artistId: String(track.performer?.id || albumData?.artist?.id || ''),
            album: albumData?.title || 'Unknown Album',
            albumId: albumId,
            duration: track.duration || 0,
            coverArt: albumCover,
            quality: track.maximum_bit_depth >= 24 ? '24-bit Hi-Res' : 'LOSSLESS',
            trackNumber: track.track_number,
            source: 'qobuz' as const,
        }));
    } catch (error: any) {
        console.error('[Qobuz] Album fetch error:', error.message);
        return null;
    }
}

/**
 * Search Qobuz only (skip HiFi and TIDAL)
 */
export async function searchQobuzOnly(query: string): Promise<MusicSearchResult | null> {
    if (!query.trim()) return null;
    console.log('[Music] Searching Qobuz only (user preference)');
    return await searchQobuz(query);
}


