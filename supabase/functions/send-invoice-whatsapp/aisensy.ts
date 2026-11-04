// The single place that talks to AiSensy: Legacy Campaign API, apiKey in the JSON body.
// No Bearer token and no Project API. `fetchImpl` is injected so tests never hit the network.
import { AISENSY_ENDPOINT, sanitizeProviderResponse, type CampaignPayload } from "./whatsapp.ts";

export type ProviderResult =
  | { kind: "accepted"; httpStatus: number; response: unknown }
  | { kind: "rejected"; httpStatus: number; response: unknown }
  | { kind: "timeout" }
  | { kind: "network_error" };

/** True when a (sanitised) AiSensy reply says the request failed despite its HTTP status. */
export function reportsFailure(response: unknown): boolean {
  if (!response || typeof response !== "object") return false;
  const r = response as Record<string, unknown>;
  const success = r["success"];
  if (success === false || success === "false") return true;
  return ["error", "errorMessage", "errors"].some(
    (k) => r[k] != null && r[k] !== "" && r[k] !== false,
  );
}

export async function postCampaign(
  payload: CampaignPayload,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 20_000,
): Promise<ProviderResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(AISENSY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ apiKey, ...payload }),
      signal: controller.signal,
    });
    const text = await res.text().catch(() => "");
    const response = sanitizeProviderResponse(text, apiKey);
    // A 2xx means AiSensy ACCEPTED the request (not a delivery confirmation), unless the
    // body itself reports a failure: the docs don't define the response body, so a 200
    // carrying `success: false` or an error message is treated as a rejection.
    return res.ok && !reportsFailure(response)
      ? { kind: "accepted", httpStatus: res.status, response }
      : { kind: "rejected", httpStatus: res.status, response };
  } catch (e) {
    return controller.signal.aborted || (e instanceof Error && e.name === "AbortError")
      ? { kind: "timeout" }
      : { kind: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
