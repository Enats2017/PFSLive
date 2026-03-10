import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { bottomNavStyles } from '../../styles/bottomNav.styles';

type TabName = 'Home' | 'Favorites' | 'Results' | 'Map';

interface BottomNavigationProps {
  activeTab?: TabName;
  product_app_id?: string | number;
  event_name?: string;
  product_option_value_app_id?: string | number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ 
  activeTab = 'Home',
  product_app_id,
  event_name,
  product_option_value_app_id,
}) => {
  const navigation = useNavigation<any>(); // ✅ Use any type for navigation
  const { t } = useTranslation('common');

  const tabs = [
    { name: 'Home' as TabName, icon: '🏠', label: t('nav.home') },
    { name: 'Favorites' as TabName, icon: '⭐', label: t('nav.favorites') },
    { name: 'Results' as TabName, icon: '📊', label: t('nav.results') },
    { name: 'Map' as TabName, icon: '🗺️', label: t('nav.map') },
  ];

  const handleTabPress = (tabName: TabName) => {
    console.log('Tab pressed:', tabName, { product_app_id, product_option_value_app_id });
    
    switch (tabName) {
      case 'Home':
        if (product_app_id) {
          // ✅ Navigate to EventDetails with product_app_id
          navigation.navigate('EventDetails', {
            product_app_id,
            event_name,
            auto_register_id: null,
          });
        } else {
          // ✅ Navigate to Home screen
          navigation.navigate('Home');
        }
        break;
        
      case 'Results':
        if (product_app_id) {
          // ✅ Navigate to ResultList
          navigation.navigate('ResultList', {
            product_app_id,
            product_option_value_app_id,
          });
        } else {
          console.log('Results: Missing required parameters');
        }
        break;
        
      case 'Map':
        if (product_app_id && product_option_value_app_id) {
          // ✅ Navigate to Route
          navigation.navigate('Route', {
            product_app_id,
            product_option_value_app_id,
            event_name: '',
          });
        } else {
          console.log('Map: Missing required parameters');
        }
        break;
        
      case 'Favorites':
        console.log('Favorites screen not implemented yet');
        break;
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