import {
  getAnalytics,
  setUserId,
  setUserProperty,
  logEvent,
} from "@react-native-firebase/analytics";
import { tokenService } from "./tokenService";

const analytics = getAnalytics();

export type UserRole = "follower" | "participant" | "both";

// Single place that decides the category from both flags
const computeCategory = (
  hasParticipated: boolean,
  hasUsedFollowerFeature: boolean,
): UserRole => {
  if (hasParticipated && hasUsedFollowerFeature) return "both";
  if (hasParticipated) return "participant";
  return "follower";
};

/**
 * Writes both user properties together so they can never drift apart.
 * - user_role      → follower | participant | both   (your existing 3-way split)
 * - has_followed   → yes | no                        (independent of user_role)
 *
 * has_followed exists because `follower` is the fallback branch of
 * computeCategory: a dormant install and an active follower who has never
 * raced both report as "follower". This second flag separates them.
 */
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

  /** Call on logout so the next user isn't attributed to the previous one. */
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

    // Recompute in case they already used a follower feature before this
    const hasUsedFollowerFeature =
      await tokenService.getHasUsedFollowerFeature();
    const role = await syncUserProperties(true, hasUsedFollowerFeature);

    console.log("📊 [Analytics] User upgraded to", role, "via:", sourceAction);

    await logEvent(analytics, "became_participant", {
      source_action: sourceAction,
    });
  },

  /**
   * Call when a user genuinely uses a follower feature
   * (follow a participant, ROUTE tap on a followed participant, view result).
   */
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

    // Always write both properties now — previously the non-participant
    // branch wrote nothing, so has_followed would have stayed "no".
    const role = await syncUserProperties(hasParticipated, true);

    if (hasParticipated) {
      console.log("📊 [Analytics] User upgraded to BOTH via:", sourceAction);
      await logEvent(analytics, "became_both", {
        source_action: sourceAction,
      });
    } else {
      console.log(
        "📊 [Analytics] Follower flag set (role stays follower) via:",
        sourceAction,
      );
    }

    // Fires in both branches, so you can measure first-follow conversion
    // independently of whether the user had already raced.
    await logEvent(analytics, "became_follower_active", {
      source_action: sourceAction,
      role_at_time: role,
    });
  },

  /**
   * Fixed event name + parameters, instead of a dynamic
   * `${screenName}_${buttonName}_${action}` name.
   *
   * Why: GA4 allows a maximum of 500 distinct event names per property, and
   * once that ceiling is hit new names are dropped permanently. Event names
   * are also capped at 40 characters — longer ones are silently rejected.
   * A screen like "LiveTrackingSettings" plus a long button name would exceed
   * that. One name with three parameters avoids both problems and is easier
   * to query.
   */
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
};