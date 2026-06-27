import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, commonStyles } from '../../styles/common.styles';
import { membershipPlansStyle as styles, COLORS } from '../../styles/membershipPlans.styles';
 import { useNavigation } from '@react-navigation/native';

type PlanId = 'lite' | 'basic' | 'pro';

interface PlanData {
    name: string;
    badge: string;
    price: string;
    period: string;
    features: string[];
    popularLabel?: string;
}

const PLAN_IDS: PlanId[] = ['lite', 'basic', 'pro'];

const MembershipPlansScreen: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const { t } = useTranslation(['membership']);
    const [selected, setSelected] = useState<PlanId>('basic');
    const navigation = useNavigation();

    const getPlan = (id: PlanId): PlanData =>
        t(`membership:plans.${id}`, { returnObjects: true }) as PlanData;

    const renderPlanCard = (id: PlanId) => {
        const plan = getPlan(id);
        const isSelected = selected === id;
        return (
            <TouchableOpacity
                key={id}
                activeOpacity={0.85}
                onPress={() => setSelected(id)}
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
                            {plan.badge}
                        </Text>
                    </View>
                </View>

                <View style={styles.priceRow}>
                    <Text style={[styles.price, isSelected && styles.textLight]}>
                        {plan.price}
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

    return (
        <SafeAreaView style={[commonStyles.container,{backgroundColor:colors.primary}]} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

            <View style={styles.header}>
                <TouchableOpacity onPress={()=> navigation.goBack()} style={styles.backButton}>
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
                {/* Info banner */}
                <View style={styles.infoBanner}>
                    <Ionicons name="information-circle-outline" size={22} color={COLORS.infoText} />
                    <Text style={styles.infoBannerText}>
                        {t('membership:infoBanner.text')}
                    </Text>
                </View>

                {/* Plan cards */}
                {PLAN_IDS.map(renderPlanCard)}

                {/* Footer note */}
                <Text style={styles.footerNote}>
                    {t('membership:footerNote')}
                </Text>
            </ScrollView>

            {/* CTA */}
            <View style={styles.ctaWrapper}>
                <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85}>
                    <Text style={styles.ctaButtonText}>
                        {t('membership:cta.continueWith', { planName: getPlan(selected).name })}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.darkText} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default MembershipPlansScreen;