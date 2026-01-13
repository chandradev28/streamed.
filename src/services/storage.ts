// Storage service for persisting user settings
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
    TORBOX_API_KEY: '@streamed_torbox_api_key',
    DNS_PROVIDER: '@streamed_dns_provider',
    ACTIVE_INDEXER: '@streamed_active_indexer',
    ZILEAN_ENABLED: '@streamed_zilean_enabled',     // Zilean alongside other sources
    ZILEAN_DMM_MODE: '@streamed_zilean_dmm_mode',   // Exclusive Zilean mode
    HIFI_CREDENTIALS: '@streamed_hifi_credentials', // HiFi music service credentials
    LIKED_SONGS: '@streamed_liked_songs',           // Liked songs library
    MUSIC_SOURCE: '@streamed_music_source',         // Music source preference: 'hifi' | 'tidal'
    USER_PLAYLISTS: '@streamed_user_playlists',     // User-created playlists
};


export type MusicSourceType = 'hifi' | 'tidal' | 'qobuz';

export type DnsProviderType = 'none' | 'cloudflare' | 'google' | 'adguard' | 'quad9';
export type IndexerType = 'torrentio' | 'zilean';

export const StorageService = {
    // TorBox API Key
    async getTorBoxApiKey(): Promise<string | null> {
        try {
            return await AsyncStorage.getItem(STORAGE_KEYS.TORBOX_API_KEY);
        } catch (error) {
            console.error('Error getting TorBox API key:', error);
            return null;
        }
    },

    async setTorBoxApiKey(apiKey: string): Promise<boolean> {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.TORBOX_API_KEY, apiKey);
            return true;
        } catch (error) {
            console.error('Error saving TorBox API key:', error);
            return false;
        }
    },

    async removeTorBoxApiKey(): Promise<boolean> {
        try {
            await AsyncStorage.removeItem(STORAGE_KEYS.TORBOX_API_KEY);
            return true;
        } catch (error) {
            console.error('Error removing TorBox API key:', error);
            return false;
        }
    },

    // Check if TorBox is configured
    async isTorBoxConfigured(): Promise<boolean> {
        const apiKey = await this.getTorBoxApiKey();
        return !!apiKey && apiKey.length > 0;
    },

    // DNS Provider
    async getDnsProvider(): Promise<DnsProviderType> {
        try {
            const provider = await AsyncStorage.getItem(STORAGE_KEYS.DNS_PROVIDER);
            return (provider as DnsProviderType) || 'none';
        } catch (error) {
            console.error('Error getting DNS provider:', error);
            return 'none';
        }
    },

    async setDnsProvider(provider: DnsProviderType): Promise<boolean> {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.DNS_PROVIDER, provider);
            return true;
        } catch (error) {
            console.error('Error saving DNS provider:', error);
            return false;
        }
    },

    // Active Indexer (for TorBox)
    async getActiveIndexer(): Promise<IndexerType> {
        try {
            const indexer = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_INDEXER);
            return (indexer as IndexerType) || 'torrentio';
        } catch (error) {
            console.error('Error getting active indexer:', error);
            return 'torrentio';
        }
    },

    async setActiveIndexer(indexer: IndexerType): Promise<boolean> {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_INDEXER, indexer);
            return true;
        } catch (error) {
            console.error('Error saving active indexer:', error);
            return false;
        }
    },

    // Zilean Settings
    async getZileanEnabled(): Promise<boolean> {
        try {
            const value = await AsyncStorage.getItem(STORAGE_KEYS.ZILEAN_ENABLED);
            return value === 'true';
        } catch (error) {
            console.error('Error getting Zilean enabled:', error);
            return false;
        }
    },

    async setZileanEnabled(enabled: boolean): Promise<boolean> {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.ZILEAN_ENABLED, enabled.toString());
            return true;
        } catch (error) {
            console.error('Error saving Zilean enabled:', error);
            return false;
        }
    },

    // Zilean DMM Mode (exclusive mode - only Zilean results)
    async getZileanDmmMode(): Promise<boolean> {
        try {
            const value = await AsyncStorage.getItem(STORAGE_KEYS.ZILEAN_DMM_MODE);
            return value === 'true';
        } catch (error) {
            console.error('Error getting Zilean DMM mode:', error);
            return false;
        }
    },

    async setZileanDmmMode(enabled: boolean): Promise<boolean> {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.ZILEAN_DMM_MODE, enabled.toString());
            return true;
        } catch (error) {
            console.error('Error saving Zilean DMM mode:', error);
            return false;
        }
    },

    // ============================================================================
    // DOWNLOAD BOOKMARKS - Save torrents per movie/show for quick access
    // ============================================================================

    /**
     * Get download bookmarks for a specific movie or TV show
     */
    async getDownloadsForMedia(mediaType: 'movie' | 'tv', mediaId: number): Promise<DownloadBookmark[]> {
        try {
            const key = `@streamed_downloads_${mediaType}_${mediaId}`;
            const data = await AsyncStorage.getItem(key);
            if (!data) return [];
            return JSON.parse(data) as DownloadBookmark[];
        } catch (error) {
            console.error('Error getting downloads for media:', error);
            return [];
        }
    },

    /**
     * Add a torrent bookmark to a movie/show
     */
    async addDownloadBookmark(
        mediaType: 'movie' | 'tv',
        mediaId: number,
        bookmark: DownloadBookmark
    ): Promise<boolean> {
        try {
            const key = `@streamed_downloads_${mediaType}_${mediaId}`;
            const existing = await this.getDownloadsForMedia(mediaType, mediaId);

            // Check if already exists (by torrentId or hash)
            const exists = existing.some(
                b => b.torrentId === bookmark.torrentId || b.torrentHash === bookmark.torrentHash
            );

            if (!exists) {
                existing.push(bookmark);
                await AsyncStorage.setItem(key, JSON.stringify(existing));
            }
            return true;
        } catch (error) {
            console.error('Error adding download bookmark:', error);
            return false;
        }
    },

    /**
     * Remove a torrent bookmark (does NOT delete from TorBox)
     */
    async removeDownloadBookmark(
        mediaType: 'movie' | 'tv',
        mediaId: number,
        torrentId: number
    ): Promise<boolean> {
        try {
            const key = `@streamed_downloads_${mediaType}_${mediaId}`;
            const existing = await this.getDownloadsForMedia(mediaType, mediaId);
            const filtered = existing.filter(b => b.torrentId !== torrentId);
            await AsyncStorage.setItem(key, JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Error removing download bookmark:', error);
            return false;
        }
    },

    /**
     * Clear all download bookmarks for a movie/show
     */
    async clearDownloadsForMedia(mediaType: 'movie' | 'tv', mediaId: number): Promise<boolean> {
        try {
            const key = `@streamed_downloads_${mediaType}_${mediaId}`;
            await AsyncStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error clearing downloads:', error);
            return false;
        }
    },

    // ========================================================================
    // HiFi Music Service Credentials
    // ========================================================================

    /**
     * Get HiFi credentials (username/password)
     */
    async getHiFiCredentials(): Promise<{ username: string; password: string } | null> {
        try {
            const value = await AsyncStorage.getItem(STORAGE_KEYS.HIFI_CREDENTIALS);
            if (value) {
                return JSON.parse(value);
            }
            return null;
        } catch (error) {
            console.error('Error getting HiFi credentials:', error);
            return null;
        }
    },

    /**
     * Save HiFi credentials
     */
    async setHiFiCredentials(username: string, password: string): Promise<boolean> {
        try {
            await AsyncStorage.setItem(
                STORAGE_KEYS.HIFI_CREDENTIALS,
                JSON.stringify({ username, password })
            );
            return true;
        } catch (error) {
            console.error('Error saving HiFi credentials:', error);
            return false;
        }
    },

    /**
     * Remove HiFi credentials (logout)
     */
    async removeHiFiCredentials(): Promise<boolean> {
        try {
            await AsyncStorage.removeItem(STORAGE_KEYS.HIFI_CREDENTIALS);
            return true;
        } catch (error) {
            console.error('Error removing HiFi credentials:', error);
            return false;
        }
    },

    /**
     * Check if HiFi is configured
     */
    async isHiFiConfigured(): Promise<boolean> {
        const credentials = await this.getHiFiCredentials();
        return credentials !== null && !!credentials.username && !!credentials.password;
    },

    // ========================================================================
    // Liked Songs (Music Library)
    // ========================================================================

    /**
     * Get all liked songs
     */
    async getLikedSongs(): Promise<LikedSong[]> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.LIKED_SONGS);
            if (!data) return [];
            return JSON.parse(data) as LikedSong[];
        } catch (error) {
            console.error('Error getting liked songs:', error);
            return [];
        }
    },

    /**
     * Add a song to liked songs
     */
    async addLikedSong(song: LikedSong): Promise<boolean> {
        try {
            const existing = await this.getLikedSongs();
            // Check if already exists
            if (existing.some(s => s.id === song.id && s.source === song.source)) {
                return true; // Already liked
            }
            existing.unshift({ ...song, likedAt: Date.now() }); // Add to beginning
            await AsyncStorage.setItem(STORAGE_KEYS.LIKED_SONGS, JSON.stringify(existing));
            return true;
        } catch (error) {
            console.error('Error adding liked song:', error);
            return false;
        }
    },

    /**
     * Remove a song from liked songs
     */
    async removeLikedSong(songId: string, source: 'tidal' | 'hifi' | 'qobuz'): Promise<boolean> {
        try {
            const existing = await this.getLikedSongs();
            const filtered = existing.filter(s => !(s.id === songId && s.source === source));
            await AsyncStorage.setItem(STORAGE_KEYS.LIKED_SONGS, JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Error removing liked song:', error);
            return false;
        }
    },

    /**
     * Check if a song is liked
     */
    async isLiked(songId: string, source: 'tidal' | 'hifi' | 'qobuz'): Promise<boolean> {
        try {
            const songs = await this.getLikedSongs();
            return songs.some(s => s.id === songId && s.source === source);
        } catch (error) {
            console.error('Error checking liked status:', error);
            return false;
        }
    },

    /**
     * Toggle liked status - returns new liked state
     */
    async toggleLiked(song: LikedSong): Promise<boolean> {
        const isCurrentlyLiked = await this.isLiked(song.id, song.source);
        if (isCurrentlyLiked) {
            await this.removeLikedSong(song.id, song.source);
            return false;
        } else {
            await this.addLikedSong(song);
            return true;
        }
    },

    /**
     * Update cached stream URL for a liked song
     * Used for cross-source playback
     */
    async updateLikedSongCache(songId: string, source: 'tidal' | 'hifi' | 'qobuz', streamUrl: string): Promise<boolean> {
        try {
            const songs = await this.getLikedSongs();
            const updatedSongs = songs.map(song => {
                if (song.id === songId && song.source === source) {
                    return {
                        ...song,
                        cachedStreamUrl: streamUrl,
                        cachedAt: Date.now(),
                    };
                }
                return song;
            });
            await AsyncStorage.setItem(STORAGE_KEYS.LIKED_SONGS, JSON.stringify(updatedSongs));
            console.log('[Storage] Cached stream URL for:', songId);
            return true;
        } catch (error) {
            console.error('Error caching stream URL:', error);
            return false;
        }
    },

    /**
     * Get cached stream URL for a liked song (if not expired)
     * URLs typically expire after 1-24 hours, so we use a 1-hour cache
     */
    async getCachedStreamUrl(songId: string, source: 'tidal' | 'hifi' | 'qobuz'): Promise<string | null> {
        try {
            const songs = await this.getLikedSongs();
            const song = songs.find(s => s.id === songId && s.source === source);
            if (song?.cachedStreamUrl && song?.cachedAt) {
                const cacheAge = Date.now() - song.cachedAt;
                const ONE_HOUR = 60 * 60 * 1000;
                if (cacheAge < ONE_HOUR) {
                    console.log('[Storage] Using cached stream URL for:', songId);
                    return song.cachedStreamUrl;
                }
                console.log('[Storage] Cache expired for:', songId);
            }
            return null;
        } catch (error) {
            console.error('Error getting cached stream URL:', error);
            return null;
        }
    },

    // ========================================================================
    // Music Source Preference
    // ========================================================================

    /**
     * Get music source preference (hifi or tidal)
     * Default: 'hifi' (primary server)
     */
    async getMusicSource(): Promise<MusicSourceType> {
        try {
            const source = await AsyncStorage.getItem(STORAGE_KEYS.MUSIC_SOURCE);
            if (source === 'tidal' || source === 'hifi' || source === 'qobuz') {
                return source;
            }
            return 'hifi'; // Default to HiFi (primary)
        } catch (error) {
            console.error('Error getting music source:', error);
            return 'hifi';
        }
    },

    /**
     * Set music source preference
     */
    async setMusicSource(source: MusicSourceType): Promise<boolean> {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.MUSIC_SOURCE, source);
            console.log('[Storage] Music source set to:', source);
            return true;
        } catch (error) {
            console.error('Error setting music source:', error);
            return false;
        }
    },

    // ========================================================================
    // User Playlists
    // ========================================================================

    /**
     * Get all user playlists
     */
    async getUserPlaylists(): Promise<UserPlaylist[]> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PLAYLISTS);
            if (!data) return [];
            return JSON.parse(data) as UserPlaylist[];
        } catch (error) {
            console.error('Error getting user playlists:', error);
            return [];
        }
    },

    /**
     * Create a new playlist
     */
    async createPlaylist(name: string, description?: string): Promise<UserPlaylist> {
        const newPlaylist: UserPlaylist = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name,
            description,
            tracks: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        try {
            const playlists = await this.getUserPlaylists();
            playlists.unshift(newPlaylist);
            await AsyncStorage.setItem(STORAGE_KEYS.USER_PLAYLISTS, JSON.stringify(playlists));
            console.log('[Storage] Created playlist:', name);
            return newPlaylist;
        } catch (error) {
            console.error('Error creating playlist:', error);
            return newPlaylist;
        }
    },

    /**
     * Update an existing playlist
     */
    async updatePlaylist(playlist: UserPlaylist): Promise<boolean> {
        try {
            const playlists = await this.getUserPlaylists();
            const index = playlists.findIndex(p => p.id === playlist.id);
            if (index === -1) return false;
            playlists[index] = { ...playlist, updatedAt: Date.now() };
            await AsyncStorage.setItem(STORAGE_KEYS.USER_PLAYLISTS, JSON.stringify(playlists));
            console.log('[Storage] Updated playlist:', playlist.name);
            return true;
        } catch (error) {
            console.error('Error updating playlist:', error);
            return false;
        }
    },

    /**
     * Delete a playlist
     */
    async deletePlaylist(playlistId: string): Promise<boolean> {
        try {
            const playlists = await this.getUserPlaylists();
            const filtered = playlists.filter(p => p.id !== playlistId);
            await AsyncStorage.setItem(STORAGE_KEYS.USER_PLAYLISTS, JSON.stringify(filtered));
            console.log('[Storage] Deleted playlist:', playlistId);
            return true;
        } catch (error) {
            console.error('Error deleting playlist:', error);
            return false;
        }
    },

    /**
     * Add a track to a playlist
     */
    async addTrackToPlaylist(playlistId: string, track: PlaylistTrack): Promise<boolean> {
        try {
            const playlists = await this.getUserPlaylists();
            const playlist = playlists.find(p => p.id === playlistId);
            if (!playlist) return false;
            // Check if track already exists
            if (playlist.tracks.some(t => t.id === track.id && t.source === track.source)) {
                console.log('[Storage] Track already in playlist');
                return true;
            }
            playlist.tracks.push({ ...track, addedAt: Date.now() });
            playlist.updatedAt = Date.now();
            // Update cover art if first track
            if (!playlist.coverArt && track.coverArt) {
                playlist.coverArt = track.coverArt;
            }
            await AsyncStorage.setItem(STORAGE_KEYS.USER_PLAYLISTS, JSON.stringify(playlists));
            console.log('[Storage] Added track to playlist:', track.title);
            return true;
        } catch (error) {
            console.error('Error adding track to playlist:', error);
            return false;
        }
    },

    /**
     * Remove a track from a playlist
     */
    async removeTrackFromPlaylist(playlistId: string, trackId: string, source: 'tidal' | 'hifi' | 'qobuz'): Promise<boolean> {
        try {
            const playlists = await this.getUserPlaylists();
            const playlist = playlists.find(p => p.id === playlistId);
            if (!playlist) return false;
            playlist.tracks = playlist.tracks.filter(t => !(t.id === trackId && t.source === source));
            playlist.updatedAt = Date.now();
            await AsyncStorage.setItem(STORAGE_KEYS.USER_PLAYLISTS, JSON.stringify(playlists));
            console.log('[Storage] Removed track from playlist');
            return true;
        } catch (error) {
            console.error('Error removing track from playlist:', error);
            return false;
        }
    },

    /**
     * Get a single playlist by ID
     */
    async getPlaylistById(playlistId: string): Promise<UserPlaylist | null> {
        try {
            const playlists = await this.getUserPlaylists();
            return playlists.find(p => p.id === playlistId) || null;
        } catch (error) {
            console.error('Error getting playlist:', error);
            return null;
        }
    },
};

// Download bookmark type
export interface DownloadBookmark {
    torrentId: number;
    torrentHash: string;
    torrentName: string;
    size: number;
    quality?: string;
    addedAt: number;
    // For TV shows
    seasonNumber?: number;
    episodeNumber?: number;
}

// Liked song type for music library
export interface LikedSong {
    id: string;
    title: string;
    artist: string;
    artistId: string;
    album: string;
    albumId: string;
    duration: number;
    coverArt: string | null;
    quality: string;
    source: 'tidal' | 'hifi' | 'qobuz';
    likedAt: number;
    // Stream URL caching for cross-source playback
    cachedStreamUrl?: string;
    cachedAt?: number;
}

// User playlist track
export interface PlaylistTrack {
    id: string;
    source: 'tidal' | 'hifi' | 'qobuz';
    title: string;
    artist: string;
    artistId: string;
    album: string;
    albumId: string;
    duration: number;
    coverArt: string | null;
    addedAt: number;
    // Import metadata
    originalTitle?: string;
    originalArtist?: string;
    matchConfidence?: number;
}

// User playlist
export interface UserPlaylist {
    id: string;
    name: string;
    description?: string;
    coverArt?: string;
    tracks: PlaylistTrack[];
    createdAt: number;
    updatedAt: number;
    importSource?: {
        platform: 'spotify' | 'apple' | 'youtube';
        originalId: string;
        originalName: string;
    };
}
