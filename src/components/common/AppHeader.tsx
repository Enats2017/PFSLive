import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
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
  showBack?: boolean;            // show a back arrow on the left
  onBack?: () => void;           // optional custom handler (defaults to navigation.goBack)
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showLogo = true,
  logoimg = false,
  showSearch = false,
  product_app_id,
  product_option_value_app_id,
  raceStatus,
  showBack = false,
  onBack,
}) => {
  const navigation = useNavigation<any>();

  const handleBackPress = () => {
    if (onBack) return onBack();
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] });
  };

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

 const handleSettingPress = () => {
  navigation.navigate('LiveTrackingSettings');
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
      {/* Left — Back arrow (opt-in) + Home icon */}
      <View style={headerStyles.leftSection}>
        {showBack && (
          <TouchableOpacity
            style={headerStyles.backBtn}
            onPress={handleBackPress}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={32}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={headerStyles.logo}
          onPress={handleLogoPress}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                contentFit="contain"
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