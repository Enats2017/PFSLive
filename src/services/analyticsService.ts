import {
  getAnalytics,
  setUserId,
  setUserProperty,
  logEvent,
} from "@react-native-firebase/analytics";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { tokenService } from "./tokenService";

const analytics = getAnalytics();

// Own key — analyticsService records its own tracking start time so duration
// doesn't depend on internals of gpsService/HomeScreen.
const TRACKING_STARTED_AT_KEY = "@PFSLive:analyticsTrackingStartedAt";

export type UserRole = "follower" | "participant" | "both";
export type LocationPermission = "always" | "when_in_use" | "denied";
// `grace` is a distinct billing-retry state in the entitlement payload, not a
// synonym for active or expired — folding it into either would hide the
// population whose payment is failing but who still have access.
export type SubscriptionState = "free" | "active" | "grace" | "expired";

const computeCategory = (
  hasParticipated: boolean,
  hasUsedFollowerFeature: boolean,
): UserRole => {
  if (hasParticipated && hasUsedFollowerFeature) return "both";
  if (hasParticipated) return "participant";
  return "follower";
};

const syncUserProperties = async (
  hasParticipated: boolean,
  hasUsedFollowerFeature: boolean,
): Promise<UserRole> => {
  const role = computeCategory(hasParticipated, hasUsedFollowerFeature);
  await setUserProperty(analytics, "user_role", role);
  await setUserProperty(
    analytics,
    "has_followed",
    hasUsedFollowerFeature ? "yes" : "no",
  );
  return role;
};

export const analyticsService = {
  // ─────────────────────────────────────────────────────────────
  // EXISTING — unchanged
  // ─────────────────────────────────────────────────────────────

  async initRole(): Promise<UserRole> {
    const hasParticipated = await tokenService.getHasParticipated();
    const hasUsedFollowerFeature =
      await tokenService.getHasUsedFollowerFeature();

    const role = await syncUserProperties(
      hasParticipated,
      hasUsedFollowerFeature,
    );

    console.log(
      "📊 [Analytics] initRole → user_role:",
      role,
      "| has_followed:",
      hasUsedFollowerFeature ? "yes" : "no",
    );
    return role;
  },

  async setUserIdentity(userId: string) {
    await setUserId(analytics, userId);
  },

  async clearUserIdentity() {
    await setUserId(analytics, null);
  },

  async markAsParticipant(
    sourceAction: "register" | "create_event" | "start_tracking",
  ) {
    const alreadyParticipant = await tokenService.getHasParticipated();
    if (alreadyParticipant) {
      console.log(
        "📊 [Analytics] markAsParticipant skipped — already participant",
      );
      return;
    }

    await tokenService.setHasParticipated();

    const hasUsedFollowerFeature =
      await tokenService.getHasUsedFollowerFeature();
    const role = await syncUserProperties(true, hasUsedFollowerFeature);

    console.log("📊 [Analytics] User upgraded to", role, "via:", sourceAction);

    await logEvent(analytics, "became_participant", {
      source_action: sourceAction,
    });
  },

  async markAsFollowerActive(
    sourceAction: "view_live_route" | "view_result" | "follow_participant",
  ) {
    const alreadyMarked = await tokenService.getHasUsedFollowerFeature();
    if (alreadyMarked) {
      console.log(
        "📊 [Analytics] markAsFollowerActive skipped — already marked",
      );
      return;
    }

    await tokenService.setHasUsedFollowerFeature();

    const hasParticipated = await tokenService.getHasParticipated();
    const role = await syncUserProperties(hasParticipated, true);

    if (hasParticipated) {
      console.log("📊 [Analytics] User upgraded to BOTH via:", sourceAction);
      await logEvent(analytics, "became_both", { source_action: sourceAction });
    } else {
      console.log(
        "📊 [Analytics] Follower flag set (role stays follower) via:",
        sourceAction,
      );
    }

    await logEvent(analytics, "became_follower_active", {
      source_action: sourceAction,
      role_at_time: role,
    });
  },

  async logInteraction(
    screenName: string,
    buttonName: string,
    action: string = "tap",
    extraParams?: Record<string, string | number | boolean>,
  ) {
    await logEvent(analytics, "ui_interaction", {
      ui_screen: screenName,
      ui_button: buttonName,
      ui_action: action,
      ...(extraParams ?? {}),
    });

    console.log(
      "📊 [Analytics] ui_interaction:",
      screenName,
      buttonName,
      action,
      extraParams ?? "",
    );
  },

  // ─────────────────────────────────────────────────────────────
  // TIER 2 — permissions
  // ─────────────────────────────────────────────────────────────

  /**
   * Records the CURRENT permission state as user properties. Read-only — it
   * never prompts, so it's safe to call on every app start and on every
   * foreground.
   *
   * Why this matters more than anything else here: Livio's whole value
   * proposition is background tracking, and right now nothing tells you what
   * share of users actually granted "Always". When someone's track is patchy,
   * this is what distinguishes a bug from a permissions problem.
   *
   * Also emits `permission_state` on change only, so you can see grants and
   * revocations over time without an event on every launch.
   */
  async syncPermissionProperties(): Promise<{
    location: LocationPermission;
    notifications: boolean;
  }> {
    let location: LocationPermission = "denied";
    let notifications = false;

    try {
      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status === "granted") {
        const bg = await Location.getBackgroundPermissionsAsync();
        location = bg.status === "granted" ? "always" : "when_in_use";
      }
    } catch {
      /* leave as denied */
    }

    try {
      const notif = await Notifications.getPermissionsAsync();
      notifications = notif.status === "granted";
    } catch {
      /* leave as false */
    }

    await setUserProperty(analytics, "location_permission", location);
    await setUserProperty(
      analytics,
      "notifications_enabled",
      notifications ? "yes" : "no",
    );

    // Emit an event only when something actually changed.
    try {
      const signature = `${location}|${notifications ? "y" : "n"}`;
      const previous = await AsyncStorage.getItem("@PFSLive:permSignature");
      if (previous !== null && previous !== signature) {
        await logEvent(analytics, "permission_state", {
          location_permission: location,
          notifications_enabled: notifications ? "yes" : "no",
        });
      }
      await AsyncStorage.setItem("@PFSLive:permSignature", signature);
    } catch {
      /* silent */
    }

    console.log(
      "📊 [Analytics] permissions → location:",
      location,
      "| notifications:",
      notifications ? "yes" : "no",
    );

    return { location, notifications };
  },

  // ─────────────────────────────────────────────────────────────
  // TIER 2 — tracking lifecycle
  // ─────────────────────────────────────────────────────────────

  /**
   * Call right after GPS tracking successfully starts.
   * Stores its own start timestamp so duration works without reaching into
   * gpsService state.
   */
  async logTrackingStarted(params?: {
    // null accepted: HomeScreen's eventId is `string | null` before a race is
    // selected. The `?? ""` below already normalises it.
    eventId?: string | number | null;
    manualStart?: boolean;
    intervalSeconds?: number;
  }) {
    try {
      await AsyncStorage.setItem(TRACKING_STARTED_AT_KEY, String(Date.now()));
    } catch {
      /* silent */
    }

    await logEvent(analytics, "tracking_started", {
      event_id: String(params?.eventId ?? ""),
      manual_start: params?.manualStart ? "yes" : "no",
      interval_seconds: params?.intervalSeconds ?? 0,
    });

    console.log("📊 [Analytics] tracking_started", params ?? "");
  },

  /**
   * Call when tracking stops, for ANY reason. `endReason` is what makes this
   * useful — the ratio of `finish_crossed` to `manual_stop` is your completion
   * rate, and a high `manual_stop` share mid-race is the strongest signal you
   * have that something is going wrong during real events.
   */
  async logTrackingCompleted(params: {
    endReason: "finish_crossed" | "manual_stop" | "auto_stop" | "error";
    distanceKm?: number;
    pointsSent?: number;
    queuedRemaining?: number;
  }) {
    // Self-guarding against double-fire. Two independent paths end a session:
    // HomeScreen's stopGPSTracking, and gpsService's finishBackgroundStop —
    // and on a background finish BOTH can run. The start timestamp is the
    // token: whichever path gets here first consumes it and logs; the second
    // finds nothing and returns without logging. No coordination needed
    // between the two call sites.
    let startedAt: string | null = null;
    try {
      startedAt = await AsyncStorage.getItem(TRACKING_STARTED_AT_KEY);
      if (startedAt) await AsyncStorage.removeItem(TRACKING_STARTED_AT_KEY);
    } catch {
      /* silent */
    }

    if (!startedAt) {
      console.log(
        "📊 [Analytics] tracking_completed skipped — already logged for this session",
      );
      return;
    }

    const durationSeconds = Math.round((Date.now() - Number(startedAt)) / 1000);

    await logEvent(analytics, "tracking_completed", {
      end_reason: params.endReason,
      duration_seconds: durationSeconds,
      distance_km: Math.round(params.distanceKm ?? 0),
      points_sent: params.pointsSent ?? 0,
      queued_remaining: params.queuedRemaining ?? 0,
    });

    console.log(
      "📊 [Analytics] tracking_completed",
      params.endReason,
      `${durationSeconds}s`,
    );
  },

  // ─────────────────────────────────────────────────────────────
  // TIER 2 — subscription
  // ─────────────────────────────────────────────────────────────

  /**
   * Call after ANY entitlement check resolves — not only after a purchase.
   * Called only on purchase, lapsed users stay marked `active` forever.
   *
   * `source` (web / apple / google) is worth carrying: a web membership and an
   * in-app purchase are different revenue paths and different support paths,
   * and the value set is small enough to register as a dimension safely.
   */
  // `source` is `string | null` on the entitlement payload; the truthiness
  // guard below already handles null, so accept it rather than forcing every
  // caller to coerce.
  async setSubscriptionState(state: SubscriptionState, source?: string | null) {
    await setUserProperty(analytics, "subscription_state", state);
    if (source) {
      await setUserProperty(analytics, "subscription_source", source);
    }
    console.log("📊 [Analytics] subscription_state →", state, source ?? "");
  },

  /** Call when a purchase completes successfully. */
  async logSubscriptionPurchased(productId: string) {
    await logEvent(analytics, "subscription_purchased", {
      product_id: productId,
    });
    await setUserProperty(analytics, "subscription_state", "active");
  },

  /**
   * Ongoing follow/unfollow counter.
   *
   * markAsFollowerActive fires only on the FIRST follow ever — it is a role
   * classifier, not a counter — so "how many follows happen per week" is
   * unanswerable and unfollows are completely invisible without this.
   *
   * MUST exist on BOTH app and web. They share one GA4 property, so if only
   * the web sends follow_toggle the report shows web-only volume and reads as
   * though the web drives nearly all follows, which is worse than having no
   * number at all. Signature matches lib/analytics.ts on the web.
   */
  async logFollowToggle(
    action: "follow" | "unfollow",
    context: string,
    extraParams?: Record<string, string | number | boolean>,
  ) {
    await logEvent(analytics, "follow_toggle", {
      follow_action: action,
      ui_screen: context,
      ...(extraParams ?? {}),
    });
    console.log("📊 [Analytics] follow_toggle:", action, context);
  },

  // ─────────────────────────────────────────────────────────────
  // TIER 3 — feature usage
  // ─────────────────────────────────────────────────────────────

  /**
   * GPX arrived via the share/view intent or one of the two document pickers.
   *
   * create vs edit are separate values because they are different behaviours:
   * attaching a route to a NEW event, versus replacing the route on an
   * existing one. Collapsing them into one `file_picker` value would hide
   * which of the two people actually do.
   */
  async logGpxImported(
    source:
      | "share_intent"        // iOS file:// deep link or Android GpxShare intent
      | "file_picker_create"  // useFileUpload — CreatePersonalEvent
      | "file_picker_edit"    // useEditFileUpload — EditPersonalEvent
      | "url",
  ) {
    await logEvent(analytics, "gpx_imported", { gpx_source: source });
  },

  /** Someone actually ran a search. Pass result count, not the query text. */
  async logSearchPerformed(
    searchType:
      | "participant"   // participant lists inside an event
      | "event"         // race/event name search
      | "athlete"       // global athlete search
      | "favourite"     // searching your own favourites
      | "follower",     // searching your own followers
    resultCount: number,
  ) {
    await logEvent(analytics, "search_performed", {
      search_type: searchType,
      result_count: resultCount,
    });
  },

  // ─────────────────────────────────────────────────────────────
  // AUTH — login / sign-up funnel
  // ─────────────────────────────────────────────────────────────

  /**
   * `login` and `sign_up` are GA4 RECOMMENDED event names — using these exact
   * strings gets them built-in report support rather than treating them as
   * arbitrary custom events. `method` is the standard parameter name.
   *
   * Never pass the email address, or any other identifier, as a parameter.
   */
  async logLogin(method: "password" | "otp") {
    await logEvent(analytics, "login", { method });
  },

  async logSignUp(method: "email" = "email") {
    await logEvent(analytics, "sign_up", { method });
  },

  /**
   * One event for the whole auth funnel, with the stage as a parameter — the
   * same reasoning as ui_interaction. A dozen separate event names would each
   * burn a slot against GA4's 500-name cap and could not be compared in a
   * single report; one name with a low-cardinality `auth_step` gives you the
   * drop-off between any two stages directly.
   *
   * The stages that matter most here are otp_sent -> otp_verified: registration
   * is compulsory to enter a race, so anyone lost at OTP is a lost entrant.
   */
  async logAuthStep(
    step:
      | "register_submitted"   // register API accepted, OTP sent
      | "otp_verified"         // OTP accepted, token issued
      | "otp_failed"           // wrong / expired / too many attempts
      | "otp_resent"
      | "reset_requested"      // forgot-password email submitted
      | "reset_otp_verified"
      | "reset_completed",
    reason?: string,
  ) {
    await logEvent(analytics, "auth_step", {
      auth_step: step,
      // Server error CODE only (e.g. 'otp_expired') — never a message, never
      // anything the user typed.
      auth_reason: reason ?? "",
    });
  },

  // ─────────────────────────────────────────────────────────────
  // EVENT REGISTRATION funnel + language
  // ─────────────────────────────────────────────────────────────

  /**
   * The race-registration funnel. `markAsParticipant('register')` already fires
   * on success, but it is a role classifier — it tells you nothing about who
   * started and dropped out. Registration is the core conversion of the app, so
   * the stages before success are the ones worth measuring.
   *
   * One event name with a stage parameter, same reasoning as auth_step.
   */
  async logRegisterStep(
    step:
      | "started"           // user tapped register on a distance
      | "login_required"    // no token — bounced to login, registration pending
      | "confirm_shown"     // backend asked for confirmation before registering
      | "completed"         // registered
      | "failed",
    reason?: string,
  ) {
    await logEvent(analytics, "register_step", {
      register_step: step,
      // Server error CODE only — never a message, never user input.
      register_reason: reason ?? "",
    });
  },

  /**
   * Personal-event creation funnel. Same gap register_step closed for race
   * registration: markAsParticipant('create_event') only fires on success, so
   * without this you cannot see who started and was blocked — and the most
   * common blocks here (`membership_required`, `limit_reached`) are commercial
   * signals, not errors.
   */
  async logCreateEventStep(
    step: "started" | "blocked" | "completed" | "failed",
    reason?: string,
  ) {
    await logEvent(analytics, "create_event_step", {
      create_event_step: step,
      // Server action/error CODE only — never a message, never the event name
      // the user typed.
      create_event_reason: reason ?? "",
    });
  },

  /**
   * Restore-purchases outcome. "restore returns nothing" is a common paid-app
   * support complaint and is currently invisible — this makes the ratio of
   * `none` to `success` visible without anyone having to file a ticket.
   */
  async logRestorePurchases(outcome: "success" | "none" | "error") {
    await logEvent(analytics, "restore_purchases", {
      restore_outcome: outcome,
    });
  },

  /**
   * App language as a user property. EN/NL/FR for a Belgian audience, so this
   * lets every other report be split by language — which of the three actually
   * converts, searches, races.
   */
  async setLanguage(languageCode: string) {
    await setUserProperty(analytics, "app_language", languageCode);
    console.log("📊 [Analytics] app_language →", languageCode);
  },

  /** App was opened by tapping a push notification. */
  async logNotificationOpened(notificationType?: string) {
    await logEvent(analytics, "notification_opened", {
      notification_type: notificationType ?? "unknown",
    });
  },
};