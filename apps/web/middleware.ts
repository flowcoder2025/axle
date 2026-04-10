import type { NextMiddleware } from "next/server";
import { authMiddleware, middlewareConfig } from "@axle/auth";

export const middleware: NextMiddleware = authMiddleware as NextMiddleware;
export const config = middlewareConfig;
