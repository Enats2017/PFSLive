import { useCallback, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { SelectedFile, formatFileSize } from "../services/editPersonalEventService";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";

export interface ExistingFile {
  path: string;
  name: string;
  removed: boolean;
}

interface UseEditFileUploadOptions {
  maxFileSize: number;
  onFileError: (msg: string) => void;
}

const getFileName = (path: string): string => {
  if (!path) return "";
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
};

export const useEditFileUpload = ({
  maxFileSize,
  onFileError,
}: UseEditFileUploadOptions) => {
  const { t } = useTranslation(["personal", "common"]);

  const [existingFile, setExistingFile] = useState<ExistingFile | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  const initExistingFile = useCallback((gpxPath: string) => {
    if (!gpxPath) return;

    setExistingFile({
      path: gpxPath,
      name: getFileName(gpxPath),
      removed: false,
    });
  }, []);

  const pickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/gpx+xml", "application/xml", "text/xml", "*/*"],
        copyToCacheDirectory: true,
      });

      console.log("📂 DocumentPicker raw result:", result);

      if (result.canceled || !result.assets?.length) return;

      const { uri, name, size, mimeType } = result.assets[0];

      // ── File size validation ──
      if (size && size > maxFileSize) {
        onFileError(
          t("personal:errors.fileTooLarge", {
            size: maxFileSize / (1024 * 1024),
          }),
        );
        return;
      }

      // ── Basic extension validation (extra safety) ──
      if (!name.toLowerCase().endsWith(".gpx")) {
        onFileError(t("personal:errors.invalidFileType"));
        return;
      }

      setSelectedFile({
        uri,
        name,
        size: size ?? 0,
        mimeType: mimeType ?? "application/gpx+xml",
      });

    } catch {
      onFileError("Could not open file picker");
    }
  }, [maxFileSize, onFileError, t]);

  const viewNewFile = useCallback(() => {
    if (!selectedFile) return;

    Alert.alert(
      t("personal:file.infoTitle"),
      t("personal:file.infoMessage", {
        name: selectedFile.name,
        size: formatFileSize(selectedFile.size),
      }),
      [{ text: t("common:ok") }],
    );
  }, [selectedFile, t]);

  const discardNewFile = useCallback(() => {
    setSelectedFile((prev) => (prev ? null : prev));
  }, []);

  // ─── Existing file actions 
  const removeExistingFile = useCallback(() => {
    setExistingFile((prev) => {
      if (!prev || prev.removed) return prev;
      return { ...prev, removed: true };
    });
  }, []);

  const undoRemoveExistingFile = useCallback(() => {
    setExistingFile((prev) => {
      if (!prev || !prev.removed) return prev;
      return { ...prev, removed: false };
    });
  }, []);

  // ─── Derived flag for API 
  const shouldRemoveGpx =
    existingFile?.removed === true && !selectedFile;

  return {
    existingFile,
    selectedFile,
    shouldRemoveGpx,
    initExistingFile,
    pickFile,
    viewNewFile,
    discardNewFile,
    removeExistingFile,
    undoRemoveExistingFile,
  };
};