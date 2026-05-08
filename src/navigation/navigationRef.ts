import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';

// ✅ Shared navigation ref — allows navigation from outside React components (e.g. App.tsx Linking handler)
export const navigationRef = createNavigationContainerRef<RootStackParamList>();