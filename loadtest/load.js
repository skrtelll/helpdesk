import http from "k6/http";
import { check, fail, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const API = `${BASE_URL}${__ENV.API_PREFIX || "/api/v1"}`;
const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || "2m";

export const options = {
  scenarios: {
    read: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: VUS },
        { duration: DURATION, target: VUS },
        { duration: "15s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{name:tickets}": ["p(95)<500"],
    "http_req_duration{name:health}": ["p(95)<200"],
  },
};

export function setup() {
  if (!__ENV.LOGIN_EMAIL) {
    return { headers: {} };
  }
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: __ENV.LOGIN_EMAIL, password: __ENV.LOGIN_PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );
  if (res.status !== 200) {
    fail(`login failed: ${res.status} ${res.body}`);
  }
  return { headers: { Authorization: `Bearer ${res.json("accessToken")}` } };
}

export default function (data) {
  const params = { headers: data.headers };

  const list = http.get(`${API}/tickets?page=0&size=20&sort=createdAt,desc`, {
    ...params,
    tags: { name: "tickets" },
  });
  check(list, { "tickets 200": (r) => r.status === 200 });

  const health = http.get(`${BASE_URL}/health`, { tags: { name: "health" } });
  check(health, { "health 200": (r) => r.status === 200 });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
    "/results/summary.json": JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  const lines = [
    `requests:        ${m.http_reqs.values.count} (${m.http_reqs.values.rate.toFixed(1)}/s)`,
    `failed:          ${(m.http_req_failed.values.rate * 100).toFixed(2)}%`,
    `duration p95:    ${m.http_req_duration.values["p(95)"].toFixed(1)} ms`,
    `duration max:    ${m.http_req_duration.values.max.toFixed(1)} ms`,
  ];
  for (const [name, t] of Object.entries(data.metrics)) {
    if (t.thresholds) {
      for (const [expr, res] of Object.entries(t.thresholds)) {
        lines.push(`${res.ok ? "PASS" : "FAIL"}  ${name}: ${expr}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}
