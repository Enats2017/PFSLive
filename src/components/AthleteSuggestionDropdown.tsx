import React from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { colors, spacing } from '../styles/common.styles';
import { ParticipantItem } from '../services/followerEvent';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AthleteSuggestionDropdownProps {
    suggestions: ParticipantItem[];
    loading: boolean;
    loadingMore: boolean;
    visible: boolean;
    hasMore: boolean;
    onSelect: (item: ParticipantItem) => void;
    onLoadMore: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const AthleteSuggestionDropdown: React.FC<AthleteSuggestionDropdownProps> = ({
    suggestions,
    loading,
    loadingMore,
    visible,
    hasMore,
    onSelect,
    onLoadMore,
}) => {
    if (!visible) return null;

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.centeredRow}>
                    <ActivityIndicator size="small" color={colors.primary ?? '#F5C518'} />
                    <Text style={styles.loaderText}>Searching…</Text>
                </View>
            </View>
        );
    }

    if (suggestions.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.centeredRow}>
                    <Text style={styles.emptyText}>No athletes found</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={suggestions}
                keyExtractor={(item) => String(item.customer_app_id)}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={{
                    paddingBottom: spacing.xxxxl,
                    flexGrow: 1,
                }}
                style={{ maxHeight: 260 }}
                onEndReached={hasMore ? onLoadMore : undefined}
                onEndReachedThreshold={0.5}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) => {
                    const hasImage = item.profile_picture && item.profile_picture.trim() !== '';
                    const initials = [item.firstname?.[0], item.lastname?.[0]]
                        .filter(Boolean).join('').toUpperCase() || '?';

                    return (
                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => onSelect(item)}
                            activeOpacity={0.7}
                        >
                            {/* Avatar */}
                            <View style={styles.avatar}>
                                {hasImage ? (
                                    <Image
                                        source={{ uri: item.profile_picture }}
                                        style={styles.avatarImage}
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View style={styles.avatarFallback}>
                                        <Text style={styles.avatarInitials}>{initials}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Info */}
                            <View style={{ flex: 1 }}>
                                <Text style={styles.name} numberOfLines={1}>
                                    {item.firstname?.trim()} {item.lastname?.trim()}
                                </Text>
                                <View style={styles.locationRow}>
                                    {item.flag_url ? (
                                        <Image
                                            source={{ uri: item.flag_url }}
                                            style={styles.flag}
                                            resizeMode="cover"
                                        />
                                    ) : null}
                                    <Text style={styles.city} numberOfLines={1}>
                                        {item.city}{item.country ? `, ${item.country}` : ''}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListFooterComponent={
                    loadingMore ? (
                        <View style={styles.footerLoader}>
                            <ActivityIndicator size="small" color={colors.primary ?? '#F5C518'} />
                        </View>
                    ) : null
                }
            />
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E8E8E8',
        borderRadius: 10,
        marginTop: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 6,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 10,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    avatarFallback: {
        width: '100%',
        height: '100%',
        backgroundColor: '#e8edf5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1a2e5a',
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    flag: {
        width: 16,
        height: 11,
        borderRadius: 2,
    },
    city: {
        fontSize: 12,
        color: '#888',
    },
    separator: {
        height: 1,
        backgroundColor: '#F2F2F2',
        marginHorizontal: 14,
    },
    centeredRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        gap: 8,
    },
    loaderText: {
        fontSize: 13,
        color: '#888',
    },
    emptyText: {
        fontSize: 13,
        color: '#aaa',
    },
    footerLoader: {
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
});

export default AthleteSuggestionDropdown;
