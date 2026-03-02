import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import DistanceTab from './DistanceTab';
import ParticipantTab from './ParticipantTab';
import type { EventDetailsProps } from '../../types/navigation';
import { API_CONFIG } from '../../constants/config';

const { width } = Dimensions.get('window');

type Tab = 'Participant' | 'Distance';
const TABS: Tab[] = ['Participant', 'Distance'];

const EventDetails = ({ route }: EventDetailsProps) => {
  const { t } = useTranslation(['details']);
  const [activeTab, setActiveTab] = useState<Tab>('Distance');
  const [refreshKey, setRefreshKey] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const { product_app_id, event_name, auto_register_id } = route.params;

  if (API_CONFIG.DEBUG) {
    console.log('📋 EventDetails params:', {
      product_app_id,
      event_name,
      auto_register_id,
    });
  }

  // ✅ REFRESH CALLBACK (called after successful registration)
  const handleRefresh = useCallback(() => {
    if (API_CONFIG.DEBUG) {
      console.log('🔄 Refreshing both tabs');
    }
    setRefreshKey((prev) => prev + 1);
  }, []);

  const renderContent = useCallback(
    (tab: Tab) => {
      if (!product_app_id) {
        return (
          <View style={commonStyles.centerContainer}>
            <Text style={commonStyles.errorText}>
              {t('details:error.missingId')}
            </Text>
          </View>
        );
      }

      switch (tab) {
        case 'Distance':
          return (
            <DistanceTab
              key={`distance-${refreshKey}`}
              product_app_id={product_app_id}
              event_name={event_name}
              auto_register_id={auto_register_id ?? null}
              onRefresh={handleRefresh}
            />
          );
        case 'Participant':
          return (
            <ParticipantTab
              key={`participant-${refreshKey}`}
              product_app_id={product_app_id}
            />
          );
        default:
          return null;
      }
    },
    [product_app_id, event_name, auto_register_id, refreshKey, handleRefresh, t]
  );

  const handleTabPress = useCallback(
    (tab: Tab) => {
      const index = TABS.indexOf(tab);
      setActiveTab(tab);
      flatListRef.current?.scrollToIndex({ index, animated: true });
    },
    []
  );

  const handleSwipe = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveTab(TABS[index]);
  }, []);

  return (
    <SafeAreaView style={commonStyles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={true} />

      <View style={detailsStyles.section}>
        <Text style={commonStyles.title}>{event_name}</Text>
      </View>

      <View style={detailsStyles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={detailsStyles.tabItem}
            onPress={() => handleTabPress(tab)}
          >
            <Text
              style={[
                commonStyles.subtitle,
                activeTab === tab && detailsStyles.activeTabText,
              ]}
            >
              {t(`details:details.${tab}`)}
            </Text>
            {activeTab === tab && (
              <LinearGradient
                colors={['#e8341a', '#f4a100', '#1a73e8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={detailsStyles.underline}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={TABS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          onMomentumScrollEnd={handleSwipe}
          initialScrollIndex={TABS.indexOf('Distance')}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={{ width, flex: 1 }}>{renderContent(item)}</View>
          )}
          scrollEnabled={true}
        />
      </View>
    </SafeAreaView>
  );
};

export default EventDetails;