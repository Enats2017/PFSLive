import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Linking,
    Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { commonStyles, palette } from '../../styles/common.styles';
import { AppHeader } from '../../components/common/AppHeader';
import { Button } from '../../components/ui';
import { membershipPlansStyle as styles, COLORS } from '../../styles/membershipPlans.styles';
import { useMembershipPlans, PlanId, PLAN_IDS } from '../../hooks/useMembershipplans';
import MembershipPlanModel, { ModalActionType } from '../../components/MembershipPlanModel';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MembershipPlansScreenpops, RootStackParamList } from '../../types/navigation';
import { tokenService } from '../../services/tokenService';
import PurchaseStatusModal from '../../components/PurchaseStatusModal';
import { analyticsService } from '../../services/analyticsService';

interface PlanData {
    name: string;
    badge: string;
    // No `price`. A hardcoded figure here was shown whenever StoreKit had not
    // answered, and it had drifted: the app quoted EUR 59,99 for a plan selling
    // at EUR 39. StoreKit is the only source of a price now - if it has not
    // answered, the card shows a spinner rather than a number that may be wrong.
    period: string;
    features: string[];
    popularLabel?: string;
}

type MembershipPlansNavigationProp =
    NativeStackNavigationProp<
        RootStackParamList,
        'MembershipPlansScreen'
    >;

const MembershipPlansScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const { t, i18n } = useTranslation(['membership']);
    const navigation = useNavigation<MembershipPlansNavigationProp>();
    const [selected, setSelected] = useState<PlanId>('basic');
    const [modalAction, setModalAction] = useState<ModalActionType | null>(null);
    const [modalPlanId, setModalPlanId] = useState<PlanId | null>(null);
    const customerAppIdRef = useRef<number | null>(null);
    // Carries the product_id from the purchase REQUEST to the confirmed
    // RESULT effect below, which doesn't otherwise receive it.
    const pendingProductIdRef = useRef<string | null>(null);
    const insets = useSafeAreaInsets();


    const {
        plansData,
        loadingPlans,
        plansError,
        planByTier,
        singlePlan,
        visibleTiers,
        storeProducts,
        loadingPrices,
        defaultSelectedTier,
        refetchPlans,
        requestPurchase,
        purchaseLoading,
        purchaseResult,
        purchaseError,
        resetPurchase,
        restorePurchases,
        restoreLoading,
        restoreResult,
        restoreError,
        resetRestore,
        purchaseButtonLoading,
    } = useMembershipPlans();

    useEffect(() => {
        if (restoreResult === "success") {
            Alert.alert(
                t('membership:restoreSuccess.title'),
                t('membership:restoreSuccess.message')
            );
            resetRestore();
            // Optionally navigate back / refresh profile
        } else if (restoreResult === "none") {
            Alert.alert(
                t('membership:restoreNone.title'),
                t('membership:restoreNone.message')
            );
            resetRestore();
        }
    }, [restoreResult]);

    useEffect(() => {
        if (restoreError) {
            Alert.alert(
                t('membership:restoreError.title'),
                t('membership:restoreError.message')
            );
            resetRestore();
        }
    }, [restoreError]);

    useEffect(() => {
        if (defaultSelectedTier) setSelected(defaultSelectedTier);
    }, [defaultSelectedTier]);

    // `selected` is seeded with 'basic' and defaultSelectedTier only fires for
    // an active member, so without this a tier the backend no longer returns
    // could stay selected - the card would be gone from the list while the
    // bottom CTA still said "Continue with" it and tried to buy it.
    useEffect(() => {
        if (visibleTiers.length > 0 && !visibleTiers.includes(selected)) {
            setSelected(visibleTiers[visibleTiers.length - 1]);
        }
    }, [visibleTiers, selected]);

    useEffect(() => {
        const loadCustomerId = async () => {
            const id = await tokenService.getCustomerId();
            customerAppIdRef.current = id;
        };
        loadCustomerId();
    }, []);

    // ✅ Build language-aware legal URLs (en/nl/fr)
    const getLegalUrls = () => {
        const lang = i18n.language?.split('-')[0]; // 'fr-FR' → 'fr'
        const code = (lang === 'nl' || lang === 'fr') ? lang : 'en'; // fallback to en

        return {
            privacy: `https://my.liviolive.com/${code}-privacy-livio`,
            terms: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`,
        };
    };

    const getPlan = (id: PlanId): PlanData =>
        t(`membership:plans.${id}`, { returnObjects: true }) as PlanData;

    const getSessionsLabel = (id: PlanId): string => {
        const apiPlan = planByTier[id];
        if (!apiPlan) return getPlan(id).badge;
        if (apiPlan.unlimited) return t('membership:sessions.unlimited');
        return t('membership:sessions.count', { count: apiPlan.sessions });
    };

    const formatPriceSymbolFirst = (price: string): string => {
        const match = price.match(/^([\d.,]+)\s*([^\d\s]+)$/);
        if (match) {
            const [, amount, symbol] = match;
            return `${symbol} ${amount}`;
        }
        return price;
    };

    // null = we do not have a price from StoreKit. The caller shows a spinner.
    const getPriceLabel = (id: PlanId): string | null => {
        const apiPlan = planByTier[id];
        if (!apiPlan) return null;
        const storePrice = storeProducts[apiPlan.product_id];
        if (!storePrice) return null;

        const currentLang = i18n.language?.split('-')[0]; // handles 'fr-FR' -> 'fr'
        if (currentLang === 'fr') {
            return storePrice; // raw API format, no reformatting
        }

        return formatPriceSymbolFirst(storePrice);
    };

    const handlePlanPress = (id: PlanId) => {
        const apiPlan = planByTier[id];
        console.log('tapped plan:', id, '| action:', apiPlan?.action, '| planByTier keys:', Object.keys(planByTier));
        if (!apiPlan) return;
        //   if (apiPlan.action === 'current') {
        //     Linking.openURL('https://apps.apple.com/account/subscriptions');
        //     return;
        // }
        if (
            apiPlan.action === 'disabled' ||
            apiPlan.action === 'locked' ||
            apiPlan.action === 'hidden'
        ) {
            setModalPlanId(id);
            setModalAction(apiPlan.action as ModalActionType);
            return;
        }

        setSelected(id);
    };

    const handleContinue = async () => {
        const apiPlan = planByTier[selected];
        if (!apiPlan) return;

        if (apiPlan.action !== 'subscribe' && apiPlan.action !== 'upgrade' && apiPlan.action !== 'current') {
            setModalPlanId(selected);
            setModalAction(apiPlan.action as ModalActionType);
            return;
        }
        console.log("calling the request");
        console.log("requestdata", apiPlan.product_id);
        try {
            pendingProductIdRef.current = apiPlan.product_id ?? null;
            await requestPurchase({
                request: {
                    apple: { sku: apiPlan.product_id },
                },
                // 'subs' is right for the three tiers this button sells. The
                // activation never comes through here - it has its own button.
                type: 'subs',
            });

        } catch (error: any) {
            const message = error?.message ?? '';
            if (message.includes('cancelled') || message.includes('canceled')) {
                console.log('ℹ️ User cancelled purchase - no action needed');
                return;
            }
            console.error('❌ Purchase request failed:', error);
        }
    };

    useEffect(() => {
        if (!purchaseResult) return;

        // Fires only on a CONFIRMED result — a cancelled or failed purchase
        // never reaches this effect, so the count is real conversions.
        void analyticsService.logSubscriptionPurchased(
            pendingProductIdRef.current ?? 'unknown',
        );
        pendingProductIdRef.current = null;

        navigation.replace('OwnProfile', {
            customer_app_id: customerAppIdRef.current ?? null,
            fromEdit: true,
        });
        resetPurchase();
    }, [purchaseResult]);

    // The activation is a CONSUMABLE: bought on its own button, with
    // type 'in-app' rather than 'subs', and never joined to `selected` - the
    // bottom CTA reads "Continue with <plan>", which would be wrong for a
    // one-off. It stays buyable however many are already held, which is what
    // the backend returns (action is always 'subscribe' for tier 'single').
    const getActivationPrice = (): string | null => {
        if (!singlePlan) return null;
        const storePrice = storeProducts[singlePlan.product_id];
        if (!storePrice) return null;
        const currentLang = i18n.language?.split('-')[0];
        return currentLang === 'fr' ? storePrice : formatPriceSymbolFirst(storePrice);
    };

    const handleBuyActivation = async () => {
        if (!singlePlan) return;
        try {
            pendingProductIdRef.current = singlePlan.product_id ?? null;
            await requestPurchase({
                request: {
                    apple: { sku: singlePlan.product_id },
                },
                type: 'in-app',
            });
        } catch (error: any) {
            const message = error?.message ?? '';
            if (message.includes('cancelled') || message.includes('canceled')) {
                return;
            }
            console.error('Activation purchase failed:', error);
        }
    };

    const handleConfirmUpgrade = () => {
        if (modalPlanId) setSelected(modalPlanId);
        setModalAction(null);
        setModalPlanId(null);
    };

    const closeModal = () => {
        setModalAction(null);
        setModalPlanId(null);
    };

    const isContinueDisabled = (() => {
        const apiPlan = planByTier[selected];
        if (!apiPlan) return true;
        return apiPlan.action !== 'subscribe' && apiPlan.action !== 'upgrade' && apiPlan.action !== 'current';
    })();

    const getBannerText = (): string => {
        if (!plansData) return t('membership:infoBanner.text') as string;
        const { has_membership, source, status, sessions_remaining } = plansData.entitlement;
        if (status === 'grace') return t('membership:infoBanner.grace') as string;
        if (!has_membership) return t('membership:infoBanner.text') as string;
        if (source === 'web') return t('membership:infoBanner.webMembership') as string;
        if (sessions_remaining === null) return t('membership:infoBanner.hasSessionsLeft', { count: '∞' } as any) as string;
        if (sessions_remaining > 0) return t('membership:infoBanner.hasSessionsLeft', { count: sessions_remaining } as any) as string;
        return t('membership:infoBanner.noSessionsLeft') as string;
    };

    const renderPlanCard = (id: PlanId) => {
        const plan = getPlan(id);
        const isSelected = selected === id;
        return (
            <TouchableOpacity
                key={id}
                activeOpacity={0.85}
                onPress={() => handlePlanPress(id)}
                style={[styles.card, isSelected ? styles.cardSelected : styles.cardUnselected]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${plan.name}, ${getPriceLabel(id)} ${plan.period}`}
            >
                {!!plan.popularLabel && (
                    <View style={styles.popularBadge}>
                        <Text style={styles.popularBadgeText}>{plan.popularLabel}</Text>
                    </View>
                )}

                {isSelected && (
                    <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={11} color={palette.navy} />
                    </View>
                )}

                <View style={styles.planRow}>
                    <Text style={[styles.planName, isSelected && styles.textLight]}>
                        {plan.name}
                    </Text>
                    <View style={[styles.sessionsBadge, isSelected && styles.sessionsBadgeLime]}>
                        <Text
                            style={[
                                styles.sessionsBadgeText,
                                isSelected && styles.sessionsBadgeTextSelected,
                            ]}
                            numberOfLines={1}
                        >
                            {getSessionsLabel(id)}
                        </Text>
                    </View>
                    <View style={styles.spacer} />
                    {/* Name, badge and price stay on ONE row — see the layout note in
                        membershipPlans.styles.ts: stacking the price pushes the App
                        Review 3.1.2 disclosures off the bottom of the screen.
                        The null check is master's: the figure is not known until
                        StoreKit answers, and a hardcoded price that disagrees with
                        the store is an App Review rejection. The spinner is white on
                        a selected card, which is navy — master's `COLORS.navy` here
                        would have been invisible, and its `styles.periodLight` does
                        not exist on this branch (the token is `mutedLight`). */}
                    {getPriceLabel(id) !== null ? (
                        <Text style={[styles.price, isSelected && styles.textLight]} numberOfLines={1}>
                            {getPriceLabel(id)}
                        </Text>
                    ) : (
                        <ActivityIndicator
                            size="small"
                            color={isSelected ? COLORS.white : COLORS.darkText}
                        />
                    )}
                    <Text style={[styles.period, isSelected && styles.mutedLight]}>
                        {plan.period}
                    </Text>
                </View>

                <View style={styles.featuresWrapper}>
                    {plan.features.map((feature, idx) => (
                        <View key={idx} style={styles.featureRow}>
                            <Ionicons name="checkmark" size={14} color={palette.lime} />
                            <Text
                                style={[styles.featureText, isSelected && styles.mutedLight]}
                            >
                                {feature}
                            </Text>
                        </View>
                    ))}
                </View>
            </TouchableOpacity>
        );
    };

    if (loadingPlans || loadingPrices) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['bottom']}>
                <AppHeader title={t('common:band.membership')} showBack />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={palette.navy} />
                </View>
            </SafeAreaView>
        );
    }

    if (plansError) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['bottom']}>
                <AppHeader title={t('common:band.membership')} showBack />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
                    <Text style={[styles.headerSubtitle, { textAlign: 'center', marginBottom: 16 }]}>
                        {plansError}
                    </Text>
                    <Button
                        label={t('membership:retry') as string}
                        onPress={refetchPlans}
                        fullWidth={false}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['bottom']}>
            {/* The screen name now lives in the header's lime band, so
                membership:header.label is no longer rendered here. */}
            <AppHeader title={t('common:band.membership')} showBack />

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.headerTitle}>{t('membership:header.title')}</Text>
                <Text style={styles.headerSubtitle}>{t('membership:header.subtitle')}</Text>

                <View style={styles.infoBanner}>
                    <Ionicons name="information-circle-outline" size={16} color={COLORS.infoText} />
                    <Text style={styles.infoBannerText}>
                        {getBannerText()}
                    </Text>
                </View>

                {visibleTiers.map(renderPlanCard)}

                {singlePlan && (
                    <>
                        <View style={styles.activationDivider}>
                            <View style={styles.activationDividerLine} />
                            <Text style={styles.activationDividerText}>
                                {t('membership:activation.dividerLabel')}
                            </Text>
                            <View style={styles.activationDividerLine} />
                        </View>

                        <View style={styles.activationCard}>
                            <View style={styles.activationTopRow}>
                                <Text style={styles.activationName}>
                                    {t('membership:activation.name')}
                                </Text>
                                {getActivationPrice() !== null ? (
                                    <Text style={styles.activationPrice}>
                                        {getActivationPrice()}
                                    </Text>
                                ) : (
                                    <ActivityIndicator size="small" color={COLORS.darkText} />
                                )}
                            </View>

                            <Text style={styles.activationDescription}>
                                {t('membership:activation.description')}
                            </Text>
                            <Text style={styles.activationNote}>
                                {t('membership:activation.note')}
                            </Text>

                            <TouchableOpacity
                                style={styles.activationBuyButton}
                                activeOpacity={0.85}
                                onPress={handleBuyActivation}
                                disabled={purchaseLoading}
                            >
                                <Text style={styles.activationBuyText}>
                                    {t('membership:activation.buy')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                <Text style={styles.footerNote}>
                    {t('membership:footerNote')}
                </Text>

                {/* ✅ Subscription info + required legal links */}
                <Text style={styles.subscriptionInfoText}>
                    {t('membership:subscriptionInfo')}
                </Text>

                <TouchableOpacity
                    onPress={restorePurchases}
                    disabled={restoreLoading}
                    style={styles.restoreButton}
                >
                    {restoreLoading ? (
                        <ActivityIndicator size="small" color={COLORS.darkText} />
                    ) : (
                        <Text style={styles.restoreButtonText}>
                            {t('membership:restorePurchases')}
                        </Text>
                    )}
                </TouchableOpacity>

                <View style={styles.legalLinksRow}>
                    <TouchableOpacity onPress={() => Linking.openURL(getLegalUrls().privacy)}>
                        <Text style={styles.legalLinkText}>
                            {t('membership:legal.privacy')}
                        </Text>
                    </TouchableOpacity>

                    <Text style={styles.legalLinkSeparator}>  •  </Text>

                    <TouchableOpacity onPress={() => Linking.openURL(getLegalUrls().terms)}>
                        <Text style={styles.legalLinkText}>
                            {t('membership:legal.terms')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View style={[styles.ctaWrapper, { paddingBottom: insets.bottom + 20 }]}>
                <Button
                    label={t('membership:cta.continueWith', { planName: getPlan(selected).name })}
                    onPress={handleContinue}
                    disabled={isContinueDisabled}
                    loading={purchaseButtonLoading}
                    icon="chevron-forward"
                    iconPosition="trailing"
                />
            </View>

            <MembershipPlanModel
                visible={modalAction !== null}
                actionType={modalAction}
                title={modalAction ? (t(`membership:actionModal.${modalAction}.title`) as string) : ''}
                description={
                    modalAction
                        ? (t(`membership:actionModal.${modalAction}.description`, {
                            planName: modalPlanId ? getPlan(modalPlanId).name : '',
                            count: plansData?.entitlement.sessions_remaining ?? 0,
                        }) as string)
                        : ''
                }
                confirmLabel={modalAction ? (t(`membership:actionModal.${modalAction}.confirm`) as string) : ''}
                onClose={closeModal}
                onConfirm={handleConfirmUpgrade}
            />

            <PurchaseStatusModal
                visible={purchaseLoading || !!purchaseError}
                status={purchaseLoading ? 'processing' : 'error'}
                errorMessage={purchaseError}
                onClose={resetPurchase}
            />
        </SafeAreaView>
    );
};

export default MembershipPlansScreen;