import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { commonStyles } from '../../styles/common.styles';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { API_CONFIG, getApiEndpoint } from '../../constants/config';
import axios from 'axios';

const ParticipantTab = ({ product_app_id }: { product_app_id: string | number }) => {
    const { t } = useTranslation(['event']);
    const [loading, setLoading] = useState(false);

    // ✅ Add your participant API here when ready
    // useEffect(() => { fetchParticipants(); }, [product_app_id]);

    if (loading) return <ActivityIndicator size="large" color="#f4a100" style={{ marginTop: 40 }} />;

    return (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text style={commonStyles.subtitle}>{t('event:participant.empty')}</Text>
        </View>
    );
};

export default ParticipantTab;