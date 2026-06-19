import React, { useCallback } from 'react';
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

const ParticipantScreen: React.FC<ParticipantScreenpops> = () => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['participant']);
    const { width } = useDimensions();
    const insets = useSafeAreaInsets(); 
    const isGestureNav = insets.bottom > 0;
    const isLandscape = width 

    const liveUpcoming = useSearchSuggestions('filter_name', ['live', 'upcoming']);

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

    return (
        <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['top', 'left','right'] : ['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader />
            <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: spacing.xl }}
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
            </ScrollView>
        </SafeAreaView>
    );
};

export default ParticipantScreen;
