import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { runAppleRecovery } from "../services/appleIapRecovery";

/**
 * ✅ App-level Apple purchase recovery (payments audit 2026-11-26 #7).
 * Mount ONCE, high in the tree (AppNavigator), with the login state. Runs the
 * background pass when the user is logged in - right away on login/launch,
 * then on each return to the foreground (throttled to one run per 10 min in
 * runAppleRecovery). A paid activation or subscription whose verify never
 * landed is credited without the user having to find the plans screen again.
 * iOS only; does nothing for logged-out users (verify needs the bearer token).
 */
export function useAppleRecovery(isLoggedIn: boolean | null): void {
  useEffect(() => {
    if (Platform.OS !== "ios" || isLoggedIn !== true) return;
    void runAppleRecovery(true);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void runAppleRecovery();
    });
    return () => sub.remove();
  }, [isLoggedIn]);
}
