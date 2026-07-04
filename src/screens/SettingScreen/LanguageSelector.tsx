import React from 'react';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { spacing } from '../../styles/common.styles';

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
        <View style={{marginBottom:spacing.sm}}>
            <FloatingLabelInput
                label={t('setting:liveTrackingSettings.languagePlaceholder')}
                value={selectedLanguage?.label ?? ''}
                onChangeText={() => {}}
                isDropdown
                options={LANGUAGE_OPTIONS}
                onSelect={onSelect}
                editable={!disabled}
            />
        </View>
    );
};