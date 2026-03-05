import React, { useState, useCallback, useEffect } from 'react'
import {
    View, Text, TouchableOpacity, FlatList,
    StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { commonStyles } from '../../styles/common.styles'
import { fetchMorePastEvents, AthleteEvent, Pagination } from '../../services/athleteProfileService'
import { profileStyles } from '../../styles/Profile.styles'
import EventCardPast from './EventCardPast'
import { useTranslation } from 'react-i18next'

interface Props {
    customerId:    number | string
    initialEvents: AthleteEvent[]
    initialPaging: Pagination
}

const PastTab = ({ customerId, initialEvents, initialPaging }: Props) => {
    const { t } = useTranslation(['profile'])
    const [events,      setEvents]      = useState<AthleteEvent[]>(initialEvents)
    const [paging,      setPaging]      = useState<Pagination>(initialPaging)
    const [refreshing,  setRefreshing]  = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)

    useEffect(() => {
        setEvents(initialEvents)
        setPaging(initialPaging)
    }, [initialEvents, initialPaging])

    const handleRefresh = useCallback(async () => {
        try {
            setRefreshing(true)
            const data = await fetchMorePastEvents(paging.page + 1) 
            setEvents(data.past ?? [])
            setPaging(data.pagination)
        } catch { /* silent */ } finally {
            setRefreshing(false)
        }
    }, [customerId])

    const handleLoadMore = useCallback(async () => {
        if (loadingMore || paging.page >= paging.total_pages) return
        try {
            setLoadingMore(true)
            const data = await fetchMorePastEvents(paging.page + 1)
            setEvents(prev => [...prev, ...(data.past ?? [])])
            setPaging(data.pagination)
        } catch { /* silent */ } finally {
            setLoadingMore(false)
        }
    }, [customerId, paging, loadingMore])

    const renderItem  = useCallback(({ item }: { item: AthleteEvent }) => <EventCardPast item={item} />, [])
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
                    <Ionicons name="time-outline" size={48} color="#ddd" />
                    <Text style={commonStyles.errorText}> {t('profile:past.no_events')}</Text>
                </View>
            }
            ListFooterComponent={
                paging.page < paging.total_pages ? (
                    <TouchableOpacity style={profileStyles.loadMoreBtn} onPress={handleLoadMore} disabled={loadingMore}>
                        {loadingMore
                            ? <ActivityIndicator size="small" color="#e8341a" />
                            : <Text style={commonStyles.loadingText}> {t('profile:buttons.load_more')}</Text>}
                    </TouchableOpacity>
                ) : null
            }
        />
    )
}



export default PastTab
