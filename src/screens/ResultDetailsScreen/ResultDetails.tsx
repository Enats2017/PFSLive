
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Dimensions, ScrollView, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlatList } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ResultDetailspops } from '../../types/navigation';
import RaceInfoTab from './RaceInfoTab';
import TimingPointTab from './TimingPointTab';
import RunnerInfoTab from './RunnerInfoTab';
import AwardsTab from './AwardsTab';
import Entypo from '@expo/vector-icons/Entypo';
import { resultInfoStyles as s } from '../../styles/resultDetails.styles';
import { colors, commonStyles } from '../../styles/common.styles';
import RaceLive from './RaceLive';
import { useFollowManager } from '../../hooks/useFollowManager';
import LiveTimingPoint from './LiveTimingPoint';
import { useResultDetail } from '../../hooks/useResultDetail';

type TabKey = 'raceInfo' | 'timingPoint' | 'runnerInfo' | 'awards';
const TAB_KEYS: TabKey[] = ['raceInfo', 'timingPoint', 'runnerInfo', 'awards'];

const { width } = Dimensions.get('window');

const ResultDetails: React.FC<ResultDetailspops> = ({ navigation, route }) => {
    const { t } = useTranslation('resultdetails');
    const {
        raceStatus,
        product_app_id,
        product_option_value_app_id,
        bib,
        from_live,
    } = route.params;

    const { data, loading, error, retry } = useResultDetail(
        product_app_id,
        product_option_value_app_id,
        bib,
        from_live ?? 0,
    );

    console.log("111", data);


    console.log("11111", raceStatus);
    console.log("product_app_id", product_app_id);
    console.log("product_option_value_app_id", product_option_value_app_id);
    console.log("bib", bib);
    const { isFollowed, isLoading, toggleFollow, refreshFollowedUsers } = useFollowManager(t);
    const [activeTab, setActiveTab] = useState<TabKey>('raceInfo');
    const flatListRef = useRef<FlatList<TabKey>>(null);
    const tabScrollRef = useRef<ScrollView>(null);

    const handleTabPress = useCallback((tab: TabKey) => {
        const index = TAB_KEYS.indexOf(tab);
        setActiveTab(tab);
        flatListRef.current?.scrollToIndex({ index, animated: true });
        tabScrollRef.current?.scrollTo({
            x: index * (width / 3) - width / 6,   // center the active tab
            animated: true,
        });
    }, []);

    const handleSwipe = useCallback((e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        if (index >= 0 && index < TAB_KEYS.length) {
            const tab = TAB_KEYS[index];
            setActiveTab(tab);
            tabScrollRef.current?.scrollTo({
                x: index * (width / 3) - width / 6,
                animated: true,
            });
        }
    }, []);

    const renderTabPage = useCallback(({ item }: { item: TabKey }) => (
        <View style={s.page}>
            {item === 'raceInfo' && (
                raceStatus === 'in_progress'
                    ? <RaceLive raceInfo={data?.race_info} event={data?.event} />
                    : <RaceInfoTab raceInfo={data?.race_info} event={data?.event} />
            )}
            {item === 'timingPoint' && (
                raceStatus === 'finished'
                    ? <LiveTimingPoint checkpoints={data?.checkpoints} />
                    : <TimingPointTab checkpoints={data?.checkpoints} />
            )}
            {item === 'runnerInfo' && (
                <RunnerInfoTab runnerInfo={data?.runner_info} />
            )}
            {item === 'awards' && <AwardsTab />}
        </View>
    ), [data, raceStatus]);
    return (
        <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="dark-content" />
            <View style={s.header}>
                <TouchableOpacity
                    style={s.headerBackBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => navigation.goBack()}
                >
                    <Ionicons name="chevron-back" size={32} color={colors.gray900} />
                </TouchableOpacity>

                <View style={s.headerCenter}>
                    <Text style={commonStyles.title}> {data?.race_info.name ?? '...'}</Text>
                    <Text style={commonStyles.text}> {data?.race_info.bib ?? ''}</Text>
                </View>
                {
                    raceStatus == 'in_progress' && (
                        <>
                            <TouchableOpacity
                                onPress={() => toggleFollow}>
                                {
                                    isFollowed ?
                                        <Entypo name="heart" size={30} color="black" /> :
                                        <Entypo name="heart-outlined" size={30} color="black" />
                                }
                            </TouchableOpacity>
                            <TouchableOpacity>
                                <Entypo name="share" size={30} color="black" />
                            </TouchableOpacity>

                        </>

                    )
                }


            </View>

            <View>
                <ScrollView
                    ref={tabScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.tabBarContent}
                    scrollEventThrottle={16}
                >
                    {TAB_KEYS.map((tabKey) => (
                        <TouchableOpacity
                            key={tabKey}
                            style={s.tabItem}
                            onPress={() => handleTabPress(tabKey)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                commonStyles.text,
                                activeTab === tabKey && s.tabTextActive,
                            ]}>
                                {t(`tabs.${tabKey}`)}
                            </Text>

                            {activeTab === tabKey && (
                                <LinearGradient
                                    colors={['#e8341a', '#f4a100', '#1a73e8']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={s.tabUnderline}
                                />
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                ref={flatListRef}
                data={TAB_KEYS}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item}
                renderItem={renderTabPage}
                onMomentumScrollEnd={handleSwipe}
                initialScrollIndex={0}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
                style={s.pageList}
            />
        </SafeAreaView>
    );
};

export default ResultDetails;
