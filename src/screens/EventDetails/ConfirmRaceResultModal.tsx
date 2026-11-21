import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { RaceResultData } from '../../services/eventDetailService';
import { commonStyles, palette, fonts, shadows, radii, space, withAlpha } from '../../styles/common.styles';
import { RING_TINT, useCompactDialog } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';
import { MODAL_ORIENTATIONS } from '../../constants/modalOrientations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useModalSideInsets } from '../../hooks/useLandscapeSidePadding';

interface ConfirmRaceResultModalProps {
  visible: boolean;
  data: RaceResultData | null;
  distanceName: string;
  registerLoading: boolean;
  // ✅ When true: button says "Confirm" and sends verification email instead of registering
  emailVerificationMode?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmRaceResultModal: React.FC<ConfirmRaceResultModalProps> = ({
  visible,
  data,
  distanceName,
  registerLoading,
  emailVerificationMode = false,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation(['confirmModal']);
  const insets = useSafeAreaInsets();
  // a Modal is outside any SafeAreaView: pad by the side insets in landscape on every
  // platform (the screen rule returned 0 on Android 3-button — sheet under the nav bar)
  const side = useModalSideInsets();
  // ✅ Compact in landscape (device test 2026-10-23): the sheet keeps its design
  // (scrolling details, footer always on screen) but drops the 90pt flag and
  // puts Confirm / Cancel side by side — the stacked footer alone took ~190 of
  // a ~354pt sheet, leaving the details a sliver. Before the early return (hooks).
  const cd = useCompactDialog();

  if (!data) return null;

  const maskEmail = (email: string): string => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.length > 2 ? 2 : 1;
    const masked = local.substring(0, visible) + '***';
    return `${masked}@${domain}`;
  };

  return (
    <Modal supportedOrientations={MODAL_ORIENTATIONS}
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>

      {/* Card */}
      {/* The body (icon → details) scrolls; Confirm / Cancel sit in a footer
          below it that is always on screen. Before, only the data rows scrolled
          inside a maxHeight '75%' card with paddingBottom 72: in landscape the
          buttons sat ~200pt off-screen and on a 667pt phone the rows got ~0pt.
          The footer carries the real bottom inset (audit 2026-10-22). */}
      <View style={styles.wrapper} pointerEvents="box-none">
        <View
          style={[
            styles.card,
            {
              // landscape: keep the sheet content clear of the notch
              paddingLeft: 24 + side.paddingLeft,
              paddingRight: 24 + side.paddingRight,
            },
          ]}
        >
          {/* Top accent bar */}

          {/* Close button */}
          <TouchableOpacity
            style={[styles.closeBtn, { right: 16 + side.paddingRight }]}
            onPress={onClose}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <View style={styles.closeBtnInner}>
              <Text style={styles.closeBtnText}>✕</Text>
            </View>
          </TouchableOpacity>

          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Icon */}
            <View style={[styles.iconWrapper, cd.s.hide]}>
              <Ionicons name="flag" size={56} color={palette.navy} />
            </View>

            {/* Title */}
            <Text style={[styles.title, cd.s.title]}>{t('confirmModal:title')}</Text>

            {/* Distance name */}
            {distanceName ? (
              <View style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={2}>
                  {distanceName}
                </Text>
              </View>
            ) : null}

            {/* Only the ParticipantResult path sends a verification email;
                the EventDetails path registers immediately. The button label
                already switched on this prop - the subtitle promised an email
                either way, so half the users waited for one that never came. */}
            <Text style={styles.subtitle}>
              {emailVerificationMode
                ? t('confirmModal:subtitle_verify')
                : t('confirmModal:subtitle')}
            </Text>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Data rows */}
            <View>
              <Row label={t('confirmModal:fields.bibNumber')} value={data.bib_number} highlight />
              <Row label={t('confirmModal:fields.firstName')} value={data.firstname} />
              <Row label={t('confirmModal:fields.lastName')} value={data.lastname} />
              <Row label={t('confirmModal:fields.dob')} value={data.dob} />
              <Row label={t('confirmModal:fields.gender')} value={data.gender} />
              <Row label={t('confirmModal:fields.city')} value={data.city} />
              <Row label={t('confirmModal:fields.country')} value={data.country} />
              <Row label={t('confirmModal:fields.nation')} value={data.nation} />
              <Row label={t('confirmModal:fields.distance')} value={data.distance_name} />
              <Row label={t('confirmModal:fields.email')} value={maskEmail(data.email)} />
            </View>
          </ScrollView>

          {/* Footer outside the scroll (verify pass 2026-10-22): with the whole card
              scrolling, Confirm / Cancel started below the fold on a normal phone.
              Only the details scroll; the buttons are always on screen. */}
          <View style={{ paddingBottom: insets.bottom + space.xl }}>
            {/* Divider */}
            <View style={styles.divider} />

            {/* Plain column in portrait (cd.s.buttonsRow undefined); a row with a
                gap in compact, so Confirm drops its marginBottom there */}
            <View style={[cd.s.buttonsRow, cd.compact && { gap: space.md }]}>
            {/* ✅ Confirm button — label changes based on mode */}
            <TouchableOpacity
              style={[
                commonStyles.primaryButton,
                { marginBottom: cd.compact ? 0 : space.md },
                cd.s.button,
                registerLoading && { opacity: 0.7 },
              ]}
              onPress={onConfirm}
              disabled={registerLoading}
              activeOpacity={0.82}
            >
              {registerLoading ? (
                <ActivityIndicator color={palette.surface} size="small" />
              ) : (
                <Text style={commonStyles.primaryButtonText}>
                  {emailVerificationMode
                    ? t('confirmModal:buttons.confirmOnly')
                    : t('confirmModal:buttons.confirm')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Cancel button */}
            <TouchableOpacity
              style={[commonStyles.secondaryButton, cd.s.button]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={commonStyles.secondaryButtonText}>
                {t('confirmModal:buttons.cancel')}
              </Text>
            </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Row component ────────────────────────────────────────────────────────────
const Row = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => {
  if (!value) return null;
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, highlight && rowStyles.highlightValue]}>
        {value}
      </Text>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(palette.ink, 0.6),
  },
  wrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 36,
    // was paddingBottom 72 + maxHeight '75%' — see the comment on the card;
    // the bottom inset now lives on the footer under the scroll.
    maxHeight: '90%',
    ...shadows.overlay,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 10,
  },
  closeBtnInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: fonts.bodySemi,
        fontSize: 14,
    color: palette.surface,
  },
  iconWrapper: {
    alignSelf: 'center',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: RING_TINT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.md,
  },
  iconText: {
    fontFamily: fonts.body,
        fontSize: 26,
  },
  title: {
    fontFamily: fonts.display,
        fontSize: 20,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  chip: {
    alignSelf: 'center',
    backgroundColor: withAlpha(palette.navy, 0.08),
    borderWidth: 1,
    borderColor: palette.navy,
    borderRadius: radii.pill,
    paddingHorizontal: space.xl,
    paddingVertical: 4,
    marginBottom: space.md,
  },
  chipText: {
    fontFamily: fonts.bodySemi,
        fontSize: 12,
    color: palette.navy,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    // 2 lines (was 1), centred: long distance names were cut (audit 2026-10-22)
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
        fontSize: 14,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 16,
  },
  // flexGrow 0: as tall as its content, shrinking (and scrolling) only when
  // the card hits maxHeight.
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.fill,
  },
  label: {
    fontFamily: fonts.bodyMedium,
        fontSize: 14,
    color: palette.textMuted,
    flex: 1,
  },
  value: {
    fontFamily: fonts.bodySemi,
        fontSize: 14,
    color: palette.ink,
    flex: 1,
    textAlign: 'right',
  },
  highlightValue: {
    color: palette.ink,
    fontFamily: fonts.display,
        fontSize: 15,
    },
});

export default ConfirmRaceResultModal;