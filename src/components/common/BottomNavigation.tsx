import React from 'react';
import { View, TouchableOpacity, Text, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { bottomNavStyles } from '../../styles/bottomNav.styles';

type TabName = 'Home' | 'Favorites' | 'Results' | 'Map';

interface BottomNavigationProps {
  activeTab?: TabName;
  product_app_id?: string | number;
  event_name?: string;
  event_image?: string | null;
  product_option_value_app_id?: string | number;
  sourceScreen?: string;
  selectedDistanceLabel?: string | number;
}

// ✅ Custom icon assets from assets folder
const TAB_ICONS: Record<TabName, any> = {
  Home:      require('../../../assets/home.png'),
  Favorites: require('../../../assets/favourites.png'),
  Results:   require('../../../assets/results.png'),
  Map:       require('../../../assets/map.png'),
};

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab = 'Home',
  product_app_id,
  event_name,
  event_image,
  product_option_value_app_id,
  sourceScreen,
  selectedDistanceLabel,
}) => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { t } = useTranslation('common');

  const tabs: { name: TabName; label: string }[] = [
    { name: 'Home',      label: t('nav.home') },
    { name: 'Favorites', label: t('nav.favorites') },
    { name: 'Results',   label: t('nav.results') },
    { name: 'Map',       label: t('nav.map') },
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
            event_image:event_image || '',
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
            event_image:event_image || '',
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
            event_image:event_image || '',
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
          event_image:event_image || '',
          auto_register_id: null,
        });
      } else if (sourceScreen === 'RaceResultScreen') {
        navigation.navigate('RaceResultScreen', {
          product_app_id,
          event_name: event_name || '',
          event_image:event_image || '',
        });
      } else {
        if (product_app_id) {
          navigation.navigate('EventDetails', {
            product_app_id,
            event_name: event_name || '',
            event_image:event_image || '',
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
          event_image:event_image || '',
        });
      } else {
        navigation.navigate('EventDetails', {
          product_app_id,
          event_name: event_name || '',
          event_image:event_image || '',
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
          event_image:event_image || '',
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
              source={TAB_ICONS[tab.name]}
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