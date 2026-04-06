import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { headerStyles } from '../../styles/header.styles';
import { useNavigation } from '@react-navigation/native';
import { tokenService } from '../../services/tokenService';

interface AppHeaderProps {
  title?: string;
  showLogo?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showLogo = true,
}) => {
  const navigation = useNavigation<any>();

  const handleLogoPress = () => {
    navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] });
  };

  const handleProfilePress = async () => {
    const isValid = await tokenService.isTokenValid();
    if (isValid) {
      const customer_app_id = await tokenService.getCustomerId();
      navigation.navigate('ProfileScreen', {
        customer_app_id: customer_app_id,
      });
    } else {
      navigation.navigate('LoginScreen');
    }
  };

    const handleSettingPress = async () => {
    const isValid = await tokenService.isTokenValid();
    if (isValid) {
     navigation.navigate('LiveTrackingSettings')
    } else {
      navigation.navigate('LoginScreen');
    }
  };

  return (
    <View style={headerStyles.container}>
      {/* Left Side - Logo Image (Clickable) */}
      <View style={headerStyles.leftSection}>
        <TouchableOpacity 
          style={headerStyles.logo}
          onPress={handleLogoPress}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../../assets/header-logo.png')}
            style={headerStyles.logoImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>

      {/* Center - Title (only if provided) */}
      {title && (
        <View style={headerStyles.centerSection}>
          <Text style={headerStyles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}

      {/* Right Side - Settings and Profile Icons */}
      <View style={headerStyles.rightSection}>
        <TouchableOpacity
          style={headerStyles.iconButton}
          onPress={handleSettingPress}
        >
          <Text style={headerStyles.icon}>⚙️</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={headerStyles.iconButton}
          onPress={handleProfilePress}
        >
          <Text style={headerStyles.icon}>👤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};