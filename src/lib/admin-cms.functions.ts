import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  AdminMutationInputSchema,
  AdminEntitySchema,
} from "./admin-cms.schema";
import {
  loadAdminWorkspace,
  mutateAdminContent,
  reorderAdminContent,
  updateContactSubmission,
} from "./server/admin-cms.server";

const reorderInput = z.object({
  entity: z.enum([
    "page_sections", "projects", "clients", "experience_items", "metrics",
    "skills", "disciplines", "principles", "services", "process_steps",
  ]),
  ids: z.array(z.string().uuid()).min(1).max(500),
  pageId: z.string().uuid().nullable(),
}).strict();

const contactInput = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "in_review", "replied", "archived"]),
  internalNotes: z.string().max(4000),
  expectedUpdatedAt: z.string().datetime({ offset: true }),
}).strict();

export const loadAdminWorkspaceFn = createServerFn({ method: "GET" }).handler(
  async () => loadAdminWorkspace(),
);

export const mutateAdminContentFn = createServerFn({ method: "POST" })
  .inputValidator(AdminMutationInputSchema)
  .handler(async ({ data }) => {
    const entity = AdminEntitySchema.parse(data.entity);
    return mutateAdminContent({
      entity,
      action: data.action,
      id: data.id,
      payload: data.payload,
      expectedUpdatedAt: data.expectedUpdatedAt,
      note: data.note ?? null,
    });
  });

export const reorderAdminContentFn = createServerFn({ method: "POST" })
  .inputValidator(reorderInput)
  .handler(async ({ data }) => reorderAdminContent(data));

export const updateContactSubmissionFn = createServerFn({ method: "POST" })
  .inputValidator(contactInput)
  .handler(async ({ data }) => updateContactSubmission(data));
