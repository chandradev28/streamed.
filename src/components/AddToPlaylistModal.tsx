import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
} from 'react-native';
import { X, Plus, Check, ListMusic } from 'lucide-react-native';
import { Image } from 'expo-image';
import { StorageService, UserPlaylist, PlaylistTrack } from '../services/storage';

interface AddToPlaylistModalProps {
    visible: boolean;
    onClose: () => void;
    track: {
        id: string;
        title: string;
        artist: string;
        artistId: string;
        album: string;
        albumId: string;
        duration: number;
        coverArt?: string | null;
        source: 'tidal' | 'hifi' | 'qobuz';
    };
}

export const AddToPlaylistModal = ({ visible, onClose, track }: AddToPlaylistModalProps) => {
    const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            loadPlaylists();
            setSelectedIds([]);
        }
    }, [visible]);

    const loadPlaylists = async () => {
        const userPlaylists = await StorageService.getUserPlaylists();
        setPlaylists(userPlaylists);
    };

    const togglePlaylist = (playlistId: string) => {
        setSelectedIds(prev =>
            prev.includes(playlistId)
                ? prev.filter(id => id !== playlistId)
                : [...prev, playlistId]
        );
    };

    const handleCreatePlaylist = async () => {
        if (!newPlaylistName.trim()) {
            Alert.alert('Error', 'Please enter a playlist name');
            return;
        }
        const newPlaylist = await StorageService.createPlaylist(newPlaylistName.trim());
        setNewPlaylistName('');
        setShowCreate(false);
        await loadPlaylists();
        // Auto-select the new playlist
        setSelectedIds(prev => [...prev, newPlaylist.id]);
    };

    const handleAddToPlaylists = async () => {
        if (selectedIds.length === 0) {
            Alert.alert('No Playlists Selected', 'Please select at least one playlist');
            return;
        }

        setLoading(true);
        const playlistTrack: PlaylistTrack = {
            id: track.id,
            source: track.source,
            title: track.title,
            artist: track.artist,
            artistId: track.artistId,
            album: track.album,
            albumId: track.albumId,
            duration: track.duration,
            coverArt: track.coverArt || null,
            addedAt: Date.now(),
        };

        for (const playlistId of selectedIds) {
            await StorageService.addTrackToPlaylist(playlistId, playlistTrack);
        }

        setLoading(false);
        Alert.alert(
            'Added!',
            `"${track.title}" added to ${selectedIds.length} playlist${selectedIds.length > 1 ? 's' : ''}`
        );
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Add to Playlist</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X color="#888" size={24} />
                        </TouchableOpacity>
                    </View>

                    {/* Track Info */}
                    <View style={styles.trackInfo}>
                        <Image
                            source={{ uri: track.coverArt || undefined }}
                            style={styles.trackCover}
                            contentFit="cover"
                        />
                        <View style={styles.trackDetails}>
                            <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                            <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                        </View>
                    </View>

                    {/* Create New Playlist Button */}
                    {showCreate ? (
                        <View style={styles.createForm}>
                            <TextInput
                                style={styles.createInput}
                                placeholder="Playlist name"
                                placeholderTextColor="#666"
                                value={newPlaylistName}
                                onChangeText={setNewPlaylistName}
                                autoFocus
                            />
                            <View style={styles.createButtons}>
                                <TouchableOpacity
                                    style={styles.createCancelButton}
                                    onPress={() => {
                                        setNewPlaylistName('');
                                        setShowCreate(false);
                                    }}
                                >
                                    <Text style={styles.createCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.createConfirmButton}
                                    onPress={handleCreatePlaylist}
                                >
                                    <Text style={styles.createConfirmText}>Create</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.createNewButton}
                            onPress={() => setShowCreate(true)}
                        >
                            <Plus color="#A78BFA" size={20} />
                            <Text style={styles.createNewText}>Create New Playlist</Text>
                        </TouchableOpacity>
                    )}

                    {/* Playlist List */}
                    <ScrollView style={styles.playlistList} showsVerticalScrollIndicator={false}>
                        {playlists.length === 0 ? (
                            <View style={styles.emptyState}>
                                <ListMusic color="#555" size={40} />
                                <Text style={styles.emptyText}>No playlists yet</Text>
                            </View>
                        ) : (
                            playlists.map(playlist => (
                                <TouchableOpacity
                                    key={playlist.id}
                                    style={[
                                        styles.playlistItem,
                                        selectedIds.includes(playlist.id) && styles.playlistItemSelected,
                                    ]}
                                    onPress={() => togglePlaylist(playlist.id)}
                                >
                                    {playlist.coverArt ? (
                                        <Image
                                            source={{ uri: playlist.coverArt }}
                                            style={styles.playlistCover}
                                            contentFit="cover"
                                        />
                                    ) : (
                                        <View style={[styles.playlistCover, styles.playlistCoverPlaceholder]}>
                                            <ListMusic color="#555" size={20} />
                                        </View>
                                    )}
                                    <View style={styles.playlistInfo}>
                                        <Text style={styles.playlistName} numberOfLines={1}>
                                            {playlist.name}
                                        </Text>
                                        <Text style={styles.playlistMeta}>
                                            {playlist.tracks.length} tracks
                                        </Text>
                                    </View>
                                    <View style={[
                                        styles.checkbox,
                                        selectedIds.includes(playlist.id) && styles.checkboxSelected,
                                    ]}>
                                        {selectedIds.includes(playlist.id) && (
                                            <Check color="#000" size={16} />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>

                    {/* Add Button */}
                    <TouchableOpacity
                        style={[
                            styles.addButton,
                            selectedIds.length === 0 && styles.addButtonDisabled,
                        ]}
                        onPress={handleAddToPlaylists}
                        disabled={selectedIds.length === 0 || loading}
                    >
                        <Text style={styles.addButtonText}>
                            {loading ? 'Adding...' : `Add to ${selectedIds.length} Playlist${selectedIds.length !== 1 ? 's' : ''}`}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: '#1a1a2e',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    trackInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    trackCover: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: '#1f1f1f',
    },
    trackDetails: {
        flex: 1,
        marginLeft: 12,
    },
    trackTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    trackArtist: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
    },
    createNewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(167, 139, 250, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.3)',
        marginBottom: 16,
    },
    createNewText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#A78BFA',
    },
    createForm: {
        marginBottom: 16,
    },
    createInput: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#fff',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    createButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
    },
    createCancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    createCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#888',
    },
    createConfirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#A78BFA',
        alignItems: 'center',
    },
    createConfirmText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#000',
    },
    playlistList: {
        maxHeight: 300,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 14,
        color: '#888',
        marginTop: 12,
    },
    playlistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: 'rgba(255,255,255,0.03)',
    },
    playlistItemSelected: {
        backgroundColor: 'rgba(167, 139, 250, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.3)',
    },
    playlistCover: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: '#1f1f1f',
    },
    playlistCoverPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    playlistInfo: {
        flex: 1,
        marginLeft: 12,
    },
    playlistName: {
        fontSize: 15,
        fontWeight: '500',
        color: '#fff',
    },
    playlistMeta: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#555',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#A78BFA',
        borderColor: '#A78BFA',
    },
    addButton: {
        backgroundColor: '#A78BFA',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 16,
    },
    addButtonDisabled: {
        opacity: 0.5,
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
    },
});

export default AddToPlaylistModal;
