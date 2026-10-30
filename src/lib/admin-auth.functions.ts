import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getAdminSession,
  loginAdmin,
  logoutAdmin,
} from "./server/admin-auth.server";

const loginInput = z.object({
  pin: z.string().regex(/^333$/),
}).strict();

export const loginAdminFn = createServerFn({ method: "POST" })
  .validator(loginInput)
  .handler(async ({ data }) => {
    return loginAdmin(data);
  });

export const getAdminSessionFn = createServerFn({ method: "GET" }).handler(
  async () => {
    return getAdminSession();
  },
);

export const logoutAdminFn = createServerFn({ method: "POST" }).handler(
  async () => logoutAdmin(),
);
