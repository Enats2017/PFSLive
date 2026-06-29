import React, { useCallback, useEffect, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { particpant } from '../../styles/participantscreen.styles';
import { AppHeader } from '../../components/common/AppHeader';
import SearchInput from '../../components/SearchInput';
import { ParticipantScreenpops } from '../../types/navigation';
import { tokenService } from '../../services/tokenService';
import { SuggestionItem } from '../../services/followerScreenService';
import SuggestionDropdown from '../../components/SuggestionDropdown';
import useSearchSuggestions from '../../hooks/useSearchSuggestions';
import { useDimensions } from '../../hooks/useDimensions';
import { eventService, EventItem } from '../../services/followerEvent';
import { fanstyle } from '../../styles/fan.styles';
import EventCard from '../../components/EventCard';

const ParticipantScreen: React.FC<ParticipantScreenpops> = () => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['participant']);
    const { width } = useDimensions();
    const insets = useSafeAreaInsets();
    const isGestureNav = insets.bottom > 0;
    const isLandscape = width
    const [events, setEvents] = useState<EventItem[]>([]);
    const [visibleCount, setVisibleCount] = useState(3);

    const liveUpcoming = useSearchSuggestions('filter_name', ['live', 'upcoming']);

    useEffect(() => {
        const load = async () => {
            try {
                const [page1, page2] = await Promise.all([
                    eventService.getEvents({ page_live: 1, page_upcoming: 1 }),
                    eventService.getEvents({ page_live: 2, page_upcoming: 2 }),
                ]);
                const seen = new Set<string>();
                const unique = [
                    ...page1.tabs.live,
                    ...page2.tabs.live,
                    ...page1.tabs.upcoming,
                    ...page2.tabs.upcoming,
                ].filter(e => {
                    if (seen.has(e.product_app_id)) return false;
                    seen.add(e.product_app_id);
                    return true;
                });
                setEvents(unique.slice(0, 6));
            } catch { }
        };
        load();
    }, []);

    const handlePersonalEventPress = useCallback(async () => {
        try {
            const token = await tokenService.getToken();
            if (token !== null && token !== '') {
                navigation.navigate('PersonalEvent');
                return;
            }
            navigation.navigate('LoginScreen');
        } catch (error) {
            console.log('❌ Token check failed:', error);
            navigation.navigate('RegisterScreen');
        }
    }, [navigation]);

    const handleEventSelect = useCallback((item: SuggestionItem) => {
        liveUpcoming.clearSuggestions();
        navigation.navigate('EventDetails', {
            product_app_id: item.product_app_id,
            event_name: item.name,
            auto_register_id: null,
        });
    }, [navigation, liveUpcoming]);

    const handleSliderScrollEnd = useCallback(() => {
        setVisibleCount(prev => Math.min(prev + 3, events.length));
    }, [events.length]);



    return (
        <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['top', 'left', 'right'] : ['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader />
            <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
            >
                <View style={{ zIndex: 50, elevation: 30 }}>
                    <View style={particpant.yellowHeader}>
                        <Feather name="radio" size={18} color="#1a1a1a" style={{ marginRight: 8 }} />
                        <Text style={commonStyles.title}>
                            {t('participant:liveTracking.title')}
                        </Text>
                    </View>
                    <View style={particpant.section}>
                        <View style={{ zIndex: 10 }}>
                            <SearchInput
                                placeholder={t('event:search')}
                                value={liveUpcoming.query}
                                onChangeText={liveUpcoming.handleSearch}
                                icon="search"
                            />
                            <SuggestionDropdown
                                suggestions={liveUpcoming.suggestions}
                                loading={liveUpcoming.loading}
                                visible={liveUpcoming.dropdownVisible}
                                onSelect={handleEventSelect}
                            />
                        </View>
                        <TouchableOpacity
                            style={[commonStyles.primaryButton, { flexDirection: 'row', marginTop: spacing.md }]}
                            onPress={() => navigation.navigate('ParticipantEvent')}
                            activeOpacity={0.8}
                        >
                            <Feather name="calendar" size={15} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={commonStyles.primaryButtonText}>
                                {t('participant:liveTracking.showAll')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={particpant.dividerRow}>
                    <View style={particpant.dividerLine} />

                </View>
                <View style={particpant.yellowHeader}>
                    <Feather name="plus-circle" size={18} color="#1a1a1a" style={{ marginRight: 8 }} />
                    <Text style={commonStyles.title}>
                        {t('participant:personalRace.title')}
                    </Text>
                </View>
                <View style={particpant.section}>
                    <View style={particpant.infoCard}>
                        <MaterialCommunityIcons name="map-marker-path" size={22} color={colors.themeiColor} />
                        <Text style={[commonStyles.text, { lineHeight: 20 }]}>
                            {t('participant:personalRace.description')}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[commonStyles.primaryButton, { flexDirection: 'row' }]}
                        onPress={handlePersonalEventPress}
                        activeOpacity={0.8}
                    >
                        <Feather name="plus" size={15} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={commonStyles.primaryButtonText}>
                            {t('participant:personalRace.createButton')}
                        </Text>
                    </TouchableOpacity>
                </View>
                <View style={particpant.dividerRow}>
                    <View style={particpant.dividerLine} />

                </View>
                <View style={{paddingHorizontal:spacing.md}}>
                <View style={fanstyle.nextEventsHeader}>
                    <Text style={fanstyle.nextEventsTitle}>{t('participant:nextevetn')}</Text>
                    <TouchableOpacity
                        style={fanstyle.viewAllBtn}
                        onPress={() => navigation.navigate('ParticipantEvent')}
                        activeOpacity={0.7}
                    >
                        <Text style={fanstyle.viewAllText}>{t('participant:viewAll')}</Text>
                        <Feather name="chevron-right" size={14} color={colors.primary} />
                    </TouchableOpacity>
                </View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                        gap: 10,
                        paddingRight: 4,
                        paddingBottom: 4,
                    }}
                    onMomentumScrollEnd={handleSliderScrollEnd}
                >
                    {events.slice(0, visibleCount).map(item => (
                        <TouchableOpacity
                            key={item.product_app_id}
                            activeOpacity={0.85}
                            onPress={() => navigation.navigate('EventDetails', {
                                product_app_id: Number(item.product_app_id),
                                event_name: item.name,
                                event_image: item.event_image,
                                auto_register_id: null,
                            })}
                        >
                            <EventCard item={item} t={t} />
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ParticipantScreen;
