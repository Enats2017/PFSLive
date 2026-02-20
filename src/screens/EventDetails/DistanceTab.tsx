import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { commonStyles } from '../../styles/common.styles';
import { useTranslation } from 'react-i18next';
import i18n, { LANGUAGES } from '../../i18n';
import { API_CONFIG, getApiEndpoint } from '../../constants/config';
import axios from 'axios';

interface Distance {
    product_option_value_app_id: number;
    product_option_app_id: number;
    distance_name: string;
    race_date: string;
    race_time: string;
    countdown_type: 'hours' | 'days' | 'in_progress' | 'finished';
    countdown_value: number;
    countdown_label: string;
}

const DistanceTab = ({ product_app_id }: { product_app_id: string | number }) => {
    const { t } = useTranslation(['event']);
    const [distances, setDistances] = useState<Distance[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDistances();
    }, [product_app_id]);

    useEffect(() => {
        fetchDistances();
    }, [i18n.language]);

    const getLanguageId = (): number => {
        const lang = i18n.language?.split('-')[0] as keyof typeof LANGUAGES;
        return LANGUAGES[lang]?.id ?? 1;
    };
    console.log("11111",getLanguageId);

    const fetchDistances = async () => {
        try {
            setLoading(true);
            const url = getApiEndpoint(API_CONFIG.ENDPOINTS.EVENT_DETAIL);
            console.log('URL:', url);
            console.log('product_app_id:', product_app_id);
            const language_id = await getLanguageId();
            console.log("languge_id", language_id);
            const formData = new FormData();
            formData.append('product_app_id', String(product_app_id));
            formData.append('language_id', String(language_id));
            console.log('Calling URL:', getApiEndpoint);
            const headers = await API_CONFIG.getMutiForm();

            const response = await axios.post(
                getApiEndpoint(API_CONFIG.ENDPOINTS.EVENT_DETAIL),
                formData,
                {
                    headers,
                    timeout: API_CONFIG.TIMEOUT,
                },
            );

            if (response.data.success) {
                setDistances(response.data.data.distances || []);
            }
        } catch (error) {
            console.error('Failed to fetch distances:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCountdownBadge = (item: Distance) => {
        switch (item.countdown_type) {
            case 'in_progress': return { label: 'LIVE', color: '#22c55e' };
            case 'finished': return { label: 'FINISHED', color: '#6b7280' };
            case 'hours': return { label: `START ${item.countdown_value}h`, color: '#22c55e' };
            case 'days': return { label: `START ${item.countdown_value}d`, color: '#1a73e8' };
            default: return { label: '', color: '#6b7280' };
        }
    };

    const formatDate = (dateString: string): string => {
        try {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch { return dateString; }
    };

    const formatTime = (timeString: string): string => {
        try { return timeString.substring(0, 5); }
        catch { return timeString; }
    };

    if (loading) return <ActivityIndicator size="large" color="#f4a100" style={{ marginTop: 40 }} />;

    if (distances.length === 0) return (
        <Text style={commonStyles.errorText}>{t('event:distance.empty')}</Text>
    );

    return (
        <FlatList
            data={distances}
            keyExtractor={(item) => String(item.product_option_value_app_id)}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
                const badge = getCountdownBadge(item);
                return (
                    <View style={[commonStyles.card, { padding: 0, overflow: 'hidden', marginBottom: 16 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={[commonStyles.title, { marginBottom: 4 }]}>{item.distance_name}</Text>
                                <Text style={commonStyles.subtitle}>{formatDate(item.race_date)}</Text>
                                <Text style={commonStyles.subtitle}>Start {formatTime(item.race_time)}</Text>
                            </View>
                            <View style={{ backgroundColor: badge.color, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, minWidth: 90, alignItems: 'center' }}>
                                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, textAlign: 'center' }}>
                                    {badge.label}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity style={[commonStyles.primaryButton, { borderRadius: 0 }]}>
                            <Text style={commonStyles.primaryButtonText}>{t('event:official.button')}</Text>
                        </TouchableOpacity>
                    </View>
                );
            }}
        />
    );
};

export default DistanceTab;