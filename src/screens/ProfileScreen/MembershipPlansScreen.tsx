import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    ActivityIndicator,
    Linking,
    Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { colors, commonStyles } from '../../styles/common.styles';
import { membershipPlansStyle as styles, COLORS } from '../../styles/membershipPlans.styles';
import { useMembershipPlans, PlanId, PLAN_IDS } from '../../hooks/useMembershipplans';
import MembershipPlanModel, { ModalActionType } from '../../components/MembershipPlanModel';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MembershipPlansScreenpops, RootStackParamList } from '../../types/navigation';
import { tokenService } from '../../services/tokenService';
import PurchaseStatusModal from '../../components/PurchaseStatusModal';

interface PlanData {
    name: string;
    badge: string;
    price: string;
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
    const insets = useSafeAreaInsets();


    const {
        plansData,
        loadingPlans,
        plansError,
        planByTier,
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

    const getPriceLabel = (id: PlanId): string => {
        const apiPlan = planByTier[id];
        if (!apiPlan) return getPlan(id).price;
        const storePrice = storeProducts[apiPlan.product_id];
        if (loadingPrices && !storePrice) return '...';
        if (!storePrice) return getPlan(id).price;

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
            await requestPurchase({
                request: {
                    apple: { sku: apiPlan.product_id },
                },
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
        navigation.replace('OwnProfile', {
            customer_app_id: customerAppIdRef.current ?? null,
            fromEdit: true,
        });
        resetPurchase();
    }, [purchaseResult]);

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
            >
                {plan.popularLabel && (
                    <View style={styles.popularBadge}>
                        <Text style={[styles.popularBadgeText, isSelected && styles.popularselectedtext]}>{plan.popularLabel}</Text>
                    </View>
                )}

                {isSelected && (
                    <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={15} color={colors.themeiColor} />
                    </View>
                )}

                <View style={styles.cardHeaderRow}>
                    <Text style={[styles.planName, isSelected && styles.textLight]}>
                        {plan.name}
                    </Text>
                    <View style={[styles.sessionsBadge, isSelected && styles.sessionsBadgeLime]}>
                        <Text
                            style={[
                                styles.sessionsBadgeText,
                                isSelected && styles.sessionsBadgeTextSelected,
                            ]}
                        >
                            {getSessionsLabel(id)}
                        </Text>
                    </View>
                </View>

                <View style={styles.priceRow}>
                    <Text style={[styles.price, isSelected && styles.textLight]}>
                        {getPriceLabel(id)}
                    </Text>
                    <Text style={[styles.period, isSelected && styles.periodLight]}>
                        {' '}
                        {plan.period}
                    </Text>
                </View>

                <View style={styles.featuresWrapper}>
                    {plan.features.map((feature, idx) => (
                        <View key={idx} style={styles.featureRow}>
                            <Ionicons
                                name="checkmark"
                                size={18}
                                color={isSelected ? COLORS.navy : COLORS.darkText}
                            />
                            <Text
                                style={[styles.featureText, isSelected && styles.featureTextLight]}
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
            <SafeAreaView style={[commonStyles.container, { backgroundColor: colors.themeiColor }]} edges={['top']}>
                <StatusBar barStyle="light-content" backgroundColor={colors.themeiColor} />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={COLORS.white} />
                </View>
            </SafeAreaView>
        );
    }

    if (plansError) {
        return (
            <SafeAreaView style={[commonStyles.container, { backgroundColor: colors.themeiColor }]} edges={['top']}>
                <StatusBar barStyle="light-content" backgroundColor={colors.themeiColor} />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
                    <Text style={{ color: COLORS.white, textAlign: 'center', marginBottom: 16 }}>
                        {plansError}
                    </Text>
                    <TouchableOpacity onPress={refetchPlans} style={styles.ctaButton}>
                        <Text style={styles.ctaButtonText}>{t('membership:retry') as string}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[commonStyles.container, { backgroundColor: colors.themeiColor }]} edges={['top' ]}>
            <StatusBar barStyle="light-content" backgroundColor={colors.themeiColor} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={22} color={COLORS.navy} />
                    <Text style={styles.headerLabel}>{t('membership:header.label')}</Text>
                </TouchableOpacity>

                <Text style={styles.headerTitle}>{t('membership:header.title')}</Text>
                <Text style={styles.headerSubtitle}>{t('membership:header.subtitle')}</Text>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.infoBanner}>
                    <Ionicons name="information-circle-outline" size={22} color={COLORS.infoText} />
                    <Text style={styles.infoBannerText}>
                        {getBannerText()}
                    </Text>
                </View>

                {PLAN_IDS.map(renderPlanCard)}

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

            <View style={[styles.ctaWrapper, { paddingBottom: insets.bottom }]}>
                <TouchableOpacity style={[styles.ctaButton, isContinueDisabled && { opacity: 0.4 }]} activeOpacity={0.85} onPress={handleContinue} disabled={isContinueDisabled}>
                    <Text style={styles.ctaButtonText}>
                        {t('membership:cta.continueWith', { planName: getPlan(selected).name })}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.darkText} />
                </TouchableOpacity>
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