import { Principal } from "@icp-sdk/core/principal";
import type { LiquidiumAppError } from "./sdk.types";

export type ProfileValidationResult =
  | { ok: true; profileId: string }
  | { ok: false; error: LiquidiumAppError };

export function validateProfileId(input: string): ProfileValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return invalidProfile("Enter a Liquidium profile identifier.");
  }

  try {
    return { ok: true, profileId: Principal.fromText(trimmed).toText() };
  } catch (cause) {
    return invalidProfile("This Liquidium profile identifier is invalid.", cause);
  }
}

function invalidProfile(message: string, cause?: unknown): ProfileValidationResult {
  return {
    ok: false,
    error: cause
      ? { type: "invalid-profile", message, cause }
      : { type: "invalid-profile", message },
  };
}
