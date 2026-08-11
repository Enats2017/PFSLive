import {
  getAnalytics,
  setUserId,
  setUserProperty,
  logEvent,
} from "@react-native-firebase/analytics";
import { tokenService } from "./tokenService";

const analytics = getAnalytics();

export type UserRole = "follower" | "participant" | "both";

// ✅ NEW — single place that decides the category from both flags
const computeCategory = (
  hasParticipated: boolean,
  hasUsedFollowerFeature: boolean,
): UserRole => {
  if (hasParticipated && hasUsedFollowerFeature) return "both";
  if (hasParticipated) return "participant";
  return "follower";
};

export const analyticsService = {
  async initRole(): Promise<UserRole> {
    const hasParticipated = await tokenService.getHasParticipated();
    const hasUsedFollowerFeature =
      await tokenService.getHasUsedFollowerFeature(); // ✅ added
    const role = computeCategory(hasParticipated, hasUsedFollowerFeature); // ✅ changed
    await setUserProperty(analytics, "user_role", role);
    console.log("📊 [Analytics] initRole → user_role set to:", role);
    return role;
  },

  async setUserIdentity(userId: string) {
    await setUserId(analytics, userId);
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

    // ✅ added — recompute in case they already used a follower feature before this
    const hasUsedFollowerFeature =
      await tokenService.getHasUsedFollowerFeature();
    const role = computeCategory(true, hasUsedFollowerFeature);
    await setUserProperty(analytics, "user_role", role);

    console.log(
      "📊 [Analytics] User upgraded to",
      role,
      "via:", // ✅ changed to show real role (could be "both")
      sourceAction,
    );

    await logEvent(analytics, "became_participant", {
      source_action: sourceAction,
    });
  },

  // ✅ NEW — call when a user genuinely uses a follower feature
  // (ROUTE tap on a followed participant, or viewing their result)
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
    const role = computeCategory(hasParticipated, true);

    if (hasParticipated) {
      await setUserProperty(analytics, "user_role", role);
      console.log("📊 [Analytics] User upgraded to BOTH via:", sourceAction);

      await logEvent(analytics, "became_both", {
        source_action: sourceAction,
      });
    } else {
      console.log(
        "📊 [Analytics] Follower flag set (still follower) via:",
        sourceAction,
      );
    }
  },
};
