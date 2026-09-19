import assert from "node:assert/strict";
const base = process.env.TAJAM_TEST_URL || "http://127.0.0.1:3000";
const payload = {
  prodi: "Teknik Mesin",
  activity: "Pengujian API lokal",
  idea: `API test ${Date.now()}`,
  category: "Useful",
  status: "Draf",
  eventDate: "2026-09-22",
  uploadDate: "2026-09-23",
  format: "Poster",
  channel: "Website",
  pic: "Penguji",
  link: "",
  notes: "Data otomatis sementara",
};
async function call(path, method = "GET", body, origin = base) {
  const res = await fetch(base + path, {
    method,
    headers: { "content-type": "application/json", origin },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}
const initial = (await call("/api/content")).data.length;
const ids = [];
try {
  assert.equal(
    (await call("/api/content", "POST", payload, "https://other.example"))
      .status,
    403,
  );
  assert.equal(
    (await call("/api/content", "POST", { ...payload, status: "Disetujui" }))
      .status,
    400,
  );
  const created = await call("/api/content", "POST", payload);
  assert.equal(created.status, 201);
  ids.push(created.data.id);
  assert.equal(
    (
      await call(`/api/content/${created.data.id}`, "PUT", {
        ...payload,
        status: "Terbit",
      })
    ).data.status,
    "Terbit",
  );
  const imported = { ...payload, idea: payload.idea + " import" };
  const result = await call("/api/import", "POST", [imported, imported]);
  assert.deepEqual(result.data, { added: 1, skipped: 1 });
  const row = (await call("/api/content")).data.find(
    (r) => r.idea === imported.idea,
  );
  ids.push(row.id);
  assert.equal(
    (
      await call("/api/import", "POST", [
        { ...payload, idea: "must roll back" },
        { ...payload, pic: "" },
      ])
    ).status,
    400,
  );
  assert.equal((await call("/api/content")).data.length, initial + 2);
  assert.equal(
    (await call("/api/content/missing", "PUT", payload)).status,
    404,
  );
  console.log(
    "PASS: create, update, list, enum validation, origin protection, atomic import, duplicate import, missing ID.",
  );
} finally {
  for (const id of ids)
    assert.equal((await call(`/api/content/${id}`, "DELETE")).status, 200);
}
assert.equal((await call("/api/content")).data.length, initial);
console.log("PASS: delete and cleanup; pre-existing data unchanged.");
