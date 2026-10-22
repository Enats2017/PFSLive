import { ModalProps } from 'react-native';

// iOS shows a <Modal> in portrait only unless it lists the orientations it may
// take (React Native's default is ['portrait']). The app itself rotates
// (app.config orientation "default"), so in landscape a modal could not be
// shown: tapping a filter on the Results screen did nothing (device test
// 2026-10-22). Every Modal in the app passes this; Android ignores the prop.
export const MODAL_ORIENTATIONS: ModalProps['supportedOrientations'] = [
  'portrait',
  'landscape',
  'landscape-left',
  'landscape-right',
];
