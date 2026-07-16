import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    StatusBar,  
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import FeedbackSuccessModal from '../../components/FeedbackSuccessModal';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { toastError, toastSuccess } from '../../../utils/toast';
import {feedbackApi, validateFeedback, ALLOWED_TOPICS, TopicKey, SubmitFeedbackPayload} from '../../services/feedbackApi';
import { ContactFeedbackScreenprops } from '../../types/navigation';
import { contactStyles } from '../../services/contactFeedback.styles';

const TOPIC_ICONS: Record<TopicKey, keyof typeof Ionicons.glyphMap> = {
    bug: 'bug-outline',
    feature: 'bulb-outline',
    event: 'calendar-outline',
    billing: 'card-outline',
    other: 'ellipsis-horizontal-circle-outline',
};

type FieldErrors = {
    message?: string;
    topic?: string;
    email?: string;
};

const ContactFeedbackScreen: React.FC<ContactFeedbackScreenprops> = ({ navigation, route }) => {
    const { t } = useTranslation('contact');
    const incomingProfile = route.params?.profile;
    const [name, setName] = useState(incomingProfile ? `${incomingProfile.firstname ?? ''} ${incomingProfile.lastname ?? ''}`.trim() : '');
    const [email, setEmail] = useState(incomingProfile?.email ?? '');
    const [message, setMessage] = useState('');
    const [topic, setTopic] = useState<TopicKey | null>(null);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [submitting, setSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const topicLabels = t('topics', { returnObjects: true }) as Record<TopicKey, string>;
    const topicOptions = ALLOWED_TOPICS.map((key, index) => ({
        label: topicLabels[key],
        value: index,
    }));

    const handleMessageChange = useCallback((text: string) => {
        setMessage(text);
        setErrors(prev => (prev.message ? { ...prev, message: undefined } : prev));
    }, []);

    const handleEmailChange = useCallback((text: string) => {
        setEmail(text);
        setErrors(prev => (prev.email ? { ...prev, email: undefined } : prev));
    }, []);

    const handleTopicSelect = useCallback((item: { value: number }) => {
        setTopic(ALLOWED_TOPICS[item.value]);
        setErrors(prev => (prev.topic ? { ...prev, topic: undefined } : prev));
    }, []);

    const resetForm = useCallback(() => {
        setName('');
        setEmail('');
        setMessage('');
        setTopic(null);
        setErrors({});
    }, []);


    const handleSubmit = useCallback(async () => {
        if (submitting) return; // guard against double-tap

        const payload: SubmitFeedbackPayload = {
            topic: (topic ?? 'other') as TopicKey,
            message,
            name,
            email,
        };

        const validationError = validateFeedback(payload);
        if (validationError) {
            const nextErrors: FieldErrors = {};
            if (validationError === 'message_required' || validationError === 'message_too_long') {
                nextErrors.message = t(`errors.${validationError}`);
            } else if (validationError === 'topic_required') {
                nextErrors.topic = t(`errors.${validationError}`);
            } else if (validationError === 'invalid_email') {
                nextErrors.email = t(`errors.${validationError}`);
            }
            setErrors(nextErrors);
            return;
        }

        setErrors({});
        setSubmitting(true);
        const result = await feedbackApi.submit(payload);
        setSubmitting(false);

        if (result.success) {
            resetForm();
            toastSuccess(t('success.toastMessage'));
            setShowSuccess(true); // modal still shows for the full celebratory moment
        } else {
            toastError(
                t(`errors.${result.error}`, { defaultValue: t('errors.generic_body') }),
            );
        }
    }, [submitting, topic, message, name, email, resetForm, t]);

    const handleSuccessClose = useCallback(() => {
        setShowSuccess(false);
        navigation.goBack();
    }, [navigation]);

    return (
        <SafeAreaView style={[commonStyles.container, { backgroundColor: colors.themeiColor }]} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.themeiColor} />
            <View style={contactStyles.header}>
                <TouchableOpacity
                    style={contactStyles.backButton}
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="arrow-back" size={22} color={colors.gray900} />
                </TouchableOpacity>
                <Text style={commonStyles.title}>{t('header.title')}</Text>
            </View>
            <KeyboardAvoidingView
                style={contactStyles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
            >
                <ScrollView
                    contentContainerStyle={contactStyles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={contactStyles.banner}>
                        <View style={contactStyles.bannerText}>
                            <Text style={contactStyles.bannerTitle}>{t('banner.title')}</Text>
                            <Text style={contactStyles.bannerSubtitle}>{t('banner.subtitle')}</Text>
                        </View>

                        <View style={contactStyles.bannerIllustration}>
                            <Ionicons name="mail" size={30} color={colors.primary} />
                            <View style={contactStyles.bannerBubble}>
                                <Ionicons name="chatbubble-ellipses" size={13} color={colors.white} />
                            </View>
                        </View>
                    </View>
                    <View style={[commonStyles.card]}>
                        <FloatingLabelInput
                            label={t('fields.name.label')}
                            value={name}
                            onChangeText={setName}
                            iconName="person-outline"
                            placeholder={t('fields.name.placeholder')}
                            autoCapitalize="words"
                            returnKeyType="next"
                            editable={!submitting}
                        />

                        <FloatingLabelInput
                            label={t('fields.email.label')}
                            value={email}
                            onChangeText={handleEmailChange}
                            iconName="mail-outline"
                            placeholder={t('fields.email.placeholder')}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            returnKeyType="next"
                            editable={!submitting}
                            error={!!errors.email}
                            errorMessage={errors.email}
                        />

                        <FloatingLabelInput
                            label={t('fields.topic.label')}
                            value={topic ? topicLabels[topic] : ''}
                            onChangeText={() => { }}
                            iconName={topic ? TOPIC_ICONS[topic] : 'help-circle-outline'}
                            isDropdown
                            options={topicOptions}
                            onSelect={handleTopicSelect}
                            required
                            editable={!submitting}
                            error={!!errors.topic}
                            errorMessage={errors.topic}
                        />

                        <FloatingLabelInput
                            label={t('fields.message.label')}
                            value={message}
                            onChangeText={handleMessageChange}
                            iconName="chatbox-ellipses-outline"
                            placeholder={t('fields.message.placeholder')}
                            multiline
                            inputHeight={128}
                            numberOfLines={5}
                            editable={!submitting}
                            error={!!errors.message}
                            errorMessage={errors.message}
                        />
                        <Text style={contactStyles.charCount}>{message.length}/500</Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            commonStyles.primaryButton,
                            { flexDirection: 'row', marginTop: spacing.xl },
                            submitting && contactStyles.buttonDisabled,
                        ]}
                        activeOpacity={0.9}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {!submitting && (
                            <Ionicons
                                name="paper-plane-outline"
                                size={18}
                                color={colors.white}
                                style={contactStyles.sendIcon}
                            />
                        )}
                        <Text style={commonStyles.primaryButtonText}>
                            {submitting ? t('button.sending') : t('button.send')}
                        </Text>
                    </TouchableOpacity>
                    <Text style={contactStyles.footerNote}>{t('footer')}</Text>
                </ScrollView>
            </KeyboardAvoidingView>
            <FeedbackSuccessModal
                visible={showSuccess}
                title={t('success.title')}
                subtitle={t('success.body')}
                buttonLabel={t('success.backToProfile')}
                onClose={handleSuccessClose}
            />
        </SafeAreaView>
    );
};


export default ContactFeedbackScreen;