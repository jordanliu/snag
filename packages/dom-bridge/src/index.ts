import { z } from "zod";

const recordOfStringsSchema = z.record(z.string(), z.string());

const nullableRecordOfStringsSchema = z.record(
  z.string(),
  z.union([z.string(), z.null()]),
);

export const selectedElementSnapshotSchema = z.object({
  selector: z.string().min(1),
  tagName: z.string().min(1),
  textContent: z.string().nullable(),
  innerHTML: z.string(),
  outerHTML: z.string(),
  computedStyles: recordOfStringsSchema,
  attributes: recordOfStringsSchema,
  url: z.string().min(1),
});

export const selectionChangedMessageSchema = z.object({
  type: z.literal("selection_changed"),
  snapshot: selectedElementSnapshotSchema,
  tabId: z.number().int().nonnegative(),
  frameId: z.number().int().nonnegative().optional(),
});

export const selectionClearedMessageSchema = z.object({
  type: z.literal("selection_cleared"),
  reason: z.string().min(1),
  tabId: z.number().int().nonnegative().optional(),
  frameId: z.number().int().nonnegative().optional(),
  url: z.string().min(1).optional(),
});

export const modifyStylesCommandSchema = z.object({
  type: z.literal("modify_styles"),
  id: z.string().min(1),
  selector: z.string().min(1),
  styles: nullableRecordOfStringsSchema,
});

export const modifyContentCommandSchema = z
  .object({
    type: z.literal("modify_content"),
    id: z.string().min(1),
    selector: z.string().min(1),
    html: z.string().optional(),
    textContent: z.string().optional(),
  })
  .refine((value) => {
    return (value.html === undefined) !== (value.textContent === undefined);
  }, "Provide exactly one of html or textContent.");

export const modifyAttributesCommandSchema = z.object({
  type: z.literal("modify_attributes"),
  id: z.string().min(1),
  selector: z.string().min(1),
  attributes: nullableRecordOfStringsSchema,
});

export const commandResultMessageSchema = z.object({
  type: z.literal("command_result"),
  id: z.string().min(1),
  ok: z.boolean(),
  selector: z.string().min(1),
  message: z.string().min(1),
  snapshot: selectedElementSnapshotSchema.optional(),
});

export const bridgeCommandSchema = z.discriminatedUnion("type", [
  modifyStylesCommandSchema,
  modifyContentCommandSchema,
  modifyAttributesCommandSchema,
]);

export const bridgeIncomingMessageSchema = z.discriminatedUnion("type", [
  selectionChangedMessageSchema,
  selectionClearedMessageSchema,
  commandResultMessageSchema,
]);

export type SelectedElementSnapshot = z.infer<
  typeof selectedElementSnapshotSchema
>;
export type SelectionChangedMessage = z.infer<
  typeof selectionChangedMessageSchema
>;
export type SelectionClearedMessage = z.infer<
  typeof selectionClearedMessageSchema
>;
export type ModifyStylesCommand = z.infer<typeof modifyStylesCommandSchema>;
export type ModifyContentCommand = z.infer<typeof modifyContentCommandSchema>;
export type ModifyAttributesCommand = z.infer<
  typeof modifyAttributesCommandSchema
>;
export type CommandResultMessage = z.infer<typeof commandResultMessageSchema>;
export type BridgeCommand = z.infer<typeof bridgeCommandSchema>;
export type BridgeIncomingMessage = z.infer<typeof bridgeIncomingMessageSchema>;
