import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles as settingStyles } from '../../styles/liveTrackingSettings.styles';

export interface LanguageOption {
    label: string;
    value: number;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
    { label: 'English', value: 1 },
    { label: 'Français', value: 3 },
    { label: 'Nederlands', value: 2 },
];

interface Props {
    selectedLanguage: LanguageOption | null;
    onSelect: (option: LanguageOption) => void;
    disabled?: boolean;
}

export const LanguageSelector: React.FC<Props> = ({ selectedLanguage, onSelect, disabled }) => {
    const { t } = useTranslation(['setting']);
    return (
        <View style={settingStyles.languageBlock}>
            <Text style={settingStyles.languageLabel}>
                {t('setting:liveTrackingSettings.languagePlaceholder')}
            </Text>
            {/* ✅ Content-sized pills that wrap, instead of three equal flex:1
                thirds. "Nederlands" needs ~82pt (bold when active) but a third
                left ~67pt at 320 / ~81pt at 360, so it broke mid-word
                ("Nederland/s"). Each pill now takes at least its text width and
                they share the spare width (flexGrow); with Larger Text the last
                one drops to a second row instead of splitting a word. */}
            <View style={[settingStyles.languageRow, { flexWrap: 'wrap' }]}>
                {LANGUAGE_OPTIONS.map((option) => {
                    const active = selectedLanguage?.value === option.value;
                    return (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                settingStyles.languagePill,
                                { flexGrow: 1, flexShrink: 0, flexBasis: 'auto' },
                                active && settingStyles.languagePillActive,
                            ]}
                            onPress={() => onSelect(option)}
                            disabled={disabled}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                        >
                            <Text style={[settingStyles.languagePillText, active && settingStyles.languagePillTextActive]}>
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};