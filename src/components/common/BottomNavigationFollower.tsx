import React from 'react';
import { View, TouchableOpacity, Text, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { bottomNavStyles } from '../../styles/bottomNav.styles';

type TabName = 'Home' | 'Favorites' | 'Results' | 'Map';

interface BottomNavigationFollowerProps {
  activeTab?: TabName;
  product_app_id?: string | number;
  event_name?: string;
  event_image?: string | null;
  product_option_value_app_id?: string | number;
  sourceTab?: 'past' | 'live' | 'upcoming';
  selectedDistanceLabel?: string | number;
  showResults?: boolean;
  race_date?: string | null;
}

const isRaceInPast = (race_date?: string | null): boolean => {
  if (!race_date) return false;
  const parsed = new Date(race_date);
  if (isNaN(parsed.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);

  return parsed <= today;
};

// ✅ Custom icon assets from assets folder
const TAB_ICONS: Record<TabName, any> = {
  Home:      require('../../../assets/home.png'),
  Favorites: require('../../../assets/favourites.png'),
  Results:   require('../../../assets/results.png'),
  Map:       require('../../../assets/map.png'),
};

// The Results tab shows a start list before race day and results after, so the
// icon follows the label. Kept out of TAB_ICONS because it's an alternate face
// of the same tab, not a fifth destination.
const PARTICIPANTS_ICON = require('../../../assets/participants.png');

export const BottomNavigationFollower: React.FC<BottomNavigationFollowerProps> = ({
  activeTab = 'Home',
  product_app_id,
  event_name,
  product_option_value_app_id,
  sourceTab,
  selectedDistanceLabel,
  event_image,
  showResults = true,
  race_date,
}) => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { t } = useTranslation('common');

  // One flag drives both the label and the icon so they can't drift apart.
  const raceIsPast = isRaceInPast(race_date);
  const resultsLabel = raceIsPast ? t('nav.results') : t('nav.participants');
  const resultsIcon = raceIsPast ? TAB_ICONS.Results : PARTICIPANTS_ICON;

  const tabs: { name: TabName; label: string; icon: any }[] = [
    { name: 'Home',      label: t('nav.home'),      icon: TAB_ICONS.Home },
    { name: 'Favorites', label: t('nav.favorites'), icon: TAB_ICONS.Favorites },
    ...(showResults
      ? [{ name: 'Results' as TabName, label: resultsLabel, icon: resultsIcon }]
      : []),
    { name: 'Map',       label: t('nav.map'),       icon: TAB_ICONS.Map },
  ];

  const handleTabPress = (tabName: TabName) => {
    switch (tabName) {
      case 'Home':
        handleHomeNavigation();
        break;

      case 'Results':
        if (product_app_id) {
          navigation.navigate('ResultList', {
            product_app_id,
            product_option_value_app_id: product_option_value_app_id || 0,
            event_name: event_name || '',
            event_image: event_image || '',
            sourceScreen: route.name,
            sectionType: 'follower',
            sourceTab,
          });
        }
        break;

      case 'Map':
        if (product_app_id) {
          navigation.navigate('LiveTracking', {
            product_app_id,
            product_option_value_app_id: product_option_value_app_id || 0,
            event_name: event_name || '',
            event_image: event_image || '',
            sourceScreen: route.name,
            sectionType: 'follower',
            sourceTab,
            selectedDistanceLabel,
          });
        }
        break;

      case 'Favorites':
        if (product_app_id) {
          navigation.navigate('FavouriteList', {
            product_app_id,
            event_name: event_name || '',
            event_image: event_image || '',
            sectionType: 'follower',
            sourceScreen: route.name,
            sourceTab,
            product_option_value_app_id: product_option_value_app_id || 0,
          });
        }
        break;
    }
  };

  const handleHomeNavigation = () => {
    const currentRoute = route.name;

    if (currentRoute === 'FollowDetails') {
      // Already on the right screen — do nothing
    } else {
      if (product_app_id) {
        navigation.navigate('FollowDetails', {
          product_app_id,
          event_name: event_name || '',
          event_image: event_image || '',
          sourceTab,
        });
      } else {
        navigation.navigate('HomeScreen');
      }
    }
  };

  return (
    <View style={bottomNavStyles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={bottomNavStyles.tab}
            onPress={() => handleTabPress(tab.name)}
            activeOpacity={0.7}
          >
            <Image
              source={tab.icon}
              style={[
                bottomNavStyles.iconImage,
                isActive && bottomNavStyles.iconImageActive,
              ]}
              resizeMode="contain"
            />
            <Text style={[bottomNavStyles.label, isActive && bottomNavStyles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};