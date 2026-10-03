import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { HttpError } from "../lib/http.js";

export interface AuthPayload {
  sub: string;
  typ: "access";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) throw new HttpError(401, "Authentication required");
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    if (payload.typ !== "access") throw new Error("wrong token type");
    req.userId = payload.sub;
    next();
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

/** Returns the authenticated user id (only valid behind requireAuth). */
export function uid(req: Request): string {
  if (!req.userId) throw new HttpError(401, "Authentication required");
  return req.userId;
}
