import React from 'react';
import { View, TouchableOpacity, Text, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { bottomNavStyles } from '../../styles/bottomNav.styles';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS } from '../../constants/analyticsScreens';

type TabName = 'Home' | 'Favorites' | 'Results' | 'Map';

interface BottomNavigationProps {
  activeTab?: TabName;
  product_app_id?: string | number;
  event_name?: string;
  event_image?: string | null;
  product_option_value_app_id?: string | number;
  sourceScreen?: string;
  selectedDistanceLabel?: string | number;
  showResults?: boolean;
  race_date?: string | null;
}

const isRaceInPast = (race_date?: string | null): boolean => {
  if (!race_date) return false; // unknown → default to "Results"

  const parsed = new Date(race_date);
  if (isNaN(parsed.getTime())) return false; // unparseable → default to "Results"

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

const NAV_BUTTONS: Record<TabName, string> = {
  Home:      ANALYTICS_BUTTONS.NAV_HOME,
  Favorites: ANALYTICS_BUTTONS.NAV_FAVORITES,
  Results:   ANALYTICS_BUTTONS.NAV_RESULTS,
  Map:       ANALYTICS_BUTTONS.NAV_MAP,
};

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab = 'Home',
  product_app_id,
  event_name,
  event_image,
  product_option_value_app_id,
  sourceScreen,
  selectedDistanceLabel,
  showResults = true,
  race_date
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
  // Fixed map, so ui_button stays a small stable set. Logged BEFORE the
  // switch: a tap on Results/Map/Favorites with no product_app_id silently
  // does nothing today, and those dead taps are worth seeing.
    void analyticsService.logInteraction(
      ANALYTICS_SCREENS.BOTTOM_NAV,
      NAV_BUTTONS[tabName],
    );

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
            sourceScreen: sourceScreen || route.name,
            sectionType: 'participant',
            sourceTab: 'live',
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
            sourceScreen: sourceScreen || route.name,
            sectionType: 'participant',
            sourceTab: 'live',
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
            sectionType: 'participant',
            sourceScreen: sourceScreen || route.name,
            sourceTab: 'live',
            product_option_value_app_id: product_option_value_app_id || 0,
          });
        }
        break;
    }
  };

  const handleHomeNavigation = () => {
    const currentRoute = route.name;

    if (currentRoute === 'ResultList') {
      if (sourceScreen === 'EventDetails') {
        navigation.navigate('EventDetails', {
          product_app_id,
          event_name: event_name || '',
          event_image: event_image || '',
          auto_register_id: null,
        });
      } else if (sourceScreen === 'RaceResultScreen') {
        navigation.navigate('RaceResultScreen', {
          product_app_id,
          event_name: event_name || '',
          event_image: event_image || '',
        });
      } else {
        if (product_app_id) {
          navigation.navigate('EventDetails', {
            product_app_id,
            event_name: event_name || '',
            event_image: event_image || '',
            auto_register_id: null,
          });
        } else {
          navigation.navigate('HomeScreen');
        }
      }
    } else if (currentRoute === 'FavouriteList') {
      if (sourceScreen === 'RaceResultScreen') {
        navigation.navigate('RaceResultScreen', {
          product_app_id,
          event_name: event_name || '',
          event_image: event_image || '',
        });
      } else {
        navigation.navigate('EventDetails', {
          product_app_id,
          event_name: event_name || '',
          event_image: event_image || '',
          auto_register_id: null,
        });
      }
    } else if (currentRoute === 'RaceResultScreen' || currentRoute === 'EventDetails') {
      // Already on the right screen — do nothing
    } else {
      if (product_app_id) {
        navigation.navigate('EventDetails', {
          product_app_id,
          event_name: event_name || '',
          event_image: event_image || '',
          auto_register_id: null,
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