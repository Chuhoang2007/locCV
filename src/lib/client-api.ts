export class ClientAPIError extends Error {
  constructor(message: string, public status: number,public fields?:import("@/domain/validation").ValidationFeedback[],public code?:string) { super(message); }
}
export async function clientJSON<T>(url: string, method: string, body?: unknown, headers: Record<string,string> = {},signal?:AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method, credentials: "same-origin", cache: "no-store",signal,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new ClientAPIError("Không thể kết nối. Hãy kiểm tra mạng rồi thử lại.", 0); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ClientAPIError(data.error?.message ?? "Chưa hoàn tất được yêu cầu. Vui lòng thử lại.", response.status,data.error?.fields,data.error?.code);
  return data as T;
}
