// TMDB API Service
import { Movie, TVShow, MovieDetails, TVShowDetails, TrendingResponse, MediaItem, SeasonDetails, CreditsResponse } from '../types/types';

const API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY || '';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// Image size options
export const ImageSizes = {
    poster: {
        small: 'w185',
        medium: 'w342',
        large: 'w500',
        original: 'original',
    },
    backdrop: {
        small: 'w300',
        medium: 'w780',
        large: 'w1280',
        original: 'original',
    },
    profile: {
        small: 'w45',
        medium: 'w185',
        large: 'h632',
        original: 'original',
    },
};

// Helper to build image URLs
export const getImageUrl = (path: string | null, size: string = 'w500'): string => {
    if (!path) {
        return 'https://via.placeholder.com/500x750?text=No+Image';
    }
    return `${IMAGE_BASE_URL}/${size}${path}`;
};

// Import DNS-over-HTTPS fetch for bypassing ISP blocks
import { dohFetch } from './doh';

// Generic fetch helper with timeout, DoH support, and detailed logging
const fetchFromTMDB = async <T>(endpoint: string, params: Record<string, string> = {}): Promise<T> => {
    const queryParams = new URLSearchParams({
        api_key: API_KEY,
        ...params,
    });

    const url = `${BASE_URL}${endpoint}?${queryParams}`;
    // Production: logging disabled for performance

    try {
        // Add timeout of 30 seconds (increased for proxy retries)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        // Use DoH fetch to bypass ISP DNS blocking
        const response = await dohFetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
            },
        });

        clearTimeout(timeoutId);

        // Production: response status logging disabled

        if (!response.ok) {
            throw new Error(`TMDB API Error: ${response.status}`);
        }

        return response.json();
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        // Production: error logging disabled
        throw error;
    }
};

// API Functions

/**
 * Get trending movies and TV shows
 */
export const getTrending = async (
    mediaType: 'all' | 'movie' | 'tv' = 'all',
    timeWindow: 'day' | 'week' = 'week'
): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>(`/trending/${mediaType}/${timeWindow}`);
};

/**
 * Get popular movies
 */
export const getPopularMovies = async (page: number = 1): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>('/movie/popular', { page: page.toString() });
};

/**
 * Get popular TV shows
 */
export const getPopularTVShows = async (page: number = 1): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>('/tv/popular', { page: page.toString() });
};

/**
 * Get top rated movies
 */
export const getTopRatedMovies = async (page: number = 1): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>('/movie/top_rated', { page: page.toString() });
};

/**
 * Get upcoming movies
 */
export const getUpcomingMovies = async (page: number = 1): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>('/movie/upcoming', { page: page.toString() });
};

/**
 * Get now playing movies
 */
export const getNowPlayingMovies = async (page: number = 1): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>('/movie/now_playing', { page: page.toString() });
};

/**
 * Get movies by watch provider (streaming service)
 * @param providerId - TMDB watch provider ID (Netflix=8, Prime=9, HBO=1899, Disney+=337, Apple TV+=350, Hulu=15)
 * @param region - ISO 3166-1 country code (default: US)
 */
export const getMoviesByProvider = async (
    providerId: number,
    region: string = 'US',
    page: number = 1
): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>('/discover/movie', {
        with_watch_providers: providerId.toString(),
        watch_region: region,
        sort_by: 'popularity.desc',
        page: page.toString(),
    });
};

/**
 * Get movie details by ID
 */
export const getMovieDetails = async (movieId: number): Promise<MovieDetails> => {
    return fetchFromTMDB<MovieDetails>(`/movie/${movieId}`);
};

/**
 * Get TV show details by ID
 */
export const getTVShowDetails = async (tvId: number): Promise<TVShowDetails> => {
    return fetchFromTMDB<TVShowDetails>(`/tv/${tvId}`);
};

/**
 * Get season details with episodes
 */
export const getSeasonDetails = async (tvId: number, seasonNumber: number): Promise<SeasonDetails> => {
    return fetchFromTMDB<SeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`);
};

/**
 * Search for movies and TV shows
 */
export const searchMulti = async (query: string, page: number = 1): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>('/search/multi', {
        query,
        page: page.toString(),
        include_adult: 'false',
    });
};

/**
 * Get movies by genre
 */
export const getMoviesByGenre = async (genreId: number, page: number = 1): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>('/discover/movie', {
        with_genres: genreId.toString(),
        page: page.toString(),
        sort_by: 'popularity.desc',
    });
};

/**
 * Get TV shows by genre
 */
export const getTVShowsByGenre = async (genreId: number, page: number = 1): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>('/discover/tv', {
        with_genres: genreId.toString(),
        page: page.toString(),
        sort_by: 'popularity.desc',
    });
};

/**
 * Get movie credits (cast and crew)
 */
export const getMovieCredits = async (movieId: number): Promise<CreditsResponse> => {
    return fetchFromTMDB<CreditsResponse>(`/movie/${movieId}/credits`);
};

/**
 * Get TV show credits (cast and crew)
 */
export const getTVCredits = async (tvId: number): Promise<CreditsResponse> => {
    return fetchFromTMDB<CreditsResponse>(`/tv/${tvId}/credits`);
};

/**
 * Get similar movies
 */
export const getSimilarMovies = async (movieId: number): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>(`/movie/${movieId}/similar`);
};

/**
 * Get similar TV shows
 */
export const getSimilarTVShows = async (tvId: number): Promise<TrendingResponse> => {
    return fetchFromTMDB<TrendingResponse>(`/tv/${tvId}/similar`);
};

/**
 * Get external IDs for a TV show (including IMDB ID)
 */
export const getTVExternalIds = async (tvId: number): Promise<{ imdb_id: string | null; tvdb_id: number | null }> => {
    const response = await fetchFromTMDB<{ imdb_id: string | null; tvdb_id: number | null }>(`/tv/${tvId}/external_ids`);
    return response;
};

// Genre IDs for reference
export const MovieGenres = {
    Action: 28,
    Adventure: 12,
    Animation: 16,
    Comedy: 35,
    Crime: 80,
    Documentary: 99,
    Drama: 18,
    Family: 10751,
    Fantasy: 14,
    History: 36,
    Horror: 27,
    Music: 10402,
    Mystery: 9648,
    Romance: 10749,
    SciFi: 878,
    Thriller: 53,
    War: 10752,
    Western: 37,
};

export const TVGenres = {
    ActionAdventure: 10759,
    Animation: 16,
    Comedy: 35,
    Crime: 80,
    Documentary: 99,
    Drama: 18,
    Family: 10751,
    Kids: 10762,
    Mystery: 9648,
    News: 10763,
    Reality: 10764,
    SciFiFantasy: 10765,
    Soap: 10766,
    Talk: 10767,
    WarPolitics: 10768,
    Western: 37,
};

// Type guard to check if a MediaItem is a Movie
export const isMovie = (item: MediaItem): item is Movie => {
    return 'title' in item;
};

// Helper to get display name (works for both movies and TV shows)
export const getMediaTitle = (item: MediaItem): string => {
    if ('title' in item) {
        return item.title;
    }
    return item.name;
};

// Helper to get release/air date
export const getMediaDate = (item: MediaItem): string => {
    if ('release_date' in item) {
        return item.release_date;
    }
    return item.first_air_date;
};

// Helper to get year from date
export const getYear = (dateString: string): string => {
    if (!dateString) return 'N/A';
    return dateString.split('-')[0];
};
