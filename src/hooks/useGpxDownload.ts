import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Distance } from '../services/eventDetailService';

const { StorageAccessFramework } = FileSystem;

/**
 * Whether the GPX button should be offered for this distance.
 *
 * ONE rule for both distance tabs — the participant one
 * (screens/EventDetails/DistanceTab.tsx) and the follower one
 * (screens/FollowerDetailsList/DistanceTab.tsx). They had the same intent
 * written twice and were free to drift; this is the single copy. It mirrors
 * livio_web's DistanceCard (isLiveOrUpcoming && !raceIsOver && !!gpx_url).
 *
 *   • countdown.status — the distance's OWN state, computed by the API, so it
 *     is timezone-correct and handles a multi-day event, where race_date is
 *     day 1 only and the earlier days are already over while the event as a
 *     whole is still live. A finished route is no longer useful and the web
 *     app hides it at the same point.
 *   • sourceTab — the TAB the user came from. An event stays in the live tab
 *     while any distance is still to run, so the tab alone is not enough;
 *     equally, coming from the past tab should never offer a route.
 *   • gpx_url — whether a route file actually exists. The API sends null when
 *     gpx_path is empty, so availability is known from the payload; without
 *     this the button renders for distances whose only possible outcome is the
 *     "no file" alert.
 *
 * NOT gated on rr_url. That is the Race Result *results* feed, a different
 * fact from whether a route file exists. The old gate assumed "no rr_url =>
 * no route file", which is false — livio_web hit this with Trail Festival du
 * Barrage: empty rr_url, a GPX on all 7 distances, every one refused.
 *
 * The participant tab has no past/live context (EventDetails renders it
 * without a sourceTab), so it omits the argument and only the other two
 * checks apply.
 */
export const canShowGpxButton = (
  item: Distance,
  sourceTab?: 'past' | 'live' | 'upcoming',
): boolean =>
  sourceTab !== 'past' &&
  item.countdown.status !== 'finished' &&
  !!item.gpx_url;

const useGpxDownload = () => {
  const { t } = useTranslation(['details']);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const downloadGpx = async (item: Distance) => {
    if (!item.gpx_url) return Alert.alert(
      t('details:gpxDownload.noFileTitle'),
      t('details:gpxDownload.noFileMessage')
    );

    setDownloadingId(item.product_option_value_app_id);
    const fileName = `${item.distance_name}.gpx`;

    try {
      const tempUri = FileSystem.cacheDirectory + fileName;
      const { status, uri: downloadedUri } = await FileSystem.downloadAsync(item.gpx_url, tempUri);
      if (status !== 200) throw new Error('Download failed');

      if (Platform.OS === 'android') {
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          await Sharing.shareAsync(downloadedUri, { mimeType: 'application/gpx+xml' });
          return;
        }

        const fileContent = await FileSystem.readAsStringAsync(downloadedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const newFileUri = await StorageAccessFramework.createFileAsync(
          permissions.directoryUri,
          fileName,
          'application/gpx+xml'
        );

        await FileSystem.writeAsStringAsync(newFileUri, fileContent, {
          encoding: FileSystem.EncodingType.Base64,
        });

        Alert.alert(
          t('details:gpxDownload.successTitle'),
          `${fileName} ${t('gpxDownload.successMessage')}`
        );
      } else {
        await Sharing.shareAsync(downloadedUri, { mimeType: 'application/gpx+xml' });
      }
    } catch (err) {
      console.log(err);
      Alert.alert(t('details:error.title'), t('details:gpxDownload.errorMessage'));
    } finally {
      setDownloadingId(null);
    }
  };

  return { downloadGpx, downloadingId };
};

export default useGpxDownload;