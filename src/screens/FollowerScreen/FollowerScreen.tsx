import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
    FlatList,
} from 'react-native';
import { useSearchFieldKeyboard } from '../../hooks/useKeyboardHeight';
import { SafeAreaView,useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, palette } from '../../styles/common.styles';
import { follow } from '../../styles/followerScreen.styles';
import { AppHeader } from '../../components/common/AppHeader';
import SearchInput from '../../components/SearchInput';
import { SuggestionItem } from '../../services/followerScreenService';
import SuggestionDropdown from '../../components/SuggestionDropdown';
import useSearchSuggestions from '../../hooks/useSearchSuggestions';
import { eventService, ParticipantItem } from '../../services/followerEvent';
import AthleteSuggestionDropdown from '../../components/AthleteSuggestionDropdown';
import { useDimensions } from '../../hooks/useDimensions';
import { useLandscapeSidePadding } from '../../hooks/useLandscapeSidePadding';
import { analyticsService } from '../../services/analyticsService';

const Divider = () => (
    <View style={follow.dividerRow}>
        <View style={follow.dividerLine} />
    </View>
);

const FollowerScreen = () => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['follow']);
    const { width, height } = useDimensions();
    const insets = useSafeAreaInsets(); 
    const isGestureNav = insets.bottom > 0;
    // ✅ A real boolean — `width` alone was always truthy. Edges are unchanged
    // in effect (portrait has no side/bottom inset where the branches differ).
    const isLandscape = width > height;
    // ✅ Notch clearance for the body in landscape (edges fall back to ['bottom']).
    const sidePadding = useLandscapeSidePadding();
    const upcoming = useSearchSuggestions('filter_name', ['upcoming', 'live']);
    const past = useSearchSuggestions('filter_name_past_suggestion', ['past']);
    const [athleteQuery, setAthleteQuery] = useState('');
    const [athleteSuggestions, setAthleteSuggestions] = useState<ParticipantItem[]>([]);
    const [athleteLoading, setAthleteLoading] = useState(false);
    const [athleteLoadingMore, setAthleteLoadingMore] = useState(false);
    const [athleteDropdownVisible, setAthleteDropdownVisible] = useState(false);
    const [athletePage, setAthletePage] = useState(1);
    const [athleteTotalPages, setAthleteTotalPages] = useState(0);
    const athleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const athleteQueryRef = useRef('');

    // ✅ Search fields vs the keyboard: the focused search scrolls to the top
    // and the list gets room for the keyboard, so its suggestions open above
    // it (useKeyboardHeight.ts). Was the athlete search only; the upcoming and
    // past searches opened their suggestions behind the keyboard (audit
    // 2026-10-23). Each section's y is measured in the list content.
    const listRef = useRef<FlatList<never>>(null);
    const upcomingSectionY = useRef(0);
    const pastSectionY = useRef(0);
    const athleteSectionY = useRef(0);
    const { keyboardPad, focusAt, blur } = useSearchFieldKeyboard((y) => {
        listRef.current?.scrollToOffset({ offset: y, animated: true });
    });

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

    const handleAthleteSearch = useCallback((text: string) => {
        setAthleteQuery(text);
        athleteQueryRef.current = text;
        if (athleteTimer.current) clearTimeout(athleteTimer.current);
        if (!text.trim()) {
            setAthleteSuggestions([]);
            setAthleteDropdownVisible(false);
            return;
        }
        setAthleteLoading(true);
        setAthleteDropdownVisible(true);
        athleteTimer.current = setTimeout(async () => {
            try {
                const result = await eventService.getEvents({
                    is_participant: '1',
                    page_participant: 1,
                    filter_name_participant: text.trim(),
                });
                const found = result.participants || [];
                setAthleteSuggestions(found);
                setAthletePage(1);

                // One event per completed search — inside the debounce, after
                // results resolve. Not per keystroke, not on pagination.
                // Count only, never the query text (unbounded cardinality).
                void analyticsService.logSearchPerformed('athlete', found.length);
                setAthleteTotalPages(result.pagination?.participants?.total_pages ?? 0);
            } catch {
                setAthleteSuggestions([]);
            } finally {
                setAthleteLoading(false);
            }
        }, 350);
    }, []);

    const handleAthleteLoadMore = useCallback(async () => {
        if (athleteLoadingMore || athletePage >= athleteTotalPages) return;
        try {
            setAthleteLoadingMore(true);
            const nextPage = athletePage + 1;
            const result = await eventService.getEvents({
                is_participant: '1',
                page_participant: nextPage,
                filter_name_participant: athleteQueryRef.current.trim(),
            });
            setAthleteSuggestions(prev => {
                const ids = new Set(prev.map(e => e.customer_app_id));
                return [...prev, ...(result.participants || []).filter(i => !ids.has(i.customer_app_id))];
            });
            setAthletePage(nextPage);
        } catch {
        } finally {
            setAthleteLoadingMore(false);
        }
    }, [athleteLoadingMore, athletePage, athleteTotalPages]);

    const handleAthleteSelect = useCallback((item: ParticipantItem) => {
        setAthleteDropdownVisible(false);
        setAthleteSuggestions([]);
        setAthleteQuery('');
        navigation.navigate('ProfileScreen', {
            customer_app_id: item.customer_app_id,
        });
    }, [navigation]);

    const renderContent = () => (
        <>
            <View
                style={{ zIndex: 30, elevation: 30 }}
                onLayout={(e) => { upcomingSectionY.current = e.nativeEvent.layout.y; }}
            >
                <View style={follow.sectionLabel}>
                    <Feather name="radio" size={14} color={palette.lime} />
                    <Text style={follow.sectionLabelText}>{t('follow:upcomingrace')}</Text>
                </View>
                <View style={follow.section}>
                    <SearchInput
                        framed={false}
                        placeholder={t('follow:search.upcomingSearch')}
                        value={upcoming.query}
                        onChangeText={upcoming.handleSearch}
                        icon="search"
                        onFocus={() => focusAt(upcomingSectionY.current)}
                        onBlur={blur}
                    />
                    <SuggestionDropdown
                        suggestions={upcoming.suggestions}
                        loading={upcoming.loading}
                        visible={upcoming.dropdownVisible}
                        onSelect={handleUpcomingSelect}
                    />
                    <TouchableOpacity
                        style={[commonStyles.outlineButton, { flexDirection: 'row', marginTop: spacing.md }]}
                        onPress={() => navigation.navigate('FollowerEvent', { initialTab: 'Live' })}
                        activeOpacity={0.8}
                    >
                        <Feather name="calendar" size={15} color={palette.navy} style={{ marginRight: 8 }} />
                        <Text style={commonStyles.outlineButtonText}>{t('follow:button.upcoming')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <Divider />
            <View
                style={{ zIndex: 20, elevation: 20 }}
                onLayout={(e) => { pastSectionY.current = e.nativeEvent.layout.y; }}
            >
                <View style={follow.sectionLabel}>
                    <Feather name="radio" size={14} color={palette.lime} />
                    <Text style={follow.sectionLabelText}>{t('follow:pastrace')}</Text>
                </View>
                <View style={follow.section}>
                    <SearchInput
                        framed={false}
                        placeholder={t('follow:search.upcomingSearch')}
                        value={past.query}
                        onChangeText={past.handleSearch}
                        icon="search"
                        onFocus={() => focusAt(pastSectionY.current)}
                        onBlur={blur}
                    />
                    <SuggestionDropdown
                        suggestions={past.suggestions}
                        loading={past.loading}
                        visible={past.dropdownVisible}
                        onSelect={handlePastSelect}
                    />
                    <TouchableOpacity
                        style={[commonStyles.outlineButton, { flexDirection: 'row', marginTop: spacing.md }]}
                        onPress={() => navigation.navigate('FollowerEvent', { initialTab: 'Past' })}
                        activeOpacity={0.8}
                    >
                        <Feather name="calendar" size={15} color={palette.navy} style={{ marginRight: 8 }} />
                        <Text style={commonStyles.outlineButtonText}>{t('follow:button.past')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <Divider />
            <View
                style={{ zIndex: 10, elevation: 10 }}
                onLayout={(e) => { athleteSectionY.current = e.nativeEvent.layout.y; }}
            >
                <View style={follow.sectionLabel}>
                    <Feather name="plus-circle" size={18} color={palette.ink} style={{ marginRight: 8 }} />
                    <Text style={follow.sectionLabelText}>{t('follow:athlete')}</Text>
                </View>
                <View style={follow.section}>
                    <SearchInput
                        framed={false}
                        placeholder={t('follow:search.athletesearch')}
                        value={athleteQuery}
                        onChangeText={handleAthleteSearch}
                        icon="search"
                        onFocus={() => focusAt(athleteSectionY.current)}
                        onBlur={blur}
                    />
                    <AthleteSuggestionDropdown
                        suggestions={athleteSuggestions}
                        loading={athleteLoading}
                        loadingMore={athleteLoadingMore}
                        visible={athleteDropdownVisible}
                        onSelect={handleAthleteSelect}
                        onLoadMore={handleAthleteLoadMore}
                        hasMore={athletePage < athleteTotalPages}
                    />
                    <TouchableOpacity
                        style={[commonStyles.outlineButton, { flexDirection: 'row', marginTop: spacing.xl }]}
                        onPress={() => navigation.navigate('AthleteSearchScreen', {})}
                        activeOpacity={0.8}
                    >
                        <Feather name="search" size={15} color={palette.navy} style={{ marginRight: 8 }} />
                        <Text style={commonStyles.outlineButtonText}>
                            {t('follow:button.athlete')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
            <View style={[follow.section, { zIndex: 1, elevation: 1 }]}>
                <TouchableOpacity
                    style={[commonStyles.limeButton, { flexDirection: 'row', marginTop: spacing.xl, gap: 8 }]}
                    onPress={() => navigation.navigate('UserFavouriteList')}
                    activeOpacity={0.8}
                >
                    <MaterialIcons name="favorite-outline" size={18} color={palette.ink} />
                    <Text style={commonStyles.limeButtonText}>
                        {t('follow:button.favourite')}
                    </Text>
                </TouchableOpacity>
            </View>
        </>
    );

    return (
        <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['left','right'] : ['bottom']}>
            <AppHeader title={t('common:band.findRace')} showBack />

            <View style={[{ flex: 1 }, sidePadding]}>
                <FlatList
                    ref={listRef}
                    data={[]}                         
                    renderItem={null}
                    // ✅ An element, not the function: renderContent is a new
                    // function every render, and VirtualizedList renders a
                    // function as <ListHeaderComponent /> — a new component type
                    // each time, so the whole header (and the focused search
                    // field) remounted on every state change.
                    ListHeaderComponent={renderContent()}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: spacing.xxxxl + keyboardPad }}
                />
            </View>
        </SafeAreaView>
    );
};

export default FollowerScreen;