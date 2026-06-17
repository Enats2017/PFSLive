import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Image,
  // ✅ REMOVE Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles, spacing } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import DistanceTab from './DistanceTab';
import ParticipantTab from '../EventDetails/ParticipantTab';
import type { followerDetailspops } from '../../types/navigation';
import { BottomNavigationFollower } from '../../components/common/BottomNavigationFollower';
import { useDimensions } from '../../hooks/useDimensions';  // ✅ your custom hook

// ✅ REMOVE: const { width } = Dimensions.get('window');

type Tab = 'Participant' | 'Distance';
const TABS: Tab[] = ['Participant', 'Distance'];

const FollowerDetails = ({ route }: followerDetailspops) => {
  const { t } = useTranslation(['details']);
  const { width } = useDimensions();  // ✅ reactive

  const [activeTab, setActiveTab] = useState<Tab>('Distance');
  const activeTabRef = useRef<Tab>('Distance');  // ✅ stale closure fix
  const flatListRef = useRef<FlatList>(null);

  const { product_app_id, event_name, sourceTab, event_image } = route.params;

  // ✅ re-sync scroll on rotation
  useEffect(() => {
    const index = TABS.indexOf(activeTabRef.current);
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [width]);

  const renderContent = useCallback((tab: Tab) => {
    if (!product_app_id) {
      return (
        <View style={commonStyles.centerContainer}>
          <Text style={commonStyles.errorText}>{t('details:error.missingId')}</Text>
        </View>
      );
    }
    switch (tab) {
      case 'Distance':
        return <DistanceTab product_app_id={product_app_id} sourceTab={sourceTab} event_name={event_name} />;
      case 'Participant':
        return <ParticipantTab product_app_id={product_app_id} />;
      default:
        return null;
    }
  }, [product_app_id, sourceTab, event_name, t]);

  // ✅ sync both state and ref
  const handleTabPress = useCallback((tab: Tab) => {
    const index = TABS.indexOf(tab);
    activeTabRef.current = tab;
    setActiveTab(tab);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  // ✅ width in deps, ref for comparison
  const handleSwipe = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    const swipedTab = TABS[index];
    if (swipedTab && swipedTab !== activeTabRef.current) {
      activeTabRef.current = swipedTab;
      setActiveTab(swipedTab);
    }
  }, [width]);

  return (
    <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={true} />

      <View style={detailsStyles.section}>
        <Text style={commonStyles.title}>{event_name}</Text>
      </View>

      {event_image ? (
        <Image
          source={{ uri: event_image }}
          style={{ width: '100%', aspectRatio: 2.3, resizeMode: 'cover', marginBottom: spacing.sm }}
        />
      ) : null}

      {/* TAB BAR */}
      <View style={detailsStyles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab} style={detailsStyles.tabItem} onPress={() => handleTabPress(tab)}>
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

      {/* TAB CONTENT */}
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
          onLayout={() => {  // ✅ re-sync after rotation
            const index = TABS.indexOf(activeTabRef.current);
            flatListRef.current?.scrollToIndex({ index, animated: false });
          }}
          getItemLayout={(_, index) => ({
            length: width,          // ✅ reactive
            offset: width * index,  // ✅ reactive
            index,
          })}
          renderItem={({ item }) => (
            <View style={{ width, flex: 1 }}>{renderContent(item)}</View>  // ✅ reactive
          )}
          scrollEnabled
        />
      </View>

      <BottomNavigationFollower
        activeTab="Home"
        product_app_id={product_app_id}
        event_name={event_name}
        product_option_value_app_id={0}
        sourceTab={sourceTab}
      />
    </SafeAreaView>
  );
};

export default FollowerDetails;