import React from 'react';
import { View, TouchableOpacity, Text, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { palette } from '../../styles/common.styles';
import { bottomNavStyles } from '../../styles/bottomNav.styles';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_PARAMS, ANALYTICS_BUTTONS } from '../../constants/analyticsScreens';

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

const NAV_BUTTONS: Record<TabName, string> = {
  Home:      ANALYTICS_BUTTONS.NAV_HOME,
  Favorites: ANALYTICS_BUTTONS.NAV_FAVORITES,
  Results:   ANALYTICS_BUTTONS.NAV_RESULTS,
  Map:       ANALYTICS_BUTTONS.NAV_MAP,
};

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
  // ✅ Landscape (audit 2026-10-23): the 79pt bar (icon over label) was ~40%
  // of a ~200pt body - the live map was a ~60-100pt strip, a details list
  // showed only its header image. There the label sits beside the icon
  // (~43pt). Portrait unchanged.
  const { width: navW, height: navH } = useWindowDimensions();
  const slim = navW > navH;

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
      ANALYTICS_SCREENS.BOTTOM_NAV_FOLLOWER,
      NAV_BUTTONS[tabName],
      'tap',
      // The nav renders inside a race context on the race screens and outside it
      // elsewhere, so event_name is optional here. omitEmptyParams drops it when
      // absent rather than sending an empty string, which GA4 would treat as a
      // real value and let pollute the race_name breakdown.
      { [ANALYTICS_PARAMS.EVENT_NAME]: event_name ?? '' },
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
    <View style={[bottomNavStyles.container, slim && bottomNavStyles.containerSlim]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={[bottomNavStyles.tab, slim && bottomNavStyles.tabSlim]}
            onPress={() => handleTabPress(tab.name)}
            activeOpacity={0.7}
          >
            {/* ✅ tintColor as a PROP — expo-image ignores it in a StyleSheet.
                See the note in BottomNavigation.tsx. */}
            <View style={isActive ? bottomNavStyles.pill : bottomNavStyles.pillGhost}>
              <Image
                source={tab.icon}
                style={bottomNavStyles.iconImage}
                tintColor={isActive ? palette.ink : palette.textMuted}
                contentFit="contain"
              />
            </View>
            {/* ✅ One line, shrunk to fit (layout audit 2026-10-22): with larger iOS
                text "Participants" / "Startpagina" broke mid-word in an 80pt tab at
                320pt and the wrapped tab's icon rose above the others. At default
                text every label already fits (audit27/33), so nothing shrinks. */}
            <Text
              style={[bottomNavStyles.label, isActive && bottomNavStyles.labelActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};