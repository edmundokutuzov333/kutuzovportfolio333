import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getAdminSession,
  loginAdmin,
  logoutAdmin,
} from "./server/admin-auth.server";

const loginInput = z.object({
  pin: z.string().regex(/^\d{3}$/),
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(1024),
});

export const loginAdminFn = createServerFn({ method: "POST" })
  .inputValidator(loginInput)
  .handler(async ({ data }) => loginAdmin(data));

export const getAdminSessionFn = createServerFn({ method: "GET" }).handler(
  async () => getAdminSession(),
);

export const logoutAdminFn = createServerFn({ method: "POST" }).handler(
  async () => logoutAdmin(),
);
