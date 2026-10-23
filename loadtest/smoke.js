import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate==0"],
  },
};

export default function () {
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    "health 200": (r) => r.status === 200,
    "health UP": (r) => r.json("status") === "UP",
  });

  const docs = http.get(`${BASE_URL}/v3/api-docs`);
  check(docs, {
    "openapi 200": (r) => r.status === 200,
    "openapi has paths": (r) => Object.keys(r.json("paths") || {}).length > 0,
  });
}
