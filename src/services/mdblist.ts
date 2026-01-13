// MDBList API Service
// Provides ratings from multiple sources (IMDb, TMDB, etc.)

import { dohFetch } from './doh';

const API_KEY = process.env.EXPO_PUBLIC_MDBLIST_API_KEY || '';
const BASE_URL = 'https://api.mdblist.com';

// MDBList Rating Types
export interface MDBListRatings {
    imdb?: {
        score: number;
        votes: number;
    };
    tmdb?: {
        score: number;
        votes: number;
    };
    trakt?: {
        score: number;
        votes: number;
    };
    letterboxd?: {
        score: number;
        votes: number;
    };
    rottentomatoes?: {
        score: number; // Critics score (percentage)
        audience?: number; // Audience score (percentage)
    };
    metacritic?: {
        score: number;
    };
}

export interface MDBListItem {
    id: number;
    title: string;
    year: number;
    type: 'movie' | 'show';
    imdbid: string;
    traktid: number;
    tmdbid: number;
    score: number;
    score_average: number;
    ratings: MDBListRating[];
    // Additional fields
    adult: boolean;
    released: string;
    runtime: number;
    certification: string;
    description: string;
    trailer: string;
    poster: string;
    backdrop: string;
}

export interface MDBListRating {
    source: string;
    value: number;
    score: number;
    votes: number;
    popular?: number;
}

/**
 * Fetch item details and ratings by TMDB ID
 * @param tmdbId - TMDB ID of the movie or show
 * @param mediaType - 'movie' or 'show'
 */
export const getRatingsByTMDBId = async (
    tmdbId: number,
    mediaType: 'movie' | 'tv'
): Promise<MDBListRatings | null> => {
    try {
        // MDBList uses 'show' instead of 'tv'
        const type = mediaType === 'tv' ? 'show' : 'movie';
        const url = `${BASE_URL}/?apikey=${API_KEY}&tm=${tmdbId}&m=${type}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await dohFetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.log('MDBList API error:', response.status);
            return null;
        }

        const data = await response.json();

        // Check if MDBList returned actual item data or just the API info page
        // When item is not found, it returns: {"website":"...", "documentation":"...", ...}
        if (data.website || !data.ratings) {
            console.log('MDBList: Item not found in database for TMDB ID:', tmdbId);
            return null;
        }

        const itemData = data as MDBListItem;

        // Transform ratings array to structured object
        const ratings: MDBListRatings = {};

        if (itemData.ratings && Array.isArray(itemData.ratings)) {
            for (const rating of itemData.ratings) {
                switch (rating.source.toLowerCase()) {
                    case 'imdb':
                        ratings.imdb = {
                            score: rating.value, // IMDb uses 1-10 scale directly
                            votes: rating.votes,
                        };
                        break;
                    case 'tmdb':
                        ratings.tmdb = {
                            score: rating.value, // TMDB uses 1-10 scale
                            votes: rating.votes,
                        };
                        break;
                    case 'trakt':
                        ratings.trakt = {
                            score: rating.value,
                            votes: rating.votes,
                        };
                        break;
                    case 'letterboxd':
                        ratings.letterboxd = {
                            score: rating.value, // Letterboxd uses 1-5 scale
                            votes: rating.votes,
                        };
                        break;
                    case 'tomatoes':
                    case 'rottentomatoes':
                        ratings.rottentomatoes = {
                            score: rating.value, // Percentage
                        };
                        break;
                    case 'metacritic':
                        ratings.metacritic = {
                            score: rating.value, // 0-100 scale
                        };
                        break;
                }
            }
        }

        return ratings;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log('MDBList request timed out');
        } else {
            console.error('Error fetching MDBList ratings:', error);
        }
        return null;
    }
};

/**
 * Fetch item details and ratings by IMDb ID
 * @param imdbId - IMDb ID (e.g., 'tt1234567')
 */
export const getRatingsByIMDBId = async (imdbId: string): Promise<MDBListRatings | null> => {
    try {
        const url = `${BASE_URL}/?apikey=${API_KEY}&i=${imdbId}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await dohFetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
            },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            return null;
        }

        const data: MDBListItem = await response.json();
        const ratings: MDBListRatings = {};

        if (data.ratings && Array.isArray(data.ratings)) {
            for (const rating of data.ratings) {
                switch (rating.source.toLowerCase()) {
                    case 'imdb':
                        ratings.imdb = { score: rating.value, votes: rating.votes };
                        break;
                    case 'tmdb':
                        ratings.tmdb = { score: rating.value, votes: rating.votes };
                        break;
                    case 'trakt':
                        ratings.trakt = { score: rating.value, votes: rating.votes };
                        break;
                    case 'letterboxd':
                        ratings.letterboxd = { score: rating.value, votes: rating.votes };
                        break;
                    case 'rottentomatoes':
                        ratings.rottentomatoes = { score: rating.value };
                        break;
                    case 'metacritic':
                        ratings.metacritic = { score: rating.value };
                        break;
                }
            }
        }

        return ratings;
    } catch (error) {
        console.error('Error fetching MDBList ratings by IMDB:', error);
        return null;
    }
};

/**
 * Format a rating value for display
 */
export const formatRating = (score: number, source: string): string => {
    switch (source) {
        case 'letterboxd':
            // Letterboxd uses 1-5 scale
            return score.toFixed(1);
        case 'rottentomatoes':
        case 'metacritic':
            // Percentage-based
            return `${Math.round(score)}%`;
        default:
            // IMDb, TMDB, Trakt use 1-10 scale
            return score.toFixed(1);
    }
};

/**
 * Format vote count for display (e.g., 1234567 -> 1.2M)
 */
export const formatVotes = (votes: number): string => {
    if (votes >= 1000000) {
        return `${(votes / 1000000).toFixed(1)}M`;
    }
    if (votes >= 1000) {
        return `${(votes / 1000).toFixed(0)}K`;
    }
    return votes.toString();
};
