import type { ActionResult } from "@/lib/types";
import { friendlyError } from "@/lib/utils";

export const ok = <T = unknown>(message: string, extra: Partial<ActionResult<T>> = {}): ActionResult<T> => ({ ok: true, message, ...extra });
export const fail = <T = unknown>(message: string, fieldErrors?: Record<string, string>): ActionResult<T> => ({ ok: false, message, fieldErrors });
export const dbFail = <T = unknown>(error: { message?: string; hint?: string; code?: string } | null) => fail<T>(friendlyError(error));
