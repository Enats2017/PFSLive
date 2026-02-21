import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchInputProps {
    placeholder: string;
    value: string;
    onChangeText: (text: string) => void;
    icon?: keyof typeof Ionicons.glyphMap;
}

const SearchInput = ({ placeholder, value, onChangeText, icon = 'search' }: SearchInputProps) => {
    return (
        <View style={styles.container}>
            <Ionicons name={icon} size={18} color="#9ca3af" style={styles.icon} />
            <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor="#9ca3af"
                value={value}
                onChangeText={onChangeText}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 10,
        paddingHorizontal: 12,
        marginBottom: 16,
        height: 44,
    },
    
    icon: { marginRight: 8 },
    input: { flex: 1, fontSize: 14, color: '#111' },
});

export default SearchInput;