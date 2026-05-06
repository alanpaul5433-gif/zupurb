import 'package:go_router/go_router.dart';

import 'screens/auth/splash_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/signup_screen.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/auth/otp_screen.dart';
import 'screens/auth/email_sent_screen.dart';
import 'screens/auth/phone_otp_screen.dart';
import 'screens/onboarding/onboarding_step1_screen.dart';
import 'screens/onboarding/onboarding_step2_screen.dart';
import 'screens/onboarding/onboarding_step3_screen.dart';
import 'screens/onboarding/onboarding_step4_screen.dart';
import 'screens/onboarding/onboarding_step5_screen.dart';
import 'screens/onboarding/onboarding_step6_screen.dart';
import 'screens/onboarding/onboarding_step7_screen.dart';
import 'screens/onboarding/onboarding_step8_screen.dart';
import 'screens/onboarding/onboarding_step9_screen.dart';
import 'screens/onboarding/onboarding_step10_screen.dart';
import 'screens/onboarding/profile_complete_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/search/search_screen.dart';
import 'screens/search/search_results_screen.dart';
import 'screens/discover/discover_screen.dart';
import 'screens/establishment/establishment_screen.dart';
import 'screens/review/verify_visit_screen.dart';
import 'screens/review/rate_experience_screen.dart';
import 'screens/review/creator_disclosure_screen.dart';
import 'screens/review/written_review_screen.dart';
import 'screens/review/review_submitted_screen.dart';
import 'screens/reservation/time_slot_screen.dart';
import 'screens/reservation/confirm_booking_screen.dart';
import 'screens/reservation/my_reservations_screen.dart';
import 'screens/reservation/reservation_pass_screen.dart';
import 'screens/reservation/zupurb_plus_screen.dart';
import 'screens/reservation/exclusive_benefits_screen.dart';
import 'screens/messages/messages_list_screen.dart';
import 'screens/messages/chat_screen.dart';
import 'screens/profile/own_profile_screen.dart';
import 'screens/profile/other_profile_screen.dart';
import 'screens/profile/notifications_screen.dart';
import 'screens/badges/badges_screen.dart';
import 'screens/points/points_wallet_screen.dart';
import 'screens/points/redeem_rewards_screen.dart';
import 'screens/settings/settings_screen.dart';
import 'screens/settings/privacy_settings_screen.dart';
import 'screens/home/add_place_screen.dart';
import 'widgets/main_shell.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/splash',
  routes: [
    GoRoute(
      path: '/splash',
      name: 'splash',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      name: 'login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/signup',
      name: 'signup',
      builder: (context, state) => const SignUpScreen(),
    ),
    GoRoute(
      path: '/forgot-password',
      name: 'forgot-password',
      builder: (context, state) => const ForgotPasswordScreen(),
    ),
    GoRoute(
      path: '/email-sent',
      name: 'email-sent',
      builder: (context, state) => const EmailSentScreen(),
    ),
    GoRoute(
      path: '/otp',
      name: 'otp',
      builder: (context, state) => const OtpScreen(),
    ),
    GoRoute(
      path: '/signup/phone-otp',
      name: 'phone-otp',
      builder: (context, state) => const PhoneOtpScreen(),
    ),
    GoRoute(
      path: '/onboarding/1',
      name: 'onboarding-1',
      builder: (context, state) => const OnboardingStep1Screen(),
    ),
    GoRoute(
      path: '/onboarding/2',
      name: 'onboarding-2',
      builder: (context, state) => const OnboardingStep2Screen(),
    ),
    GoRoute(
      path: '/onboarding/3',
      name: 'onboarding-3',
      builder: (context, state) => const OnboardingStep3Screen(),
    ),
    GoRoute(
      path: '/onboarding/4',
      name: 'onboarding-4',
      builder: (context, state) => const OnboardingStep4Screen(),
    ),
    GoRoute(
      path: '/onboarding/5',
      name: 'onboarding-5',
      builder: (context, state) => const OnboardingStep5Screen(),
    ),
    GoRoute(
      path: '/onboarding/6',
      name: 'onboarding-6',
      builder: (context, state) => const OnboardingStep6Screen(),
    ),
    GoRoute(
      path: '/onboarding/7',
      name: 'onboarding-7',
      builder: (context, state) => const OnboardingStep7Screen(),
    ),
    GoRoute(
      path: '/onboarding/8',
      name: 'onboarding-8',
      builder: (context, state) => const OnboardingStep8Screen(),
    ),
    GoRoute(
      path: '/onboarding/9',
      name: 'onboarding-9',
      builder: (context, state) => const OnboardingStep9Screen(),
    ),
    GoRoute(
      path: '/onboarding/10',
      name: 'onboarding-10',
      builder: (context, state) => const OnboardingStep10Screen(),
    ),
    GoRoute(
      path: '/onboarding/complete',
      name: 'onboarding-complete',
      builder: (context, state) => const ProfileCompleteScreen(),
    ),
    ShellRoute(
      builder: (context, state, child) => MainShell(child: child),
      routes: [
        GoRoute(
          path: '/home',
          name: 'home',
          builder: (context, state) => const HomeScreen(),
        ),
        GoRoute(
          path: '/search',
          name: 'search',
          builder: (context, state) => const SearchScreen(),
        ),
        GoRoute(
          path: '/search/results',
          name: 'search-results',
          builder: (context, state) => const SearchResultsScreen(),
        ),
        GoRoute(
          path: '/discover',
          name: 'discover',
          builder: (context, state) => const DiscoverScreen(),
        ),
        GoRoute(
          path: '/messages',
          name: 'messages',
          builder: (context, state) => const MessagesListScreen(),
        ),
        GoRoute(
          path: '/profile',
          name: 'profile',
          builder: (context, state) => const OwnProfileScreen(),
        ),
      ],
    ),
    GoRoute(
      path: '/establishment/:id',
      name: 'establishment',
      builder: (context, state) => const EstablishmentScreen(),
    ),
    GoRoute(
      path: '/review/verify',
      name: 'review-verify',
      builder: (context, state) => const VerifyVisitScreen(),
    ),
    GoRoute(
      path: '/review/rate',
      name: 'review-rate',
      builder: (context, state) => const RateExperienceScreen(),
    ),
    GoRoute(
      path: '/review/disclosure',
      name: 'review-disclosure',
      builder: (context, state) => const CreatorDisclosureScreen(),
    ),
    GoRoute(
      path: '/review/write',
      name: 'review-write',
      builder: (context, state) => const WrittenReviewScreen(),
    ),
    GoRoute(
      path: '/review/submitted',
      name: 'review-submitted',
      builder: (context, state) => const ReviewSubmittedScreen(),
    ),
    GoRoute(
      path: '/reservation/slots',
      name: 'reservation-slots',
      builder: (context, state) => const TimeSlotScreen(),
    ),
    GoRoute(
      path: '/reservation/confirm',
      name: 'reservation-confirm',
      builder: (context, state) => const ConfirmBookingScreen(),
    ),
    GoRoute(
      path: '/reservation/my',
      name: 'my-reservations',
      builder: (context, state) => const MyReservationsScreen(),
    ),
    GoRoute(
      path: '/reservation/pass',
      name: 'reservation-pass',
      builder: (context, state) => const ReservationPassScreen(),
    ),
    GoRoute(
      path: '/zupurb-plus',
      name: 'zupurb-plus',
      builder: (context, state) => const ZupurbPlusScreen(),
    ),
    GoRoute(
      path: '/exclusive-benefits',
      name: 'exclusive-benefits',
      builder: (context, state) => const ExclusiveBenefitsScreen(),
    ),
    GoRoute(
      path: '/chat/:id',
      name: 'chat',
      builder: (context, state) => const ChatScreen(),
    ),
    GoRoute(
      path: '/profile/:id',
      name: 'other-profile',
      builder: (context, state) => const OtherProfileScreen(),
    ),
    GoRoute(
      path: '/notifications',
      name: 'notifications',
      builder: (context, state) => const NotificationsScreen(),
    ),
    GoRoute(
      path: '/badges',
      name: 'badges',
      builder: (context, state) => const BadgesScreen(),
    ),
    GoRoute(
      path: '/points',
      name: 'points',
      builder: (context, state) => const PointsWalletScreen(),
    ),
    GoRoute(
      path: '/redeem',
      name: 'redeem',
      builder: (context, state) => const RedeemRewardsScreen(),
    ),
    GoRoute(
      path: '/settings',
      name: 'settings',
      builder: (context, state) => const SettingsScreen(),
    ),
    GoRoute(
      path: '/settings/privacy',
      name: 'privacy-settings',
      builder: (context, state) => const PrivacySettingsScreen(),
    ),
    GoRoute(
      path: '/add-place',
      name: 'add-place',
      builder: (context, state) => const AddPlaceScreen(),
    ),
  ],
);
