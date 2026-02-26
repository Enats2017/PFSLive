import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import DistanceTab from './DistanceTab';
import ParticipantTab from './ParticipantTab';
import type { EventDetailsProps } from '../../types/navigation';

const { width } = Dimensions.get('window');
type Tab = 'Participant' | 'Distance';
const TABS: Tab[] = ['Participant', 'Distance']; // ✅ Order stays the same

const EventDetails = ({ route }: EventDetailsProps) => {
  const { t } = useTranslation(['details']);
  const [activeTab, setActiveTab] = useState<Tab>('Distance'); // ✅ DEFAULT TO DISTANCE
  const flatListRef = useRef<FlatList>(null);

  const { product_app_id, event_name } = route.params;

  const renderContent = (tab: Tab) => {
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
        return <DistanceTab product_app_id={product_app_id} />;
      case 'Participant':
        return <ParticipantTab product_app_id={product_app_id} />;
      default:
        return null;
    }
  };

  const handleTabPress = (tab: Tab) => {
    const index = TABS.indexOf(tab);
    setActiveTab(tab);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleSwipe = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveTab(TABS[index]);
  };

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
            <Text style={[commonStyles.subtitle, activeTab === tab && detailsStyles.activeTabText]}>
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
          initialScrollIndex={TABS.indexOf('Distance')} // ✅ START AT DISTANCE (index 1)
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index
          })}
          renderItem={({ item }) => (
            <View style={{ width, flex: 1 }}>
              {renderContent(item)}
            </View>
          )}
          scrollEnabled={true}
        />
      </View>
    </SafeAreaView>
  );
};

export default EventDetails;