import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Animated,
    Modal,
    ScrollView,
    Platform,
    Keyboard,
    KeyboardEvent,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles, colors } from '../../styles/common.styles';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import { settingsService, Settings } from '../../services/settingsService';
import { toastSuccess, toastError } from '../../../utils/toast';
import { styles } from '../../styles/liveTrackingSettings.styles';

type Visibility = 'public' | 'private';

const generateStrongPassword = (): string => {
    const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower  = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const all    = upper + lower + digits;
    const length = Math.floor(Math.random() * 5) + 8;
    let pwd = '';
    pwd += upper [Math.floor(Math.random() * upper.length)];
    pwd += lower [Math.floor(Math.random() * lower.length)];
    pwd += digits[Math.floor(Math.random() * digits.length)];
    for (let i = pwd.length; i < length; i++) {
        pwd += all[Math.floor(Math.random() * all.length)];
    }
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
};

export const LiveTrackingSettingsScreen: React.FC = () => {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation(['setting']);

    const [visibility,    setVisibility]    = useState<Visibility>('public');
    const [password,      setPassword]      = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [modalVisible,  setModalVisible]  = useState(false);
    const [isLoading,     setIsLoading]     = useState(true);
    const [isUpdating,    setIsUpdating]    = useState(false);

    // slideAnim      sheet entrance/exit: 400=off-screen, 0=resting
    // keyboardOffset additional lift when keyboard is visible
    const slideAnim      = useRef(new Animated.Value(400)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;
    const cardScale      = useRef(new Animated.Value(1)).current;

    useEffect(() => { loadSettings(); }, []);

    // WHY we listen manually instead of using KeyboardAvoidingView:
    // slideAnim uses useNativeDriver:true so it runs on the UI thread.
    // KAV works via JS-side layout changes — the two can't cooperate and
    // KAV simply has no effect. Instead we animate keyboardOffset on the
    // same native thread and subtract it from the sheet's translateY.
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (e: KeyboardEvent) => {
            Animated.timing(keyboardOffset, {
                toValue: e.endCoordinates.height,
                duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 200,
                useNativeDriver: true,
            }).start();
        };

        const onHide = (e: KeyboardEvent) => {
            Animated.timing(keyboardOffset, {
                toValue: 0,
                duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 200,
                useNativeDriver: true,
            }).start();
        };

        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [keyboardOffset]);

    const syncState = (settings: Settings) => {
        setVisibility(settings.live_tracking_visibility);
        setPassword(
            settings.live_tracking_visibility === 'private'
                ? (settings.live_tracking_password ?? '')
                : ''
        );
    };

    const loadSettings = async () => {
        try {
            setIsLoading(true);
            const settings = await settingsService.getSettings();
            syncState(settings);
        } catch (e: any) {
            console.error('❌ [Settings] Load error:', e?.message);
            toastError(t('setting:liveTrackingSettings.toastErrorLoad'));
        } finally {
            setIsLoading(false);
        }
    };

    const saveSettings = async (vis: Visibility, pwd: string): Promise<boolean> => {
        try {
            setIsUpdating(true);
            const settings = await settingsService.updateSettings({
                live_tracking_visibility: vis,
                live_tracking_password: pwd,
            });
            syncState(settings);
            toastSuccess(t('setting:liveTrackingSettings.toastSuccess'));
            return true;
        } catch (e: any) {
            console.error('❌ [Settings] Save error:', e?.message);
            toastError(t('setting:liveTrackingSettings.toastErrorSave'));
            return false;
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSaveSettings = async (vis: Visibility) => {
        if (vis === 'private' && !password.trim()) {
            setPasswordError(t('setting:liveTrackingSettings.passwordRequired'));
            return;
        }
        setPasswordError('');
        const ok = await saveSettings(vis, vis === 'private' ? password.trim() : '');
        if (ok && vis === 'private') closeModal();
    };

    const handleTabSwitch = (val: Visibility) => {
        if (val === visibility || isUpdating) return;
        setPasswordError('');
        Animated.sequence([
            Animated.timing(cardScale, { toValue: 0.97, duration: 100, useNativeDriver: true }),
            Animated.timing(cardScale, { toValue: 1,    duration: 150, useNativeDriver: true }),
        ]).start();
        setVisibility(val);
        if (val === 'private') openModal();
    };

    const openModal = () => {
        keyboardOffset.setValue(0);
        setModalVisible(true);
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
        }).start();
    };

    const closeModal = () => {
        Keyboard.dismiss();
        Animated.timing(slideAnim, {
            toValue: 500,
            duration: 280,
            useNativeDriver: true,
        }).start(() => setModalVisible(false));
    };

    const getStrengthLabel = (len: number): string => {
        if (len < 6) return t('setting:liveTrackingSettings.strengthWeak');
        if (len < 8) return t('setting:liveTrackingSettings.strengthModerate');
        return t('setting:liveTrackingSettings.strengthStrong');
    };

    if (isLoading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
                <AppHeader title={t('setting:liveTrackingSettings.header')} showLogo={true} />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={commonStyles.loadingText}>{t('setting:liveTrackingSettings.loadingText')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="dark-content" backgroundColor="#F4F6FB" />
            <AppHeader title={t('setting:liveTrackingSettings.header')} showLogo={true} />

            <ScrollView
                contentContainerStyle={{ flexGrow: 1, padding: 15 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.pageTitleRow}>
                    <Text style={commonStyles.title}>{t('setting:liveTrackingSettings.pageTitle')}</Text>
                    <Text style={commonStyles.subtitle}>{t('setting:liveTrackingSettings.pageSubtitle')}</Text>
                </View>

                <Animated.View style={[commonStyles.card, { transform: [{ scale: cardScale }] }]}>
                    <View style={styles.cardHeader}>
                        <View style={styles.cardIconWrap}>
                            <Text style={commonStyles.title}>📍</Text>
                        </View>
                        <View>
                            <Text style={commonStyles.text}>{t('setting:liveTrackingSettings.cardTitle')}</Text>
                            <Text style={styles.cardSubtitle}>{t('setting:liveTrackingSettings.cardSubtitle')}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <Text style={commonStyles.subtitle}>{t('setting:liveTrackingSettings.visibilityLabel')}</Text>

                    <View style={styles.segmentedControl}>
                        {(['public', 'private'] as Visibility[]).map((val) => (
                            <TouchableOpacity
                                key={val}
                                style={[styles.segment, visibility === val && styles.segmentActive]}
                                onPress={() => handleTabSwitch(val)}
                                activeOpacity={0.8}
                                disabled={isUpdating}
                            >
                                <Text style={styles.segmentEmoji}>
                                    {val === 'public' ? '🌍' : '🔒'}
                                </Text>
                                <Text style={[commonStyles.text, visibility === val && styles.segmentTextActive]}>
                                    {t(`setting:liveTrackingSettings.${val}`)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {visibility === 'public' ? (
                        <TouchableOpacity
                            style={[commonStyles.primaryButton, isUpdating && { opacity: 0.7 }]}
                            onPress={() => handleSaveSettings('public')}
                            activeOpacity={0.85}
                            disabled={isUpdating}
                        >
                            {isUpdating
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={commonStyles.primaryButtonText}>{t('setting:liveTrackingSettings.saveSettings')}</Text>
                            }
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={commonStyles.secondaryButton}
                            onPress={openModal}
                            activeOpacity={0.85}
                            disabled={isUpdating}
                        >
                            <Text style={commonStyles.secondaryButtonText}>{t('setting:liveTrackingSettings.editPassword')}</Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>
            </ScrollView>

            <Modal
                transparent
                visible={modalVisible}
                animationType="none"
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        onPress={closeModal}
                        activeOpacity={1}
                    />

                    {/* Sheet position = slideAnim - keyboardOffset.
                        Both run on the native thread — smooth and in
                        sync with the system keyboard animation. */}
                    <Animated.View style={[
                        styles.bottomSheet,
                        { paddingBottom: insets.bottom + 24 },
                        {
                            transform: [{
                                translateY: Animated.subtract(slideAnim, keyboardOffset),
                            }],
                        },
                    ]}>
                        <View style={styles.sheetHandle} />

                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={closeModal}
                            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                        >
                            <Text style={styles.closeBtnText}>✕</Text>
                        </TouchableOpacity>

                        <Text style={commonStyles.title}>{t('setting:liveTrackingSettings.modalTitle')}</Text>
                        <Text style={commonStyles.subtitle}>{t('setting:liveTrackingSettings.modalSubtitle')}</Text>

                        <View style={styles.divider} />

                        <Text style={commonStyles.text}>{t('setting:liveTrackingSettings.passwordLabel')}</Text>

                        <FloatingLabelInput
                            label={t('setting:liveTrackingSettings.passwordPlaceholder')}
                            value={password}
                            onChangeText={txt => { setPassword(txt); setPasswordError(''); }}
                            iconName="lock-closed-outline"
                            isPassword
                            required
                        />

                        {!!passwordError && (
                            <Text style={commonStyles.errorText}>⚠️ {passwordError}</Text>
                        )}

                        {password.length > 0 && (
                            <Text style={styles.hintText}>
                                {getStrengthLabel(password.length)} · {password.length} {t('setting:liveTrackingSettings.chars')}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={commonStyles.secondaryButton}
                            onPress={() => { setPassword(generateStrongPassword()); setPasswordError(''); }}
                            activeOpacity={0.8}
                        >
                            <Text style={commonStyles.secondaryButtonText}>{t('setting:liveTrackingSettings.generatePassword')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[commonStyles.primaryButton, { marginTop: 10 }, isUpdating && { opacity: 0.7 }]}
                            onPress={() => handleSaveSettings('private')}
                            activeOpacity={0.85}
                            disabled={isUpdating}
                        >
                            {isUpdating
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={commonStyles.primaryButtonText}>{t('setting:liveTrackingSettings.saveSettings')}</Text>
                            }
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default LiveTrackingSettingsScreen;