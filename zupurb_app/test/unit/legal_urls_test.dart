/// Unit tests for lib/core/config/legal_urls.dart
///
/// LegalUrls is a holder of static const URL strings with no logic, so these
/// tests pin the exact constant values (these URLs are surfaced to users and
/// referenced by store-listing/compliance flows) and assert they are
/// well-formed https links on the zupurb.app domain.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/core/config/legal_urls.dart';

void main() {
  group('LegalUrls constants', () {
    test('privacyPolicy has the expected value', () {
      expect(LegalUrls.privacyPolicy, 'https://zupurb.app/privacy');
    });

    test('termsOfService has the expected value', () {
      expect(LegalUrls.termsOfService, 'https://zupurb.app/terms');
    });

    test('both URLs are https on the zupurb.app host', () {
      for (final url in [LegalUrls.privacyPolicy, LegalUrls.termsOfService]) {
        final uri = Uri.parse(url);
        expect(uri.scheme, 'https', reason: '$url should be https');
        expect(uri.host, 'zupurb.app', reason: '$url should be on zupurb.app');
        expect(uri.path, isNotEmpty, reason: '$url should have a path');
      }
    });

    test('the two URLs are distinct', () {
      expect(LegalUrls.privacyPolicy, isNot(LegalUrls.termsOfService));
    });
  });
}
