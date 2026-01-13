/**
 * Music Player Service
 * Uses react-native-track-player for reliable background audio with notification controls
 */

import TrackPlayer, {
    Capability,
    State,
    Event,
    RepeatMode,
    AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import { HiFiSong, getStreamUrl, getTidalStreamUrl, getQobuzStreamUrl } from './hifi';
import { StorageService } from './storage';

// ============================================================================
// Types
// ============================================================================

export interface PlaybackState {
    isPlaying: boolean;
    isLoading: boolean;
    currentSong: HiFiSong | null;
    positionMs: number;
    durationMs: number;
    queue: HiFiSong[];
    currentIndex: number;
    shuffleEnabled: boolean;
    repeatMode: 'off' | 'all' | 'one';
}

type PlaybackListener = (state: PlaybackState) => void;

// ============================================================================
// Player State
// ============================================================================

let isPlayerReady = false;
let currentState: PlaybackState = {
    isPlaying: false,
    isLoading: false,
    currentSong: null,
    positionMs: 0,
    durationMs: 0,
    queue: [],
    currentIndex: -1,
    shuffleEnabled: false,
    repeatMode: 'off',
};
let listeners: PlaybackListener[] = [];
let originalQueue: HiFiSong[] = [];
let currentQueueSongs: HiFiSong[] = [];

// Request cancellation for fast clicking - each playQueue call gets a unique ID
let currentPlaybackRequestId = 0;

// ============================================================================
// Initialization
// ============================================================================

export async function initPlayer(): Promise<void> {
    if (isPlayerReady) return;

    try {
        await TrackPlayer.setupPlayer({
            autoHandleInterruptions: true,
        });

        await TrackPlayer.updateOptions({
            // Capabilities shown in the notification
            capabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
                Capability.Stop,
                Capability.SeekTo,
            ],
            // Capabilities shown in the compact notification (lock screen)
            compactCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
            ],
            // Capabilities shown on the notification (Android)
            notificationCapabilities: [
                Capability.Play,
                Capability.Pause,
                Capability.SkipToNext,
                Capability.SkipToPrevious,
            ],
            progressUpdateEventInterval: 1, // Update progress every 1 second
            android: {
                appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
            },
        });

        // Set initial repeat mode to Queue (play all songs in queue)
        await TrackPlayer.setRepeatMode(RepeatMode.Queue);
        console.log('[MusicPlayer] Set initial repeat mode to Queue');

        // Handle queue ended - this fires when all tracks have finished
        TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
            console.log('[MusicPlayer] Queue ended, position:', event.position, 'track:', event.track);

            // If repeat mode is Queue ('all'), restart from beginning
            if (currentState.repeatMode === 'all') {
                console.log('[MusicPlayer] Repeat all - restarting queue from beginning');
                const queue = await TrackPlayer.getQueue();
                if (queue.length > 0) {
                    await TrackPlayer.skip(0);
                    await TrackPlayer.play();
                }
            }
        });

        TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
            if (event.track) {
                const index = event.index ?? -1;

                // ROBUST FIX: Multiple fallback strategies for finding the correct song
                let song: HiFiSong | null = null;

                // Strategy 1: Read song directly from track's embedded data (most reliable)
                if ((event.track as any).songData) {
                    song = (event.track as any).songData;
                    console.log('[MusicPlayer] ✓ Found song from embedded data:', song?.title);
                }

                // Strategy 2: Strict string ID comparison (handles number vs string mismatch)
                if (!song) {
                    const trackIdStr = String(event.track.id);
                    song = currentQueueSongs.find(s => String(s.id) === trackIdStr) || null;
                    if (song) {
                        console.log('[MusicPlayer] ✓ Found song by string ID match:', song.title);
                    }
                }

                // Strategy 3: Match by title and artist (fallback if IDs don't match)
                if (!song && event.track.title && event.track.artist) {
                    song = currentQueueSongs.find(s =>
                        s.title === event.track?.title && s.artist === event.track?.artist
                    ) || null;
                    if (song) {
                        console.log('[MusicPlayer] ✓ Found song by title/artist match:', song.title);
                    }
                }

                // Strategy 4: Use index as last resort
                if (!song && index >= 0 && index < currentQueueSongs.length) {
                    song = currentQueueSongs[index];
                    console.log('[MusicPlayer] ⚠️ Using index fallback:', song?.title);
                }

                // Update currentIndex to match the song's position in our queue
                const correctIndex = song
                    ? currentQueueSongs.findIndex(s => String(s.id) === String(song!.id))
                    : index;

                currentState = {
                    ...currentState,
                    currentSong: song,
                    currentIndex: correctIndex >= 0 ? correctIndex : index,
                    durationMs: (event.track.duration || 0) * 1000,
                };
                notifyListeners();

                if (!song) {
                    console.error('[MusicPlayer] ❌ Could not find song for track:', event.track.id, event.track.title);
                }
            }
        });

        TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
            const isPlaying = event.state === State.Playing;
            const isLoading = event.state === State.Buffering || event.state === State.Loading;

            currentState = {
                ...currentState,
                isPlaying,
                isLoading,
            };
            notifyListeners();
        });

        TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, async (event) => {
            currentState = {
                ...currentState,
                positionMs: event.position * 1000,
                durationMs: event.duration * 1000,
            };
            notifyListeners();
        });

        isPlayerReady = true;
        console.log('[MusicPlayer] Initialized with TrackPlayer for background audio');
    } catch (error) {
        console.error('[MusicPlayer] Failed to initialize:', error);
    }
}

// ============================================================================
// Listeners
// ============================================================================

export function addPlaybackListener(listener: PlaybackListener): () => void {
    listeners.push(listener);
    listener(currentState);
    return () => {
        listeners = listeners.filter(l => l !== listener);
    };
}

function notifyListeners(): void {
    listeners.forEach(listener => listener(currentState));
}

// ============================================================================
// Playback Controls
// ============================================================================

export async function playSong(song: HiFiSong): Promise<void> {
    await playQueue([song], 0);
}

export async function playQueue(songs: HiFiSong[], startIndex: number = 0): Promise<void> {
    if (!isPlayerReady) {
        await initPlayer();
    }

    // FAST-CLICK FIX: Generate unique request ID for this playback request
    // Each new click increments the ID, cancelling any previous pending requests
    const thisRequestId = ++currentPlaybackRequestId;
    console.log('[MusicPlayer] 🎯 Playback request #' + thisRequestId);

    try {
        currentState = {
            ...currentState,
            isLoading: true,
        };
        notifyListeners();

        // Store original queue for reference
        originalQueue = [...songs];

        await TrackPlayer.reset();

        // FAST-CLICK FIX: Check if this request is still valid (not superseded by newer click)
        if (thisRequestId !== currentPlaybackRequestId) {
            console.log('[MusicPlayer] ⏭️ Request #' + thisRequestId + ' cancelled - newer request exists');
            return;
        }

        console.log('[MusicPlayer] Preparing queue of', songs.length, 'tracks, starting at', startIndex);

        // Helper function to fetch stream URL for a song
        const fetchStreamUrl = async (song: HiFiSong): Promise<string | null> => {
            // Check cache first
            if (song.source && song.source !== 'hifi') {
                const cachedUrl = await StorageService.getCachedStreamUrl(song.id, song.source);
                if (cachedUrl) {
                    console.log('[MusicPlayer] ✓ Using cached URL for:', song.title);
                    return cachedUrl;
                }
            }

            // Fetch fresh URL
            if (song.source === 'tidal') {
                const url = await getTidalStreamUrl(song.id);
                if (url) StorageService.updateLikedSongCache(song.id, 'tidal', url);
                return url;
            } else if (song.source === 'qobuz') {
                const url = await getQobuzStreamUrl(song.id);
                if (url) StorageService.updateLikedSongCache(song.id, 'qobuz', url);
                return url;
            } else {
                // HiFi local server
                const url = getStreamUrl(song.id);
                console.log('[MusicPlayer] HiFi stream URL:', url, 'for song:', song.title, 'source:', song.source);
                return url;
            }
        };

        // STEP 1: Fetch ONLY the first track (clicked track) immediately
        const firstSong = songs[startIndex];
        console.log('[MusicPlayer] 🚀 Fetching first track:', firstSong.title);
        const firstUrl = await fetchStreamUrl(firstSong);

        // FAST-CLICK FIX: Check if this request is still valid after async fetch
        if (thisRequestId !== currentPlaybackRequestId) {
            console.log('[MusicPlayer] ⏭️ Request #' + thisRequestId + ' cancelled after fetch - newer request exists');
            return;
        }

        if (!firstUrl) {
            console.error('[MusicPlayer] ✗ Failed to get stream URL for first track');
            currentState = { ...currentState, isLoading: false };
            notifyListeners();
            return;
        }

        // Build the queue order: first song, then remaining songs
        const remainingSongs = [
            ...songs.slice(startIndex + 1), // Songs after clicked
            ...songs.slice(0, startIndex),  // Songs before clicked (for "previous")
        ];

        // CRITICAL FIX: Set currentQueueSongs to match EXACT TrackPlayer queue order
        // This ensures PlaybackActiveTrackChanged index maps correctly to the right song
        currentQueueSongs = [firstSong, ...remainingSongs];

        // Add first track and play IMMEDIATELY
        // ROBUST: Embed full song data in track for reliable retrieval
        const firstTrack = {
            id: String(firstSong.id), // Ensure ID is string
            url: firstUrl,
            title: firstSong.title,
            artist: firstSong.artist,
            album: firstSong.album || 'Unknown Album',
            artwork: firstSong.coverArt || undefined,
            duration: firstSong.duration,
            songData: firstSong, // Embed full song for reliable lookup
        };

        await TrackPlayer.add([firstTrack]);
        await TrackPlayer.play();

        console.log('[MusicPlayer] ▶️ Playing first track immediately:', firstSong.title);

        currentState = {
            ...currentState,
            isLoading: false,
            isPlaying: true,
            queue: currentQueueSongs,
            currentIndex: 0,
            currentSong: firstSong,
        };
        notifyListeners();

        // STEP 2: Fetch remaining tracks in background (non-blocking)
        if (remainingSongs.length > 0) {
            console.log('[MusicPlayer] 📥 Loading', remainingSongs.length, 'more tracks in background...');

            // Background loading - don't await this
            (async () => {
                const failedTracks: string[] = [];

                for (const song of remainingSongs) {
                    try {
                        const url = await fetchStreamUrl(song);
                        if (url) {
                            // ROBUST: Embed full song data in track for reliable retrieval
                            await TrackPlayer.add({
                                id: String(song.id), // Ensure ID is string
                                url,
                                title: song.title,
                                artist: song.artist,
                                album: song.album || 'Unknown Album',
                                artwork: song.coverArt || undefined,
                                duration: song.duration,
                                songData: song, // Embed full song for reliable lookup
                            });
                            console.log('[MusicPlayer] ✓ Added to queue:', song.title);
                        } else {
                            failedTracks.push(String(song.id));
                            console.log('[MusicPlayer] ⚠️ No URL for track (removing from queue):', song.title);
                        }
                    } catch (err: any) {
                        failedTracks.push(String(song.id));
                        console.log('[MusicPlayer] ⚠️ Failed to load track:', song.title, err?.message || '');
                    }
                }

                // Remove failed tracks from our queue state to keep in sync
                if (failedTracks.length > 0) {
                    currentQueueSongs = currentQueueSongs.filter(s => !failedTracks.includes(String(s.id)));
                    currentState = {
                        ...currentState,
                        queue: currentQueueSongs,
                    };
                    notifyListeners();
                    console.log('[MusicPlayer] 🔄 Removed', failedTracks.length, 'failed tracks from queue');
                }

                console.log('[MusicPlayer] ✅ Background queue loading complete');
            })();
        }

    } catch (error) {
        console.error('[MusicPlayer] Failed to play queue:', error);
        currentState = {
            ...currentState,
            isLoading: false,
            isPlaying: false,
        };
        notifyListeners();
    }
}

export async function togglePlayPause(): Promise<void> {
    try {
        const state = await TrackPlayer.getPlaybackState();
        if (state.state === State.Playing) {
            await TrackPlayer.pause();
        } else {
            await TrackPlayer.play();
        }
    } catch (error) {
        console.error('[MusicPlayer] Toggle play/pause error:', error);
    }
}

export async function pause(): Promise<void> {
    await TrackPlayer.pause();
}

export async function resume(): Promise<void> {
    await TrackPlayer.play();
}

export async function seekTo(positionMs: number): Promise<void> {
    await TrackPlayer.seekTo(positionMs / 1000);
}

export async function skipNext(): Promise<void> {
    try {
        const queue = await TrackPlayer.getQueue();
        const currentTrack = await TrackPlayer.getActiveTrackIndex();

        if (currentTrack != null && currentTrack < queue.length - 1) {
            await TrackPlayer.skipToNext();
        } else if (currentState.repeatMode === 'all' && queue.length > 0) {
            await TrackPlayer.skip(0);
            await TrackPlayer.play();
        }
    } catch (error) {
        console.error('[MusicPlayer] Skip next error:', error);
    }
}

export async function skipPrevious(): Promise<void> {
    try {
        const position = await TrackPlayer.getProgress();
        const currentTrack = await TrackPlayer.getActiveTrackIndex();

        if (position.position > 3) {
            await TrackPlayer.seekTo(0);
        } else if (currentTrack != null && currentTrack > 0) {
            await TrackPlayer.skipToPrevious();
        } else if (currentState.repeatMode === 'all') {
            const queue = await TrackPlayer.getQueue();
            await TrackPlayer.skip(queue.length - 1);
            await TrackPlayer.play();
        }
    } catch (error) {
        console.error('[MusicPlayer] Skip previous error:', error);
    }
}

// ============================================================================
// Shuffle/Repeat Controls
// ============================================================================

export function setShuffle(enabled: boolean): void {
    currentState = {
        ...currentState,
        shuffleEnabled: enabled,
    };

    if (enabled) {
        const currentSong = currentQueueSongs[currentState.currentIndex];
        const otherSongs = currentQueueSongs.filter((_, i) => i !== currentState.currentIndex);

        for (let i = otherSongs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [otherSongs[i], otherSongs[j]] = [otherSongs[j], otherSongs[i]];
        }

        if (currentSong) {
            currentQueueSongs = [currentSong, ...otherSongs];
        }
    } else {
        currentQueueSongs = [...originalQueue];
    }

    notifyListeners();
}

export function setRepeatMode(mode: 'off' | 'all' | 'one'): void {
    console.log('[MusicPlayer] Setting repeat mode to:', mode);
    currentState = {
        ...currentState,
        repeatMode: mode,
    };

    switch (mode) {
        case 'off':
            TrackPlayer.setRepeatMode(RepeatMode.Off);
            console.log('[MusicPlayer] TrackPlayer repeat: Off');
            break;
        case 'one':
            TrackPlayer.setRepeatMode(RepeatMode.Track);
            console.log('[MusicPlayer] TrackPlayer repeat: Track (loop single song)');
            break;
        case 'all':
            TrackPlayer.setRepeatMode(RepeatMode.Queue);
            console.log('[MusicPlayer] TrackPlayer repeat: Queue (play all, then restart)');
            break;
    }

    notifyListeners();
}

export function toggleRepeat(): void {
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(currentState.repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setRepeatMode(nextMode);
}

export function toggleShuffle(): void {
    setShuffle(!currentState.shuffleEnabled);
}

export async function stop(): Promise<void> {
    try {
        await TrackPlayer.stop();
        await TrackPlayer.reset();

        currentQueueSongs = [];
        currentState = {
            isPlaying: false,
            isLoading: false,
            currentSong: null,
            positionMs: 0,
            durationMs: 0,
            queue: [],
            currentIndex: -1,
            shuffleEnabled: false,
            repeatMode: currentState.repeatMode,
        };
        notifyListeners();
    } catch (error) {
        console.error('[MusicPlayer] Stop error:', error);
    }
}

// ============================================================================
// Getters
// ============================================================================

export function getState(): PlaybackState {
    return currentState;
}

export function isPlaying(): boolean {
    return currentState.isPlaying;
}

export function getCurrentSong(): HiFiSong | null {
    return currentState.currentSong;
}

// ============================================================================
// Utilities
// ============================================================================

export function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
