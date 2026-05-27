import React from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../styles/common.styles';
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
                    <Text style={styles.emptyText}>No results found</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={suggestions}
                keyExtractor={(item) => String(item.product_app_id)}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                style={{ maxHeight: 220 }}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => onSelect(item)}
                        activeOpacity={0.7}
                    >
                        <Feather name="flag" size={14} color="#888" style={styles.rowIcon} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.name} numberOfLines={1}>
                                {item.name}
                            </Text>
                            <Text style={styles.date}>
                                {formatEventDate(item.race_date,t)}{item.city ? `  ·  ${item.city}` : ''}
                            </Text>
                        </View>
                        <Feather name="chevron-right" size={14} color="#bbb" />
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

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
        paddingVertical: 11,
    },
    rowIcon: {
        marginRight: 8,
        marginTop: 1,
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    date: {
        fontSize: 12,
        color: '#888',
    },
    separator: {
        height: 1,
        backgroundColor: '#F2F2F2',
        marginHorizontal: 14,
    },
    loaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    loaderText: {
        marginLeft: 8,
        fontSize: 13,
        color: '#888',
    },
    centeredRow: {
        padding: 14,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 13,
        color: '#aaa',
    },
});

export default SuggestionDropdown;
