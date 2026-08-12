const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

module.exports = function withFirebaseDisableSPM(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf-8');
      if (!podfile.includes('$RNFirebaseDisableSPM = true')) {
        podfile =
          '$RNFirebaseDisableSPM = true\n' +
          '$RNFirebaseAsStaticFramework = true\n' +
          podfile;
        fs.writeFileSync(podfilePath, podfile);
      }
      return cfg;
    },
  ]);
};