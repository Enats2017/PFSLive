import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { spacing, palette, fonts, shadows, space } from '../styles/common.styles';
import { ParticipantItem } from '../services/followerEvent';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { width: winW, height: winH } = useWindowDimensions();   // before the early return (hooks rule)
  const isLandscape = winW > winH;
    if (!visible) return null;

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.centeredRow}>
                    <ActivityIndicator size="small" color={palette.navy} />
                    {/* ✅ Was hard-coded English; reuses the existing
                        follower:searching key (en/fr/nl already translated). */}
                    <Text style={styles.loaderText}>{t('follower:searching')}</Text>
                </View>
            </View>
        );
    }

    if (suggestions.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.centeredRow}>
                    <Text style={styles.emptyText}>{t('common:empty.noAthletes')}</Text>
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
                    // landscape: 16 - 90 of the 260pt list was blank (audit 2026-10-23)
                    paddingBottom: isLandscape ? spacing.lg : spacing.xxxxl,
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
                                        cachePolicy="memory-disk"
                                        style={styles.avatarImage}
                                        contentFit="cover"
                                    />
                                ) : (
                                    <View style={styles.avatarFallback}>
                                        <Text style={styles.avatarInitials}>{initials}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Info */}
                            <View style={{ flex: 1 }}>
                                {/* ✅ 2 lines: long double-barrelled names were cut to
                                    one line in a ~200pt column at 320. */}
                                <Text style={styles.name} numberOfLines={2}>
                                    {item.firstname?.trim()} {item.lastname?.trim()}
                                </Text>
                                <View style={styles.locationRow}>
                                    {item.flag_url ? (
                                        <Image
                                            source={{ uri: item.flag_url }}
                                            cachePolicy="memory-disk"
                                            style={styles.flag}
                                            contentFit="cover"
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
                            <ActivityIndicator size="small" color={palette.navy} />
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
    ...shadows.card,

        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 10,
        marginTop: 4,
        overflow: 'hidden',
  },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.xl,
        paddingVertical: 8,
        gap: space.md,
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
        backgroundColor: palette.fill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitials: {
        fontFamily: fonts.bodySemi,
        fontSize: 14,
        color: palette.navy,
    },
    name: {
        fontFamily: fonts.bodySemi,
        fontSize: 14,
        color: palette.ink,
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
        fontFamily: fonts.body,
        fontSize: 13,
        color: palette.textMuted,
        // ✅ shrink inside locationRow: without it the Text kept its full width
        // beside the flag, so numberOfLines' "…" never applied and the row's
        // overflow: hidden just hard-cut the city mid-letter.
        flexShrink: 1,
    },
    separator: {
        height: 1,
        backgroundColor: palette.fill,
        marginHorizontal: 16,
    },
    centeredRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 8,
    },
    loaderText: {
        fontFamily: fonts.body,
        fontSize: 14,
        color: palette.textMuted,
    },
    emptyText: {
        fontFamily: fonts.body,
        fontSize: 14,
        color: palette.placeholder,
    },
    footerLoader: {
        paddingVertical: spacing.sm,
        alignItems: 'center',
    },
});

export default AthleteSuggestionDropdown;
