import React, { useState, useCallback, useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    View,
    Text,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/common/AppHeader';
import { Button, Card } from '../../components/ui';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import FeedbackSuccessModal from '../../components/FeedbackSuccessModal';
import { commonStyles, palette } from '../../styles/common.styles';
import { toastError, toastSuccess } from '../../../utils/toast';
import { feedbackApi, validateFeedbackFields, ALLOWED_TOPICS, TopicKey, SubmitFeedbackPayload } from '../../services/feedbackApi';
import { ContactFeedbackScreenprops } from '../../types/navigation';
import { contactStyles } from '../../services/contactFeedback.styles';
import { useLandscapeSidePadding, useSafeAreaEdges } from '../../hooks/useLandscapeSidePadding';

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
    const scrollRef = useRef<ScrollView>(null);
    // ✅ Measured position of the message field inside the scroll content
    // (card y + field y within the card). The old fixed scrollTo({ y: 260 })
    // only matched one phone/language: a taller banner in fr/nl, Larger Text or
    // a 2-line topic left the field under the keyboard or scrolled past it.
    const cardYRef = useRef(0);
    const messageYRef = useRef<number | null>(null);
    // ✅ Notch clearance for the body in landscape (edges are ['bottom']).
    const sidePadding = useLandscapeSidePadding();
    const safeEdges = useSafeAreaEdges();   // + Android 3-button landscape sides
    const topicLabels = t('topics', { returnObjects: true }) as Record<TopicKey, string>;
    const topicOptions = ALLOWED_TOPICS.map((key, index) => ({
        label: topicLabels[key],
        value: index,
    }));

    // Use the app's standard keyboard behavior: `KeyboardAvoidingView` handles
    // the insets and scroll placement for the focused field, while the ScrollView
    // keeps the form content reachable without manually translating it.

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
        if (submitting) return;

        const fieldErrors = validateFeedbackFields({ topic, message, email });

        if (Object.keys(fieldErrors).length > 0) {
            setErrors({
                message: fieldErrors.message ? t(`errors.${fieldErrors.message}`) : undefined,
                topic: fieldErrors.topic ? t(`errors.${fieldErrors.topic}`) : undefined,
                email: fieldErrors.email ? t(`errors.${fieldErrors.email}`) : undefined,
            });
            return;
        }

        const payload: SubmitFeedbackPayload = {
            topic: topic as TopicKey, // guaranteed non-null here — fieldErrors would have caught it otherwise
            message,
            name,
            email,
        };

        setErrors({});
        setSubmitting(true);
        const result = await feedbackApi.submit(payload);
        setSubmitting(false);

        if (result.success) {
            resetForm();
            toastSuccess(t('success.toastMessage'));
            setShowSuccess(true);
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

    const handleDescriptionFocus = useCallback(() => {
        requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({
                y: messageYRef.current !== null
                    ? Math.max(0, cardYRef.current + messageYRef.current - 12)
                    : 260,
                animated: true,
            });
        });
    }, []);

    return (
        <SafeAreaView style={commonStyles.container} edges={safeEdges}>
            {/* header.title now reads from the shared band, so the local
                back-arrow row is gone. */}
            <AppHeader title={t('common:band.contactFeedback')} showBack />

            {/* contactStyles.flex bounds the ScrollView to the space left under
                the header — without it the ScrollView sizes to its content and
                the reachUs card falls off the bottom with nothing to scroll. */}
            <KeyboardAvoidingView
                style={[contactStyles.flex, sidePadding]}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                // ✅ 0, not 80: RN's KAV uses its onLayout frame, relative to a
                // SafeAreaView that starts at the screen top (headerShown false),
                // so AppHeader is already counted. 80 lifted the form 80pt clear
                // of the keyboard — in landscape that left ~0-20pt of form.
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    ref={scrollRef}
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
                            <Ionicons name="mail" size={30} color={palette.navy} />
                            <View style={contactStyles.bannerBubble}>
                                <Ionicons name="chatbubble-ellipses" size={13} color={palette.surface} />
                            </View>
                        </View>
                    </View>
                    <View onLayout={(e) => { cardYRef.current = e.nativeEvent.layout.y; }}>
                    <Card>
                        <FloatingLabelInput
                            label={t('fields.name.label')}
                            value={name}
                            onChangeText={setName}
                            iconName="person-outline"
                            placeholder={t('fields.name.placeholder')}
                            autoCapitalize="words"
                            returnKeyType="next"
                            editable={false}
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
                            editable={false}
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

                        <View onLayout={(e) => { messageYRef.current = e.nativeEvent.layout.y; }}>
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
                            onFocus={handleDescriptionFocus}
                        />
                        </View>
                        <Text style={contactStyles.charCount}>{message.length}/500</Text>
                    </Card>
                    </View>

                    <Button
                        label={submitting ? t('button.sending') : t('button.send')}
                        onPress={handleSubmit}
                        loading={submitting}
                        icon="paper-plane-outline"
                        style={contactStyles.submitSpacing}
                    />
                    <Text style={contactStyles.footerNote}>{t('footer')}</Text>

                    {/* 36_ContactFeedback.png: a way to reach support that does
                        not depend on this form going through. */}
                    <View style={contactStyles.reachCard}>
                        <Text style={contactStyles.reachTitle}>{t('reachUs.title')}</Text>
                        <View style={contactStyles.reachRow}>
                            <Ionicons name="mail-outline" size={20} color={palette.navy} />
                            <Text style={contactStyles.reachEmail} selectable>
                                {t('reachUs.email')}
                            </Text>
                        </View>
                        <Text style={contactStyles.reachNote}>{t('reachUs.replyTime')}</Text>
                    </View>
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