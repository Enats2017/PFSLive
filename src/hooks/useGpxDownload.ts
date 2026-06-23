import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Distance } from '../services/eventDetailService';

const { StorageAccessFramework } = FileSystem;

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
      Alert.alert(t('details:error.title'), t('detailsgpxDownload.errorMessage'));
    } finally {
      setDownloadingId(null);
    }
  };

  return { downloadGpx, downloadingId };
};

export default useGpxDownload;