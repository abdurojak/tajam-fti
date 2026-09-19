"use client";
import { useEffect, useState } from "react";
import type { AdministrationData, MemberCommand, MemberRecord, Role, ScopeType } from "@/lib/organization";

async function api(body?: unknown): Promise<AdministrationData | MemberRecord> {
  const response = await fetch("/api/admin/members", { method: body ? "POST" : "GET", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Permintaan gagal.");
  return data;
}
const empty: MemberCommand = { email: "", role: "editor", scopeType: "department", departmentId: "", studyProgramId: null, active: true };

export default function MemberManager() {
  const [data, setData] = useState<AdministrationData | null>(null);
  const [form, setForm] = useState<MemberCommand>(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => setData((await api()) as AdministrationData);
  useEffect(() => { void load().catch((e) => setError(e.message)); }, []);
  async function save(value: MemberCommand) {
    setBusy(true); setError("");
    try { await api(value); await load(); setForm(empty); }
    catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan anggota."); }
    finally { setBusy(false); }
  }
  if (!data) return <div className="loading-state"><p>{error || "Memuat anggota…"}</p></div>;
  return <section className="panel">
    <div className="panel-heading"><div><h2>Kelola anggota</h2><p>Role dan cakupan berlaku langsung pada permintaan berikutnya.</p></div></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <MemberFields value={form} data={data} onChange={setForm} />
    <div className="admin-form-actions"><button className="button primary" disabled={busy} onClick={() => void save(form)}>Tambah anggota</button></div>
    <div className="admin-list">
      {data.members.map((member) => <MemberRow key={member.email} member={member} data={data} busy={busy} onSave={save} />)}
    </div>
  </section>;
}

function MemberFields({ value, data, onChange, lockEmail = false }: { value: MemberCommand; data: AdministrationData; onChange: (value: MemberCommand) => void; lockEmail?: boolean }) {
  const set = (next: Partial<MemberCommand>) => onChange({ ...value, ...next });
  const role = value.role as Role;
  const scope = value.scopeType as ScopeType;
  return <div className="member-fields">
    <input type="email" aria-label="Email anggota" value={value.email} disabled={lockEmail} onChange={(e) => set({ email: e.target.value })} placeholder="nama@trisakti.ac.id" />
    <select aria-label={`Role ${value.email || "anggota"}`} value={role} onChange={(e) => { const next = e.target.value as Role; set(next === "admin" ? { role: next, scopeType: "global", departmentId: null, studyProgramId: null } : { role: next, scopeType: "department", departmentId: "", studyProgramId: null }); }}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
    {role !== "admin" && <><select aria-label={`Jenis cakupan ${value.email || "anggota"}`} value={scope} onChange={(e) => { const next = e.target.value as ScopeType; set({ scopeType: next, departmentId: next === "department" ? "" : null, studyProgramId: next === "study_program" ? "" : null }); }}><option value="department">Jurusan</option><option value="study_program">Program studi</option></select>{scope === "department" ? <select aria-label="Cakupan jurusan" value={value.departmentId ?? ""} onChange={(e) => set({ departmentId: e.target.value })}><option value="">Pilih jurusan</option>{data.departments.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select> : <select aria-label="Cakupan prodi" value={value.studyProgramId ?? ""} onChange={(e) => set({ studyProgramId: e.target.value })}><option value="">Pilih prodi</option>{data.studyPrograms.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}</>}
  </div>;
}

function MemberRow({ member, data, busy, onSave }: { member: MemberRecord; data: AdministrationData; busy: boolean; onSave: (value: MemberCommand) => Promise<void> }) {
  const [value, setValue] = useState<MemberCommand>(member);
  return <div className="member-row"><MemberFields value={value} data={data} onChange={setValue} lockEmail /><span className={`status-chip ${member.active ? "" : "inactive"}`}>{member.active ? "Aktif" : "Nonaktif"}</span><button className="button secondary small" disabled={busy} onClick={() => void onSave(value)}>Simpan</button><button className="text-button" disabled={busy} onClick={() => void onSave({ ...value, active: !member.active })}>{member.active ? "Nonaktifkan" : "Aktifkan"}</button></div>;
}
