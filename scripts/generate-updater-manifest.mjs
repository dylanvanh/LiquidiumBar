import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

function usage() {
  return [
    "Usage:",
    "  pnpm updater:manifest <version> <artifact-url> <signature-file> <output-file> [notes-file]",
  ].join("\n");
}

export function createUpdaterManifest({
  version,
  artifactUrl,
  signature,
  notes = "",
  publishedAt = new Date().toISOString(),
}) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid semantic version: ${version}`);
  }

  const url = new URL(artifactUrl);
  const localTestUrl =
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !localTestUrl) {
    throw new Error("Updater artifacts must use HTTPS, except for local tests.");
  }
  if (!signature.trim()) {
    throw new Error("Updater signature is empty.");
  }

  return {
    version,
    notes,
    pub_date: publishedAt,
    platforms: {
      "darwin-aarch64": {
        signature: signature.trim(),
        url: url.toString(),
      },
    },
  };
}

async function main() {
  const [version, artifactUrl, signatureFile, outputFile, notesFile] =
    process.argv.slice(2);
  if (!version || !artifactUrl || !signatureFile || !outputFile) {
    throw new Error(usage());
  }

  const [signature, notes] = await Promise.all([
    readFile(signatureFile, "utf8"),
    notesFile ? readFile(notesFile, "utf8") : "",
  ]);
  const manifest = createUpdaterManifest({
    version,
    artifactUrl,
    signature,
    notes,
  });
  await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`Created ${basename(outputFile)} for v${version}\n`);
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  });
}
