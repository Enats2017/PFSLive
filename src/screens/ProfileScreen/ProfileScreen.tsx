import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
    View, Text, TouchableOpacity, FlatList, StyleSheet,
    ActivityIndicator, Dimensions, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { AppHeader } from '../../components/common/AppHeader'
import { commonStyles } from '../../styles/common.styles'
import { detailsStyles } from '../../styles/details.styles'
import LiveTab from './LiveTab'
import PastTab from './PastTab'
import ProfileCard from '../../components/ProfileCard'
import {
    fetchAthleteProfileApi,
    AthleteEvent,
    AthleteProfile,
    Pagination,
} from '../../services/athleteProfileService'
import { tokenService } from '../../services/tokenService'
import { useFocusEffect } from '@react-navigation/native'

const { width } = Dimensions.get('window')
type Tab = 'Live' | 'Past'
const TABS: Tab[] = ['Past', 'Live']
const EMPTY_PAGING: Pagination = { page: 1, per_page: 3, total: 0, total_pages: 0 }

const ProfileEditScreen = () => {
    const { t } = useTranslation(['profile'])
    const flatListRef = useRef<FlatList>(null)
    const [activeTab, setActiveTab] = useState<Tab>('Live')
    const [profile, setProfile] = useState<AthleteProfile | null>(null)
    const [liveEvents, setLiveEvents] = useState<AthleteEvent[]>([])
    const [pastEvents, setPastEvents] = useState<AthleteEvent[]>([])
    const [livePaging, setLivePaging] = useState<Pagination>(EMPTY_PAGING)
    const [pastPaging, setPastPaging] = useState<Pagination>(EMPTY_PAGING)
    const [customerId, setCustomerId] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState('')

    useFocusEffect(
        useCallback(() => {
            const init = async () => {
                try {
                    setLoading(true)
                    setFetchError('')
                    const id = await tokenService.getCustomerId() ?? 0
                    if (!id) {
                        setFetchError(t('profile:errors.user_not_found'))
                        return
                    }
                    console.log('Fetching profile for customerId:', id)
                    const data = await fetchAthleteProfileApi()
                    setProfile(data.profile)
                    setLiveEvents(data.tabs.live)
                    setPastEvents(data.tabs.past)
                    setLivePaging(data.pagination.live)
                    setPastPaging(data.pagination.past)

                } catch (e: any) {
                    setFetchError(e.message || t('profile:errors.load_profile_failed'))
                } finally {
                    setLoading(false)
                }
            }

            init()

        }, [])
    )
    const handleTabPress = useCallback((tab: Tab) => {
        const index = TABS.indexOf(tab)
        setActiveTab(tab)
        flatListRef.current?.scrollToIndex({ index, animated: true })
    }, [])

    const handleSwipe = useCallback((e: any) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / width)
        setActiveTab(TABS[index])
    }, [])

    if (loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader showLogo={true} />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color="#e8341a" />
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={true} />
            <ProfileCard profile={profile} fetchError={fetchError} />
            <View style={detailsStyles.tabBar}>
                {TABS.map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={detailsStyles.tabItem}
                        onPress={() => handleTabPress(tab)}
                    >
                        <Text style={[commonStyles.subtitle, activeTab === tab && detailsStyles.activeTabText]}>
                            {t(`profile:tab.${tab}`, tab)}
                        </Text>
                        {activeTab === tab && (
                            <LinearGradient
                                colors={['#e8341a', '#f4a100', '#1a73e8']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={detailsStyles.underline}
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
                    initialScrollIndex={TABS.indexOf('Live')}
                    getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
                    renderItem={({ item: tab }) => (
                        <View style={{ width, flex: 1 }}>
                            {tab === 'Live' ? (
                                <LiveTab
                                    customerId={customerId}
                                    initialEvents={liveEvents}
                                    initialPaging={livePaging}
                                />
                            ) : (
                                <PastTab
                                    customerId={customerId}
                                    initialEvents={pastEvents}
                                    initialPaging={pastPaging}
                                />
                            )}
                        </View>
                    )}
                />
            </View>
        </SafeAreaView>
    )
}


export default ProfileEditScreen
