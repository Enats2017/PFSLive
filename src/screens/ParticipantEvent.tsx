import React, { useState } from 'react'
import { View, Text, StatusBar, ScrollView } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context'
import { AppHeader } from '../components/common/AppHeader';
import { commonStyles } from '../styles/common.styles';
import { eventStyles } from '../styles/event';

const ParticipantEvent = () => {
    const [activeTab, setActiveTab] = useState();
    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={true} />
            <ScrollView
                style={eventStyles.scrollView}
                contentContainerStyle={eventStyles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={eventStyles.section}>
                    <Text style={commonStyles.title}>Events</Text>   
                </View>
                
            </ScrollView>
        </SafeAreaView>
    )
}

export default ParticipantEvent
