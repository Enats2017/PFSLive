import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Dimensions,
    
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, colors, spacing } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
 
import LiveTab from './LiveTab';
import PastTab from './PastTab';
import { AthleteEvent, AthleteProfile, eventService } from '../../services/athleteProfileService';
import { API_CONFIG } from '../../constants/config';
import { ownProfile } from '../../styles/ownProfile.styles';
import { useDimensions } from '../../hooks/useDimensions';

const { width, height } = Dimensions.get('window');

type Tab = 'Past' | 'Live';
const TABS: Tab[] = ['Past', 'Live'];
const LIVE_INDEX = TABS.indexOf('Live');
const TAB_CONTENT_HEIGHT = height * 0.56;

interface PaginationState {
    live: { page: number; total_pages: number };
    past: { page: number; total_pages: number };
}

export interface EventsContentProps {
    onBack: () => void;
    liveEvents: AthleteEvent[];
    pastEvents: AthleteEvent[];
    profile: AthleteProfile | null;
    loadMoreLive: () => void;
    loadMorePast: () => void;
    loadingMoreLive: boolean;
    loadingMorePast: boolean;
    pagination: PaginationState;
}

const EventsContent: React.FC<EventsContentProps> = ({
    onBack,
    liveEvents,
    pastEvents,
    profile,
    loadMoreLive,
    loadMorePast,
    loadingMoreLive,
    loadingMorePast,
    pagination,
}) => {
    const { t } = useTranslation(['profile','ownProfile']);
    const { width: windowWidth } = useDimensions(); // ← tablet/iPad fallback
    const [containerWidth, setContainerWidth] = useState(0);
    const width = containerWidth || windowWidth;
    const flatListRef = useRef<FlatList>(null);
    const activeTabRef = useRef<Tab>('Live');
    const [activeTab, setActiveTab] = React.useState<Tab>('Live');

    useEffect(() => {
            const index = TABS.indexOf(activeTabRef.current);
            const timer = setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index, animated: false });
            }, 80);
            return () => clearTimeout(timer);
        }, [width]);

    const handleTabPress = useCallback((tab: Tab) => {
        const index = TABS.indexOf(tab);
        setActiveTab(tab);
        activeTabRef.current = tab;
        flatListRef.current?.scrollToIndex({ index, animated: true });
    }, []);

    const handleSwipe = useCallback((e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        if (TABS[index] && TABS[index] !== activeTabRef.current) {
            setActiveTab(TABS[index]);
            activeTabRef.current = TABS[index];
        }
    }, [width]); 

    const renderTabContent = useCallback(({ item }: { item: Tab }) => (
        <View style={{ width }}>
            {item === 'Live' ? (
                <LiveTab
                    events={liveEvents}
                    onLoadMore={loadMoreLive}
                    loadingMore={loadingMoreLive}
                    hasMore={pagination.live.page < pagination.live.total_pages}
                    profile={profile ?? undefined}
                />
            ) : (
                <PastTab
                    events={pastEvents}
                    onLoadMore={loadMorePast}
                    loadingMore={loadingMorePast}
                    hasMore={pagination.past.page < pagination.past.total_pages}
                    profile={profile ?? undefined}
                />
            )}
        </View>
    ), [
        width,
        liveEvents, pastEvents,
        loadMoreLive, loadMorePast,
        loadingMoreLive, loadingMorePast,
        pagination, profile,
    ]);

    return (
        <View style={{ flex: 1 }} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
            <TouchableOpacity style={ownProfile.backRow} onPress={onBack} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={22} color={colors.gray900} />
                <Text style={ownProfile.backLabel}>{t('ownProfile:backbtn.events')}</Text>
            </TouchableOpacity>

            <View style={detailsStyles.tabBar}>
                {TABS.map(tab => {
                    const isActive = activeTab === tab;
                    return (
                        <TouchableOpacity
                            key={tab}
                            style={detailsStyles.tabItem}
                            onPress={() => handleTabPress(tab)}
                            activeOpacity={0.7}
                        >
                            <Text style={[commonStyles.subtitle, isActive && detailsStyles.activeTabText]}>
                                {t(`profile:tab.${tab}`)}
                            </Text>
                            {isActive && (
                                <LinearGradient
                                    colors={['#e8341a', '#f4a100', '#1a73e8']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={detailsStyles.underline}
                                />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Swipeable content */}
            <View style={{ height: TAB_CONTENT_HEIGHT }}>
                <FlatList
                    ref={flatListRef}
                    data={TABS}
                    horizontal
                    pagingEnabled
                    onLayout={() => { const index = TABS.indexOf(activeTabRef.current); 
                        flatListRef.current?.scrollToIndex({ index, animated: false });
                    }}
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={item => item}
                    nestedScrollEnabled={true}
                    onMomentumScrollEnd={handleSwipe}
                    initialScrollIndex={LIVE_INDEX}
                    scrollEnabled={true}
                    getItemLayout={(_, index) => ({
                        length: width,
                        offset: width * index,
                        index,
                    })}
                    renderItem={renderTabContent}
                />
            </View>
        </View>
    );
};



export default React.memo(EventsContent);