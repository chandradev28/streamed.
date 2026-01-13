import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    X,
    Settings,
    Wifi,
    Plug,
    ChevronRight,
    Music2,
} from 'lucide-react-native';

interface MenuOverlayProps {
    visible: boolean;
    onClose: () => void;
    onNavigate?: (screen: string) => void;
}

const menuItems = [
    { id: 'music', label: 'This Is Music', icon: Music2, description: 'Stream lossless Tidal music', accent: '#10B981' },
    { id: 'indexers', label: 'Indexer Status', icon: Wifi, description: 'Check Torrentio indexer health' },
    { id: 'addons', label: 'Stream Addons', icon: Plug, description: 'Configure Torrentio, Comet & more' },
    { id: 'settings', label: 'App Settings', icon: Settings, description: 'General preferences' },
];


export const MenuOverlay = ({ visible, onClose, onNavigate }: MenuOverlayProps) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(-50)).current;
    const itemAnims = useRef(menuItems.map(() => new Animated.Value(0))).current;

    useEffect(() => {
        if (visible) {
            // Animate overlay in
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            // Stagger menu items
            Animated.stagger(
                80,
                itemAnims.map((anim) =>
                    Animated.spring(anim, {
                        toValue: 1,
                        friction: 8,
                        tension: 40,
                        useNativeDriver: true,
                    })
                )
            ).start();
        } else {
            // Animate out
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: -50,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();

            // Reset item animations
            itemAnims.forEach((anim) => anim.setValue(0));
        }
    }, [visible]);

    if (!visible) return null;

    const handleItemPress = (id: string) => {
        onNavigate?.(id);
        onClose();
    };

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <StatusBar barStyle="light-content" />

            {/* Background */}
            <LinearGradient
                colors={['#0a0a0a', '#121212', '#0a0a0a']}
                style={styles.background}
            />

            {/* Header */}
            <Animated.View
                style={[
                    styles.header,
                    {
                        transform: [{ translateY: slideAnim }],
                        paddingTop: insets.top + 20 // Dynamic safe area padding
                    }
                ]}
            >
                <Text style={styles.headerTitle}>Menu</Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <X color="#fff" size={24} />
                </TouchableOpacity>
            </Animated.View>

            {/* Menu Items */}
            <View style={styles.menuContainer}>
                {menuItems.map((item, index) => {
                    const ItemIcon = item.icon;
                    const itemAnim = itemAnims[index];

                    return (
                        <Animated.View
                            key={item.id}
                            style={[
                                styles.menuItemWrapper,
                                {
                                    opacity: itemAnim,
                                    transform: [
                                        {
                                            translateX: itemAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [-30, 0],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => handleItemPress(item.id)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.menuItemLeft}>
                                    <View style={styles.iconContainer}>
                                        <ItemIcon color="#fff" size={22} />
                                    </View>
                                    <View style={styles.menuItemText}>
                                        <Text style={styles.menuItemLabel}>{item.label}</Text>
                                        <Text style={styles.menuItemDescription}>
                                            {item.description}
                                        </Text>
                                    </View>
                                </View>
                                <ChevronRight color="#555" size={20} />
                            </TouchableOpacity>
                        </Animated.View>
                    );
                })}
            </View>

            {/* Footer */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
                <Text style={styles.footerText}>Streamed v1.0.0</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '700',
        color: '#fff',
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    menuItemWrapper: {
        marginBottom: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    menuItemText: {
        flex: 1,
    },
    menuItemLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    menuItemDescription: {
        fontSize: 13,
        color: '#888',
    },
    footer: {
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 13,
        color: '#444',
    },
});
