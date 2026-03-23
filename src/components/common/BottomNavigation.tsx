import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { bottomNavStyles } from '../../styles/bottomNav.styles';

type TabName = 'Home' | 'Favorites' | 'Results' | 'Map';

interface BottomNavigationProps {
  activeTab?: TabName;
  product_app_id?: string | number;
  event_name?: string;
  product_option_value_app_id?: string | number;
  sourceScreen?: string;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ 
  activeTab = 'Home',
  product_app_id,
  event_name,
  product_option_value_app_id,
  sourceScreen,
  // ✅ NEW PROP
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
      sourceScreen,
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
            sectionType: 'participant',
            sourceTab: 'live', 
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
            sectionType: 'participant', // ✅ PASS CURRENT SCREEN AS SOURCE
          });
        } else {
          console.log('Map: Missing required parameters');
        }
        break;
        
      case 'Favorites':
         if(product_app_id){
          navigation.navigate('FavouriteList',{
            product_app_id,
            event_name: event_name || '',
            sourceScreen: route.name,
             sectionType: 'participant',
             product_option_value_app_id,
              sourceTab: 'live', 
          });
        }
        break;
    }
  };

  // ✅ SMART HOME NAVIGATION WITH SOURCE TRACKING
  const handleHomeNavigation = () => {
    const currentRoute = route.name;

    console.log('🏠 Home navigation:', {
      currentRoute,
      sourceScreen,
      product_app_id,
    });

    // ✅ CASE 1: ON RESULTLIST
    if (currentRoute === 'ResultList') {
      // Check where we came from
      if (sourceScreen === 'EventDetails') {
        // Came from EventDetails → Go back to EventDetails
        console.log('📍 ResultList (from EventDetails) → EventDetails');
        navigation.navigate('EventDetails', {
          product_app_id,
          event_name: event_name || '',
          auto_register_id: null,
        });
      } else if (sourceScreen === 'RaceResultScreen') {
        // Came from RaceResultScreen → Go back to RaceResultScreen
        console.log('📍 ResultList (from RaceResultScreen) → RaceResultScreen');
        navigation.navigate('RaceResultScreen', {
          product_app_id,
          event_name: event_name || '',
        });
      } else {
        // Default: Go to EventDetails
        console.log('📍 ResultList (unknown source) → EventDetails');
        if (product_app_id) {
          navigation.navigate('EventDetails', {
            product_app_id,
            event_name: event_name || '',
            auto_register_id: null,
          });
        } else {
          navigation.navigate('HomeScreen');
        }
      }
    }

     else if (currentRoute === 'FavouriteList') {
      if (sourceScreen === 'RaceResultScreen') {
        navigation.navigate('RaceResultScreen', {
          product_app_id,
          event_name: event_name || '',
        });
      } else {
        navigation.navigate('EventDetails', {
          product_app_id,
          event_name: event_name || '',
          auto_register_id: null,
        });
      }
    }
    // ✅ CASE 2: ON RACERESULTSCREEN → STAY
    else if (currentRoute === 'RaceResultScreen') {
      console.log('📍 Already on RaceResultScreen - staying');
      // Do nothing, already on the right screen
    }
    // ✅ CASE 3: ON EVENTDETAILS → STAY
    else if (currentRoute === 'EventDetails') {
      console.log('📍 Already on EventDetails - staying');
      // Do nothing, already on the right screen
    }
    // ✅ CASE 4: DEFAULT
    else {
      if (product_app_id) {
        console.log('📍 Default → EventDetails');
        navigation.navigate('EventDetails', {
          product_app_id,
          event_name: event_name || '',
          auto_register_id: null,
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