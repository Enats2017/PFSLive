import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { bottomNavStyles } from '../../styles/bottomNav.styles';

type TabName = 'Home' | 'Favorites' | 'Results' | 'Map' | 'More';

interface BottomNavigationProps {
  activeTab?: TabName;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useTranslation('common');

  const currentTab = activeTab || (route.name === 'Home' ? 'Home' : route.name === 'Route' ? 'Map' : 'Home');

  const tabs = [
    { name: 'Home' as TabName, icon: '🏠', label: t('nav.home') },
    { name: 'Favorites' as TabName, icon: '⭐', label: t('nav.favorites') },
    { name: 'Results' as TabName, icon: '📊', label: t('nav.results') },
    { name: 'Map' as TabName, icon: '🗺️', label: t('nav.map') },
    { name: 'More' as TabName, icon: '⋯', label: t('nav.more') },
  ];

  const handleTabPress = (tabName: TabName) => {
    console.log('Tab pressed:', tabName);
    
    switch (tabName) {
      case 'Home':
        navigation.navigate('Home' as never);
        break;
      case 'Map':
        navigation.navigate('Route' as never, {
          eventId: '1',
          eventName: 'TMiler Mountain Trail',
        } as never);
        break;
      case 'Favorites':
      case 'Results':
      case 'More':
        console.log(`${tabName} screen not implemented yet`);
        break;
    }
  };

  return (
    <View style={bottomNavStyles.container}>
      {tabs.map((tab) => {
        const isActive = currentTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={bottomNavStyles.tab}
            onPress={() => handleTabPress(tab.name)}
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