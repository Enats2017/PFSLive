import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import DistanceTab from './DistanceTab';
import ParticipantTab from '../EventDetails/ParticipantTab';
import type { followerDetailspops } from '../../types/navigation';
import { BottomNavigationFollower } from '../../components/common/BottomNavigationFollower';
import { useDimensions } from '../../hooks/useDimensions';

type Tab = 'Participant' | 'Distance';
const TABS: Tab[] = ['Participant', 'Distance'];

const FollowerDetails = ({ route }: followerDetailspops) => {
  const { t } = useTranslation(['details']);
  const { width: windowWidth } = useDimensions();
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);
  const isGestureNav = insets.bottom > 0;
  const width = containerWidth || windowWidth;
  const isLandscape = width

  const [activeTab, setActiveTab] = useState<Tab>('Distance');
  const activeTabRef = useRef<Tab>('Distance');
  const flatListRef = useRef<FlatList>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set(['Distance']));
  const { product_app_id, event_name, sourceTab, event_image } = route.params;

  useEffect(() => {
    const index = TABS.indexOf(activeTabRef.current);
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [width]);


  const renderHeader = useCallback(() => (
    <View style={detailsStyles.section}>
      <Text style={commonStyles.title}>{event_name}</Text>
    </View>
  ), [event_name]);

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
        return (
          <DistanceTab
            product_app_id={product_app_id}
            sourceTab={sourceTab}
            event_name={event_name}
            event_image={event_image}
          />
        );
      case 'Participant':
        if (!visitedTabs.has('Participant')) return null;
        return (
          <ParticipantTab
            product_app_id={product_app_id}
            event_image={event_image}
          />
        );
      default:
        return null;
    }
  }, [product_app_id, sourceTab, event_name, event_image, visitedTabs, t]);

  const handleTabPress = useCallback((tab: Tab) => {
    const index = TABS.indexOf(tab);
    activeTabRef.current = tab;
    setActiveTab(tab);
    setVisitedTabs(prev => new Set(prev).add(tab));
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const handleSwipe = useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    const swipedTab = TABS[index];
    if (swipedTab && swipedTab !== activeTabRef.current) {
      activeTabRef.current = swipedTab;
      setActiveTab(swipedTab);
      setVisitedTabs(prev => new Set(prev).add(swipedTab));
    }
  }, [width]);

  return (
    <SafeAreaView
      style={commonStyles.container}
      edges={isLandscape && !isGestureNav ? ['top', 'left', 'right'] : ['top', 'bottom']}
    >
      <StatusBar barStyle="dark-content" />
      <AppHeader showLogo={true} />

      <View
        style={{ flex: 1 }}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >

        {renderHeader()}

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
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            renderItem={({ item }) => (
              <View style={{ width, flex: 1 }}>{renderContent(item)}</View>
            )}
          />
        </View>
      </View>

      <BottomNavigationFollower
        activeTab="Home"
        product_app_id={product_app_id}
        event_name={event_name}
        event_image={event_image}
        product_option_value_app_id={0}
        sourceTab={sourceTab}
      />
    </SafeAreaView>
  );
};

export default FollowerDetails;