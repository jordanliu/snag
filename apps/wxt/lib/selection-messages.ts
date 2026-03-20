import {
  selectedElementSnapshotSchema,
} from "@repo/dom-bridge";
import { z } from "zod";

export const selectionChangedRuntimeMessageSchema = z.object({
  type: z.literal("content_selection_changed"),
  snapshot: selectedElementSnapshotSchema,
});

export const selectionClearedRuntimeMessageSchema = z.object({
  type: z.literal("content_selection_cleared"),
  reason: z.string(),
  url: z.string(),
});

export const clearPageSelectionRuntimeMessageSchema = z.object({
  type: z.literal("background_clear_page_selection"),
  reason: z.string(),
});

export const selectorSessionProbeMessageSchema = z.object({
  type: z.literal("selector_session_probe"),
});

export const selectorSessionStatusMessageSchema = z.object({
  type: z.literal("selector_session_status"),
  ready: z.literal(true),
  enabled: z.boolean(),
});

export type SelectionChangedRuntimeMessage = z.infer<
  typeof selectionChangedRuntimeMessageSchema
>;
export type SelectionClearedRuntimeMessage = z.infer<
  typeof selectionClearedRuntimeMessageSchema
>;
export type ClearPageSelectionRuntimeMessage = z.infer<
  typeof clearPageSelectionRuntimeMessageSchema
>;
export type SelectorSessionProbeMessage = z.infer<
  typeof selectorSessionProbeMessageSchema
>;
export type SelectorSessionStatusMessage = z.infer<
  typeof selectorSessionStatusMessageSchema
>;

export function isSelectionChangedRuntimeMessage(
  value: unknown,
): value is SelectionChangedRuntimeMessage {
  return selectionChangedRuntimeMessageSchema.safeParse(value).success;
}

export function isSelectionClearedRuntimeMessage(
  value: unknown,
): value is SelectionClearedRuntimeMessage {
  return selectionClearedRuntimeMessageSchema.safeParse(value).success;
}

export function isClearPageSelectionRuntimeMessage(
  value: unknown,
): value is ClearPageSelectionRuntimeMessage {
  return clearPageSelectionRuntimeMessageSchema.safeParse(value).success;
}

export function isSelectorSessionProbeMessage(
  value: unknown,
): value is SelectorSessionProbeMessage {
  return selectorSessionProbeMessageSchema.safeParse(value).success;
}
