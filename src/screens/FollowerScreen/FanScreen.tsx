import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    StatusBar,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
    Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppHeader } from '../../components/common/AppHeader';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { useDimensions } from '../../hooks/useDimensions';
import SearchInput from '../../components/SearchInput';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { fanstyle } from '../../styles/fan.styles';
import { suggestionService, SuggestionItem } from '../../services/followerScreenService';
import SuggestionDropdown from '../../components/SuggestionDropdown';
import { eventService, EventItem } from '../../services/followerEvent';
import { formatEventDate } from '../../utils/dateFormatter';
import EventCard from '../../components/EventCard';



interface NavCardProps {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    onPress: () => void;
}

const NavCard: React.FC<NavCardProps> = ({ icon, title, subtitle, onPress }) => (
    <TouchableOpacity style={fanstyle.navCard} onPress={onPress} activeOpacity={0.82}>
        <View style={fanstyle.navIconWrap}>{icon}</View>
        <View style={fanstyle.navText}>
            <Text style={fanstyle.navTitle}>{title}</Text>
            <Text style={fanstyle.navSub}>{subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={22} color={colors.white} />
    </TouchableOpacity>
);




const FanScreen = () => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['follow']);
    const { width } = useDimensions();
    const insets = useSafeAreaInsets();
    const isLandscape = width > 600;
    const isGestureNav = insets.bottom > 0;
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [visibleCount, setVisibleCount] = useState(3);

    const handleSearch = useCallback((text: string) => {
        setSearchQuery(text);
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        if (!text.trim()) {
            setSuggestions([]);
            setDropdownVisible(false);
            setSearchLoading(false);
            return;
        }
        setSearchLoading(true);
        setDropdownVisible(true);
        debounceTimer.current = setTimeout(async () => {
            try {
                const [liveUpcoming, past] = await Promise.all([
                    suggestionService.getSuggestions({ filter_name: text.trim() }),
                    suggestionService.getSuggestions({ filter_name_past_suggestion: text.trim() }),
                ]);
                setSuggestions([...liveUpcoming, ...past]);
            } catch {
                setSuggestions([]);
            } finally {
                setSearchLoading(false);
            }
        }, 350);
    }, []);

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

    const handleSelect = useCallback((item: SuggestionItem) => {
        setDropdownVisible(false);
        setSearchQuery('');
        setSuggestions([]);
        navigation.navigate('FollowDetails', {
            product_app_id: Number(item.product_app_id),
            event_name: item.name,
            event_image: item.event_image,
            sourceTab: item.tab === 'past' ? 'past' : 'live',
        });
    }, [navigation]);

    const handleSliderScrollEnd = useCallback(() => {
        setVisibleCount(prev => Math.min(prev + 3, events.length));
    }, [events.length]);


    return (
        <SafeAreaView
            style={commonStyles.container}
            edges={isLandscape && !isGestureNav ? ['top', 'left', 'right'] : ['top']}
        >
            <StatusBar barStyle="dark-content" />
            <AppHeader logoimg={true} />

            <ScrollView
                contentContainerStyle={fanstyle.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={fanstyle.section}>
                    <SearchInput
                        placeholder={t('follow:search.upcomgsearch', 'Find an event by name…')}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        icon="search"
                    />
                    <SuggestionDropdown
                        suggestions={suggestions}
                        loading={searchLoading}
                        visible={dropdownVisible}
                        onSelect={handleSelect}
                    />
                </View>

                <View style={fanstyle.section}>
                    <NavCard
                        icon={<Ionicons name="calendar-outline" size={26} color={colors.white} />}
                        title={t('follow:upcomingrace')}
                        subtitle={t('follow:nav.upcomingsub')}
                        onPress={() => navigation.navigate('FollowerEvent', { initialTab: 'Live' })}
                    />
                    <NavCard
                        icon={<Ionicons name="trophy-outline" size={26} color={colors.white} />}
                        title={t('follow:pastrace')}
                        subtitle={t('follow:nav.pastsub')}
                        onPress={() => navigation.navigate('FollowerEvent', { initialTab: 'Past' })}
                    />
                    <NavCard
                        icon={<Feather name="user" size={26} color={colors.white} />}
                        title={t('follow:athlete')}
                        subtitle={t('follow:nav.athletesub')}
                        onPress={() => navigation.navigate('AthleteSearchScreen', {})}
                    />
                    <NavCard
                        icon={<Ionicons name="heart-outline" size={26} color={colors.white} />}
                        title={t('follow:button.favourite', 'FAVORITES')}
                        subtitle={t('follow:nav.favouritesub')}
                        onPress={() => navigation.navigate('UserFavouriteList')}
                    />
                </View>

                <View style={fanstyle.nextEventsSection}>
                    <View style={fanstyle.nextEventsHeader}>
                        <Text style={fanstyle.nextEventsTitle}>{t('follow:nextevetn')}</Text>
                        <TouchableOpacity
                            style={fanstyle.viewAllBtn}
                            onPress={() => navigation.navigate('FollowerEvent', { initialTab: 'Live' })}
                            activeOpacity={0.7}
                        >
                            <Text style={fanstyle.viewAllText}>{t('follow:viewAll')}</Text>
                            <Feather name="chevron-right" size={14} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={fanstyle.sliderContent}
                        onMomentumScrollEnd={handleSliderScrollEnd}
                    >
                        {events.slice(0, visibleCount).map(item => (
                            <TouchableOpacity
                                key={item.product_app_id}
                                activeOpacity={0.85}
                                onPress={() => navigation.navigate('FollowDetails', {
                                    product_app_id: Number(item.product_app_id),
                                    event_name: item.name,
                                    event_image: item.event_image,
                                    sourceTab: 'live',
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

export default FanScreen;