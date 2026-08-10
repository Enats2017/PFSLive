import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import BackgroundGeolocation from 'react-native-background-geolocation';

import App from './App';

console.log('🚪 index.ts entry loaded');

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// ── Transistor headless task (Android) ──────────────────────────────────────
// Registered at the app ENTRY POINT, not in gpsService: after the Android app is
// killed the SDK runs this handler in a FRESH headless JS context where the React
// tree never mounts. Registration buried in an App.tsx import chain has proven
// unreliable, so it lives here.
//
// require(), not a top-level import: ES imports hoist, and this must run AFTER
// registerRootComponent — importing gpsService also fires its module-level
// side effects, including the cold-boot rehydrate.
//
// Paired with app.enableHeadless:true in the ready() config. Without that runtime
// flag the SDK never starts a headless context and this handler is never invoked.
const { headlessTask } = require('./src/services/gpsService');
BackgroundGeolocation.registerHeadlessTask(headlessTask);