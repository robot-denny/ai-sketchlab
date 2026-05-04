/**
 * Prompt builders for the How-To Guide Writer agent.
 *
 * The agent's system prompt (set in the backoffice) expects the user message
 * to be a JSON payload describing one feature. These helpers shape that payload
 * for the create-fresh and amend code paths.
 */

import type { SignaturePayload } from './sourceSignature.js';

export interface GeneratePromptInput {
  /** Display name shown to editors, e.g. "Alert Banner". */
  featureDisplayName: string;
  /** Source-signature payload assembled by `computeSourceSignature`. */
  payload: SignaturePayload;
}

/**
 * Build the user message body for a fresh-create run. The JSON shape mirrors
 * the source-signature payload so the agent has every property alias / name /
 * data-type alias to work from, plus the partial contents for context.
 */
export function generatePrompt(input: GeneratePromptInput): string {
  const body = {
    mode: 'create',
    featureDisplayName: input.featureDisplayName,
    elementType: input.payload.elementType,
    partial: {
      path: input.payload.partial,
      content: input.payload.partialContent,
    },
  };
  return JSON.stringify(body, null, 2);
}

export interface AmendPromptInput {
  /** Display name shown to editors, e.g. "Alert Banner". */
  featureDisplayName: string;
  /** Existing description HTML stored on the guide page. */
  existingDescription: string;
  /**
   * The signature payload the existing description was generated from. May be
   * a minimal stub (signature + timestamp + featureAlias) if older metadata
   * predates full-payload storage.
   */
  previousSignaturePayload: unknown;
  /** Freshly computed payload from the current source state. */
  currentSignaturePayload: SignaturePayload;
}

/**
 * Build the user message body for an amend run. The agent's system prompt
 * already instructs it to amend rather than rewrite when an existing
 * description is provided; this body gives it the source-of-truth diff plus
 * the explicit instruction phrasing required by the spec.
 */
export function generateAmendPrompt(input: AmendPromptInput): string {
  const body = {
    mode: 'amend',
    featureDisplayName: input.featureDisplayName,
    instruction:
      'amend the existing description; preserve any prose the editor has added; only change paragraphs that need to reflect the source diff.',
    existingDescription: input.existingDescription,
    previousSignaturePayload: input.previousSignaturePayload,
    currentSignaturePayload: input.currentSignaturePayload,
  };
  return JSON.stringify(body, null, 2);
}
