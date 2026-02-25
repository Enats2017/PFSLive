import React, { useState } from 'react'
import { KeyboardAvoidingView, ScrollView, StatusBar, Platform, View, Alert, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppHeader } from '../../components/common/AppHeader'
import { commonStyles, spacing } from '../../styles/common.styles'
import { PersonalEventProps } from '../../types/navigation'
import FloatingLabelInput from '../../components/FloatingLabelInput'
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { personalStyles } from '../../styles/personalEvent.styles'
import { useTranslation } from 'react-i18next';
import { API_CONFIG, getApiEndpoint } from '../../constants/config'
import axios from 'axios';
import { toastError, toastSuccess } from '../../../utils/toast'
import { createPersonalEvent } from '../../services/personalEventService';

const CreatePersonalEvent: React.FC<PersonalEventProps> = ({ navigation }) => {
    const { t } = useTranslation(['personal', 'common']);
    const [name, setName] = useState('');
    const [selectedEventType, setSelectedEventType] = useState<{ label: string; value: number } | null>(null);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [date, setDate] = useState('');
    const [selectedFile, setSelectedFile] = useState<any>(null);

    const EVENT_TYPE_OPTIONS = [
        { label: "Organized Event with ranking / results", value: 1 },
        { label: "Organized Event without ranking / results", value: 2 },
        { label: "Training session", value: 3 },
    ];

    const pickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/gpx+xml', '.gpx'],
                copyToCacheDirectory: true,
                multiple: false,
            });
            if (!result.canceled && result.assets?.[0]) {
                setSelectedFile(result.assets[0]);
            }
        } catch (error) {
            console.error('File pick error:', error);
            toastError('File Error', 'Failed to pick file. Please try again.');
        }
    };

    const handleViewFile = () => {
        if (!selectedFile) return;
        Alert.alert("File Info", `Name: ${selectedFile.name}\nSize: ${(selectedFile.size / 1024).toFixed(2)} KB`);
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            toastError('Validation', 'Please enter a name.');
            return;
        }
        if (!date.trim()) {
            toastError('Validation', 'Please select a date.');
            return;
        }

        try {
            const data = await createPersonalEvent({
                name,
                eventTypeId: selectedEventType?.value ?? null,  // ✅ sending selected value
                date,
                startTime,
                endTime,
                selectedFile,
            });

            if (data.success) {
                toastSuccess(t('personal:success.title'));
                navigation.goBack();
            }
        } catch (error: any) {
            const message = error.response?.data?.message || error.message || 'Something went wrong';
            toastError('Error', message);
        }
    };

    return (
        <SafeAreaView style={commonStyles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader showLogo={true} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1 }}
                >
                    <View style={personalStyles.section}>
                        <Text style={commonStyles.title}>{t('personal:title')}</Text>
                    </View>

                    <View style={personalStyles.formContainer}>
                        <FloatingLabelInput
                            label={t('personal:name')}
                            value={name}
                            onChangeText={setName}
                            iconName="person-circle-outline"
                        />

                        <FloatingLabelInput
                            label="Event Type"
                            value={selectedEventType?.label ?? ''}
                            onChangeText={() => { }}
                            isDropdown
                            options={EVENT_TYPE_OPTIONS}
                            onSelect={(item) => setSelectedEventType(item)}
                        />

                        <FloatingLabelInput
                            label={t('personal:date')}
                            value={date}
                            onChangeText={setDate}
                            iconName="calendar-outline"
                            isDatePicker
                            required
                        />

                        <FloatingLabelInput
                            label={t('personal:startTime')}
                            value={startTime}
                            onChangeText={setStartTime}
                            iconName="time-outline"
                            isTimePicker
                        />

                        <FloatingLabelInput
                            label={t('personal:EndTime')}
                            value={endTime}
                            onChangeText={setEndTime}
                            iconName="time-outline"
                            isTimePicker
                        />


                        <View>
                            {!selectedFile ? (
                                <TouchableOpacity
                                    style={personalStyles.uploadBox}
                                    onPress={pickFile}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="cloud-upload-outline" size={40} color="#ff5722" />
                                    <Text style={personalStyles.uploadTitle}>Tap to Upload GPX File</Text>
                                    <Text style={personalStyles.uploadSubtitle}>Supported format: .gpx</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={personalStyles.fileCard}>
                                    <View style={personalStyles.fileLeft}>
                                        <Ionicons name="document-outline" size={28} color="#FF5722" />
                                        <View style={{ marginLeft: 10, flex: 1 }}>
                                            <Text numberOfLines={1} style={personalStyles.fileName}>
                                                {selectedFile.name}
                                            </Text>
                                            <Text style={personalStyles.fileSize}>
                                                {(selectedFile.size / 1024).toFixed(2)} KB
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={personalStyles.actions}>
                                        <TouchableOpacity onPress={handleViewFile}>
                                            <Ionicons name="eye-outline" size={22} color="#444" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setSelectedFile(null)}>
                                            <Ionicons name="close-circle" size={24} color="red" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>

                        <Text style={personalStyles.subtitle}>{t('personal:fileInfo')}</Text>

                        <TouchableOpacity
                            style={[commonStyles.primaryButton, { marginTop: spacing.xxxl }]}
                            onPress={handleSubmit}
                        >
                            <Text style={commonStyles.primaryButtonText}>{t('personal:button.save')}</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};


export default CreatePersonalEvent
