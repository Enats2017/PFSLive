const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

module.exports = function withFirebaseDisableSPM(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf-8');
      let prefix = '';
      if (!podfile.includes('$RNFirebaseDisableSPM')) {
        prefix += '$RNFirebaseDisableSPM = true\n';
      }
      if (!podfile.includes('$RNFirebaseAsStaticFramework')) {
        prefix += '$RNFirebaseAsStaticFramework = true\n';
      }
      if (prefix) fs.writeFileSync(podfilePath, prefix + podfile);
      return cfg;
    },
  ]);
};