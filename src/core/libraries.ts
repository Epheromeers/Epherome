import type { ClientJsonRule } from "./rules";

export interface ClientJsonLibrary {
  downloads?: {
    artifact?: {
      path: string;
    };
  };
  name: string;
  rules?: ClientJsonRule[];
}
