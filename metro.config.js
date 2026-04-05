// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.minifierConfig = {
  keep_classnames: false,
  keep_fnames: false,
  mangle: true,
  compress: {
    drop_console: true,
  },
};

module.exports = config;