import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLanguageStore } from '../store/useLanguageStore';
import { LANGUAGES, LanguageCode } from '../i18n';
import { palette, fonts, space } from '../styles/common.styles';

export const LanguageSelector: React.FC = () => {
  const { currentLanguage, changeLanguage } = useLanguageStore();

  return (
    <View style={styles.container}>
      {(Object.keys(LANGUAGES) as LanguageCode[]).map((lang) => (
        <TouchableOpacity
          key={lang}
          style={[
            styles.button,
            currentLanguage === lang && styles.activeButton,
          ]}
          onPress={() => changeLanguage(lang)}
        >
          <Text style={styles.flag}>{LANGUAGES[lang].flag}</Text>
          <Text
            style={[
              styles.text,
              currentLanguage === lang && styles.activeText,
            ]}
          >
            {LANGUAGES[lang].name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: space.xl,
    borderRadius: 10,
    backgroundColor: palette.fill,
    gap: 6,
  },
  activeButton: {
    backgroundColor: palette.danger,
  },
  flag: {
    fontFamily: fonts.body,
        fontSize: 20,
  },
  text: {
    fontFamily: fonts.bodyMedium,
        fontSize: 13,
    color: palette.textBody,
    },
  activeText: {
    color: palette.surface,
  },
});