/**
 * Playlist Import Service
 * Imports playlists from Spotify, Apple Music, and YouTube Music
 * 
 * Works by:
 * 1. Parsing the share URL to extract playlist ID
 * 2. Fetching playlist metadata and tracks via public APIs
 * 3. Matching tracks to Tidal/Qobuz for playback
 */

import { searchTidalOnly, searchQobuzOnly, MusicTrack } from './hifi';
import { StorageService, UserPlaylist, PlaylistTrack } from './storage';

// ============================================================================
// Types
// ============================================================================

export type ImportPlatform = 'spotify' | 'apple' | 'youtube' | 'unknown';

export interface ImportedTrack {
    title: string;
    artist: string;
    album?: string;
    duration?: number;
}

export interface ImportResult {
    success: boolean;
    playlist?: UserPlaylist;
    totalTracks: number;
    matchedTracks: number;
    unmatchedTracks: ImportedTrack[];
    error?: string;
}

// ============================================================================
// URL Parsing
// ============================================================================

/**
 * Detect platform from URL
 */
export function detectPlatform(url: string): ImportPlatform {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('spotify.com') || lowerUrl.includes('spotify.link')) {
        return 'spotify';
    }
    if (lowerUrl.includes('music.apple.com') || lowerUrl.includes('itunes.apple.com')) {
        return 'apple';
    }
    if (lowerUrl.includes('music.youtube.com') || lowerUrl.includes('youtube.com/playlist')) {
        return 'youtube';
    }
    return 'unknown';
}

/**
 * Parse Spotify playlist URL
 * Formats:
 * - https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
 * - https://spotify.link/abc123
 */
export function parseSpotifyUrl(url: string): string | null {
    // Match playlist ID from open.spotify.com URLs
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    if (match) return match[1];
    return null;
}

/**
 * Parse Apple Music playlist URL
 * Format: https://music.apple.com/us/playlist/playlist-name/pl.abc123
 */
export function parseAppleMusicUrl(url: string): { storefront: string; id: string } | null {
    const match = url.match(/music\.apple\.com\/([a-z]{2})\/playlist\/[^\/]+\/(pl\.[a-zA-Z0-9]+)/);
    if (match) {
        return { storefront: match[1], id: match[2] };
    }
    return null;
}

/**
 * Parse YouTube Music playlist URL
 * Format: https://music.youtube.com/playlist?list=PLxxxxxxx
 */
export function parseYouTubeMusicUrl(url: string): string | null {
    const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return null;
}

// ============================================================================
// Spotify Import (Uses SpotifyDown API)
// ============================================================================

async function fetchSpotifyPlaylist(playlistId: string): Promise<{
    name: string;
    tracks: ImportedTrack[];
} | null> {
    console.log('[Import] Fetching Spotify playlist:', playlistId);

    // Primary: SpotifyDown API (most reliable as of 2024)
    try {
        // First get playlist metadata
        const metaResponse = await fetch(`https://api.spotifydown.com/metadata/playlist/${playlistId}`, {
            headers: {
                'Origin': 'https://spotifydown.com',
                'Referer': 'https://spotifydown.com/',
            },
        });

        if (metaResponse.ok) {
            const metaData = await metaResponse.json();
            console.log('[Import] Spotify metadata:', JSON.stringify(metaData).slice(0, 200));

            if (metaData.success && metaData.trackList && metaData.trackList.length > 0) {
                return {
                    name: metaData.title || 'Spotify Playlist',
                    tracks: metaData.trackList.map((t: any) => ({
                        title: t.title || t.name || '',
                        artist: t.artists || t.artist || '',
                        album: t.album || '',
                        duration: t.durationSec || t.duration || 0,
                    })).filter((t: ImportedTrack) => t.title && t.artist),
                };
            }
        }
    } catch (error) {
        console.warn('[Import] SpotifyDown API failed:', error);
    }

    // Fallback: Try Spotify Scraper API
    try {
        const response = await fetch(`https://spotify-scraper.p.rapidapi.com/v1/playlist/tracks?playlistId=${playlistId}`, {
            headers: {
                'X-RapidAPI-Key': 'demo', // Demo key - may have rate limits
                'X-RapidAPI-Host': 'spotify-scraper.p.rapidapi.com',
            },
        });

        if (response.ok) {
            const data = await response.json();
            if (data.tracks && data.tracks.items && data.tracks.items.length > 0) {
                return {
                    name: data.name || 'Spotify Playlist',
                    tracks: data.tracks.items.map((item: any) => ({
                        title: item.track?.name || item.name || '',
                        artist: item.track?.artists?.[0]?.name || item.artists?.[0]?.name || '',
                        album: item.track?.album?.name || item.album?.name || '',
                        duration: Math.floor((item.track?.duration_ms || item.duration_ms || 0) / 1000),
                    })).filter((t: ImportedTrack) => t.title && t.artist),
                };
            }
        }
    } catch (error) {
        console.warn('[Import] Spotify Scraper API failed:', error);
    }

    // Last resort: Parse Spotify embed page
    try {
        const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
        const response = await fetch(embedUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });

        if (response.ok) {
            const html = await response.text();
            // Try to extract track data from the embed's inline script
            const scriptMatch = html.match(/<script[^>]*>Spotify\s*=\s*(\{.*?\});<\/script>/s);
            if (scriptMatch) {
                try {
                    const data = JSON.parse(scriptMatch[1]);
                    if (data.playlist?.tracks) {
                        return {
                            name: data.playlist.name || 'Spotify Playlist',
                            tracks: data.playlist.tracks.map((t: any) => ({
                                title: t.name || '',
                                artist: t.artists?.[0]?.name || '',
                                album: t.album?.name || '',
                                duration: Math.floor((t.duration_ms || 0) / 1000),
                            })).filter((t: ImportedTrack) => t.title && t.artist),
                        };
                    }
                } catch (e) {
                    console.warn('[Import] Failed to parse embed data');
                }
            }
        }
    } catch (error) {
        console.warn('[Import] Spotify embed parse failed:', error);
    }

    console.error('[Import] All Spotify methods failed for playlist:', playlistId);
    return null;
}

// ============================================================================
// Apple Music Import (Uses public RSS/API)
// ============================================================================

async function fetchAppleMusicPlaylist(storefront: string, playlistId: string): Promise<{
    name: string;
    tracks: ImportedTrack[];
} | null> {
    console.log('[Import] Fetching Apple Music playlist:', playlistId);

    try {
        // Apple Music public embed API
        const response = await fetch(
            `https://music.apple.com/api/v1/catalog/${storefront}/playlists/${playlistId}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Origin': 'https://music.apple.com',
                },
            }
        );

        if (!response.ok) {
            console.error('[Import] Apple Music API failed:', response.status);
            return null;
        }

        const data = await response.json();
        const playlist = data.data?.[0];

        if (!playlist) return null;

        return {
            name: playlist.attributes?.name || 'Apple Music Playlist',
            tracks: (playlist.relationships?.tracks?.data || []).map((t: any) => ({
                title: t.attributes?.name,
                artist: t.attributes?.artistName,
                album: t.attributes?.albumName,
                duration: t.attributes?.durationInMillis
                    ? Math.floor(t.attributes.durationInMillis / 1000)
                    : undefined,
            })),
        };
    } catch (error) {
        console.error('[Import] Apple Music fetch error:', error);
        return null;
    }
}

// ============================================================================
// YouTube Music Import (Uses Invidious API)
// ============================================================================

const INVIDIOUS_INSTANCES = [
    'https://invidious.io.lol',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
];

async function fetchYouTubeMusicPlaylist(playlistId: string): Promise<{
    name: string;
    tracks: ImportedTrack[];
} | null> {
    console.log('[Import] Fetching YouTube Music playlist:', playlistId);

    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const response = await fetch(`${instance}/api/v1/playlists/${playlistId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });

            if (!response.ok) continue;

            const data = await response.json();

            return {
                name: data.title || 'YouTube Music Playlist',
                tracks: (data.videos || []).map((v: any) => ({
                    title: v.title,
                    artist: v.author || v.authorId || 'Unknown Artist',
                    duration: v.lengthSeconds,
                })),
            };
        } catch (error) {
            console.warn('[Import] Invidious instance failed:', instance, error);
            continue;
        }
    }

    console.error('[Import] All Invidious instances failed');
    return null;
}

// ============================================================================
// Track Matching
// ============================================================================

/**
 * Match imported tracks to Tidal/Qobuz for playback
 */
async function matchTrack(track: ImportedTrack): Promise<PlaylistTrack | null> {
    const query = `${track.title} ${track.artist}`;

    // Try Qobuz first (better quality)
    try {
        const qobuzResults = await searchQobuzOnly(query);
        if (qobuzResults?.tracks?.length) {
            const match = qobuzResults.tracks[0];
            return {
                id: match.id,
                source: 'qobuz',
                title: match.title,
                artist: match.artist,
                artistId: match.artistId,
                album: match.album,
                albumId: match.albumId,
                duration: match.duration,
                coverArt: match.coverArt,
                addedAt: Date.now(),
                originalTitle: track.title,
                originalArtist: track.artist,
                matchConfidence: 90,
            };
        }
    } catch (error) {
        console.warn('[Import] Qobuz search failed:', error);
    }

    // Fallback to Tidal
    try {
        const tidalResults = await searchTidalOnly(query);
        if (tidalResults?.tracks?.length) {
            const match = tidalResults.tracks[0];
            return {
                id: match.id,
                source: 'tidal',
                title: match.title,
                artist: match.artist,
                artistId: match.artistId,
                album: match.album,
                albumId: match.albumId,
                duration: match.duration,
                coverArt: match.coverArt,
                addedAt: Date.now(),
                originalTitle: track.title,
                originalArtist: track.artist,
                matchConfidence: 85,
            };
        }
    } catch (error) {
        console.warn('[Import] Tidal search failed:', error);
    }

    return null;
}

// ============================================================================
// Main Import Function
// ============================================================================

export interface ImportProgress {
    stage: 'fetching' | 'matching' | 'saving' | 'done' | 'error';
    current: number;
    total: number;
    message: string;
}

export async function importPlaylist(
    url: string,
    onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
    const platform = detectPlatform(url);

    if (platform === 'unknown') {
        return {
            success: false,
            totalTracks: 0,
            matchedTracks: 0,
            unmatchedTracks: [],
            error: 'Unsupported URL. Please use a Spotify, Apple Music, or YouTube Music playlist link.',
        };
    }

    onProgress?.({ stage: 'fetching', current: 0, total: 0, message: `Fetching playlist from ${platform}...` });

    // Fetch playlist data
    let playlistData: { name: string; tracks: ImportedTrack[] } | null = null;
    let originalId = '';

    switch (platform) {
        case 'spotify': {
            const id = parseSpotifyUrl(url);
            if (!id) {
                return { success: false, totalTracks: 0, matchedTracks: 0, unmatchedTracks: [], error: 'Invalid Spotify playlist URL' };
            }
            originalId = id;
            playlistData = await fetchSpotifyPlaylist(id);
            break;
        }
        case 'apple': {
            const parsed = parseAppleMusicUrl(url);
            if (!parsed) {
                return { success: false, totalTracks: 0, matchedTracks: 0, unmatchedTracks: [], error: 'Invalid Apple Music playlist URL' };
            }
            originalId = parsed.id;
            playlistData = await fetchAppleMusicPlaylist(parsed.storefront, parsed.id);
            break;
        }
        case 'youtube': {
            const id = parseYouTubeMusicUrl(url);
            if (!id) {
                return { success: false, totalTracks: 0, matchedTracks: 0, unmatchedTracks: [], error: 'Invalid YouTube Music playlist URL' };
            }
            originalId = id;
            playlistData = await fetchYouTubeMusicPlaylist(id);
            break;
        }
    }

    if (!playlistData || playlistData.tracks.length === 0) {
        return {
            success: false,
            totalTracks: 0,
            matchedTracks: 0,
            unmatchedTracks: [],
            error: 'Could not fetch playlist. Make sure it\'s a public playlist.',
        };
    }

    // Match tracks
    const matchedTracks: PlaylistTrack[] = [];
    const unmatchedTracks: ImportedTrack[] = [];
    const total = playlistData.tracks.length;

    onProgress?.({ stage: 'matching', current: 0, total, message: `Matching ${total} tracks...` });

    for (let i = 0; i < playlistData.tracks.length; i++) {
        const track = playlistData.tracks[i];
        onProgress?.({ stage: 'matching', current: i + 1, total, message: `Matching: ${track.title}` });

        const matched = await matchTrack(track);
        if (matched) {
            matchedTracks.push(matched);
        } else {
            unmatchedTracks.push(track);
        }

        // Small delay to avoid rate limiting
        if (i < playlistData.tracks.length - 1) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    if (matchedTracks.length === 0) {
        return {
            success: false,
            totalTracks: total,
            matchedTracks: 0,
            unmatchedTracks,
            error: 'Could not match any tracks. Try a different playlist.',
        };
    }

    // Create playlist
    onProgress?.({ stage: 'saving', current: 0, total: 0, message: 'Saving playlist...' });

    const newPlaylist = await StorageService.createPlaylist(playlistData.name);

    // Update with tracks and import source
    const updatedPlaylist: UserPlaylist = {
        ...newPlaylist,
        tracks: matchedTracks,
        coverArt: matchedTracks[0]?.coverArt || undefined,
        importSource: {
            platform,
            originalId,
            originalName: playlistData.name,
        },
    };

    await StorageService.updatePlaylist(updatedPlaylist);

    onProgress?.({ stage: 'done', current: matchedTracks.length, total, message: 'Import complete!' });

    return {
        success: true,
        playlist: updatedPlaylist,
        totalTracks: total,
        matchedTracks: matchedTracks.length,
        unmatchedTracks,
    };
}
