import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StatusBar,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { BottomNavigation } from '../../components/common/BottomNavigation';
import { commonStyles } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import DistanceTab from './DistanceTab';
import type { EventDetailsProps } from '../../types/navigation';
import { API_CONFIG } from '../../constants/config';
import { useDimensions } from '../../hooks/useDimensions';

const EventDetails = ({ route }: EventDetailsProps) => {
  const { t } = useTranslation(['details']);
  const [refreshKey, setRefreshKey] = useState(0);
  const { width: windowWidth } = useDimensions();
  const insets = useSafeAreaInsets(); 
  const [containerWidth, setContainerWidth] = useState(0);
  const width = containerWidth || windowWidth;
  const isLandscape = windowWidth ;
  const isGestureNav = insets.bottom > 0;

  const { product_app_id, event_name, auto_register_id, event_image } = route.params;

  if (API_CONFIG.DEBUG) {
    console.log('📋 EventDetails params:', {
      product_app_id,
      event_name,
      auto_register_id,
    });
  }

  const handleRefresh = useCallback(() => {
    if (API_CONFIG.DEBUG) {
      console.log('🔄 Refreshing tab');
    }
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['top', 'left','right'] : ['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={true} />
      <View style={detailsStyles.section}>
        <Text style={detailsStyles.title}>{event_name}</Text>
      </View>
      
      <View style={{ flex: 1 }}>
        {product_app_id ? (
          <DistanceTab
            key={`distance-${refreshKey}`}
            product_app_id={product_app_id}
            event_name={event_name}
            event_image={event_image}
            auto_register_id={auto_register_id ?? null}
            onRefresh={handleRefresh}
          />
        ) : (
          <View style={commonStyles.centerContainer}>
            <Text style={commonStyles.errorText}>
              {t('details:error.missingId')}
            </Text>
          </View>
        )}
      </View>

      <BottomNavigation
        activeTab="Home"
        product_app_id={product_app_id}
        event_name={event_name}
      />
    </SafeAreaView>
  );
};

export default EventDetails;