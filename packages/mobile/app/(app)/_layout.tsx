import { useSuspenseQuery } from "@tanstack/react-query";
import { Redirect, usePathname } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "../../src/auth/AuthContext";
import { AppDrawer } from "../../src/components/AppDrawer";
import { QueryBoundary } from "../../src/components/QueryBoundary";
import { trpc } from "../../src/trpc";
import { UserProvider } from "../../src/user/UserContext";
import { isWizardCompanionRoute } from "../../src/utils/onboardingGate";

// MUS-94: the (app) group is the post-login shell (drawer + tabs). Before we
// mount it, we must gate on onboarding progress:
//   - anonymous user             → /login
//   - loading (token verifying)  → splash
//   - authed, no role picked     → /onboarding/role-picker
//   - authed, role but no step-2 → /onboarding/{role}
//   - authed, step-2 complete    → mount drawer + tabs
//
// Onboarding progress is derived from server state (MUS-94 added
// `onboarding.getResumeStep` to the tRPC router), NOT a client-only flag, so
// the answer is consistent across devices and preserved across logouts.
//
// The server query runs under a <QueryBoundary> so the drawer can never
// render before the gate has resolved — this is the "no flash of home UI
// before the redirect fires" requirement. The boundary's Suspense fallback
// is a splash, so the cold-launch user sees spinner → redirect (to wizard)
// OR spinner → drawer (if complete), never spinner → drawer → redirect.
export default function AppLayout() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#6c63ff" />
      </View>
    );
  }

  if (status === "unauthenticated") {
    return <Redirect href="/login" />;
  }

  // Authed. Delegate to the gate which suspends on the resume-step query.
  return (
    <QueryBoundary
      loadingFallback={
        <View style={styles.splash}>
          <ActivityIndicator color="#6c63ff" />
        </View>
      }
    >
      <OnboardingGate />
    </QueryBoundary>
  );
}

/**
 * Reads the server's resume-step decision and either redirects into the
 * wizard or mounts the post-onboarding shell. Kept as a dedicated component
 * so the `useSuspenseQuery` call sits inside the <QueryBoundary> — calling it
 * at the layout's top level would suspend the layout itself without a
 * fallback.
 *
 * We explicitly avoid re-checking `user.roles.length === 0` here: the server
 * answer is authoritative and already encodes that case (empty roles →
 * `role-picker`). Trusting only the server means the MUS-95 path (add a role
 * from settings) doesn't have to special-case the client guard.
 *
 * One wrinkle: `/create-entity` is an (app)-segment screen that participates
 * in the wizard flow — musician/promoter step-2 push there to name a new
 * band or promoter group. If the gate redirects wizard-in-progress users
 * back to step-2 the moment they hit /create-entity, the create sub-flow
 * loops forever. `isWizardCompanionRoute` captures that exception so we
 * mount the shell anyway. The awaited `refetchQueries` in create-entity's
 * success handlers guarantees that by the time the user is routed on to
 * the entity profile, the resume step has flipped to 'complete' — so the
 * exception window only covers the in-flight create step itself.
 */
function OnboardingGate() {
  const pathname = usePathname();
  const { data: step } = useSuspenseQuery(
    trpc.onboarding.getResumeStep.queryOptions(),
  );

  // Pre-"complete" users are allowed onto create-entity as a wizard
  // continuation; `isWizardCompanionRoute` currently matches just that
  // route. Everything else in (app) is gated.
  const allowShell = step === "complete" || isWizardCompanionRoute(pathname);

  if (!allowShell) {
    if (step === "role-picker") {
      return <Redirect href="/onboarding/role-picker" />;
    }
    if (step === "musician") {
      return <Redirect href="/onboarding/musician" />;
    }
    // step === 'promoter'
    return <Redirect href="/onboarding/promoter" />;
  }

  return (
    <UserProvider>
      <Drawer
        drawerContent={(props) => <AppDrawer {...props} />}
        screenOptions={{
          headerShown: false,
          drawerPosition: "right",
          drawerType: "front",
          drawerStyle: { backgroundColor: "#0f0f11", width: 280 },
        }}
      >
        <Drawer.Screen name="(tabs)" options={{ headerShown: false }} />
      </Drawer>
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f11",
  },
});
