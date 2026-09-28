// supabase.functions.invoke() reports every 4xx/5xx from an Edge Function as
// a FunctionsHttpError whose .message is always the generic
// "Edge Function returned a non-2xx status code" — the actual reason the
// function sent back (e.g. "Set the campaign's platform and category…") lives
// in the Response on error.context and is otherwise thrown away. This reads
// it, so people see what actually went wrong instead of a dead-end message.

const GENERIC_INVOKE_MESSAGE = /non-2xx status code/i;

type ResponseLike = { status?: number; clone?: () => ResponseLike; json?: () => Promise<unknown> };

async function readBody(ctx: ResponseLike): Promise<Record<string, unknown> | null> {
  try {
    const source = typeof ctx.clone === "function" ? ctx.clone() : ctx;
    const body = await source.json?.();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Turns whatever supabase.functions.invoke() returned as `error` into a message that's safe and useful to show a person. */
export async function describeEdgeFunctionError(error: unknown, fallback: string): Promise<string> {
  if (!error || typeof error !== "object") return fallback;
  const err = error as { name?: string; message?: string; context?: ResponseLike };

  if (err.name === "FunctionsFetchError") {
    return "Couldn't reach the server — check your connection and try again.";
  }

  const ctx = err.context;
  if (ctx && typeof ctx.status === "number") {
    const body = await readBody(ctx);
    const ourMessage = typeof body?.error === "string" ? body.error : null;
    if (ourMessage) return ourMessage;

    // Errors produced by Supabase itself, before our code ran, use
    // { code, message } instead of our { error }.
    const platformMessage = typeof body?.message === "string" ? body.message : null;
    if (ctx.status === 404 || body?.code === "NOT_FOUND") {
      return "This feature isn't available yet — the function behind it hasn't been deployed. Please let the ChatSched team know.";
    }
    if (ctx.status === 401) return "Your session has expired — please log in again.";
    if (platformMessage) return platformMessage;
    return `${fallback} (error ${ctx.status})`;
  }

  if (err.message && !GENERIC_INVOKE_MESSAGE.test(err.message)) return err.message;
  return fallback;
}
