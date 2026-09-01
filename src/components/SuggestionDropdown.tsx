import React from 'react';
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { palette, fonts, shadows, space } from '../styles/common.styles';
import { SuggestionItem } from '../services/followerScreenService';
import { formatEventDate } from '../utils/dateFormatter';
import { useTranslation } from 'react-i18next';


interface SuggestionDropdownProps {
    suggestions: SuggestionItem[];
    loading: boolean;
    visible: boolean;
    onSelect: (item: SuggestionItem) => void;
}

const SuggestionDropdown: React.FC<SuggestionDropdownProps> = ({
    suggestions,
    loading,
    visible,
    onSelect,
}) => {
    const { t } = useTranslation(['event', 'common']);
    if (!visible) return null;


    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.loaderRow}>
                    <ActivityIndicator size="small" color={palette.navy} />
                    <Text style={styles.loaderText}>Searching…</Text>
                </View>
            </View>
        );
    }

    if (suggestions.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.centeredRow}>
                    <Text style={styles.emptyText}>{t('common:empty.noResults')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
             <ScrollView
                style={{ maxHeight: 220 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                scrollEventThrottle={100}
            >
                {suggestions.map((item, index) => (
                    <React.Fragment key={String(item.product_app_id)}>
                        {index > 0 && <View style={styles.separator} />}
                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => onSelect(item)}
                            activeOpacity={0.7}
                        >
                            <Feather name="flag" size={14} color={palette.textMuted} style={styles.rowIcon} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.name} numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <Text style={styles.date}>
                                    {formatEventDate(item.race_date, t)}{item.city ? `  ·  ${item.city}` : ''}
                                </Text>
                            </View>
                            
                            <Feather name="chevron-right" size={14} color={palette.placeholder} style={{ marginLeft: 8 }} />
                        </TouchableOpacity>
                    </React.Fragment>
                ))}

            </ScrollView>
            
        </View>
    );
};

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
        paddingVertical: 12,
    },
    rowIcon: {
        marginRight: 8,
        marginTop: 1,
    },
    name: {
        fontFamily: fonts.bodySemi,
        fontSize: 13,
        color: palette.ink,
        marginBottom: 2,
    },
    date: {
        fontFamily: fonts.body,
        fontSize: 12,
        color: palette.textMuted,
    },
    separator: {
        height: 1,
        backgroundColor: palette.fill,
        marginHorizontal: 16,
    },
    loaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    loaderText: {
        marginLeft: 8,
        fontFamily: fonts.body,
        fontSize: 13,
        color: palette.textMuted,
    },
    centeredRow: {
        padding: 16,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: fonts.body,
        fontSize: 13,
        color: palette.placeholder,
    },
});

export default SuggestionDropdown;
