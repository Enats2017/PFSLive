// Cases added 2026-10-18 (round 25): repo hygiene found while re-running every suite.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = ({ test }) => {
  const ROOT = path.resolve(__dirname, '../..');

  test('npm run test:activation build output (.cardtest/) is ignored by git', () => {
    // package.json compiles the activation card tests into .cardtest/ — left
    // unignored, every run showed it as a new folder to commit.
    const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts['test:activation'] || '';
    assert.ok(script.includes('--outDir .cardtest'), 'the script still writes to .cardtest');
    const out = execFileSync('git', ['check-ignore', '-v', '--no-index', '.cardtest/screens/x.js'], { cwd: ROOT, encoding: 'utf8' });
    assert.ok(/\.gitignore:\d+:\.cardtest\//.test(out), out);
  });
};
