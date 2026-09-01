import React from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { headerStyles } from '../../styles/header.styles';
import { useNavigation } from '@react-navigation/native';
import { tokenService } from '../../services/tokenService';
import { palette } from '../../styles/common.styles';

const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

export interface HeaderAction {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Read aloud by screen readers — icon-only buttons have no visible label. */
  accessibilityLabel: string;
}

interface AppHeaderProps {
  /** Screen name for the lime band. Omit to render the navy row alone. */
  title?: string;
  showLogo?: boolean;
  logoimg?: boolean;
  showSearch?: boolean;
  product_app_id?: number;
  product_option_value_app_id?: number | null;
  raceStatus?: 'finished' | 'in_progress' | 'not_started';
  showBack?: boolean;            // show a back arrow on the left
  onBack?: () => void;           // optional custom handler (defaults to navigation.goBack)
  /** Extra trailing icons, rendered before settings and profile. */
  actions?: HeaderAction[];
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
  actions,
}) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

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
    <View>
      {/* Light status bar content — the row behind it is navy on every screen. */}
      <StatusBar barStyle="light-content" backgroundColor={palette.navyDeep} />

      <LinearGradient
        colors={[palette.navyDeep, palette.navy, palette.navyLift]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        // The bar paints behind the status bar, so it carries the top inset.
        style={[headerStyles.bar, { paddingTop: insets.top + 16 }]}
      >
        <View style={headerStyles.row}>
          {showBack && (
            <TouchableOpacity
              style={headerStyles.iconBtn}
              onPress={handleBackPress}
              activeOpacity={0.7}
              hitSlop={HIT}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={23} color={palette.surface} />
            </TouchableOpacity>
          )}

          {showLogo && (
            <TouchableOpacity
              style={headerStyles.iconBtn}
              onPress={handleLogoPress}
              activeOpacity={0.7}
              hitSlop={HIT}
              accessibilityRole="button"
              accessibilityLabel="Home"
            >
              <Ionicons name="home-outline" size={21} color={palette.surface} />
            </TouchableOpacity>
          )}

          {logoimg ? (
            <View style={headerStyles.centerLogoWrap}>
              <Image
                // The navy wordmark is invisible on a navy bar; this is the white
                // version, lime accent preserved. See scripts/make-header-logo.mjs.
                source={require('../../../assets/livio_logo_header.png')}
                style={headerStyles.centerLogo}
                contentFit="contain"
              />
            </View>
          ) : (
            <View style={headerStyles.spacer} />
          )}

          {showSearch && (
            <TouchableOpacity
              style={headerStyles.iconBtn}
              onPress={handleSearchPress}
              activeOpacity={0.7}
              hitSlop={HIT}
              accessibilityRole="button"
              accessibilityLabel="Search participants"
            >
              <Ionicons name="search-outline" size={20} color={palette.textOnNavy} />
            </TouchableOpacity>
          )}

          {actions?.map((action) => (
            <TouchableOpacity
              key={action.icon}
              style={headerStyles.iconBtn}
              onPress={action.onPress}
              activeOpacity={0.7}
              hitSlop={HIT}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
            >
              <Ionicons name={action.icon} size={20} color={palette.textOnNavy} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={headerStyles.iconBtn}
            onPress={handleSettingPress}
            activeOpacity={0.7}
            hitSlop={HIT}
            accessibilityRole="button"
            accessibilityLabel="Tracking settings"
          >
            <Ionicons name="settings-outline" size={20} color={palette.textOnNavy} />
          </TouchableOpacity>

          <TouchableOpacity
            style={headerStyles.iconBtn}
            onPress={handleProfilePress}
            activeOpacity={0.7}
            hitSlop={HIT}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <Ionicons name="person-outline" size={20} color={palette.textOnNavy} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {!!title && (
        <View style={headerStyles.band}>
          <Text style={headerStyles.bandText} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </View>
  );
};
