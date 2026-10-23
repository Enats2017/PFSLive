import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, Animated, Modal, ScrollView,
    Platform, Keyboard, KeyboardEvent, ActivityIndicator, Linking,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { commonStyles, palette, space } from '../../styles/common.styles';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, SegmentedFilter } from '../../components/ui';
import FloatingLabelInput from '../../components/FloatingLabelInput';
import { settingsService, Settings } from '../../services/settingsService';
import { toastSuccess, toastError } from '../../../utils/toast';
import { styles } from '../../styles/liveTrackingSettings.styles';
import { LanguageSelector, LanguageOption, LANGUAGE_OPTIONS } from './LanguageSelector';
import { saveLanguage, getLanguageCodeFromId } from '../../i18n';
import { useLanguageStore } from '../../store/useLanguageStore';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../../constants/analyticsScreens';
import { MODAL_ORIENTATIONS } from '../../constants/modalOrientations';
import { useLandscapeSidePadding, useModalSideInsets } from '../../hooks/useLandscapeSidePadding';

type Visibility = 'public' | 'private';

const generateStrongPassword = (): string => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const all = upper + lower + digits;
    const length = Math.floor(Math.random() * 5) + 8;
    let pwd = '';
    pwd += upper[Math.floor(Math.random() * upper.length)];
    pwd += lower[Math.floor(Math.random() * lower.length)];
    pwd += digits[Math.floor(Math.random() * digits.length)];
    for (let i = pwd.length; i < length; i++) {
        pwd += all[Math.floor(Math.random() * all.length)];
    }
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
};

export const UserTrackingSettings: React.FC = () => {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation(['setting']);
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    // landscape: the parent screen's SafeAreaView only pads the bottom, so the
    // cards and the sheet sat under the notch (audit 2026-10-22)
    const side = useLandscapeSidePadding();
    // a Modal is outside any SafeAreaView: pad by the side insets in landscape on every
    // platform (the screen rule returned 0 on Android 3-button — sheet under the nav bar)
    const sheetSide = useModalSideInsets();
    // Plain-state mirror of keyboardOffset, only to cap the sheet height: the
    // sheet is lifted by the full keyboard height, so in landscape the title,
    // ✕ and input went off the top with nothing to scroll. The sheet is now at
    // most (window − keyboard − top inset) and its body scrolls (audit 2026-10-22).
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    // ✅ Landscape + keyboard (device test 2026-10-23): the sheet is ~176pt on a
    // 393pt iPhone (393 − ~209 keyboard − 8), its body ~112pt — title, subtitle,
    // divider and field label filled it and the focused password field sat
    // below, out of view while typing. Now the body scrolls the field into view
    // when the keyboard opens, and in landscape the bottom padding while typing
    // is 8 (not 24). Portrait: content fits, so nothing moves.
    const isLandscape = windowWidth > windowHeight;
    const sheetBodyRef = useRef<ScrollView>(null);
    const inputY = useRef(0);
    const sheetBodyBox = useRef({ box: 0, content: 0 });

    const [visibility, setVisibility] = useState<Visibility>('public');
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [deletionUrl, setDeletionUrl] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption | null>(null);
    const [isLanguageUpdating, setIsLanguageUpdating] = useState(false);

    const slideAnim = useRef(new Animated.Value(400)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;
    const cardScale = useRef(new Animated.Value(1)).current;

    const { changeLanguage } = useLanguageStore();

    useEffect(() => { loadSettings(); }, []);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (e: KeyboardEvent) => {
            setKeyboardHeight(e.endCoordinates.height);
            // after the sheet has re-laid out at its smaller maxHeight; clamped
            // to the overflow, so a body that fits (portrait) never moves
            setTimeout(() => {
                const y = Math.min(inputY.current - 8, sheetBodyBox.current.content - sheetBodyBox.current.box);
                if (y > 0) sheetBodyRef.current?.scrollTo({ y, animated: true });
            }, 300);
            Animated.timing(keyboardOffset, {
                toValue: e.endCoordinates.height,
                duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 200,
                useNativeDriver: true,
            }).start();
        };
        const onHide = (e: KeyboardEvent) => {
            setKeyboardHeight(0);
            Animated.timing(keyboardOffset, {
                toValue: 0,
                duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 200,
                useNativeDriver: true,
            }).start();
        };

        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);
        return () => { showSub.remove(); hideSub.remove(); };
    }, [keyboardOffset]);

    const syncState = (settings: Settings) => {
        setVisibility(settings.live_tracking_visibility);
        setPassword(
            settings.live_tracking_visibility === 'private'
                ? (settings.live_tracking_password ?? '')
                : ''
        );
    };

    const syncLanguage = (languageId: number) => {
        const match = LANGUAGE_OPTIONS.find(option => option.value === languageId);
        if (match) setSelectedLanguage(match);
    };

    const loadSettings = async () => {
        try {
            setIsLoading(true);
            const { settings, accountDeletionUrl, languageId } = await settingsService.getSettings();
            syncState(settings);
            setDeletionUrl(accountDeletionUrl);
            syncLanguage(languageId);
            const langCode = getLanguageCodeFromId(languageId);
        if (langCode) {
            await saveLanguage(langCode);
            await changeLanguage(langCode);
        }
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
            const { settings, languageId } = await settingsService.updateSettings(
                { live_tracking_visibility: vis, live_tracking_password: pwd },
                selectedLanguage?.value
            );
            syncState(settings);
            syncLanguage(languageId);
            analyticsService.logInteraction(
                ANALYTICS_SCREENS.TRACKING_SETTINGS,
                ANALYTICS_BUTTONS.VISIBILITY_SAVE,
                'submit',
                { [ANALYTICS_PARAMS.VISIBILITY]: vis } // 'public' or 'private'
            );
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

    const handleLanguageChange = async (option: LanguageOption) => {
        const previous = selectedLanguage;
        setSelectedLanguage(option);

        try {
            setIsLanguageUpdating(true);   // ← changed from setIsUpdating
            const { settings, languageId } = await settingsService.updateSettings(
                {
                    live_tracking_visibility: visibility,
                    live_tracking_password: visibility === 'private' ? password.trim() : '',
                },
                option.value
            );
            syncState(settings);
            syncLanguage(languageId);
             const langCode = getLanguageCodeFromId(option.value);
        if (langCode) {
            await saveLanguage(langCode);
            await changeLanguage(langCode, { userInitiated: true });
        }
        toastSuccess(t('setting:liveTrackingSettings.toastSuccess'));
        } catch (e: any) {
            console.error('❌ [Settings] Language update error:', e?.message);
            toastError(t('setting:liveTrackingSettings.toastErrorSave'));
            setSelectedLanguage(previous);
        } finally {
            setIsLanguageUpdating(false);   // ← changed from setIsUpdating
        }
    };

    const handleTabSwitch = (val: Visibility) => {
        if (val === visibility || isUpdating) return;
        setPasswordError('');
        Animated.sequence([
            Animated.timing(cardScale, { toValue: 0.97, duration: 100, useNativeDriver: true }),
            Animated.timing(cardScale, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
        setVisibility(val);
        if (val === 'private') openModal();
    };

    const openModal = () => {
        keyboardOffset.setValue(0);
        setKeyboardHeight(0);
        setModalVisible(true);
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    };

    const closeModal = () => {
        Keyboard.dismiss();
        Animated.timing(slideAnim, { toValue: 500, duration: 280, useNativeDriver: true })
            .start(() => setModalVisible(false));
    };

    const getStrengthLabel = (len: number): string => {
        if (len < 6) return t('setting:liveTrackingSettings.strengthWeak');
        if (len < 8) return t('setting:liveTrackingSettings.strengthModerate');
        return t('setting:liveTrackingSettings.strengthStrong');
    };

    const handleOpenDeletion = async () => {
        if (!deletionUrl) return;
        try {
            const ok = await Linking.canOpenURL(deletionUrl);
            if (ok) await Linking.openURL(deletionUrl);
            else toastError(t('setting:liveTrackingSettings.deleteAccountError'));
        } catch {
            toastError(t('setting:liveTrackingSettings.deleteAccountError'));
        }
    };

    if (isLoading) {
        return (
            <View style={commonStyles.centerContainer}>
                <ActivityIndicator size="large" />
                <Text style={commonStyles.loadingText}>{t('setting:liveTrackingSettings.loadingText')}</Text>
            </View>
        );
    }

    return (
        <>
            <ScrollView
                contentContainerStyle={[styles.screen, { paddingLeft: space.xl + side.paddingLeft, paddingRight: space.xl + side.paddingRight }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.pageTitleRow}>
                    <Text style={styles.pageTitle}>{t('setting:liveTrackingSettings.pageTitle')}</Text>
                    <Text style={styles.pageSubtitle}>{t('setting:liveTrackingSettings.pageSubtitle')}</Text>
                </View>

                <LanguageSelector
                    selectedLanguage={selectedLanguage}
                    onSelect={handleLanguageChange}
                     disabled={isUpdating || isLanguageUpdating}
                />

                <Animated.View style={{ transform: [{ scale: cardScale }] }}>
                    <Card>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardIconWrap}>
                                <Ionicons name="location-outline" size={22} color={palette.navy} />
                            </View>
                            {/* flex 1 + minWidth 0: without it the text column sized to its
                                content and fr copy ran past the card edge (audit 2026-10-22) */}
                            <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.cardTitle}>{t('setting:liveTrackingSettings.cardTitle')}</Text>
                                <Text style={styles.cardSubtitle}>{t('setting:liveTrackingSettings.cardSubtitle')}</Text>
                            </View>
                        </View>

                        <View style={styles.divider} />
                        <Text style={styles.sectionLabel}>{t('setting:liveTrackingSettings.visibilityLabel')}</Text>

                        <SegmentedFilter<Visibility>
                            options={[
                                { value: 'public', label: t('setting:liveTrackingSettings.public') },
                                { value: 'private', label: t('setting:liveTrackingSettings.private') },
                            ]}
                            value={visibility}
                            onChange={handleTabSwitch}
                        />

                        {visibility === 'public' ? (
                            <Button
                                label={t('setting:liveTrackingSettings.saveSettings')}
                                onPress={() => handleSaveSettings('public')}
                                loading={isUpdating}
                                style={styles.actionSpacing}
                            />
                        ) : (
                            <Button
                                label={t('setting:liveTrackingSettings.editPassword')}
                                onPress={openModal}
                                variant="secondary"
                                disabled={isUpdating}
                                style={styles.actionSpacing}
                            />
                        )}
                    </Card>
                </Animated.View>

                {!!deletionUrl && (
                    <TouchableOpacity style={styles.deleteAccountBtn} onPress={handleOpenDeletion} activeOpacity={0.85}>
                        <Text style={styles.deleteAccountText}>🗑️  {t('setting:liveTrackingSettings.deleteAccount')}</Text>
                        <Text style={styles.deleteAccountHint}>{t('setting:liveTrackingSettings.deleteAccountHint')}</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent visible={modalVisible} animationType="none" onRequestClose={closeModal}>
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.modalBackdrop} onPress={closeModal} activeOpacity={1} />
                    <Animated.View style={[
                        styles.bottomSheet,
                        {
                            paddingBottom: keyboardHeight > 0 && isLandscape ? 8 : (keyboardHeight > 0 ? 0 : insets.bottom) + 24,   // home-indicator inset is behind the keyboard while typing
                            maxHeight: windowHeight - keyboardHeight - insets.top - 8,
                            paddingLeft: space.xxl + sheetSide.paddingLeft,
                            paddingRight: space.xxl + sheetSide.paddingRight,
                        },
                        { transform: [{ translateY: Animated.subtract(slideAnim, keyboardOffset) }] },
                    ]}>
                        <View style={styles.sheetHandle} />
                        <TouchableOpacity style={[styles.closeBtn, { right: 14 + sheetSide.paddingRight }]} onPress={closeModal} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                            <Text style={styles.closeBtnText}>✕</Text>
                        </TouchableOpacity>

                        <ScrollView
                            ref={sheetBodyRef}
                            onLayout={(e) => { sheetBodyBox.current.box = e.nativeEvent.layout.height; }}
                            onContentSizeChange={(_w, h) => { sheetBodyBox.current.content = h; }}
                            style={styles.sheetBody}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            <Text style={styles.modalTitle}>{t('setting:liveTrackingSettings.modalTitle')}</Text>
                            <Text style={styles.modalSubtitle}>{t('setting:liveTrackingSettings.modalSubtitle')}</Text>
                            <View style={styles.divider} />
                            <Text style={styles.fieldLabel}>{t('setting:liveTrackingSettings.passwordLabel')}</Text>

                            <View onLayout={(e) => { inputY.current = e.nativeEvent.layout.y; }}>
                            <FloatingLabelInput
                                label={t('setting:liveTrackingSettings.passwordPlaceholder')}
                                value={password}
                                onChangeText={txt => { setPassword(txt); setPasswordError(''); }}
                                iconName="lock-closed-outline"
                                isPassword
                                required
                            />
                            </View>

                            {!!passwordError && <Text style={commonStyles.errorText}>⚠️ {passwordError}</Text>}

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
                                style={[commonStyles.primaryButton, { marginTop: 8 }, isUpdating && { opacity: 0.7 }]}
                                onPress={() => handleSaveSettings('private')}
                                activeOpacity={0.85}
                                disabled={isUpdating}
                            >
                                {isUpdating
                                    ? <ActivityIndicator size="small" color={palette.surface} />
                                    : <Text style={commonStyles.primaryButtonText}>{t('setting:liveTrackingSettings.saveSettings')}</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </Animated.View>
                </View>
            </Modal>
        </>
    );
};