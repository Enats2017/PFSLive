import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { commonStyles, colors } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { useTranslation } from 'react-i18next';
import { getCurrentLanguageId } from '../../i18n';
import { API_CONFIG, getApiEndpoint } from '../../constants/config';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

interface Distance {
    product_option_value_app_id: number;
    product_option_app_id: number;
    distance_name: string;
    race_date: string;
    race_time: string;
    countdown_type: 'minutes' | 'hours' | 'days' | 'in_progress' | 'finished';
    countdown_value: number;
    countdown_label: string;
}

const DistanceTab = ({ product_app_id }: { product_app_id: string | number }) => {
    const { t } = useTranslation(['details']);
    const [distances, setDistances] = useState<Distance[]>([]);
    const [loading, setLoading] = useState(true);
    const [serverTime, setServerTime] = useState<string>('');
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    useEffect(() => {
        fetchDistances();
    }, [product_app_id]);
    console.log(product_app_id);
    

    const fetchDistances = async () => {
        try {
            setLoading(true);
            const language_id = getCurrentLanguageId();
            const requestBody = {
                language_id: language_id,
                product_app_id: product_app_id

            };
            const headers = await API_CONFIG.getHeaders();
            const response = await axios.post(
                getApiEndpoint(API_CONFIG.ENDPOINTS.EVENT_DETAIL),
                requestBody,
                {
                    headers,
                },
            );
            console.log(response);
            

            if (response.data.success) {
                console.log(response.data.success);
                
                setDistances(response.data.data.distances || []);
                console.log("1111",distances);
                (distances)
                 setServerTime(response.data.data.server_datetime);
            }
        } catch (error) {
            console.error('Failed to fetch distances:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCountdownBadge = (item: Distance) => {
        switch (item.countdown_type) {
            case 'in_progress': return { label: t('details:countdown.in_progress'), color: colors.success };
            case 'finished': return { label: t('details:countdown.finished'), color: colors.gray500 };
            case 'hours': return { label: `${item.countdown_value} ${t('details:countdown.hours')}`, color: colors.success };
            case 'minutes':
                return {
                    label: `${item.countdown_value} ${t('details:countdown.minutes')}`,
                    color: colors.warning
                };
            case 'days': return { label: `${item.countdown_value} ${t('details:countdown.days')}`, color: colors.info };
            default: return { label: '', color: '#6b7280' };
        }
    };

    const getButtonText = (item: Distance) => {
    if (!serverTime) return t('details:button');
    const serverDate = new Date(serverTime.replace(' ', 'T'));
    const raceDateTime = new Date(`${item.race_date}T${item.race_time}`);
    const diffMs = raceDateTime.getTime() - serverDate.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    if (diffMinutes <= 60 && diffMinutes >= 0) {
        return t('details:live');
    }
    return  t('details:button');
};

    if (loading) return <ActivityIndicator size="large" color="#f4a100" style={{ marginTop: 40 }} />;

    if (distances.length === 0) return (
        <Text style={commonStyles.errorText}>{t('details:distance.empty')}</Text>
    );

    return (
        <FlatList
            data={distances}
            keyExtractor={(item) => String(item.product_option_value_app_id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
            renderItem={({ item }) => {
                const badge = getCountdownBadge(item);
                return (
                    <View style={[commonStyles.card, { padding: 0, overflow: 'hidden', marginBottom: 16 }]}>
                        <View style={detailsStyles.distance}>
                            <View style={{ flex: 1 }}>
                                <Text style={[commonStyles.title, { marginBottom: 4 }]}>{item.distance_name}</Text>
                                <Text style={commonStyles.subtitle}>{item.race_date}</Text>
                                <Text style={commonStyles.subtitle}>{item.race_time}</Text>
                            </View>
                            <View style={detailsStyles.count}>
                                <Text style={commonStyles.text}>
                                    {badge.label}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity style={[commonStyles.primaryButton, { borderRadius: 0 }]} onPress={() => navigation.navigate('Register')}>
                            <Text style={commonStyles.primaryButtonText}>{getButtonText(item)}</Text>
                        </TouchableOpacity>
                    </View>
                );
            }}
        />
    );
};

export default DistanceTab;