import type { ClientJsonRule } from "./rules";

interface ClientJsonLibraryDownloadArtifact {
  path?: string;
  sha1?: string;
  size?: number;
  url?: string;
}

export interface ClientJsonLibrary {
  downloads?: {
    artifact?: ClientJsonLibraryDownloadArtifact;
    classifiers?: {
      [key: string]: ClientJsonLibraryDownloadArtifact;
    };
  };
  name?: string;
  url?: string;
  extract?: {
    exclude?: string[];
  };
  rules?: ClientJsonRule[];
}
