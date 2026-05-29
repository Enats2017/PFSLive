const {
  withMainActivity,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ✅ 1. Patch MainActivity.kt to read GPX share/view intents
const withGpxMainActivity = (config) => {
  return withMainActivity(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes('import android.content.Intent')) {
      contents = contents.replace(
        'import android.os.Bundle',
        'import android.os.Bundle\nimport android.content.Intent'
      );
    }

    if (!contents.includes('handleGpxIntent(intent)')) {
      contents = contents.replace(
        'super.onCreate(null)',
        'super.onCreate(null)\n    handleGpxIntent(intent)'
      );
    }

    if (!contents.includes('fun onNewIntent')) {
      contents = contents.replace(
        'override fun getMainComponentName',
        `override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    handleGpxIntent(intent)
  }

  private fun resolveFileName(uri: android.net.Uri): String? {
    return try {
      val cursor = contentResolver.query(
        uri,
        arrayOf(android.provider.OpenableColumns.DISPLAY_NAME),
        null, null, null
      )
      cursor?.use {
        if (it.moveToFirst()) it.getString(
          it.getColumnIndexOrThrow(android.provider.OpenableColumns.DISPLAY_NAME)
        ) else null
      }
    } catch (e: Exception) {
      null
    }
  }

  private fun handleGpxIntent(intent: Intent) {
    val action = intent.action ?: return
    val type = intent.type ?: ""
    if (
      action == Intent.ACTION_SEND &&
      (type == "application/gpx+xml" || type == "text/xml" || type == "application/xml")
    ) {
      val uri = intent.getParcelableExtra<android.net.Uri>(Intent.EXTRA_STREAM)
      if (uri != null) {
        GpxShareHolder.uri = uri.toString()
        GpxShareHolder.fileName = resolveFileName(uri)
      }
    } else if (action == Intent.ACTION_VIEW) {
      val uri = intent.data
      if (uri != null && uri.toString().lowercase().endsWith(".gpx")) {
        GpxShareHolder.uri = uri.toString()
        GpxShareHolder.fileName = resolveFileName(uri)
      }
    }
  }

  override fun getMainComponentName`
      );
    }

    if (!contents.includes('object GpxShareHolder')) {
      contents = contents + '\nobject GpxShareHolder { var uri: String? = null; var fileName: String? = null }\n';
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

// ✅ 2. Write GpxShareModule.kt and GpxSharePackage.kt
const withGpxNativeFiles = (config) => {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      // ✅ Dynamic package path based on bundle ID
      const packageName = config.android?.package ?? 'eu.passionforsports.livio';
      const packagePath = packageName.replace(/\./g, '/');
      const dir = path.join(
        mod.modRequest.platformProjectRoot,
        `app/src/main/java/${packagePath}`
      );

      // ✅ Create directory if it doesn't exist
      fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(
        path.join(dir, 'GpxShareModule.kt'),
        `package ${packageName}

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableNativeMap

class GpxShareModule(ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

  override fun getName() = "GpxShare"

  @ReactMethod
  fun getIntent(promise: Promise) {
    val uri = GpxShareHolder.uri
    val fileName = GpxShareHolder.fileName
    GpxShareHolder.uri = null
    GpxShareHolder.fileName = null
    if (uri == null) {
      promise.resolve(null)
      return
    }
    val map = WritableNativeMap()
    map.putString("uri", uri)
    map.putString("fileName", fileName ?: "shared.gpx")
    promise.resolve(map)
  }
}
`
      );

      fs.writeFileSync(
        path.join(dir, 'GpxSharePackage.kt'),
        `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class GpxSharePackage : ReactPackage {
  override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
    listOf(GpxShareModule(ctx))

  override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`
      );

      return mod;
    },
  ]);
};

// ✅ 3. Register GpxSharePackage in MainApplication.kt
const withGpxMainApplication = (config) => {
  return withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;

    if (!contents.includes('GpxSharePackage')) {
      contents = contents.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n        add(GpxSharePackage())'
      );
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

module.exports = (config) => {
  config = withGpxMainActivity(config);
  config = withGpxNativeFiles(config);
  config = withGpxMainApplication(config);
  return config;
};