import { expect, it } from "vitest";
import { mutationAllowed } from "../src/lib/api";
it("menerima origin browser lokal ketika Next menormalkan URL internal", () => {
  const request = new Request("http://localhost:3000/api/content", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
    },
  });
  expect(mutationAllowed(request)).toBeNull();
});
it("menolak origin situs lain", () => {
  const request = new Request("http://localhost:3000/api/content", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "https://other.example",
      "content-type": "application/json",
    },
  });
  expect(mutationAllowed(request)?.status).toBe(403);
});
