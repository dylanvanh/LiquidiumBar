import { LiquidiumError, LiquidiumErrorCode } from "@liquidium/client";
import type { LiquidiumAppError } from "./sdk.types";

export function mapLiquidiumError(error: unknown): LiquidiumAppError {
  if (isInvalidPrincipalError(error)) {
    return {
      type: "invalid-profile",
      message: "This Liquidium profile identifier is invalid.",
      cause: error,
    };
  }

  if (error instanceof LiquidiumError) {
    if (
      error.code === LiquidiumErrorCode.NETWORK_ERROR ||
      error.code === LiquidiumErrorCode.REQUEST_TIMEOUT ||
      error.code === LiquidiumErrorCode.SERVICE_UNAVAILABLE ||
      error.code === LiquidiumErrorCode.CANISTER_REJECTED
    ) {
      return {
        type: "network",
        message: "Liquidium data is temporarily unavailable.",
        cause: error,
      };
    }

    return {
      type: "sdk",
      message: "Liquidium could not return this data.",
      cause: error,
    };
  }

  return {
    type: "sdk",
    message: "LiqWatch could not load Liquidium data.",
    cause: error,
  };
}

function isInvalidPrincipalError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "PrincipalError" ||
      error.message.toLowerCase().includes("principal"))
  );
}
