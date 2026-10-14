// src/components/Home/ShareTrackingLink.tsx
//
// ✅ "Share my live link" — each runner brings their own audience.
//
// Links to the runner's own live page on the follower webapp:
//   {WEB_BASE_URL}/result_detail/?product_app_id&product_option_value_app_id&bib&from_live=1
// (livio_web route; trailingSlash export, hence "/result_detail/").
//
// Needs the runner's bib + distance for THIS race. home_api did not return
// them — the growth API change adds next_race_bib_number /
// next_race_product_option_value_app_id. Until the server sends both, this
// renders nothing (no half-working link). Custom/GPX events have no bib and
// are skipped for the same reason.

import React, { useCallback } from 'react';
import { Platform, Share, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { palette } from '../../styles/common.styles';
import { readinessStyles as s } from '../../styles/readiness.styles';
import { APP_CONFIG } from '../../constants/config';
import { analyticsService } from '../../services/analyticsService';

interface Props {
  productAppId?: string | number | null;
  povId?: string | number | null;
  bib?: string | number | null;
  raceName?: string | null;
}

export const buildLiveLink = (
  productAppId: string | number,
  povId: string | number,
  bib: string | number,
): string =>
  `${APP_CONFIG.WEB_BASE_URL}/result_detail/?product_app_id=${encodeURIComponent(String(productAppId))}` +
  `&product_option_value_app_id=${encodeURIComponent(String(povId))}` +
  `&bib=${encodeURIComponent(String(bib))}&from_live=1`;

export const ShareTrackingLink: React.FC<Props> = ({ productAppId, povId, bib, raceName }) => {
  const { t } = useTranslation(['readiness']);

  const bibStr = bib != null ? String(bib).trim() : '';
  // '0' is what an (int)-cast empty bib looks like — never a real bib.
  // Number() > 0: ids may arrive as strings, and "0" is the server default.
  const usable = Number(productAppId) > 0 && Number(povId) > 0 && bibStr !== '' && bibStr !== '0';

  const onShare = useCallback(async () => {
    if (!usable) return;
    const url = buildLiveLink(productAppId!, povId!, bibStr);
    const message = raceName
      ? t('readiness:share.message', { race: raceName, url })
      : t('readiness:share.messageNoRace', { url });
    try {
      // The URL is already in `message`; iOS would append `url` again (the
      // link showed twice in Messages/WhatsApp). Android ignores `url`.
      const res = await Share.share(Platform.OS === 'ios' ? { message } : { message, url });
      void analyticsService.logShareLiveLink(res.action === Share.sharedAction ? 'shared' : 'dismissed');
    } catch {
      void analyticsService.logShareLiveLink('error');
    }
  }, [usable, productAppId, povId, bibStr, raceName, t]);

  if (!usable) return null;

  return (
    <TouchableOpacity style={s.shareButton} onPress={onShare} accessibilityRole="button" activeOpacity={0.8}>
      <Ionicons name="share-social-outline" size={18} color={palette.navy} />
      <Text style={s.shareButtonText}>{t('readiness:share.button')}</Text>
    </TouchableOpacity>
  );
};
