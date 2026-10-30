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
    if (process.env["NODE_ENV"] !== "production") console.info("[admin-auth] login handler entered");
    return loginAdmin(data);
  });

export const getAdminSessionFn = createServerFn({ method: "GET" }).handler(
  async () => {
    if (process.env["NODE_ENV"] !== "production") console.info("[admin-auth] session read handler entered");
    return getAdminSession();
  },
);

export const logoutAdminFn = createServerFn({ method: "POST" }).handler(
  async () => logoutAdmin(),
);
