import React from 'react';
import { Image, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/common.styles';
import { fanstyle } from '../styles/fan.styles';
import { EventItem } from '../services/followerEvent';
import { formatEventDate } from '../utils/dateFormatter';

interface EventCardProps {
    item: EventItem;
    t: any;
}

const EventCard: React.FC<EventCardProps> = ({ item, t }) => {
    return (
        <View style={fanstyle.eventCard}>
            <Image
                source={{ uri: item.event_image }}
                style={fanstyle.eventImg}
                resizeMode="cover"
            />
            <View style={fanstyle.eventInfo}>
                <Text style={fanstyle.eventName} numberOfLines={1}>{item.name}</Text>
                <View style={fanstyle.eventDateRow}>
                    <Text style={fanstyle.eventDate}>{formatEventDate(item.race_date, t)}</Text>
                    <Ionicons name="calendar-outline" size={15} color={colors.primaryDark} />
                </View>
            </View>
        </View>
    );
};

export default EventCard;