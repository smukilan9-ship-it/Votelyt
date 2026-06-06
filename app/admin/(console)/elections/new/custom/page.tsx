"use client";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/Toast";
import { ChevronLeft, ChevronRight, Plus, X, Check, KeyRound, ShieldCheck, HelpCircle } from "lucide-react";
import { getTemplate } from "@/lib/templates";

interface FieldDef { fieldName: string; fieldLabel: string; isRequired: boolean; }
interface RestrictionRule { field: string; value: string; }
interface PositionDef { title: string; description: string; maxWinners: number; maxVotes: number; rules: RestrictionRule[]; }
interface CandFieldDef { fieldName: string; fieldLabel: string; isRequired: boolean; }

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

const key = (s: string) => s.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

function BuilderInner() {
  const router = useRouter();
  const { toast } = useToast();
  const params = useSearchParams();
  const tpl = useMemo(() => {
    const id = params.get("template");
    return id ? getTemplate(id) : undefined;
  }, [params]);
  const fixed = tpl?.fixed ?? false;

  const STEPS = fixed
    ? ["Details", "Review"]
    : ["Details", "Voter fields", "Identifiers", "Positions", "Candidates", "Review"];

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  // form state — prefilled from template if present
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [authMode, setAuthMode] = useState<"ACCESS_CODE" | "TWO_FIELDS">(tpl?.config.authMode ?? "ACCESS_CODE");
  const [allowAbstain, setAllowAbstain] = useState(tpl?.config.allowAbstain ?? true);
  const [fields, setFields] = useState<FieldDef[]>(
    tpl?.config.voterFields.map((f) => ({ fieldName: f.fieldName, fieldLabel: f.fieldLabel, isRequired: f.isRequired })) ?? [
      { fieldName: "email", fieldLabel: "Email", isRequired: true },
      { fieldName: "name", fieldLabel: "Full Name", isRequired: true },
    ]
  );
  const [primary, setPrimary] = useState<string>(tpl?.config.primaryIdentifier ?? "");
  const [secondary, setSecondary] = useState<string>(tpl?.config.secondaryIdentifier ?? "");
  const [positions, setPositions] = useState<PositionDef[]>(
    tpl?.config.positions.map((p) => ({ title: p.title, description: p.description ?? "", maxWinners: p.maxWinners, maxVotes: p.maxVotes, rules: p.rules })) ?? [
      { title: "", description: "", maxWinners: 1, maxVotes: 1, rules: [] },
    ]
  );
  const [candFields, setCandFields] = useState<CandFieldDef[]>(
    tpl?.config.candidateFields.map((c) => ({ fieldName: c.fieldName, fieldLabel: c.fieldLabel, isRequired: c.isRequired })) ?? []
  );

  const navigate = (next: number) => { setDirection(next > step ? 1 : -1); setStep(next); };

  // field helpers
  const addField = () => setFields((f) => [...f, { fieldName: "", fieldLabel: "", isRequired: true }]);
  const removeField = (i: number) => setFields((f) => {
    const removed = f[i].fieldName;
    if (removed === primary) setPrimary("");
    if (removed === secondary) setSecondary("");
    return f.filter((_, idx) => idx !== i);
  });
  const updateField = (i: number, k: keyof FieldDef, v: string | boolean) =>
    setFields((f) => f.map((fld, idx) => (idx === i ? { ...fld, [k]: v } : fld)));

  // position helpers
  const addPosition = () => setPositions((p) => [...p, { title: "", description: "", maxWinners: 1, maxVotes: 1, rules: [] }]);
  const removePosition = (i: number) => setPositions((p) => p.filter((_, idx) => idx !== i));
  const updatePosition = (i: number, k: keyof PositionDef, v: string | number) =>
    setPositions((p) => p.map((pos, idx) => (idx === i ? { ...pos, [k]: v } : pos)));
  const addRule = (i: number) => setPositions((p) => p.map((pos, idx) => idx === i ? { ...pos, rules: [...pos.rules, { field: "", value: "" }] } : pos));
  const updateRule = (pi: number, ri: number, k: "field" | "value", val: string) =>
    setPositions((p) => p.map((pos, i) => i !== pi ? pos : { ...pos, rules: pos.rules.map((r, j) => j === ri ? { ...r, [k]: val } : r) }));
  const removeRule = (pi: number, ri: number) =>
    setPositions((p) => p.map((pos, i) => i !== pi ? pos : { ...pos, rules: pos.rules.filter((_, j) => j !== ri) }));

  // candidate field helpers
  const addCand = () => setCandFields((c) => [...c, { fieldName: "", fieldLabel: "", isRequired: false }]);
  const removeCand = (i: number) => setCandFields((c) => c.filter((_, idx) => idx !== i));
  const updateCand = (i: number, k: keyof CandFieldDef, v: string | boolean) =>
    setCandFields((c) => c.map((cf, idx) => (idx === i ? { ...cf, [k]: v } : cf)));

  const namedFields = fields.filter((f) => f.fieldName.trim());

  // per-step gate so the user can't skip a broken step
  const stepValid = (s: number): true | string => {
    if (fixed) return title.trim() ? true : "Give the election a title";
    if (s === 0) return title.trim() ? true : "Give the election a title";
    if (s === 1) {
      if (namedFields.length === 0) return "Add at least one voter field";
      if (fields.some((f) => !f.fieldName.trim() || !f.fieldLabel.trim())) return "Every field needs a key and a label";
      return true;
    }
    if (s === 2) {
      if (!primary) return "Choose a primary identifier";
      if (authMode === "TWO_FIELDS") {
        if (!secondary) return "Two-field login needs a second field";
        if (secondary === primary) return "Secondary must differ from primary";
      }
      return true;
    }
    if (s === 3) return positions.some((p) => p.title.trim()) ? true : "Add at least one position";
    return true;
  };

  const next = () => {
    const v = stepValid(step);
    if (v !== true) return toast(v, "error");
    navigate(step + 1);
  };

  const handleSubmit = async () => {
    for (let s = 0; s < STEPS.length - 1; s++) {
      const v = stepValid(s);
      if (v !== true) { navigate(s); return toast(v, "error"); }
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = fixed
        ? { title, description, template: "SCHOOL", authMode, allowAbstain }
        : {
            title, description, template: "GENERIC", authMode, allowAbstain,
            authFields: authMode === "TWO_FIELDS" ? [primary, secondary] : [],
            voterFields: fields.map((f) => ({ fieldName: f.fieldName, fieldLabel: f.fieldLabel, isIdentifier: f.fieldName === primary, isRequired: f.isRequired })),
            positions: positions.filter((p) => p.title.trim()).map((p) => {
              const restrictions: Record<string, string> = {};
              p.rules.filter((r) => r.field.trim() && r.value.trim()).forEach((r) => { restrictions[key(r.field)] = r.value.trim(); });
              return { title: p.title, description: p.description, maxWinners: p.maxWinners, maxVotes: p.maxVotes, restrictions };
            }),
            candidateFields: candFields.filter((c) => c.fieldName.trim() && c.fieldLabel.trim()).map((c) => ({ fieldName: c.fieldName, fieldLabel: c.fieldLabel, isRequired: c.isRequired })),
          };
      const res = await fetch("/api/elections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        const data = await res.json();
        toast("Election created", "success");
        router.push(`/admin/elections/${data.id}`);
      } else {
        const { error } = await res.json().catch(() => ({ error: "Failed" }));
        toast(error ?? "Failed to create election", "error");
      }
    } catch {
      toast("Failed to create election", "error");
    } finally {
      setLoading(false);
    }
  };

  const isReview = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-28">
      <motion.div initial={{ opacity: 0, filter: "blur(6px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.6 }}>
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-white/35 mb-5">
          Console · create{tpl ? ` · ${tpl.name}` : " · custom"}
        </p>
        <h1 className="mb-12 font-sans font-extrabold tracking-tight leading-[1.05] text-white" style={{ fontSize: "clamp(2.6rem, 7vw, 4.8rem)" }}>
          {fixed ? "Quick setup." : "Build it."}
        </h1>
      </motion.div>

      {/* step indicator */}
      <div className="mb-14 flex flex-wrap items-center gap-x-3 gap-y-2">
        {STEPS.map((label, i) => (
          <button key={label} onClick={() => i < step && navigate(i)} className="flex items-center gap-2 group">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-all text-[0.8rem] font-mono ${
              i < step ? "accent-gradient text-white cursor-pointer" : i === step ? "border-2 border-[#4A9EFF] text-[#4A9EFF]" : "border border-white/[0.12] text-white/35"}`}>
              {i < step ? <Check size={13} /> : i + 1}
            </div>
            <span className={`font-sans font-medium text-[0.85rem] tracking-tight ${i === step ? "text-white" : i < step ? "text-[#4A9EFF]" : "text-white/35"}`}>{label}</span>
            {i < STEPS.length - 1 && <div className={`mx-1 h-px w-6 ${i < step ? "accent-gradient" : "bg-white/[0.1]"}`} />}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden" style={{ minHeight: 460 }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div key={step} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }} className="space-y-10">

            {STEPS[step] === "Details" && (
              <>
                <Section n="01" title="Details">
                  <div className="space-y-5">
                    <Labeled label="Election title"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Student Council 2026" className="field-glass" /></Labeled>
                    <Labeled label="Description"><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description…" className="field-glass resize-none" /></Labeled>
                  </div>
                </Section>
                <Section n="02" title="Voter login">
                  <div className="grid grid-cols-2 gap-3">
                    <Choice active={authMode === "ACCESS_CODE"} onClick={() => setAuthMode("ACCESS_CODE")} title="Access code" body="System-generated 6-character token per voter." />
                    <Choice active={authMode === "TWO_FIELDS"} onClick={() => setAuthMode("TWO_FIELDS")} title="Two fields" body={fixed ? "Voters log in with ID Number + Enrollment ID." : "Voters log in with two fields from their record."} />
                  </div>
                </Section>
                <Section n="03" title="Abstaining">
                  <div className="grid grid-cols-2 gap-3">
                    <Choice active={allowAbstain} onClick={() => setAllowAbstain(true)} title="Allowed" body="Voters may submit a blank ballot." />
                    <Choice active={!allowAbstain} onClick={() => setAllowAbstain(false)} title="Not allowed" body="At least one vote is required." />
                  </div>
                </Section>
                {fixed && (
                  <div className="glass rounded-xl p-5 text-sm text-white/55">
                    <p className="mb-2 font-medium text-white">Preset structure</p>
                    This template ships with house-restricted Boy &amp; Girl captains per house plus global Sports captains, and the standard school voter fields (ID Number, House, Enrollment ID…). The structure is locked, but the <span className="text-white">login method</span> and <span className="text-white">abstaining</span> above are yours to set — pick <span className="text-[#7DC4FF]">Two fields</span> for ID Number + Enrollment ID login, or <span className="text-[#7DC4FF]">Access code</span> for system-generated tokens.
                  </div>
                )}
              </>
            )}

            {STEPS[step] === "Voter fields" && (
              <Section n="04" title="Voter fields" action={<GhostAdd onClick={addField}><Plus size={12} /><span>Add field</span></GhostAdd>}>
                <p className="mb-4 text-sm text-white/45">Define the columns in your voter list. You&apos;ll pick the identifiers in the next step.</p>
                <div className="space-y-2">
                  {fields.map((f, i) => (
                    <div key={i} className="glass rounded-xl p-4 grid grid-cols-12 items-end gap-3">
                      <div className="col-span-12 sm:col-span-4">
                        <label className="mono-label mb-1 block">Key</label>
                        <input value={f.fieldName} onChange={(e) => updateField(i, "fieldName", key(e.target.value))} placeholder="roll_no" className="field-glass text-sm" />
                      </div>
                      <div className="col-span-8 sm:col-span-5">
                        <label className="mono-label mb-1 block">Label</label>
                        <input value={f.fieldLabel} onChange={(e) => updateField(i, "fieldLabel", e.target.value)} placeholder="Roll Number" className="field-glass text-sm" />
                      </div>
                      <div className="col-span-3 sm:col-span-2 pb-2">
                        <button type="button" onClick={() => updateField(i, "isRequired", !f.isRequired)} className="font-mono text-[0.58rem] uppercase tracking-[0.14em]" style={{ color: f.isRequired ? "#89AACC" : "rgba(255,255,255,0.3)" }}>
                          {f.isRequired ? "● Required" : "Optional"}
                        </button>
                      </div>
                      <div className="col-span-1 flex justify-end pb-2">
                        <button type="button" onClick={() => removeField(i)} disabled={fields.length === 1} className="text-white/40 hover:text-destructive disabled:opacity-30"><X size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {STEPS[step] === "Identifiers" && (
              <Section n="05" title="Identifiers">
                <p className="mb-6 text-sm text-white/45">Now choose which fields identify a voter. The <span className="text-white">primary identifier must be unique</span> — the system rejects duplicates on import.</p>
                <div className="space-y-5">
                  <IdentifierPicker
                    icon={<KeyRound size={15} />}
                    label="Primary identifier"
                    hint="Required · must be unique (e.g. Student ID, Employee ID)"
                    value={primary}
                    onChange={setPrimary}
                    options={namedFields}
                    required
                  />
                  <IdentifierPicker
                    icon={<ShieldCheck size={15} />}
                    label="Secondary identifier"
                    hint={authMode === "TWO_FIELDS" ? "Required for two-field login · used as the second login field" : "Optional but recommended · helps prevent accidental duplicates"}
                    value={secondary}
                    onChange={setSecondary}
                    options={namedFields.filter((f) => f.fieldName !== primary)}
                    required={authMode === "TWO_FIELDS"}
                    allowNone={authMode !== "TWO_FIELDS"}
                  />
                  {primary && (
                    <div className="glass rounded-xl p-4 text-[0.82rem] text-white/55">
                      <span className="text-[#4A9EFF]">●</span> Voters will be de-duplicated on <span className="font-mono text-[#7DC4FF]">{primary}</span>
                      {authMode === "TWO_FIELDS" && secondary && <> and log in with <span className="font-mono text-[#7DC4FF]">{primary}</span> + <span className="font-mono text-[#7DC4FF]">{secondary}</span></>}.
                    </div>
                  )}
                </div>
              </Section>
            )}

            {STEPS[step] === "Positions" && (
              <Section n="06" title="Positions & roles" action={<GhostAdd onClick={addPosition}><Plus size={12} /><span>Add position</span></GhostAdd>}>
                <p className="mb-3 text-sm text-white/45">A position is a seat people vote for (e.g. President). Add eligibility rules to limit it to specific voters (e.g. house = Atri); leave empty for open to all.</p>
                <div className="mb-5 glass rounded-xl p-4 text-[0.8rem] leading-relaxed text-white/55">
                  <p><span className="font-mono text-[#7DC4FF]">Votes</span> — the <span className="text-white">maximum candidates one voter may tick</span> on their ballot for this position. Set it to the number of selections you allow each person to make.</p>
                  <p className="mt-1"><span className="font-mono text-[#7DC4FF]">Winners</span> — how many candidates are actually elected — the top N by vote count once polls close.</p>
                  <p className="mt-2.5 border-t border-white/[0.06] pt-2.5 text-white/40">
                    <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-white/30">Example</span>{" "}
                    A single President seat → <span className="text-[#7DC4FF]">1 vote · 1 winner</span>. A committee where each voter picks 3 and the top 5 are elected → <span className="text-[#7DC4FF]">3 votes · 5 winners</span>.
                  </p>
                </div>
                <div className="space-y-3">
                  {positions.map((p, i) => (
                    <div key={i} className="glass rounded-xl p-5 space-y-4">
                      <div className="grid grid-cols-12 items-end gap-3">
                        <div className="col-span-12 sm:col-span-6"><label className="mono-label mb-1 block">Title</label><input value={p.title} onChange={(e) => updatePosition(i, "title", e.target.value)} placeholder="President" className="field-glass text-sm" /></div>
                        <div className="col-span-4 sm:col-span-2"><LabelTip label="Votes" tip="Max candidates one voter may select for this seat. Use 1 for a single choice, or a higher number to let each voter pick several." /><input type="number" min={1} value={p.maxVotes} onChange={(e) => updatePosition(i, "maxVotes", parseInt(e.target.value) || 1)} className="field-glass text-sm text-center" /></div>
                        <div className="col-span-4 sm:col-span-2"><LabelTip label="Winners" tip="How many candidates get elected — the top N by vote count when polls close." /><input type="number" min={1} value={p.maxWinners} onChange={(e) => updatePosition(i, "maxWinners", parseInt(e.target.value) || 1)} className="field-glass text-sm text-center" /></div>
                        <div className="col-span-4 sm:col-span-2 flex justify-end pb-2"><button type="button" onClick={() => removePosition(i)} disabled={positions.length === 1} className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-white/40 hover:text-destructive disabled:opacity-30">Remove</button></div>
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-white/40">Eligibility{p.rules.length === 0 && " · open to all"}</span>
                          <GhostAdd onClick={() => addRule(i)}><Plus size={10} /><span>Rule</span></GhostAdd>
                        </div>
                        {p.rules.map((rule, j) => (
                          <div key={j} className="mb-2 flex items-center gap-2">
                            <input value={rule.field} onChange={(e) => updateRule(i, j, "field", key(e.target.value))} placeholder="field" className="field-glass flex-1 text-xs" />
                            <span className="text-white/40 text-sm">=</span>
                            <input value={rule.value} onChange={(e) => updateRule(i, j, "value", e.target.value)} placeholder="value" className="field-glass flex-1 text-xs" />
                            <button type="button" onClick={() => removeRule(i, j)} className="text-white/40 hover:text-destructive shrink-0"><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {STEPS[step] === "Candidates" && (
              <Section n="07" title="Candidate fields" action={<GhostAdd onClick={addCand}><Plus size={12} /><span>Add field</span></GhostAdd>}>
                <p className="mb-4 text-sm text-white/45">Optional extra fields captured for each candidate (beyond name &amp; photo) — e.g. manifesto, bio, department.</p>
                {candFields.length === 0 && <p className="glass rounded-xl p-5 text-sm text-white/40">No custom candidate fields. Candidates will have a name, description and photo by default.</p>}
                <div className="space-y-2">
                  {candFields.map((c, i) => (
                    <div key={i} className="glass rounded-xl p-4 grid grid-cols-12 items-end gap-3">
                      <div className="col-span-12 sm:col-span-4"><label className="mono-label mb-1 block">Key</label><input value={c.fieldName} onChange={(e) => updateCand(i, "fieldName", key(e.target.value))} placeholder="manifesto" className="field-glass text-sm" /></div>
                      <div className="col-span-8 sm:col-span-5"><label className="mono-label mb-1 block">Label</label><input value={c.fieldLabel} onChange={(e) => updateCand(i, "fieldLabel", e.target.value)} placeholder="Manifesto" className="field-glass text-sm" /></div>
                      <div className="col-span-3 sm:col-span-2 pb-2"><button type="button" onClick={() => updateCand(i, "isRequired", !c.isRequired)} className="font-mono text-[0.58rem] uppercase tracking-[0.14em]" style={{ color: c.isRequired ? "#89AACC" : "rgba(255,255,255,0.3)" }}>{c.isRequired ? "● Required" : "Optional"}</button></div>
                      <div className="col-span-1 flex justify-end pb-2"><button type="button" onClick={() => removeCand(i)} className="text-white/40 hover:text-destructive"><X size={13} /></button></div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {STEPS[step] === "Review" && (
              <div className="space-y-10">
                <div>
                  <h2 className="font-sans font-bold text-2xl text-white mb-6">Summary</h2>
                  <div className="divide-y divide-white/[0.07]">
                    <Row label="Title" value={title || "—"} />
                    <Row label="Type" value={fixed ? "School (Fixed)" : tpl ? tpl.name : "Custom"} />
                    <Row label="Login" value={authMode === "ACCESS_CODE" ? "Access code" : "Two fields"} />
                    <Row label="Abstaining" value={allowAbstain ? "Allowed" : "Not allowed"} />
                    {!fixed && <>
                      <Row label="Voter fields" value={`${namedFields.length} defined`} />
                      <Row label="Primary ID" value={primary || "—"} />
                      <Row label="Secondary ID" value={secondary || "—"} />
                      <Row label="Positions" value={`${positions.filter((p) => p.title.trim()).length} defined`} />
                      <Row label="Candidate fields" value={`${candFields.filter((c) => c.fieldName.trim()).length} defined`} />
                    </>}
                  </div>
                </div>
                {!fixed && positions.filter((p) => p.title.trim()).length > 0 && (
                  <div>
                    <h2 className="font-sans font-bold text-2xl text-white mb-6">Positions</h2>
                    <div className="divide-y divide-white/[0.07]">
                      {positions.filter((p) => p.title.trim()).map((p, i) => (
                        <div key={i} className="flex items-center gap-5 py-4">
                          <span className="font-mono text-[0.65rem] text-white/25 w-6">{String(i + 1).padStart(2, "0")}</span>
                          <span className="font-sans font-medium text-[1.05rem] flex-1 text-white">{p.title}</span>
                          {Object.keys(p.rules.filter((r) => r.field && r.value)).length > 0 && <span className="font-mono text-[0.62rem] text-[#7DC4FF]">restricted</span>}
                          <span className="font-mono text-[0.65rem] text-white/35">{p.maxVotes}v · {p.maxWinners}w</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-14 flex items-center justify-between border-t border-white/[0.08] pt-8">
        <button type="button" onClick={() => step > 0 ? navigate(step - 1) : router.push("/admin/elections/new")} className="flex items-center gap-2 rounded-full px-5 py-3 font-sans font-medium text-[0.9rem] text-white/55 hover:text-white hover:bg-white/[0.05] transition-all">
          <ChevronLeft size={18} />{step > 0 ? "Back" : "Cancel"}
        </button>
        {!isReview ? (
          <button type="button" onClick={next} className="flex items-center gap-2 rounded-full bg-white/[0.08] border border-white/[0.12] px-8 py-3 font-sans font-semibold text-[0.9rem] text-white hover:bg-white/[0.12] hover:border-[#4A9EFF]/50 transition-all">
            Next <ChevronRight size={18} />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 rounded-full bg-[#4A9EFF] px-9 py-3.5 font-sans font-semibold text-[0.95rem] text-black hover:bg-[#7DC4FF] disabled:opacity-50 transition-all">
            {loading ? "Creating…" : "Create election"} <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function CustomBuilderPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-8 py-32 text-white/40">Loading…</div>}>
      <BuilderInner />
    </Suspense>
  );
}

/* ── sub-components ──────────────────────────────────────── */
function Section({ n, title, action, children }: { n: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between border-b border-white/[0.06] pb-3">
        <div className="flex items-baseline gap-3"><span className="font-mono text-[0.62rem] text-white/40">{n}</span><h2 className="font-sans font-semibold text-[1.2rem] tracking-tight text-white">{title}</h2></div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Choice({ active, onClick, title, body, disabled }: { active: boolean; onClick: () => void; title: string; body: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`relative rounded-xl p-5 text-left transition-all ${active ? "glass-strong" : "glass hover:bg-white/[0.04]"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`} style={active ? { borderColor: "rgba(137,170,204,0.35)" } : undefined}>
      {active && <div className="absolute top-3 right-3 h-4 w-4 rounded-full accent-gradient flex items-center justify-center"><Check size={8} color="white" /></div>}
      <p className="font-sans font-semibold text-[1rem] mb-1.5" style={{ color: active ? "#4A9EFF" : "#fff" }}>{title}</p>
      <p className="text-xs text-white/45">{body}</p>
    </button>
  );
}
function LabelTip({ label, tip }: { label: string; tip: string }) {
  return (
    <div className="mb-1 flex items-center gap-1">
      <label className="mono-label">{label}</label>
      <span tabIndex={0} role="note" aria-label={tip} className="group relative inline-flex cursor-help text-white/30 hover:text-[#7DC4FF] focus:text-[#7DC4FF] focus:outline-none">
        <HelpCircle size={11} />
        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-lg border border-white/[0.1] bg-[#0c0c0e] px-3 py-2 text-[0.72rem] normal-case leading-snug tracking-normal text-white/70 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
          {tip}
        </span>
      </span>
    </div>
  );
}
function GhostAdd({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-1 glass rounded-full px-3 py-1 font-mono text-[0.58rem] uppercase tracking-[0.16em] text-white/45 hover:text-white transition-colors">{children}</button>;
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mono-label mb-2 block">{label}</label>{children}</div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-4"><span className="font-sans text-[0.95rem] text-white/45">{label}</span><span className="font-mono text-[0.85rem] tracking-[0.05em] text-white">{value}</span></div>;
}
function IdentifierPicker({ icon, label, hint, value, onChange, options, required, allowNone }: { icon: React.ReactNode; label: string; hint: string; value: string; onChange: (v: string) => void; options: { fieldName: string; fieldLabel: string }[]; required?: boolean; allowNone?: boolean }) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-[#4A9EFF]">{icon}</span>
        <span className="font-sans font-semibold text-[0.95rem] text-white">{label}</span>
        {required && <span className="font-mono text-[0.55rem] uppercase tracking-[0.14em] text-[#FF9F6C]">required</span>}
      </div>
      <p className="mb-4 text-[0.78rem] text-white/40">{hint}</p>
      {options.length === 0 ? (
        <p className="text-[0.8rem] text-white/35">Add voter fields first.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allowNone && (
            <button type="button" onClick={() => onChange("")} className={`rounded-full px-3.5 py-1.5 text-[0.8rem] font-medium transition-all ${value === "" ? "bg-[#4A9EFF] text-black" : "glass text-white/55 hover:text-white"}`}>None</button>
          )}
          {options.map((o) => (
            <button key={o.fieldName} type="button" onClick={() => onChange(o.fieldName)} className={`rounded-full px-3.5 py-1.5 text-[0.8rem] font-medium transition-all ${value === o.fieldName ? "bg-[#4A9EFF] text-black" : "glass text-white/55 hover:text-white"}`}>
              {o.fieldLabel || o.fieldName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
