import React, { useState, useCallback, useEffect } from 'react'
import {
    View, Text, TouchableOpacity, FlatList,
    StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { commonStyles } from '../../styles/common.styles'
import { fetchMoreLiveEvents, AthleteEvent, Pagination } from '../../services/athleteProfileService'
import { profileStyles } from '../../styles/Profile.styles'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

/* ── Props ── */
interface Props {
    customerId: number | string
    initialEvents: AthleteEvent[]
    initialPaging: Pagination
}

/* ── Status badge ── */
const StatusBadge = ({ status }: { status?: string }) => {
      const { t } = useTranslation(['profile'])
    const config: Record<string, { bg: string; dot: string; label: string }> = {
        in_progress: { bg: '#fff0ee', dot: '#e8341a',  label: t('profile:status.live') },
        not_started: { bg: '#f0f4ff', dot: '#1a73e8', label: t('profile:status.soon') },
        finished: { bg: '#f4f4f4', dot: '#888',  label: t('profile:status.finished') },
    }
    const c = status ? config[status] : null
    if (!c) return null
    return (
        <View style={[profileStyles.badge, { backgroundColor: c.bg }]}>
            <View style={[profileStyles.badgeDot, { backgroundColor: c.dot }]} />
            <Text style={[profileStyles.badgeText, { color: c.dot }]}>{c.label}</Text>
        </View>
    )
}


const EventCard = ({ item }: { item: AthleteEvent }) => {
     const { t } = useTranslation(['profile'])
    const navigation = useNavigation()
    const handlePress = () => {
        if (item.event_source === 'custom') {
            // navigation.navigate('EditPersonalEventScreen', {
            //     eventId: item.id
            // })
            return
        }

        // navigation.navigate('MyEventDetailsScreen', {
        //     eventId: item.id
        // })

    }

    const getButtonText = () => {
        if (item.event_source === 'custom') {
            return t('profile:buttons.edit_personal_event')
        }
       
        if (item.race_status === 'in_progress') {
            return t('profile:buttons.live_tracking_progress')
        }
         if (item.race_status == 'not_started') {
             return t('profile:buttons.live_tracking_soon')
        }
            return t('profile:buttons.enable_gps')    
        }

    return (
        <View style={[commonStyles.card, profileStyles.eventCard]}>
            <StatusBadge status={item.race_status} />
            <View style={profileStyles.textsection}>
                <Text style={commonStyles.title}>{item.name}</Text>
                <Text style={commonStyles.text}>
                    {item.race_date} {item.race_time?.slice(0, 5)}
                </Text>
            </View>
            <TouchableOpacity
                style={commonStyles.primaryButton}
                onPress={handlePress}
            >
                <Text style={commonStyles.primaryButtonText}>
                    {getButtonText()}
                </Text>

            </TouchableOpacity>

        </View>

    )
}

const LiveTab = ({ customerId, initialEvents, initialPaging }: Props) => {
     const { t } = useTranslation(['profile'])
    const [events, setEvents] = useState<AthleteEvent[]>(initialEvents)
    const [paging, setPaging] = useState<Pagination>(initialPaging)
    const [refreshing, setRefreshing] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)

    // sync if parent refreshes and passes new initial data
    useEffect(() => {
        setEvents(initialEvents)
        setPaging(initialPaging)
    }, [initialEvents, initialPaging])

    const handleRefresh = useCallback(async () => {
        try {
            setRefreshing(true)
            const data = await fetchMoreLiveEvents(paging.page + 1)
            setEvents(data.live ?? [])
            setPaging(data.pagination)
        } catch { /* silent */ } finally {
            setRefreshing(false)
        }
    }, [customerId])

    const handleLoadMore = useCallback(async () => {
        if (loadingMore || paging.page >= paging.total_pages) return
        try {
            setLoadingMore(true)
            const data = await fetchMoreLiveEvents(paging.page + 1)
            setEvents(prev => [...prev, ...(data.live ?? [])])
            setPaging(data.pagination)
        } catch { /* silent */ } finally {
            setLoadingMore(false)
        }
    }, [customerId, paging, loadingMore])



    const renderItem = useCallback(({ item }: { item: AthleteEvent }) =>
        <EventCard item={item} />, [])

    const keyExtractor = useCallback((item: AthleteEvent) => String(item.id), [])

    return (
        <FlatList
            data={events}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={profileStyles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8341a" />
            }
            ListEmptyComponent={
                <View style={profileStyles.empty}>
                    <Ionicons name="radio-outline" size={48} color="#ddd" />
                    <Text style={commonStyles.errorText}> {t('profile:empty.no_live_events')}</Text>
                </View>
            }
            ListFooterComponent={
                paging.page < paging.total_pages ? (
                    <TouchableOpacity style={profileStyles.loadMoreBtn} onPress={handleLoadMore} disabled={loadingMore}>
                        {loadingMore
                            ? <ActivityIndicator size="small" color="#e8341a" />
                            : <Text style={commonStyles.loadingText}>{t('profile:buttons.load_more')}</Text>}
                    </TouchableOpacity>
                ) : null
            }
        />
    )
}



export default LiveTab
