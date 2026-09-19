"use client";
import { useEffect, useState } from "react";
import type { AdministrationData, Department, StudyProgram } from "@/lib/organization";

async function api(body?: unknown) {
  const response = await fetch("/api/admin/organization", {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
  return data;
}

export default function OrganizationManager() {
  const [data, setData] = useState<AdministrationData | null>(null);
  const [departmentName, setDepartmentName] = useState("");
  const [programName, setProgramName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => setData(await api());
  useEffect(() => { void load().catch((e) => setError(e.message)); }, []);
  async function save(entity: "department" | "study_program", value: Department | StudyProgram | object) {
    setBusy(true); setError("");
    try { await api({ entity, value }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan."); }
    finally { setBusy(false); }
  }
  if (!data) return <div className="loading-state"><p>{error || "Memuat organisasi…"}</p></div>;
  const activeDepartments = data.departments.filter((x) => x.active);
  return (
    <div className="admin-grid">
      {error && <div className="notice error" role="alert">{error}</div>}
      <section className="panel">
        <div className="panel-heading"><div><h2>Jurusan</h2><p>Kelola unit induk fakultas.</p></div></div>
        <form className="admin-inline" onSubmit={(e) => { e.preventDefault(); void save("department", { name: departmentName, active: true }).then(() => setDepartmentName("")); }}>
          <input aria-label="Nama jurusan baru" value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="Nama jurusan" required />
          <button className="button primary small" disabled={busy}>Tambah jurusan</button>
        </form>
        <div className="admin-list">
          {data.departments.map((department) => (
            <EditableUnit key={department.id} value={department} label="jurusan" busy={busy} onSave={(next) => save("department", next)} />
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Program studi</h2><p>Setiap prodi berada dalam satu jurusan.</p></div></div>
        <form className="admin-inline" onSubmit={(e) => { e.preventDefault(); void save("study_program", { name: programName, departmentId, active: true }).then(() => setProgramName("")); }}>
          <input aria-label="Nama prodi baru" value={programName} onChange={(e) => setProgramName(e.target.value)} placeholder="Nama program studi" required />
          <select aria-label="Jurusan prodi baru" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} required>
            <option value="">Pilih jurusan</option>
            {activeDepartments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <button className="button primary small" disabled={busy}>Tambah prodi</button>
        </form>
        <div className="admin-list">
          {data.studyPrograms.map((program) => (
            <EditableProgram key={program.id} value={program} departments={activeDepartments} busy={busy} onSave={(next) => save("study_program", next)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function EditableUnit({ value, label, busy, onSave }: { value: Department; label: string; busy: boolean; onSave: (value: Department) => Promise<void> }) {
  const [name, setName] = useState(value.name);
  return <div className="admin-row"><input aria-label={`Nama ${label} ${value.name}`} value={name} onChange={(e) => setName(e.target.value)} /><span className={`status-chip ${value.active ? "" : "inactive"}`}>{value.active ? "Aktif" : "Nonaktif"}</span><button className="button secondary small" disabled={busy} onClick={() => void onSave({ ...value, name })}>Simpan</button><button className="text-button" disabled={busy} onClick={() => void onSave({ ...value, name, active: !value.active })}>{value.active ? "Nonaktifkan" : "Aktifkan"}</button></div>;
}

function EditableProgram({ value, departments, busy, onSave }: { value: StudyProgram; departments: Department[]; busy: boolean; onSave: (value: StudyProgram) => Promise<void> }) {
  const [name, setName] = useState(value.name);
  const [departmentId, setDepartmentId] = useState(value.departmentId);
  return <div className="admin-row"><input aria-label={`Nama prodi ${value.name}`} value={name} onChange={(e) => setName(e.target.value)} /><select aria-label={`Jurusan ${value.name}`} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>{departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><span className={`status-chip ${value.active ? "" : "inactive"}`}>{value.active ? "Aktif" : "Nonaktif"}</span><button className="button secondary small" disabled={busy} onClick={() => void onSave({ ...value, name, departmentId })}>Simpan</button><button className="text-button" disabled={busy} onClick={() => void onSave({ ...value, name, departmentId, active: !value.active })}>{value.active ? "Nonaktifkan" : "Aktifkan"}</button></div>;
}
