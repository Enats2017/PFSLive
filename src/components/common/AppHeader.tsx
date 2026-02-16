import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { headerStyles } from '../../styles/header.styles';

interface AppHeaderProps {
  title?: string;
  showLogo?: boolean; // Always show logo instead of back button
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showLogo = true, // Default to showing logo
}) => {
  return (
    <View style={headerStyles.container}>
      {/* Left Side - Always Logo */}
      <View style={headerStyles.leftSection}>
        <View style={headerStyles.logo}>
          <Text style={headerStyles.logoIcon}>P</Text>
        </View>
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
          onPress={() => console.log('Settings pressed')}
        >
          <Text style={headerStyles.icon}>⚙️</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={headerStyles.iconButton}
          onPress={() => console.log('Profile pressed')}
        >
          <Text style={headerStyles.icon}>👤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};