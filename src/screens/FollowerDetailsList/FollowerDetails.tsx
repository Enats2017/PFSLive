import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
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
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS } from '../../constants/analyticsScreens';

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

  const [showResults, setShowResults] = useState(true);
  const [raceDate, setRaceDate] = useState<string | null>(null);
  

  useEffect(() => {
    const index = TABS.indexOf(activeTabRef.current);
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: false });
    }, 80);
    return () => clearTimeout(timer);
  }, [width]);


  // The event name lives in the header band now, so this would repeat it.
  const renderHeader = useCallback(() => null, []);

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
            onResultsAvailability={setShowResults}
            onRaceDateAvailable={setRaceDate}
          />
        );
      case 'Participant':
        if (!visitedTabs.has('Participant')) return null;
        return (
          <ParticipantTab
            product_app_id={product_app_id}
            event_image={event_image}
            showResults={showResults}
          />
        );
      default:
        return null;
    }
  }, [product_app_id, sourceTab, event_name, event_image, visitedTabs, showResults, t]);

  const handleTabPress = useCallback((tab: Tab) => {
    void analyticsService.logInteraction(
      ANALYTICS_SCREENS.FOLLOWER_DETAILS,
      ANALYTICS_BUTTONS.TAB,
      'tap',
      { tab_name: tab },
    );
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
      void analyticsService.logInteraction(
        ANALYTICS_SCREENS.FOLLOWER_DETAILS,
        ANALYTICS_BUTTONS.TAB,
        'swipe',
        { tab_name: swipedTab },
      );
      activeTabRef.current = swipedTab;
      setActiveTab(swipedTab);
      setVisitedTabs(prev => new Set(prev).add(swipedTab));
    }
  }, [width]);

  return (
    <SafeAreaView
      style={commonStyles.container}
      edges={isLandscape && !isGestureNav ? ['left', 'right'] : ['bottom']}
    >
      <AppHeader title={event_name} showLogo={true} showBack />

      <View
        style={{ flex: 1 }}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >

        {renderHeader()}

        {/* ✅ In-page content tabs — lime underline on white, per the deck.
            These were the navy pill group, which the design reserves for
            FILTERS (event Past/Live/Upcoming), not for switching content. */}
        <View style={detailsStyles.tabBarUnderline}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[detailsStyles.tabItemUnderline, activeTab === tab && detailsStyles.tabItemUnderlineActive]}
              onPress={() => handleTabPress(tab)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab }}
            >
              <Text style={[detailsStyles.tabTextUnderline, activeTab === tab && detailsStyles.tabTextUnderlineActive]}>
                {t(`details:details.${tab}`)}
              </Text>
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
        showResults={showResults}
        race_date={raceDate} 
      />
    </SafeAreaView>
  );
};

export default FollowerDetails;