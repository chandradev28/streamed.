import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { Menu, User } from 'lucide-react-native';

type SourceMode = 'streamed' | 'torboxers';

interface HeaderNavProps {
    onProfilePress?: () => void;
    onMenuPress?: () => void;
    sourceMode?: SourceMode;
    onSourceModeChange?: (mode: SourceMode) => void;
}

export const HeaderNav = ({
    onProfilePress,
    onMenuPress,
    sourceMode = 'streamed',
    onSourceModeChange,
}: HeaderNavProps) => {
    // Get safe area insets for dynamic positioning
    const insets = useSafeAreaInsets();

    // Animation for sliding pill
    const slideAnim = useRef(new Animated.Value(sourceMode === 'streamed' ? 0 : 1)).current;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: sourceMode === 'streamed' ? 0 : 1,
            useNativeDriver: false,
            tension: 100,
            friction: 12,
        }).start();
    }, [sourceMode, slideAnim]);

    const handleModePress = (mode: SourceMode) => {
        if (onSourceModeChange) {
            onSourceModeChange(mode);
        }
    };

    // Interpolate for sliding effect (2 positions)
    const pillTranslateX = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [2, OPTION_WIDTH + 2],
    });

    const isTorboxers = sourceMode === 'torboxers';

    return (
        <View style={[
            styles.container,
            isTorboxers && styles.containerCentered,
            { paddingTop: insets.top + 12 } // Dynamic safe area padding
        ]}>
            {/* Left: Hamburger Menu - only in Streamed mode */}
            {!isTorboxers && (
                <TouchableOpacity style={styles.iconButton} onPress={onMenuPress}>
                    <Menu color={Colors.dark.text} size={24} />
                </TouchableOpacity>
            )}

            {/* Center: Capsule Toggle */}
            <View style={styles.capsuleContainer}>
                {/* Sliding Pill Background */}
                <Animated.View
                    style={[
                        styles.slidingPill,
                        { transform: [{ translateX: pillTranslateX }] }
                    ]}
                />

                {/* Streamed Option */}
                <TouchableOpacity
                    style={styles.capsuleOption}
                    onPress={() => handleModePress('streamed')}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.capsuleText,
                        sourceMode === 'streamed' && styles.capsuleTextActive
                    ]}>
                        Streamed
                    </Text>
                </TouchableOpacity>

                {/* Torboxers Option */}
                <TouchableOpacity
                    style={styles.capsuleOption}
                    onPress={() => handleModePress('torboxers')}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.capsuleText,
                        sourceMode === 'torboxers' && styles.capsuleTextActive
                    ]}>
                        Torboxers
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Right: User Profile - only in Streamed mode */}
            {!isTorboxers && (
                <TouchableOpacity style={styles.iconButton} onPress={onProfilePress}>
                    <User color={Colors.dark.text} size={24} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const CAPSULE_PADDING = 2;
const OPTION_WIDTH = 90;

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 12,
        width: '100%',
        position: 'absolute',
        top: 0,
        zIndex: 10,
    },
    containerCentered: {
        justifyContent: 'center',
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333333',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    capsuleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(40, 40, 45, 0.95)',
        borderRadius: 22,
        padding: CAPSULE_PADDING,
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    slidingPill: {
        position: 'absolute',
        width: OPTION_WIDTH,
        height: 36,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 18,
        top: CAPSULE_PADDING,
        left: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    capsuleOption: {
        width: OPTION_WIDTH,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    capsuleText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        letterSpacing: 0.3,
    },
    capsuleTextActive: {
        color: '#1a1a1a',
    },
});
