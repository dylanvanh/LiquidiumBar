export interface UpdaterManifestInput {
  version: string;
  artifactUrl: string;
  signature: string;
  notes?: string;
  publishedAt?: string;
}

export interface UpdaterManifest {
  version: string;
  notes: string;
  pub_date: string;
  platforms: {
    "darwin-aarch64": {
      signature: string;
      url: string;
    };
  };
}

export function createUpdaterManifest(input: UpdaterManifestInput): UpdaterManifest;
