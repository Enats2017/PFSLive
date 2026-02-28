import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import {
  PersonalEventFile,
  isValidGPXFile,
  isValidFileSize,
  formatFileSize,
} from '../services/personalEventService';
import { API_CONFIG } from '../constants/config';

export const useFileUpload = (
  maxFileSize: number,
  onError: (message: string) => void
) => {
  const { t } = useTranslation(['personal', 'common']);
  const [selectedFile, setSelectedFile] = useState<PersonalEventFile | null>(null);

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/gpx+xml', 'application/xml', 'text/xml'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      if (result.assets && result.assets[0]) {
        const file = result.assets[0];

        if (!isValidGPXFile(file.name)) {
          onError(t('personal:errors.invalidFileType'));
          return;
        }

        if (!isValidFileSize(file.size, maxFileSize)) {
          onError(
            t('personal:errors.fileTooLarge', {
              size: maxFileSize / (1024 * 1024),
            })
          );
          return;
        }

        setSelectedFile({
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
        });

        if (API_CONFIG.DEBUG) {
          console.log('✅ File selected:', {
            name: file.name,
            size: formatFileSize(file.size),
          });
        }
      }
    } catch (error: any) {
      if (API_CONFIG.DEBUG) {
        console.error('❌ File pick error:', error);
      }
      onError(t('personal:errors.filePickFailed'));
    }
  }, [maxFileSize, onError, t]);

  const viewFile = useCallback(() => {
    if (!selectedFile) return;

    Alert.alert(
      t('personal:file.infoTitle'),
      t('personal:file.infoMessage', {
        name: selectedFile.name,
        size: formatFileSize(selectedFile.size),
      }),
      [{ text: t('common:ok') }]
    );
  }, [selectedFile, t]);

  const removeFile = useCallback(() => {
    Alert.alert(
      t('personal:file.removeTitle'),
      t('personal:file.removeMessage'),
      [
        { text: t('common:cancel'), style: 'cancel' },
        {
          text: t('personal:file.removeButton'),
          style: 'destructive',
          onPress: () => {
            setSelectedFile(null);
            if (API_CONFIG.DEBUG) {
              console.log('🗑️ File removed');
            }
          },
        },
      ]
    );
  }, [t]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
  }, []);

  return {
    selectedFile,
    pickFile,
    viewFile,
    removeFile,
    clearFile,
  };
};