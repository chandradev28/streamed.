// OMDB API Service
// Provides direct access to IMDb, Rotten Tomatoes, and Metacritic ratings
// API Key: Free tier - 1000 requests/day
// Uses direct fetch (no proxy) for better reliability

const API_KEY = process.env.EXPO_PUBLIC_OMDB_API_KEY || '';
const BASE_URL = 'https://www.omdbapi.com';

export interface OMDBRatings {
    imdb?: {
        score: number;
        votes: number;
    };
    rottenTomatoes?: {
        score: number; // Percentage (0-100)
    };
    metacritic?: {
        score: number; // Score (0-100)
    };
}

interface OMDBResponse {
    Response: string;
    imdbRating?: string;
    imdbVotes?: string;
    imdbID?: string;
    Title?: string;
    Year?: string;
    Rated?: string;
    Runtime?: string;
    Plot?: string;
    Ratings?: Array<{
        Source: string;
        Value: string;
    }>;
    Error?: string;
}

/**
 * Parse Rotten Tomatoes percentage from string (e.g., "87%" -> 87)
 */
const parseRottenTomatoes = (value: string): number | null => {
    const match = value.match(/(\d+)%/);
    return match ? parseInt(match[1], 10) : null;
};

/**
 * Parse Metacritic score from string (e.g., "75/100" -> 75)
 */
const parseMetacritic = (value: string): number | null => {
    const match = value.match(/(\d+)\/100/);
    return match ? parseInt(match[1], 10) : null;
};

/**
 * Fetch all ratings by IMDb ID (direct fetch, no proxy)
 * Returns IMDb, Rotten Tomatoes, and Metacritic ratings
 * @param imdbId - IMDb ID (e.g., 'tt0163025')
 */
export const getOMDBRatings = async (imdbId: string): Promise<OMDBRatings | null> => {
    try {
        const url = `${BASE_URL}/?apikey=${API_KEY}&i=${imdbId}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        // Use direct fetch - no proxy needed for mobile apps
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.log('OMDB: HTTP error', response.status);
            return null;
        }

        const data: OMDBResponse = await response.json();

        // Check for API error
        if (data.Response === 'False') {
            console.log('OMDB: API error -', data.Error);
            return null;
        }

        const ratings: OMDBRatings = {};

        // Extract IMDb rating from main fields
        if (data.imdbRating && data.imdbRating !== 'N/A') {
            const score = parseFloat(data.imdbRating);
            const votes = parseInt(data.imdbVotes?.replace(/,/g, '') || '0', 10);

            if (!isNaN(score)) {
                ratings.imdb = { score, votes };
            }
        }

        // Extract ratings from Ratings array
        if (data.Ratings && Array.isArray(data.Ratings)) {
            for (const rating of data.Ratings) {
                switch (rating.Source) {
                    case 'Rotten Tomatoes':
                        const rtScore = parseRottenTomatoes(rating.Value);
                        if (rtScore !== null) {
                            ratings.rottenTomatoes = { score: rtScore };
                        }
                        break;
                    case 'Metacritic':
                        const mcScore = parseMetacritic(rating.Value);
                        if (mcScore !== null) {
                            ratings.metacritic = { score: mcScore };
                        }
                        break;
                }
            }
        }

        console.log('OMDB: Fetched ratings successfully', Object.keys(ratings));
        return ratings;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log('OMDB: Request timed out');
        } else {
            console.error('OMDB: Error fetching ratings:', error.message);
        }
        return null;
    }
};

/**
 * Fetch ratings by movie title and year (fallback when no IMDb ID)
 * @param title - Movie title
 * @param year - Release year (optional)
 */
export const getOMDBRatingsByTitle = async (
    title: string,
    year?: number
): Promise<OMDBRatings | null> => {
    try {
        const yearParam = year ? `&y=${year}` : '';
        const url = `${BASE_URL}/?apikey=${API_KEY}&t=${encodeURIComponent(title)}${yearParam}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return null;
        }

        const data: OMDBResponse = await response.json();

        if (data.Response === 'False') {
            return null;
        }

        const ratings: OMDBRatings = {};

        if (data.imdbRating && data.imdbRating !== 'N/A') {
            const score = parseFloat(data.imdbRating);
            const votes = parseInt(data.imdbVotes?.replace(/,/g, '') || '0', 10);
            if (!isNaN(score)) {
                ratings.imdb = { score, votes };
            }
        }

        if (data.Ratings && Array.isArray(data.Ratings)) {
            for (const rating of data.Ratings) {
                if (rating.Source === 'Rotten Tomatoes') {
                    const rtScore = parseRottenTomatoes(rating.Value);
                    if (rtScore !== null) {
                        ratings.rottenTomatoes = { score: rtScore };
                    }
                } else if (rating.Source === 'Metacritic') {
                    const mcScore = parseMetacritic(rating.Value);
                    if (mcScore !== null) {
                        ratings.metacritic = { score: mcScore };
                    }
                }
            }
        }

        return ratings;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log('OMDB: Title search timed out');
        } else {
            console.error('OMDB: Error fetching by title:', error.message);
        }
        return null;
    }
};

// Legacy export for backward compatibility
export const getIMDbRating = async (imdbId: string): Promise<{ score: number; votes: number } | null> => {
    const ratings = await getOMDBRatings(imdbId);
    return ratings?.imdb || null;
};
