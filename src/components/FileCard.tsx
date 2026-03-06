
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { personalStyles } from '../styles/personalEvent.styles';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/common.styles';
import React from 'react';

interface FileCardProps {
  fileName: string;
  fileSubtitle: string;
  disabled: boolean;
  onSwapOrView: () => void;
  onRemoveOrDiscard: () => void;
  swapIcon: React.ComponentProps<typeof Ionicons>['name'];
}

 export const FileCard = React.memo<FileCardProps>(({
  fileName, fileSubtitle, disabled, onSwapOrView, onRemoveOrDiscard, swapIcon,
}) => (
  <View style={personalStyles.fileCard}>
    <View style={personalStyles.fileLeft}>
      <View style={personalStyles.fileIconContainer}>
        <Ionicons name="document-outline" size={28} color={colors.primary} />
      </View>
      <View style={personalStyles.fileDetails}>
        <Text numberOfLines={1} style={personalStyles.fileName}>{fileName}</Text>
        <Text style={personalStyles.fileSize}>{fileSubtitle}</Text>
      </View>
    </View>
    <View style={personalStyles.actions}>
      <TouchableOpacity style={personalStyles.actionButton} onPress={onSwapOrView} disabled={disabled}>
        <Ionicons name={swapIcon} size={20} color={colors.gray600} />
      </TouchableOpacity>
      <TouchableOpacity style={personalStyles.actionButton} onPress={onRemoveOrDiscard} disabled={disabled}>
        <Ionicons name="close-circle" size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  </View>
));