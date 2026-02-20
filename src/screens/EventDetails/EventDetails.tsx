import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import DistanceTab from './DistanceTab';        
import ParticipantTab from './ParticipantTab';  

const { width } = Dimensions.get('window');
type Tab = 'Participant' | 'Distance';
const TABS: Tab[] = ['Participant', 'Distance'];

interface EventDetailsProps {
    route?: { params?: { 
        product_app_id?: string | number;
        event_name?: string; 
    }};
    
    navigation?: any;
}

const EventDetails = ({ route, navigation }: EventDetailsProps) => {
    const { t } = useTranslation(['event']);
    const [activeTab, setActiveTab] = useState<Tab>('Distance');
    const flatListRef = useRef<FlatList>(null);

    const product_app_id = route?.params?.product_app_id;
    const event_name = route?.params?.event_name;

    const renderContent = (tab: Tab) => {
        if (!product_app_id) return null;
        switch (tab) {
            case 'Distance':    return <DistanceTab product_app_id={product_app_id} />;
            case 'Participant': return <ParticipantTab product_app_id={product_app_id} />;
        }
    };

    const handleTabPress = (tab: Tab) => {
        setActiveTab(tab);
        flatListRef.current?.scrollToIndex({ index: TABS.indexOf(tab), animated: true });
    };

    const handleSwipe = (e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width);
        setActiveTab(TABS[index]);
    };

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={true} />

            <View style={eventStyles.section}>
                <Text style={commonStyles.title}>{event_name}</Text>
            </View>

            <View style={eventStyles.tabBar}>
                {TABS.map((tab) => (
                    <TouchableOpacity key={tab} style={eventStyles.tabItem} onPress={() => handleTabPress(tab)}>
                        <Text style={[commonStyles.subtitle, activeTab === tab && eventStyles.activeTabText]}>
                            {t(`event:details.${tab}`)}
                        </Text>
                        {activeTab === tab && (
                            <LinearGradient
                                colors={['#e8341a', '#f4a100', '#1a73e8']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={eventStyles.underline}
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
                        <View style={{ width, padding: 16 }}>
                            {renderContent(item)}
                        </View>
                    )}
                />
            </View>
        </SafeAreaView>
    );
};

export default EventDetails;

