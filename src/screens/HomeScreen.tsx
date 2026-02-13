import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { HomeScreenProps } from '../types/navigation';
import { LanguageSelector } from '../components/LanguageSelector';
import { APP_CONFIG } from '../constants/config';

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { t } = useTranslation(['home', 'common']);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🏃‍♂️ {t('common:app_name')}</Text>
          <Text style={styles.subtitle}>{t('home:subtitle')}</Text>
        </View>

        {/* Language Selector */}
        <View style={styles.languageSection}>
          <Text style={styles.languageLabel}>{t('home:footer.language')}</Text>
          <LanguageSelector />
        </View>

        {/* Tagline */}
        <Text style={styles.tagline}>{t('home:tagline')}</Text>

        {/* Role Selection Cards */}
        <View style={styles.cardsContainer}>
          {/* Participant Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              console.log('Participant selected');
              navigation.navigate('Route', {
                eventId: '1',
                eventName: 'TMiler Mountain Trail',
              });
            }}
          >
            <View style={styles.cardIcon}>
              <Text style={styles.iconText}>🏃</Text>
            </View>
            <Text style={styles.cardTitle}>{t('home:participant.title')}</Text>
            <Text style={styles.cardDescription}>
              {t('home:participant.description')}
            </Text>
            <View style={styles.cardButton}>
              <Text style={styles.cardButtonText}>
                {t('home:participant.button')}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Follower Card */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              console.log('Follower selected');
              navigation.navigate('Route', {
                eventId: '1',
                eventName: 'TMiler Mountain Trail',
              });
            }}
          >
            <View style={styles.cardIcon}>
              <Text style={styles.iconText}>👥</Text>
            </View>
            <Text style={styles.cardTitle}>{t('home:follower.title')}</Text>
            <Text style={styles.cardDescription}>
              {t('home:follower.description')}
            </Text>
            <View style={styles.cardButton}>
              <Text style={styles.cardButtonText}>
                {t('home:follower.button')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t('home:footer.version', { version: APP_CONFIG.VERSION })}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#AAAAAA',
  },
  languageSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  languageLabel: {
    fontSize: 14,
    color: '#AAAAAA',
    marginBottom: 12,
  },
  tagline: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 30,
    fontWeight: '500',
  },
  cardsContainer: {
    gap: 20,
  },
  card: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DC143C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 40,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#AAAAAA',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  cardButton: {
    backgroundColor: '#DC143C',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  cardButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666666',
  },
});

export default HomeScreen;