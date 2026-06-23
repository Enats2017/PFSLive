import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Distance } from '../services/eventDetailService';

const { StorageAccessFramework } = FileSystem;

const useGpxDownload = () => {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const downloadGpx = async (item: Distance) => {
    if (!item.gpx_url) return Alert.alert('Error', 'No GPX file available.');

    setDownloadingId(item.product_option_value_app_id);
    const fileName = `${item.distance_name}.gpx`;

    try {
      // Download to a temp/cache location first
      const tempUri = FileSystem.cacheDirectory + fileName;
      const { status, uri: downloadedUri } = await FileSystem.downloadAsync(item.gpx_url, tempUri);
      if (status !== 200) throw new Error('Download failed');

      if (Platform.OS === 'android') {
        // Ask user to pick a folder (e.g. Downloads), then write the file there directly
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          // fallback to share sheet if they deny folder access
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

        Alert.alert('Downloaded', `${fileName} saved successfully.`);
      } else {
        // iOS: share sheet is the standard "download" flow (Save to Files)
        await Sharing.shareAsync(downloadedUri, { mimeType: 'application/gpx+xml' });
      }
    } catch (err) {
      console.log(err);
      Alert.alert('Error', 'Could not download GPX file.');
    } finally {
      setDownloadingId(null);
    }
  };

  return { downloadGpx, downloadingId };
};

export default useGpxDownload;