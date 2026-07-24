import { describe, expect, it } from "vitest";
import { createUpdaterManifest } from "../../scripts/generate-updater-manifest.mjs";

describe("updater manifest", () => {
  it("creates the signed Apple Silicon platform entry", () => {
    expect(
      createUpdaterManifest({
        version: "0.1.6",
        artifactUrl:
          "https://github.com/dylanvanh/LiquidiumBar/releases/download/v0.1.6/LiquidiumBar.app.tar.gz",
        signature: "signed archive",
        notes: "Update notes",
        publishedAt: "2026-07-24T08:00:00.000Z",
      })
    ).toEqual({
      version: "0.1.6",
      notes: "Update notes",
      pub_date: "2026-07-24T08:00:00.000Z",
      platforms: {
        "darwin-aarch64": {
          signature: "signed archive",
          url: "https://github.com/dylanvanh/LiquidiumBar/releases/download/v0.1.6/LiquidiumBar.app.tar.gz",
        },
      },
    });
  });

  it("permits HTTP only for an isolated local test endpoint", () => {
    expect(() =>
      createUpdaterManifest({
        version: "0.1.7-test.1",
        artifactUrl: "http://127.0.0.1:4187/LiquidiumBar.app.tar.gz",
        signature: "signed archive",
      })
    ).not.toThrow();
    expect(() =>
      createUpdaterManifest({
        version: "0.1.7",
        artifactUrl: "http://example.com/LiquidiumBar.app.tar.gz",
        signature: "signed archive",
      })
    ).toThrow(/HTTPS/);
  });
});
