"use client";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { TurnoutWidget } from "@/components/admin/TurnoutWidget";
import { PhaseController } from "@/components/admin/PhaseController";
import { useToast } from "@/components/ui/Toast";

// Results views pull in GSAP — defer them into their own chunk so they only
// load when the (non-default) Results tab is opened, trimming the console bundle.
const ResultsLoading = () => (
  <div className="glass rounded-2xl p-8"><div className="h-40 w-full animate-pulse rounded-xl bg-white/[0.03]" /></div>
);
const ResultsChart = dynamic(() => import("@/components/admin/ResultsChart").then((m) => m.ResultsChart), { loading: ResultsLoading, ssr: false });
const ResultsPodium = dynamic(() => import("@/components/admin/ResultsPodium").then((m) => m.ResultsPodium), { loading: ResultsLoading, ssr: false });

interface CandidateField { fieldName: string; fieldLabel: string; isRequired: boolean; }
interface Candidate { id: string; name: string; description: string | null; photoUrl: string | null; }
interface Position { id: string; title: string; description: string | null; maxWinners: number; maxVotes: number; restrictions: Record<string, string>; candidates: Candidate[]; }
interface VoterField { id: string; fieldName: string; fieldLabel: string; isIdentifier: boolean; isRequired: boolean; }
interface Election {
  id: string; title: string; description: string | null; template: string;
  status: string; allowAbstain: boolean; authMode: string; voterFields: VoterField[]; positions: Position[];
  candidateFields?: CandidateField[];
  _count: { voters: number };
}

/** CSV cell escaping + spreadsheet formula-injection guard (shared). */
export function csvCell(raw: unknown): string {
  let s = String(raw ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type Tab = "overview" | "candidates" | "voters" | "results";

export function ElectionConsole({ election: initial }: { election: Election }) {
  const { toast } = useToast();
  const router = useRouter();
  const [election, setElection] = useState(initial);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [addCandidateOpen, setAddCandidateOpen] = useState(false);
  const [tokensResult, setTokensResult] = useState<{ token: string; metadata: Record<string, string> }[] | null>(null);

  const [selectedPosition, setSelectedPosition] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidateDesc, setCandidateDesc] = useState("");
  const candidateFields = election.candidateFields ?? [];
  const [candidateMeta, setCandidateMeta] = useState<Record<string, string>>({});
  const [candidatePhoto, setCandidatePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [addingCandidate, setAddingCandidate] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/elections/${election.id}`);
    if (res.ok) setElection(await res.json());
  }, [election.id]);

  const changeStatus = async (status: string) => {
    setStatusLoading(true);
    const res = await fetch(`/api/elections/${election.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setElection((e) => ({ ...e, status: updated.status }));
      toast(`Phase set to ${status === "ACTIVE" ? "open" : status === "ENDED" ? "close" : "draft"}`, "success");
    } else {
      toast("Failed to update phase", "error");
    }
    setStatusLoading(false);
  };

  const setAbstain = async (val: boolean) => {
    const res = await fetch(`/api/elections/${election.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowAbstain: val }),
    });
    if (res.ok) {
      setElection((e) => ({ ...e, allowAbstain: val }));
      toast(val ? "Abstaining allowed" : "Abstaining not allowed", "success");
    } else {
      toast("Failed to update", "error");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/elections/${election.id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Election deleted", "success");
      router.push("/admin");
    } else {
      toast("Failed to delete election", "error");
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const openAddCandidate = (positionId: string) => {
    setSelectedPosition(positionId);
    setCandidateName(""); setCandidateDesc("");
    setCandidatePhoto(null); setPhotoPreview(null);
    setCandidateMeta({});
    setAddCandidateOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setCandidatePhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleAddCandidate = async () => {
    if (!selectedPosition || !candidateName.trim()) return toast("Select a position and enter a name", "error");
    const missing = candidateFields.find((f) => f.isRequired && !(candidateMeta[f.fieldName] ?? "").trim());
    if (missing) return toast(`${missing.fieldLabel} is required`, "error");
    setAddingCandidate(true);
    const fd = new FormData();
    fd.append("positionId", selectedPosition);
    fd.append("name", candidateName.trim());
    if (candidateDesc.trim()) fd.append("description", candidateDesc.trim());
    if (candidatePhoto) fd.append("photo", candidatePhoto);
    candidateFields.forEach((f) => {
      const v = (candidateMeta[f.fieldName] ?? "").trim();
      if (v) fd.append(`meta_${f.fieldName}`, v);
    });
    const res = await fetch(`/api/elections/${election.id}/candidates`, { method: "POST", body: fd });
    if (res.ok) {
      toast("Candidate added", "success");
      setAddCandidateOpen(false);
      await refetch();
    } else {
      const text = await res.text();
      let message = "Failed to add candidate";
      try { message = JSON.parse(text).error ?? message; } catch {}
      toast(message, "error");
    }
    setAddingCandidate(false);
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    // Optimistic: drop the card immediately, restore it if the request fails.
    const snapshot = election.positions;
    setElection((e) => ({
      ...e,
      positions: e.positions.map((p) => ({ ...p, candidates: p.candidates.filter((c) => c.id !== candidateId) })),
    }));
    const res = await fetch(`/api/elections/${election.id}/candidates?candidateId=${candidateId}`, { method: "DELETE" });
    if (res.ok) {
      toast("Candidate removed", "success");
    } else {
      setElection((e) => ({ ...e, positions: snapshot }));
      toast("Failed to remove candidate", "error");
    }
  };

  const handleImportVoters = async () => {
    if (!importFile) return toast("Please select a file", "error");
    setImporting(true);
    const fd = new FormData();
    fd.append("file", importFile);
    const res = await fetch(`/api/elections/${election.id}/voters`, { method: "POST", body: fd });
    if (res.ok) {
      const data = await res.json();
      toast(`Imported ${data.imported} voters`, "success");
      setTokensResult(data.tokens);
      await refetch();
    } else {
      const { error } = await res.json();
      toast(error ?? "Import failed", "error");
    }
    setImporting(false);
  };

  const downloadTokens = () => {
    if (!tokensResult) return;
    const rows = [
      ["Access code", ...Object.keys(tokensResult[0]?.metadata ?? {})],
      ...tokensResult.map((r) => [r.token, ...Object.values(r.metadata)]),
    ];
    downloadCsv(`${election.title}-codes.csv`, rows);
  };

  const candidateCount = election.positions.reduce((s, p) => s + p.candidates.length, 0);
  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "candidates", label: "Candidates", n: candidateCount },
    { id: "voters", label: "Voters", n: election._count.voters },
    { id: "results", label: "Results" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-20">

      <div>
        {/* back */}
        <Link href="/admin" className="link-underline font-mono text-[0.65rem] uppercase tracking-[0.22em] text-white/35 hover:text-white transition-colors">
          ⟵ Dashboard
        </Link>

        {/* header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-wrap items-end justify-between gap-6 pb-8 sm:gap-8 sm:pb-10 border-b border-white/[0.08]"
        >
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-4">
              <StatusBadge status={election.status} />
              <span className="font-sans font-medium text-[0.72rem] uppercase tracking-[0.12em] text-white/45">{election.template}</span>
            </div>
            <h1 className="font-sans font-extrabold text-white leading-[0.95] tracking-tight"
              style={{ fontSize: "clamp(2.2rem, 5vw, 4rem)" }}>
              {election.title}
            </h1>
            {election.description && (
              <p className="mt-4 max-w-xl text-base text-white/45 leading-relaxed">{election.description}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-5">
            <PhaseController status={election.status} busy={statusLoading} onAdvance={changeStatus} />
            <button onClick={() => { setDeleteText(""); setDeleteConfirm(true); }}
              className="font-sans font-medium text-[0.78rem] text-white/50 transition-colors hover:text-red-400">
              Delete election
            </button>
          </div>
        </motion.div>

        {/* tabs */}
        <div className="mt-10 mb-12 -mx-5 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`relative shrink-0 px-5 py-3 rounded-xl font-sans font-medium text-sm tracking-wide transition-all duration-200 ${
                activeTab === t.id
                  ? "bg-white/[0.1] text-white"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
              }`}
            >
              {t.label}
              {t.n !== undefined && (
                <span className={`ml-2 font-mono text-xs ${activeTab === t.id ? "text-[#4A9EFF]" : "text-white/25"}`}>
                  {String(t.n).padStart(2, "0")}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >

            {/* overview */}
            {activeTab === "overview" && (
              <div className="space-y-10">
                <TurnoutWidget electionId={election.id} emphasized={election.status === "ACTIVE"} />

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Configuration */}
                  <div className="glass rounded-2xl p-6 sm:p-8">
                    <h3 className="font-sans font-semibold text-lg text-white mb-6">Configuration</h3>
                    <InfoRow label="Template" value={election.template} />
                    <InfoRow label="Positions" value={String(election.positions.length)} />
                    <InfoRow label="Voter fields" value={String(election.voterFields.length)} />
                    <InfoRow label="Registered" value={String(election._count.voters)} />
                    <div className="flex items-center justify-between py-4">
                      <span className="font-sans text-sm text-white/40">Abstaining</span>
                      <div className="flex items-center gap-1.5">
                        {(["Allowed", "Not allowed"] as const).map((lbl) => {
                          const val = lbl === "Allowed";
                          const active = election.allowAbstain === val;
                          return (
                            <button
                              key={lbl}
                              onClick={() => setAbstain(val)}
                              className={`rounded-lg px-3 py-1.5 font-sans text-[0.78rem] font-medium transition-all ${
                                active
                                  ? "bg-[#4A9EFF]/15 text-[#4A9EFF] border border-[#4A9EFF]/25"
                                  : "text-white/40 hover:text-white/60 border border-white/[0.06]"
                              }`}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Election ID (voting access) */}
                  <div className="glass rounded-2xl p-6 sm:p-8">
                    <h3 className="font-sans font-semibold text-lg text-white mb-6">Voter access</h3>
                    {/* Big Election ID */}
                    <div className="mb-4 rounded-xl bg-white/[0.04] border border-white/[0.06] px-5 py-4">
                      <p className="sans-label text-white/40 mb-2">Election ID</p>
                      <p className="font-mono text-[1.4rem] font-bold tracking-[0.18em] text-[#4A9EFF]">
                        {election.id}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { navigator.clipboard.writeText(election.id); toast("Election ID copied", "success"); }}
                        className="flex-1 rounded-xl bg-[#4A9EFF]/10 border border-[#4A9EFF]/20 py-2.5 font-sans text-[0.8rem] font-semibold text-[#4A9EFF] hover:bg-[#4A9EFF]/15 transition-colors"
                      >
                        Copy ID
                      </button>
                      <button
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/vote/${election.id}`); toast("Link copied", "success"); }}
                        className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.06] py-2.5 font-sans text-[0.8rem] font-semibold text-white/50 hover:text-white/70 transition-colors"
                      >
                        Copy link
                      </button>
                    </div>
                    <p className="mt-4 text-[0.85rem] leading-relaxed text-white/45">
                      Share the Election ID with voters. They enter it at the voting portal to authenticate and cast their ballot.
                    </p>
                  </div>
                </div>

                {/* Positions */}
                <div>
                  <h3 className="font-sans font-semibold text-lg text-white mb-6">
                    Positions
                    <span className="ml-3 font-mono text-sm text-white/30">{String(election.positions.length).padStart(2, "0")}</span>
                  </h3>
                  <div className="space-y-3">
                    {election.positions.map((pos, i) => (
                      <div
                        key={pos.id}
                        className="glass rounded-xl flex items-center justify-between gap-4 px-6 py-5 hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-[0.72rem] tabular-nums text-white/30 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                          <span className="font-sans font-semibold text-base text-white">{pos.title}</span>
                        </div>
                        <span className="font-sans text-[0.82rem] text-white/45 shrink-0">
                          {pos.candidates.length} candidate{pos.candidates.length === 1 ? "" : "s"} · pick {pos.maxVotes}
                          {Object.keys(pos.restrictions ?? {}).length > 0 && (
                            <span className="text-[#4A9EFF] ml-2">· restricted</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* candidates */}
            {activeTab === "candidates" && (
              <div className="space-y-16">
                {election.positions.map((pos) => (
                  <section key={pos.id}>
                    <div className="mb-8 flex items-center justify-between pb-5 border-b border-white/[0.08]">
                      <div className="flex items-baseline gap-4">
                        <h3 className="font-sans font-bold text-2xl text-white">{pos.title}</h3>
                        <span className="font-sans text-[0.82rem] text-white/45">
                          {pos.candidates.length} candidate{pos.candidates.length === 1 ? "" : "s"} · pick {pos.maxVotes} · {pos.maxWinners} {pos.maxWinners > 1 ? "winners" : "winner"}
                        </span>
                      </div>
                      <button
                        onClick={() => openAddCandidate(pos.id)}
                        className="glass rounded-full px-5 py-2.5 font-sans font-medium text-sm text-white/50 hover:text-white transition-colors"
                      >
                        + Add
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {pos.candidates.map((c, i) => (
                        <motion.div
                          key={c.id}
                          className="group relative glass rounded-xl overflow-hidden card-lift"
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.06, duration: 0.4 }}
                        >
                          <div className="relative aspect-[4/5] overflow-hidden bg-white/[0.03]">
                            {c.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.photoUrl} alt={c.name}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
                                style={{ filter: "grayscale(0.5) contrast(1.08) brightness(0.8)" }}
                              />
                            ) : (
                              <span className="grid h-full w-full place-items-center font-mono text-3xl text-white/20">
                                {c.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                              </span>
                            )}
                            <span className="absolute left-3 top-3 font-mono text-[0.68rem] tabular-nums tracking-[0.12em] text-white/40">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <button
                              onClick={() => handleDeleteCandidate(c.id)}
                              className="absolute right-0 top-0 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 font-sans text-[0.72rem] font-medium text-white/60 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 rounded-bl-lg"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="p-4">
                            <p className="font-sans font-semibold text-[0.95rem] leading-tight text-white">{c.name}</p>
                            {c.description && (
                              <p className="mt-1 font-sans text-[0.8rem] leading-snug text-white/50">{c.description}</p>
                            )}
                          </div>
                        </motion.div>
                      ))}

                      <button
                        onClick={() => openAddCandidate(pos.id)}
                        className="group flex flex-col glass rounded-xl hover:border-[#4A9EFF]/30 transition-all duration-300"
                      >
                        <div className="grid aspect-[4/5] place-items-center">
                          <span className="font-mono text-2xl text-white/20 transition-colors group-hover:text-[#4A9EFF]">+</span>
                        </div>
                        <div className="p-4">
                          <p className="font-sans text-[0.8rem] font-medium text-white/40 transition-colors group-hover:text-white/70">
                            Add candidate
                          </p>
                        </div>
                      </button>
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* voters */}
            {activeTab === "voters" && (
              <div className="space-y-10">
                <section className="glass rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-5 sm:px-8 sm:py-6 border-b border-white/[0.07]">
                    <h3 className="font-sans font-semibold text-lg text-white">Import voters</h3>
                    <span className="font-sans text-[0.78rem] font-medium text-white/40">CSV or Excel</span>
                  </div>
                  <div className="p-5 sm:p-8">
                    <p className="sans-label mb-3 text-white/40">Required columns</p>
                    <div className="mb-6 flex flex-wrap gap-2">
                      {election.voterFields.map((f) => (
                        <span
                          key={f.id}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-sans text-[0.8rem] font-medium border ${
                            f.isIdentifier
                              ? "border-[#4A9EFF]/30 text-[#4A9EFF] bg-[#4A9EFF]/5"
                              : "border-white/[0.08] text-white/55 bg-white/[0.02]"
                          }`}
                        >
                          <span className="font-mono text-[0.78rem]">{f.fieldName}</span>
                          <span className={f.isIdentifier ? "text-[#4A9EFF]/70" : "text-white/35"}>
                            {f.isIdentifier ? "ID" : f.isRequired ? "Required" : "Optional"}
                          </span>
                        </span>
                      ))}
                    </div>

                    <label
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.preventDefault(); setImportFile(e.dataTransfer.files?.[0] ?? null); }}
                      className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.1] px-6 py-12 text-center transition-all hover:border-[#4A9EFF]/40 hover:bg-[#4A9EFF]/[0.03]"
                    >
                      <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} className="hidden" />
                      <div className="h-10 w-10 rounded-full glass-strong flex items-center justify-center">
                        <span className="text-[#4A9EFF] text-lg">↑</span>
                      </div>
                      <p className="font-sans text-[1rem] font-medium text-white/60">
                        {importFile ? importFile.name : "Drop a file, or click to browse"}
                      </p>
                      <p className="font-sans text-[0.82rem] text-white/40">
                        {importFile ? "Ready to import" : "CSV or Excel · columns must match above"}
                      </p>
                    </label>

                    <div className="mt-5 flex justify-end">
                      <Button size="sm" onClick={handleImportVoters} loading={importing} disabled={!importFile}>
                        Import voters
                      </Button>
                    </div>

                    {tokensResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-5 flex items-center justify-between rounded-xl border-l-2 border-[#4A9EFF] bg-[#4A9EFF]/[0.06] px-4 py-3"
                      >
                        <p className="font-sans text-[0.85rem] font-medium text-[#4A9EFF]">
                          {tokensResult.length} imported — download tokens now (shown once)
                        </p>
                        <Button size="sm" variant="success" onClick={downloadTokens}>Download CSV</Button>
                      </motion.div>
                    )}
                  </div>
                </section>
                <VoterList electionId={election.id} fields={election.voterFields} authMode={election.authMode} electionTitle={election.title} status={election.status} onChanged={refetch} />
              </div>
            )}

            {/* results */}
            {activeTab === "results" && (
              election.status === "ENDED"
                ? <ResultsPodium electionId={election.id} locked={false} />
                : <ResultsChart electionId={election.id} locked={election.status !== "ENDED"} />
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* add candidate modal */}
      <Modal
        open={addCandidateOpen}
        onClose={() => setAddCandidateOpen(false)}
        title="Add candidate"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddCandidateOpen(false)}>Cancel</Button>
            <Button variant="success" onClick={handleAddCandidate} loading={addingCandidate}>Add</Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-col gap-1.5">
            <label className="mono-label">Position</label>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="field-glass text-sm"
            >
              {election.positions.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#111]">{p.title}</option>
              ))}
            </select>
          </div>
          <Input label="Candidate name" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="Full name" required />
          <Textarea label="Description" value={candidateDesc} onChange={(e) => setCandidateDesc(e.target.value)} placeholder="Party, platform or tagline" rows={2} />
          {candidateFields.map((f) => (
            <Input
              key={f.fieldName}
              label={f.fieldLabel + (f.isRequired ? " *" : "")}
              value={candidateMeta[f.fieldName] ?? ""}
              onChange={(e) => setCandidateMeta((m) => ({ ...m, [f.fieldName]: e.target.value }))}
              placeholder={f.fieldLabel}
              required={f.isRequired}
            />
          ))}
          <div className="flex flex-col gap-2">
            <label className="mono-label">Photo</label>
            <div className="flex items-center gap-4">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Preview" className="h-16 w-16 object-cover rounded-lg" style={{ filter: "grayscale(1) contrast(1.06) brightness(0.85)" }} />
              ) : (
                <div className="h-16 w-16 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02]" />
              )}
              <div>
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
                <Button type="button" variant="secondary" size="sm" onClick={() => photoInputRef.current?.click()}>
                  {photoPreview ? "Change" : "Upload"}
                </Button>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={() => { setCandidatePhoto(null); setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ""; }}
                    className="ml-3 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-red-400"
                  >
                    Remove
                  </button>
                )}
                <p className="mt-2 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-white/25">JPG · PNG · WebP — max 2MB</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* delete election — irreversible, so require typing the title to confirm */}
      <Modal
        open={deleteConfirm}
        onClose={() => { if (!deleting) setDeleteConfirm(false); }}
        title="Delete this election?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteConfirm(false)} disabled={deleting}>Cancel</Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
              disabled={deleteText.trim() !== election.title.trim()}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-white/75">
            This permanently deletes{" "}
            <span className="font-semibold text-white">{election.title}</span>{" "}
            along with all of its positions, candidates, voters, access codes and any ballots cast. This action cannot be undone.
          </p>
          <div>
            <label className="mono-label mb-2 block">Type the election name to confirm</label>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder={election.title}
              className="field-glass text-sm"
              autoFocus
              aria-label="Type the election name to confirm deletion"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] py-4 last:border-0">
      <span className="font-sans text-sm text-white/40">{label}</span>
      <span className="font-sans text-[0.9rem] font-medium text-white/80">{value}</span>
    </div>
  );
}

function VoterList({ electionId, fields, authMode, electionTitle, status, onChanged }: { electionId: string; fields: { fieldName: string; fieldLabel: string }[]; authMode: string; electionTitle: string; status: string; onChanged: () => void }) {
  const [voters, setVoters] = useState<{ id: string; metadata: Record<string, string>; hasVoted: boolean }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  // Freshly regenerated codes, shown once. Keyed by voter id.
  const [newCodes, setNewCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null); // voterId | "bulk"
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null); // voterId pending removal
  const [clearConfirm, setClearConfirm] = useState(false);
  const { toast } = useToast();
  const isAccessCode = authMode === "ACCESS_CODE";
  // The roll is editable only during draft; once the election opens it's frozen.
  const editable = status === "DRAFT";

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/elections/${electionId}/voters`);
    if (res.ok) setVoters(await res.json());
    else toast("Failed to load voters", "error");
    setLoading(false);
  };

  const regenerateOne = async (voterId: string) => {
    setBusy(voterId);
    try {
      const res = await fetch(`/api/elections/${electionId}/voters/${voterId}/regenerate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { setNewCodes((m) => ({ ...m, [voterId]: data.token })); toast("New access code generated", "success"); }
      else toast(data.error ?? "Could not regenerate", "error");
    } catch { toast("Could not regenerate", "error"); }
    finally { setBusy(null); }
  };

  const regenerateAll = async () => {
    setBusy("bulk");
    try {
      const res = await fetch(`/api/elections/${electionId}/voters/regenerate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const map: Record<string, string> = {};
        for (const r of data.tokens as { voterId: string; token: string }[]) map[r.voterId] = r.token;
        setNewCodes((m) => ({ ...m, ...map }));
        toast(`Regenerated ${data.regenerated} codes`, "success");
      } else toast(data.error ?? "Bulk regeneration failed", "error");
    } catch { toast("Bulk regeneration failed", "error"); }
    finally { setBusy(null); setBulkConfirm(false); }
  };

  const downloadNewCodes = () => {
    if (!voters) return;
    const rows: (string | number)[][] = [["Access code", ...fields.map((f) => f.fieldLabel)]];
    for (const v of voters) {
      if (!newCodes[v.id]) continue;
      rows.push([newCodes[v.id], ...fields.map((f) => v.metadata[f.fieldName] ?? "")]);
    }
    downloadCsv(`${electionTitle}-regenerated-codes.csv`, rows);
  };

  const removeVoter = async (voterId: string) => {
    setBusy(voterId);
    try {
      const res = await fetch(`/api/elections/${electionId}/voters/${voterId}`, { method: "DELETE" });
      if (res.ok) {
        setVoters((vs) => (vs ? vs.filter((v) => v.id !== voterId) : vs));
        toast("Voter removed", "success");
        onChanged();
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error ?? "Could not remove voter", "error");
      }
    } catch { toast("Could not remove voter", "error"); }
    finally { setBusy(null); setRemoveConfirm(null); }
  };

  const clearRoll = async () => {
    setBusy("bulk");
    try {
      const res = await fetch(`/api/elections/${electionId}/voters`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setVoters([]);
        setNewCodes({});
        toast(`Cleared ${data.cleared} voter${data.cleared === 1 ? "" : "s"}`, "success");
        onChanged();
      } else toast(data.error ?? "Could not clear voter roll", "error");
    } catch { toast("Could not clear voter roll", "error"); }
    finally { setBusy(null); setClearConfirm(false); }
  };

  if (!voters) {
    return (
      <section className="glass rounded-2xl flex flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8 sm:py-7">
        <div>
          <h3 className="font-sans font-semibold text-lg text-white">Voter roll</h3>
          <p className="mt-2 text-sm text-white/60">Hidden by default for privacy.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={load} loading={loading}>Load roll</Button>
      </section>
    );
  }

  const votedCount = voters.filter((v) => v.hasVoted).length;
  const filtered = query.trim()
    ? voters.filter((v) => Object.values(v.metadata).some((val) => String(val).toLowerCase().includes(query.toLowerCase())))
    : voters;
  const regeneratedCount = Object.keys(newCodes).length;
  const removingVoter = removeConfirm ? voters.find((v) => v.id === removeConfirm) ?? null : null;
  const removingLabel = removingVoter
    ? (fields.map((f) => removingVoter.metadata[f.fieldName]).find(Boolean) ?? "this voter")
    : "this voter";

  return (
    <>
    <section className="glass rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-6 border-b border-white/[0.07]">
        <div className="flex items-center gap-6">
          <h3 className="font-sans font-semibold text-lg text-white">
            Voter roll
            <span className="ml-2 font-mono text-sm tabular-nums text-white/35">{voters.length}</span>
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4A9EFF]/25 bg-[#4A9EFF]/[0.08] px-2.5 py-1 font-sans text-[0.78rem] font-medium text-[#4A9EFF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4A9EFF]" />{votedCount} voted
          </span>
          <span className="font-sans text-[0.82rem] text-white/45">{voters.length - votedCount} pending</span>
        </div>
        <div className="flex items-center gap-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search voters"
            className="field-glass w-44 !py-1.5 text-[0.85rem]"
          />
          {isAccessCode && (
            <Button size="sm" variant="secondary" onClick={() => setBulkConfirm(true)} disabled={busy !== null || voters.length === 0}>
              Regenerate all codes
            </Button>
          )}
          {editable && (
            <Button size="sm" variant="secondary" onClick={() => setClearConfirm(true)} disabled={busy !== null || voters.length === 0}>
              Clear voter roll
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={load} loading={loading}>Refresh</Button>
        </div>
      </div>

      {!editable && (
        <div className="border-b border-white/[0.07] bg-white/[0.02] px-5 py-3 sm:px-8">
          <p className="font-sans text-[0.82rem] text-white/45">
            The voter roll is locked — voters cannot be removed after the election has opened.
          </p>
        </div>
      )}

      {isAccessCode && regeneratedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-[#4A9EFF]/[0.06] px-5 py-3 sm:px-8">
          <p className="font-sans text-[0.85rem] font-medium text-[#4A9EFF]">
            {regeneratedCount} new code{regeneratedCount > 1 ? "s" : ""} — shown once, download to distribute
          </p>
          <Button size="sm" variant="success" onClick={downloadNewCodes}>Download CSV</Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.07]">
              {fields.map((f) => (
                <th key={f.fieldName} className="px-6 py-3.5 text-left font-sans text-[0.78rem] font-semibold text-white/55">
                  {f.fieldLabel}
                </th>
              ))}
              <th className="px-6 py-3.5 text-left font-sans text-[0.78rem] font-semibold text-white/55">Status</th>
              {isAccessCode && <th className="px-6 py-3.5 text-right font-sans text-[0.78rem] font-semibold text-white/55">Access code</th>}
              {editable && <th className="px-6 py-3.5 text-right font-sans text-[0.78rem] font-semibold text-white/55">Remove</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                {fields.map((f) => (
                  <td key={f.fieldName} className="px-6 py-3.5 font-sans text-[0.88rem] text-white/75">
                    {v.metadata[f.fieldName] ?? "—"}
                  </td>
                ))}
                <td className="px-6 py-3.5">
                  {v.hasVoted ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4A9EFF]/25 bg-[#4A9EFF]/[0.08] px-2.5 py-1 font-sans text-[0.75rem] font-medium text-[#4A9EFF]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4A9EFF]" />Voted
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-sans text-[0.75rem] font-medium text-white/45">
                      Pending
                    </span>
                  )}
                </td>
                {isAccessCode && (
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    {newCodes[v.id] ? (
                      <button
                        onClick={() => { navigator.clipboard.writeText(newCodes[v.id]); toast("Code copied", "success"); }}
                        title="Click to copy"
                        className="font-mono text-[0.82rem] tracking-[0.16em] text-[#4A9EFF] hover:text-[#7DC4FF]"
                      >
                        {newCodes[v.id]} ⧉
                      </button>
                    ) : (
                      <button
                        onClick={() => regenerateOne(v.id)}
                        disabled={busy !== null}
                        className="font-sans text-[0.78rem] font-medium text-white/45 hover:text-[#4A9EFF] disabled:opacity-40 transition-colors"
                      >
                        {busy === v.id ? "…" : "Regenerate"}
                      </button>
                    )}
                  </td>
                )}
                {editable && (
                  <td className="px-6 py-3.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => setRemoveConfirm(v.id)}
                      disabled={busy !== null}
                      className="font-sans text-[0.78rem] font-medium text-white/55 hover:text-red-400 disabled:opacity-40 transition-colors"
                    >
                      {busy === v.id ? "…" : "Remove"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    {/* regenerate every access code */}
    <Modal
      open={bulkConfirm}
      onClose={() => setBulkConfirm(false)}
      title="Regenerate all access codes?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setBulkConfirm(false)} disabled={busy === "bulk"}>Cancel</Button>
          <Button variant="primary" onClick={regenerateAll} loading={busy === "bulk"}>Regenerate all</Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-white/75">
        This issues a brand-new code for every one of the{" "}
        <span className="font-semibold text-white">{voters.length}</span> voters on this roll.
        Any codes you have already shared will <span className="font-semibold text-white">stop working</span> immediately.
        The new codes are shown once here — download them afterwards to redistribute.
      </p>
    </Modal>

    {/* clear the entire voter roll */}
    <Modal
      open={clearConfirm}
      onClose={() => setClearConfirm(false)}
      title="Clear the voter roll?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setClearConfirm(false)} disabled={busy === "bulk"}>Cancel</Button>
          <Button variant="danger" onClick={clearRoll} loading={busy === "bulk"}>Yes, clear roll</Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-white/75">
        This removes all{" "}
        <span className="font-semibold text-white">{voters.length}</span>{" "}
        voters and their access codes from this election. This cannot be undone — you would need to re-import the list.
        The roll can only be cleared while the election is still in draft.
      </p>
    </Modal>

    {/* remove a single voter */}
    <Modal
      open={removeConfirm !== null}
      onClose={() => setRemoveConfirm(null)}
      title="Remove this voter?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setRemoveConfirm(null)} disabled={busy !== null}>Cancel</Button>
          <Button variant="danger" onClick={() => removeConfirm && removeVoter(removeConfirm)} loading={busy !== null && busy === removeConfirm}>Remove voter</Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-white/75">
        This removes{" "}
        <span className="font-semibold text-white">{removingLabel}</span>{" "}
        from the voter roll along with their access code. This cannot be undone.
      </p>
    </Modal>
    </>
  );
}
