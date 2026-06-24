import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { headerStyles } from '../../styles/header.styles';
import { useNavigation } from '@react-navigation/native';
import { tokenService } from '../../services/tokenService';
import { colors } from '../../styles/common.styles';


interface AppHeaderProps {
  title?: string;
  showLogo?: boolean;
  logoimg?:boolean;
  showSearch?: boolean;
  product_app_id?: number;
  product_option_value_app_id?: number | null;
  raceStatus?: 'finished' | 'in_progress' | 'not_started';
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showLogo = true,
  logoimg = false,
  showSearch = false,
  product_app_id,
  product_option_value_app_id,
  raceStatus,
}) => {
  const navigation = useNavigation<any>();

  // ✅ Clears entire stack — no back history
  const handleLogoPress = () => {
    navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] });
  };

  const handleProfilePress = async () => {
    const isValid = await tokenService.isTokenValid();
    if (isValid) {
      const customer_app_id = await tokenService.getCustomerId();
      navigation.navigate('OwnProfile', { customer_app_id });
    } else {
      navigation.navigate('LoginScreen');
    }
  };

  const handleSettingPress = async () => {
    const isValid = await tokenService.isTokenValid();
    if (isValid) {
      navigation.navigate('LiveTrackingSettings');
    } else {
      navigation.navigate('LoginScreen');
    }
  };

  // ✅ Guard: only navigate if product_app_id is defined
  const handleSearchPress = () => {
    if (!product_app_id) return;
    navigation.navigate('SearchParticipant', {
      product_app_id,
      product_option_value_app_id: product_option_value_app_id ?? undefined,
      raceStatus,
    });
  };

  return (
    <View style={headerStyles.container}>
      {/* Left — Home Icon */}
      <View style={headerStyles.leftSection}>
        <TouchableOpacity
          style={headerStyles.logo}
          onPress={handleLogoPress}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="home-variant"
            size={32}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>
      {logoimg  && (  
        <View style={headerStyles.centerSection}>
          <Image
                source={require('../../../assets/livio_logo_transparent.png')}
                style={headerStyles.centerLogo}
                resizeMode="contain"
              />
              </View>
        )
      }

      {/* Center — Title */}
      {title && (
        <View style={headerStyles.centerSection}>
          <Text style={headerStyles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}

      {/* Right — Actions */}
      <View style={headerStyles.rightSection}>
        {showSearch && (
          <TouchableOpacity
            style={headerStyles.searchButton}
            onPress={handleSearchPress}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="account-search"
              size={30}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}
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