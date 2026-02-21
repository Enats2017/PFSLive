import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API_CONFIG, getApiEndpoint } from '../../constants/config';
import SearchInput from '../../components/SearchInput';
import { LinearGradient } from 'expo-linear-gradient';

interface Participant {
    participant_app_id: string;
    firstname: string | null;
    lastname: string | null;
    bib_number: string;
    city: string;
    country: string;
    race_distance: string;
}

const ParticipantTab = ({ product_app_id }: { product_app_id: string | number }) => {
    const { t } = useTranslation(['event']);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const debounceTimer = useRef<any>(null);
    const isLoadingMoreRef = useRef(false);

    useEffect(() => {
        fetchParticipants(1, '');
    }, [product_app_id]);

    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            fetchParticipants(1, searchText);
        }, 500);
        return () => clearTimeout(debounceTimer.current);
    }, [searchText]);

    const fetchParticipants = async (pageNum: number, search: string) => {
        try {
            const url = getApiEndpoint(API_CONFIG.ENDPOINTS.PARTICIPANTS);
            pageNum === 1 ? setLoading(true) : setLoadingMore(true);
            const headers = await API_CONFIG.getHeaders();
            console.log(product_app_id);
            const requestBody = {
                product_app_id,
                page: pageNum,
                filter_name: search
            };
            console.log(requestBody);

            const response = await axios.post(
                url,
                requestBody,
                {
                    headers,

                }
            );
            if (response.data.success) {
                const data = response.data.data?.participants || [];
                const pagination = response.data.data?.pagination || {};
                setParticipants(prev => pageNum === 1 ? data : [...prev, ...data]);
                setPage(pageNum);
                setTotalPages(pagination.total_pages || 1);
            }
        } catch (error) {
            console.error('Failed to fetch participants:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            isLoadingMoreRef.current = false;
        }
    };

    const handleLoadMore = useCallback(() => {
        if (isLoadingMoreRef.current || loadingMore) return;
        if (page >= totalPages) return;
        isLoadingMoreRef.current = true;
        fetchParticipants(page + 1, searchText);
    }, [page, totalPages, loadingMore, searchText]);

    const renderParticipant = ({ item }: { item: Participant }) => (
        <View style={[commonStyles.card, { padding: 0, overflow: 'hidden', marginBottom: 16 }]}>
            <View style={eventStyles.topRow}>
                <View style={eventStyles.avatar}>
                    <Ionicons name="person-circle-outline" size={55} color="#9ca3af" style={eventStyles.logo} />
                </View>
                <LinearGradient
                    colors={['#e8341a', '#f4a100', '#1a73e8']}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={eventStyles.divider}
                />
                <View style={eventStyles.info}>
                    <Text style={commonStyles.title}>
                        {`${item.firstname ?? ''} ${item.lastname ?? ''}`.trim().toUpperCase() || 'UNKNOWN PARTICIPANT'}
                    </Text>
                    <Text style={commonStyles.text}>{item.city} | {item.country}</Text>
                    <Text style={commonStyles.subtitle}>{item.race_distance}</Text>
                </View>
            </View>
            <TouchableOpacity style={commonStyles.favoriteButton}>
                <Text style={commonStyles.favoriteButtonText}>ADD TO FAVORITE</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={commonStyles.container}>
            <SearchInput
                placeholder={t('event:participant.search')}
                value={searchText}
                onChangeText={setSearchText}
                icon="search"
            />
            {loading ? (
                <ActivityIndicator size="large" color="#f4a100" style={{ marginTop: 40 }} />
            ) : participants.length === 0 ? (
                <Text style={commonStyles.errorText}>{t('event:participant.empty')}</Text>
            ) : (
                <FlatList
                    data={participants}
                    keyExtractor={(item) => String(item.participant_app_id)}
                    renderItem={renderParticipant}
                    showsVerticalScrollIndicator={false}
                    onEndReached={handleLoadMore}
                    contentContainerStyle={{ paddingBottom: spacing.xxxl}}
                    onEndReachedThreshold={0.2}
                    ListFooterComponent={
                        loadingMore
                            ? <ActivityIndicator size="small" color="#f4a100" style={{ marginVertical: 16 }} />
                            : null
                    }
                />
            )}
        </View>
    );
};

export default ParticipantTab;