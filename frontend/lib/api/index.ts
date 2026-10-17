import { httpApi } from "./http";
import { mockApi } from "./mock";
import type { Api } from "./types";

/** Mock включён по умолчанию; для настоящего backend: NEXT_PUBLIC_USE_MOCK=false. */
export const isMock = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
export const api: Api = isMock ? mockApi : httpApi;
export { ApiError } from "./types";
