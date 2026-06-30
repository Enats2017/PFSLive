import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { colors, commonStyles } from '../../styles/common.styles';
import { membershipPlansStyle as styles, COLORS } from '../../styles/membershipPlans.styles';
import { useMembershipPlans, PlanId, PLAN_IDS } from '../../hooks/useMembershipplans';
import MembershipPlanModel, { ModalActionType } from '../../components/MembershipPlanModel';

interface PlanData {
    name: string;
    badge: string;
    price: string;
    period: string;
    features: string[];
    popularLabel?: string;
}

const MembershipPlansScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const { t } = useTranslation(['membership']);
    const navigation = useNavigation();
    const [selected, setSelected] = useState<PlanId>('basic');
    const [modalAction, setModalAction] = useState<ModalActionType | null>(null);
    const [modalPlanId, setModalPlanId] = useState<PlanId | null>(null);

    const {
        plansData,
        loadingPlans,
        plansError,
        planByTier,
        storeProducts,
        loadingPrices,
        defaultSelectedTier,
        refetchPlans,
    } = useMembershipPlans();

    useEffect(() => {
        if (defaultSelectedTier) setSelected(defaultSelectedTier);
    }, [defaultSelectedTier]);

    const getPlan = (id: PlanId): PlanData =>
        t(`membership:plans.${id}`, { returnObjects: true }) as PlanData;

    const getSessionsLabel = (id: PlanId): string => {
        const apiPlan = planByTier[id];
        if (!apiPlan) return getPlan(id).badge;
        if (apiPlan.unlimited) return t('membership:sessions.unlimited');
        return t('membership:sessions.count', { count: apiPlan.sessions });
    };

    const getPriceLabel = (id: PlanId): string => {
        const apiPlan = planByTier[id];
        if (!apiPlan) return getPlan(id).price;
        const storePrice = storeProducts[apiPlan.product_id];
        if (loadingPrices && !storePrice) return '...';
        return storePrice || getPlan(id).price;
    };

   const handlePlanPress = (id: PlanId) => {
    const apiPlan = planByTier[id];

    if (!apiPlan) return;

    if (
        apiPlan.action === 'upgrade' ||
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

    const handleConfirmUpgrade = () => {
        if (modalPlanId) setSelected(modalPlanId);
        setModalAction(null);
        setModalPlanId(null);
    };

    const closeModal = () => {
        setModalAction(null);
        setModalPlanId(null);
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
                        <Text style={styles.popularBadgeText}>{plan.popularLabel}</Text>
                    </View>
                )}

                {isSelected && (
                    <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={15} color={COLORS.darkText} />
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
                                color={isSelected ? COLORS.lime : COLORS.darkText}
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

    if (loadingPlans) {
        return (
            <SafeAreaView style={[commonStyles.container, { backgroundColor: colors.primary }]} edges={['top']}>
                <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={COLORS.white} />
                </View>
            </SafeAreaView>
        );
    }

    if (plansError) {
        return (
            <SafeAreaView style={[commonStyles.container, { backgroundColor: colors.primary }]} edges={['top']}>
                <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
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
        <SafeAreaView style={[commonStyles.container, { backgroundColor: colors.primary }]} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={22} color={COLORS.white} />
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
                        {t('membership:infoBanner.text')}
                    </Text>
                </View>

                {PLAN_IDS.map(renderPlanCard)}

                <Text style={styles.footerNote}>
                    {t('membership:footerNote')}
                </Text>
            </ScrollView>

            <View style={styles.ctaWrapper}>
                <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85}>
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
                          }) as string)
                        : ''
                }
                confirmLabel={modalAction ? (t(`membership:actionModal.${modalAction}.confirm`) as string) : ''}
                showConfirm={modalAction === 'upgrade'}
                onClose={closeModal}
                onConfirm={handleConfirmUpgrade}
            />
        </SafeAreaView>
    );
};

export default MembershipPlansScreen;