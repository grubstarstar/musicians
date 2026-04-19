import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { Suspense, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ErrorBoundary } from "react-error-boundary";

interface QueryBoundaryProps {
  children: ReactNode;
  /** Shown when the underlying query throws a tRPC NOT_FOUND error. */
  notFoundFallback?: ReactNode;
  /** Shown while the query is pending. Defaults to a centered spinner. */
  loadingFallback?: ReactNode;
}

export function QueryBoundary({
  children,
  notFoundFallback,
  loadingFallback = <DefaultLoading />,
}: QueryBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => {
            if (notFoundFallback && isTRPCNotFound(error)) {
              return <>{notFoundFallback}</>;
            }
            const err =
              error instanceof Error ? error : new Error(String(error));
            return <DefaultError error={err} onRetry={resetErrorBoundary} />;
          }}
        >
          <Suspense fallback={loadingFallback}>{children}</Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

function isTRPCNotFound(error: unknown): boolean {
  return (
    error instanceof TRPCClientError &&
    (error.data as { code?: string } | undefined)?.code === "NOT_FOUND"
  );
}

function DefaultLoading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color="#6c63ff" />
    </View>
  );
}

function DefaultError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.detail}>{error.message}</Text>
      <Pressable onPress={onRetry} style={styles.retry}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f11",
    padding: 20,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "600", marginBottom: 8 },
  detail: {
    color: "#7a7a85",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  retry: {
    backgroundColor: "#6c63ff",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
