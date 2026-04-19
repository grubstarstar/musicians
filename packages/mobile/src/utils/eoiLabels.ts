import type { AppRouter } from "@musicians/shared";
import type { inferRouterOutputs } from "@trpc/server";

type RouterOutputs = inferRouterOutputs<AppRouter>;

type EoiState = RouterOutputs["requests"]["listMine"][number]["eois"][number]["state"];
type RequestStatus = RouterOutputs["requests"]["listMine"][number]["status"];

/**
 * Human-readable label for an EoI state, used on the Manage Requests screen.
 * Kept pure so tests can hit every branch without any React/tRPC plumbing.
 */
export function formatEoiStateLabel(state: EoiState): string {
  switch (state) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "auto_rejected":
      return "Auto-rejected";
    case "withdrawn":
      return "Withdrawn";
  }
}

/**
 * Matches the server enum to a badge colour. Pending is the project primary
 * accent; terminal positive uses green; terminal negative uses a muted red.
 */
export function getEoiStateColor(state: EoiState): string {
  switch (state) {
    case "pending":
      return "#6c63ff";
    case "accepted":
      return "#3fa66a";
    case "rejected":
    case "auto_rejected":
      return "#b04b4b";
    case "withdrawn":
      return "#4a4a52";
  }
}

/**
 * Display name for a user — full name if both parts are set, otherwise the
 * first name, otherwise `@username`. Used for EoI target rows.
 */
export function formatUserDisplayName(user: {
  username: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (full.length > 0) return full;
  if (user.firstName && user.firstName.trim().length > 0) return user.firstName;
  return `@${user.username}`;
}

/**
 * Label + colour for a request status pill.
 */
export function formatRequestStatusLabel(status: RequestStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
    case "cancelled":
      return "Cancelled";
  }
}

export function getRequestStatusColor(status: RequestStatus): string {
  switch (status) {
    case "open":
      return "#6c63ff";
    case "closed":
      return "#3fa66a";
    case "cancelled":
      return "#4a4a52";
  }
}
