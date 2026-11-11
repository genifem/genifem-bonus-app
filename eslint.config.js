// Expo's recommended rules, plus the generated native folders.
const expo = require("eslint-config-expo/flat");

module.exports = [
  ...expo,
  {
    ignores: ["dist/*", "dist-check/*", "android/*", "ios/*", ".expo/*", ".backend/*", "expo-env.d.ts"],
  },
];
