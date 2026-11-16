import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  AdminMutationInputSchema,
  AdminEntitySchema,
} from "./admin-cms.schema";
import {
  loadAdminWorkspace,
  mutateAdminContent,
  deleteArchivedProject,
  reorderAdminContent,
  reorderPublishedProjects,
  setFeaturedPublishedProjects,
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

const publishedProjectOrderInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  expectedIds: z.array(z.string().uuid()).min(1).max(500),
}).strict().superRefine((value, context) => {
  if (value.ids.length !== value.expectedIds.length ||
      new Set(value.ids).size !== value.ids.length ||
      new Set(value.expectedIds).size !== value.expectedIds.length ||
      !value.ids.every(id => value.expectedIds.includes(id))) {
    context.addIssue({ code: z.ZodIssueCode.custom,
      message: "A lista tem de incluir todos os trabalhos publicados uma única vez." });
  }
});

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

/** Same PIN-only Admin server context; the service_role key never reaches the browser. */
export const reorderPublishedProjectsFn = createServerFn({ method: "POST" })
  .inputValidator(publishedProjectOrderInput)
  .handler(async ({ data }) => reorderPublishedProjects(data));

export const setFeaturedPublishedProjectsFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ids: z.array(z.string().uuid()).min(1).max(500), featured: z.boolean() }).strict())
  .handler(async ({ data }) => setFeaturedPublishedProjects(data));

export const deleteArchivedProjectFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    id: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    note: z.string().trim().max(500).nullable().optional(),
  }).strict())
  .handler(async ({ data }) => deleteArchivedProject({ ...data, note: data.note ?? null }));

export const updateContactSubmissionFn = createServerFn({ method: "POST" })
  .inputValidator(contactInput)
  .handler(async ({ data }) => updateContactSubmission(data));
