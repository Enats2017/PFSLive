// app.config.js
export default ({ config }) => ({
	...config,
	name: "PFSLive",
	slug: "pfslive",
	version: "1.0.0",
	orientation: "portrait",
	// icon: "./assets/icon.png",
	userInterfaceStyle: "light",
	// splash: {
	// 	image: "./assets/splash.png",
	// 	resizeMode: "contain",
	// 	backgroundColor: "#ffffff"
	// },
	assetBundlePatterns: [
		"**/*"
	],
	ios: {
		supportsTablet: true,
		bundleIdentifier: "com.yourcompany.pfslive"
	},
	android: {
		// adaptiveIcon: {
		// 	foregroundImage: "./assets/adaptive-icon.png",
		// 	backgroundColor: "#ffffff"
		// },
		package: "com.yourcompany.pfslive"
	},
	web: {
		// favicon: "./assets/favicon.png"
	},
	plugins: [
		"expo-asset",
		[
			"@rnmapbox/maps",
			{
				RNMapboxMapsDownloadToken: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN
			}
		]
	]
});