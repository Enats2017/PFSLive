import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
    Keyboard,
    KeyboardEvent,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { follow } from '../../styles/followerScreen.styles';
import { AppHeader } from '../../components/common/AppHeader';
import SearchInput from '../../components/SearchInput';
import { SuggestionItem } from '../../services/followerScreenService';
import SuggestionDropdown from '../../components/SuggestionDropdown';
import useSearchSuggestions from '../../hooks/useSearchSuggestions';
import { eventService, EventItem, ParticipantItem } from '../../services/followerEvent';
import FanEventCard from '../FollowerEventList/FollowerCard';
import { FlatList } from 'react-native-gesture-handler';
import { useFollowManager } from '../../hooks/useFollowManager';
import { TrackingPasswordModal } from '../../components/TrackingPasswordModal';

const Divider = () => (
    <View style={follow.dividerRow}>
        <View style={follow.dividerLine} />
        <Text style={follow.dividerLabel}>OR</Text>
        <View style={follow.dividerLine} />
    </View>
);

const FollowerScreen = () => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['follow']);
    const upcoming = useSearchSuggestions('filter_name', ['upcoming', 'live']);
    const past = useSearchSuggestions('filter_name_past_suggestion', ['past']);
    const [athleteSearch, setAthleteSearch] = useState('');
    const participantSearchFocused = useRef(false);
    const keyboardOffset = useRef(new Animated.Value(0)).current;
    const [athleteResults, setAthleteResults] = useState<ParticipantItem[]>([]);
    const [athleteSearching, setAthleteSearching] = useState(false);
    const [athletePagination, setAthletePagination] = useState({ page: 0, total_pages: 0 });
    const isLoadingMore = useRef(false);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (e: KeyboardEvent) => {
            if (!participantSearchFocused.current) return;
            Animated.timing(keyboardOffset, {
                toValue: e.endCoordinates.height,
                duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 200,
                useNativeDriver: true,
            }).start();
        };

        const onHide = (e: KeyboardEvent) => {
            Animated.timing(keyboardOffset, {
                toValue: 0,
                duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 200,
                useNativeDriver: true,
            }).start();
        };
        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [keyboardOffset]);

    const handleUpcomingSelect = useCallback((item: SuggestionItem) => {
        upcoming.clearSuggestions();
        navigation.navigate('FollowDetails', {
            product_app_id: Number(item.product_app_id),
            event_name: item.name,
            sourceTab: 'live',
        });
    }, [navigation, upcoming]);

    const handlePastSelect = useCallback((item: SuggestionItem) => {
        past.clearSuggestions();
        navigation.navigate('FollowDetails', {
            product_app_id: Number(item.product_app_id),
            event_name: item.name,
            sourceTab: 'past',
        });
    }, [navigation, past]);

    const {
        isFollowed,
        isLoading,
        refreshFollowedUsers,
        handleFollowPress,
        passwordModalVisible,
        isVerifying,
        passwordError,
        handlePasswordSubmit,
        handlePasswordModalClose,
    } = useFollowManager(t);

    useEffect(() => {
        if (!athleteSearch.trim()) {
            setAthleteResults([]);
            setAthletePagination({ page: 0, total_pages: 0 });
            return;
        }
        const timer = setTimeout(async () => {
            try {
                setAthleteSearching(true);
                const result = await eventService.getEvents({
                    is_participant: '1',
                    page_participant: 1,
                    filter_name_participant: athleteSearch.trim(),
                });
                setAthleteResults(result.participants || []);
                setAthletePagination({
                    page: 1,
                    total_pages: result.pagination?.participants?.total_pages ?? 0,
                });
            } catch (err) {
                console.error('❌ Athlete search failed:', err);
            } finally {
                setAthleteSearching(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [athleteSearch]);

    const loadMoreAthletes = useCallback(async () => {
        if (isLoadingMore.current) return;
        if (athletePagination.page >= athletePagination.total_pages) return;
        try {
            isLoadingMore.current = true;
            const nextPage = athletePagination.page + 1;
            const result = await eventService.getEvents({
                is_participant: '1',
                page_participant: nextPage,
                filter_name_participant: athleteSearch.trim(),
            });
            setAthleteResults(prev => {
                const ids = new Set(prev.map(e => e.customer_app_id));
                return [...prev, ...(result.participants || []).filter(i => !ids.has(i.customer_app_id))];
            });
            setAthletePagination(prev => ({ ...prev, page: nextPage }));
        } catch (err) {
            console.error('Load more athletes failed:', err);
        } finally {
            isLoadingMore.current = false;
        }
    }, [athleteSearch, athletePagination]);

    const renderAthleteCard = useCallback(
        ({ item }: { item: ParticipantItem }) => (
            <FanEventCard
                item={item}
                isFollowed={isFollowed(item.customer_app_id)}
                isLoading={isLoading(item.customer_app_id)}
                onToggleFollow={() => {
                    handleFollowPress({
                        customer_app_id: item.customer_app_id,
                        password_protected: item.password_protected ?? 0,
                    });
                }}
            />
        ),
        [isFollowed, isLoading, handleFollowPress]  
    );

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader />
            <Animated.View style={{ flex: 1, transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }] }} >
                <View style={follow.yellowHeader}>
                    <Feather name="radio" size={18} color="#1a1a1a" style={{ marginRight: 8 }} />
                    <Text style={commonStyles.title}>{t('follow:upcomingrace')}</Text>
                </View>
                <View style={follow.section} >
                    <View style={{ zIndex: 20 }}>
                        <SearchInput
                            placeholder={t('follow:search.upcomgsearch')}
                            value={upcoming.query}
                            onChangeText={upcoming.handleSearch}
                            icon="search"
                        />
                        <SuggestionDropdown
                            suggestions={upcoming.suggestions}
                            loading={upcoming.loading}
                            visible={upcoming.dropdownVisible}
                            onSelect={handleUpcomingSelect}
                        />
                    </View>
                    <TouchableOpacity
                        style={[commonStyles.primaryButton, { flexDirection: 'row', marginTop: spacing.md }]}
                        onPress={() => navigation.navigate('FollowerEvent')}
                        activeOpacity={0.8}
                    >
                        <Feather name="calendar" size={15} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={commonStyles.primaryButtonText}>{t('follow:button.upcoming')}</Text>
                    </TouchableOpacity>
                </View>
                <Divider />
                <View style={follow.yellowHeader}>
                    <Feather name="radio" size={18} color="#1a1a1a" style={{ marginRight: 8 }} />
                    <Text style={commonStyles.title}>{t('follow:pastrace')}</Text>
                </View>
                <View style={follow.section}>
                    <View style={{ zIndex: 10 }}>
                        <SearchInput
                            placeholder={t('follow:search.upcomgsearch')}
                            value={past.query}
                            onChangeText={past.handleSearch}
                            icon="search"
                        />
                        <SuggestionDropdown
                            suggestions={past.suggestions}
                            loading={past.loading}
                            visible={past.dropdownVisible}
                            onSelect={handlePastSelect}
                        />
                    </View>
                    <TouchableOpacity
                        style={[commonStyles.primaryButton, { flexDirection: 'row', marginTop: spacing.md }]}
                        onPress={() => navigation.navigate('FollowerEvent', { initialTab: 'Past' })}
                        activeOpacity={0.8}
                    >
                        <Feather name="calendar" size={15} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={commonStyles.primaryButtonText}>{t('follow:button.past')}</Text>
                    </TouchableOpacity>
                </View>
                <Divider />
                <View style={follow.yellowHeader}>
                    <Feather name="plus-circle" size={18} color="#1a1a1a" style={{ marginRight: 8 }} />
                    <Text style={commonStyles.title}>{t('follow:athlete')}</Text>
                </View>
                <View style={[follow.section, { flex: 1 }]}>
                    <FlatList
                        data={athleteResults}
                        keyExtractor={(item, index) => `${item.customer_app_id}_${index}`}
                        renderItem={renderAthleteCard}
                        onEndReached={loadMoreAthletes}
                        onEndReachedThreshold={0.5}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        removeClippedSubviews={false}
                        ListHeaderComponent={
                            <SearchInput
                                placeholder={t('follow:search.athletesearch')}
                                value={athleteSearch}
                                onChangeText={setAthleteSearch}
                                icon="search"
                                onFocus={() => { participantSearchFocused.current = true; }}
                                onBlur={() => { participantSearchFocused.current = false; }}
                            />
                        }
                        ListEmptyComponent={
                            athleteSearching ? (
                                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.lg }} />
                            ) : athleteSearch.trim().length > 0 ? (
                                <Text style={[commonStyles.errorText, { textAlign: 'center', marginTop: 40 }]}>
                                    {t('follower:empty.searchNoResults')}
                                </Text>
                            ) : null
                        }
                        ListFooterComponent={
                            isLoadingMore.current ? (
                                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
                            ) : null
                        }
                    />
                </View>
            </Animated.View>
            <TrackingPasswordModal
                visible={passwordModalVisible}
                isVerifying={isVerifying}
                passwordError={passwordError}
                onSubmit={handlePasswordSubmit}
                onClose={handlePasswordModalClose}
            />
        </SafeAreaView>
    );
};

export default FollowerScreen;
