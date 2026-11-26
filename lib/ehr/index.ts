import "server-only";
import { MockEhrConnector } from "./mock";
import type { EhrConnector } from "./types";

/** Swap this for a real connector later; nothing else needs to change. */
export function getEhrConnector(): EhrConnector {
  return new MockEhrConnector();
}
