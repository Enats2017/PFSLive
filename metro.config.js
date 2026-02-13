// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure .gpx files are treated as assets and bundled
config.resolver.assetExts.push('gpx');

module.exports = config;