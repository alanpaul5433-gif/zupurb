// PLACEHOLDER — regenerate with: flutterfire configure
// Run after Firebase project is provisioned in deployment milestone D1.
// Command: flutterfire configure --project=<real-project-id>
// This file will be overwritten by flutterfire; do not hand-edit after that point.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (defaultTargetPlatform == TargetPlatform.android) {
      return android;
    } else if (defaultTargetPlatform == TargetPlatform.iOS) {
      return ios;
    }
    throw UnsupportedError(
      'DefaultFirebaseOptions are not supported for this platform. '
      'Re-run flutterfire configure after adding web/desktop support.',
    );
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'placeholder_api_key',
    appId: '1:000000000000:android:0000000000000000',
    messagingSenderId: '000000000000',
    projectId: 'zupurb-app-placeholder',
    storageBucket: 'zupurb-app-placeholder.appspot.com',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'placeholder_api_key',
    appId: '1:000000000000:ios:0000000000000000',
    messagingSenderId: '000000000000',
    projectId: 'zupurb-app-placeholder',
    storageBucket: 'zupurb-app-placeholder.appspot.com',
    iosBundleId: 'com.zupurb.zupurbApp',
  );
}
