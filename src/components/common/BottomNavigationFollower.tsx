import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { bottomNavStyles } from '../../styles/bottomNav.styles';

type TabName = 'Home' | 'Favorites' | 'Results' | 'Map';

interface BottomNavigationFollowerProps {
  activeTab?: TabName;
  product_app_id?: string | number;
  event_name?: string;
  product_option_value_app_id?: string | number;
  sourceTab?: 'past' | 'live' | 'upcoming';
}

export const BottomNavigationFollower: React.FC<BottomNavigationFollowerProps> = ({
  activeTab = 'Home',
  product_app_id,
  event_name,
  product_option_value_app_id,
  sourceTab
}) => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { t } = useTranslation('common');

  const tabs = [
    { name: 'Home' as TabName, icon: '🏠', label: t('nav.home') },
    { name: 'Favorites' as TabName, icon: '⭐', label: t('nav.favorites') },
    { name: 'Results' as TabName, icon: '📊', label: t('nav.results') },
    { name: 'Map' as TabName, icon: '🗺️', label: t('nav.map') },
  ];

  const handleTabPress = (tabName: TabName) => {
    console.log('Tab pressed:', tabName, {
      currentRoute: route.name,
      product_app_id,
      product_option_value_app_id,
    });

    switch (tabName) {
      case 'Home':
        handleHomeNavigation();
        break;

      case 'Results':
        if (product_app_id) {
          navigation.navigate('ResultList', {
            product_app_id,
            product_option_value_app_id,
            event_name: event_name || '',
            sourceScreen: route.name,
            sectionType: 'follower',
            sourceTab: sourceTab,
          });
        } else {
          console.log('Results: Missing product_app_id');
        }
        break;

      case 'Map':
        if (product_app_id && product_option_value_app_id) {
          navigation.navigate('Route', {
            product_app_id,
            product_option_value_app_id,
            event_name: event_name || '',
            sourceScreen: route.name,
            sectionType: 'follower',
          });
        } else {
          console.log('Map: Missing required parameters');
        }
        break;

      case 'Favorites':
        if (product_app_id) {
          navigation.navigate('FavouriteList', {
            product_app_id,
            event_name: event_name || '',
            sourceScreen: route.name,
            sourceTab: sourceTab,
            sectionType: 'follower',

          });
        }
        break;
    }
  };

  const handleHomeNavigation = () => {
    const currentRoute = route.name;

    console.log('🏠 Follower Home navigation:', {
      currentRoute,
      product_app_id,
      event_name: event_name || '',
    });

    if (currentRoute === 'FollowDetails') {
      console.log('📍 Already on FollowerList - staying');
    }
    else {
      if (product_app_id) {
        console.log('📍 Default → FollowerList');
        navigation.navigate('FollowDetails', {
          product_app_id,
          event_name: event_name || '',
          sourceTab: sourceTab,
        });
      } else {
        console.log('📍 Default → Home');
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
            <Text style={[bottomNavStyles.icon, isActive && bottomNavStyles.iconActive]}>
              {tab.icon}
            </Text>
            <Text style={[bottomNavStyles.label, isActive && bottomNavStyles.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
