import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Camera, Languages, Utensils, MessageCircle, Wrench, Mic, Stamp, PenLine, Briefcase,
  ShieldCheck, ShieldAlert, Search, MapPin, Wifi, Clock, Coins, Sparkles, Check,
  Plus, X, GraduationCap, FileUp, Award, ArrowRight, TrendingUp, Flame, Mountain, CalendarCheck, CalendarX, Shuffle, ChevronDown, Linkedin, FileText, Database, Microscope, FlaskConical
} from "lucide-react";

/* ===================== shared logic ===================== */
const WEIGHTS = { skills: 0.4, location: 0.15, experience: 0.15, availability: 0.15, reputation: 0.15 };
const COURSE = { spanish: ["spanish", "translation"], "creative writing": ["writing"], "intro to photography": ["photography"] };
const clamp = (n) => Math.max(0, Math.min(1, n));
const norm = (s) => String(s || "").trim().toLowerCase();
function effSkills(p) {
  const s = new Set((p.skills || []).map(norm));
  (p.certifications || []).forEach((c) => s.add(norm(c)));
  for (const c of p.coursework || []) (COURSE[norm(c)] || []).forEach((x) => s.add(x));
  return s;
}
function scoreTask(p, t) {
  const have = effSkills(p), need = (t.skills || []).map(norm);
  const matched = need.filter((s) => have.has(s)), missing = need.filter((s) => !have.has(s));
  const skills = need.length ? matched.length / need.length : 0;
  let location;
  if (t.remote) location = 1;
  else if (p.anyLocation) location = 1;
  else { const locs = [p.location, ...(p.locations || [])].map(norm); location = locs.includes(norm(t.location)) ? 1 : p.remoteOk ? 0.35 : 0.1; }
  const experience = (p.years || 0) >= (t.minYears || 0) ? 1 : clamp(1 - ((t.minYears || 0) - (p.years || 0)) / 4);
  const availability = t.schedule === "async" || t.schedule === "flexible" ? 1 : clamp((p.hoursPerWeek || 0) / (t.timeCommitmentHours || 1));
  const reputation = clamp((p.reputation || 0) / 100), gated = (p.reputation || 0) < (t.minReputation || 0);
  let total = WEIGHTS.skills * skills + WEIGHTS.location * location + WEIGHTS.experience * experience + WEIGHTS.availability * availability + WEIGHTS.reputation * reputation;
  if (gated) total *= 0.55;
  const cat = TASK_CAT[t.id];
  if (p.categories && p.categories.length && cat && p.categories.includes(cat)) total = Math.min(1, total + 0.06);
  if (p.wants) { const ws = p.wants.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3); const hay = `${t.title} ${t.skills.join(" ")} ${cat || ""}`.toLowerCase(); if (ws.some((w) => hay.includes(w))) total = Math.min(1, total + 0.04); }
  return { total: Math.round(total * 100), matched, missing, gated };
}
const RED = [/\b(password|credential|verification code|otp|sms code)\b/i, /\b(pretend to be|impersonate|pose as)\b/i, /\b(bypass|launder|fake id|forged)\b/i];
const isRefuse = (t) => RED.some((r) => r.test(`${t.title} ${t.desc}`));

const SKILL_DICT = ["photography", "navigation", "reliability", "writing", "driving", "empathy", "listening", "spanish", "translation", "palate", "manual-dexterity", "voice", "notary"];
const COURSE_DICT = ["spanish", "creative writing", "statistics", "intro to photography", "chemistry"];
const CITIES = ["denver", "boulder", "san francisco", "austin", "new york"];
const tcase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
function parseResume(text) {
  const t = text.toLowerCase();
  const skills = SKILL_DICT.filter((s) => t.includes(s)), coursework = COURSE_DICT.filter((c) => t.includes(c));
  const city = CITIES.find((c) => t.includes(c)), h = t.match(/(\d{1,2})\s*(hrs|hours|h)\b/), y = t.match(/(\d{1,2})\s*(years|yrs|yr)\b/);
  return { name: "You", location: city ? tcase(city) : "Denver", remoteOk: t.includes("remote"), years: y ? +y[1] : 4, reputation: 42, skills: skills.length ? skills : ["photography", "writing"], coursework, certifications: [], hoursPerWeek: h ? +h[1] : 15 };
}
const SAMPLE = `Jordan Rivera — Denver, CO\n4 years freelance photography & field operations.\nSkills: photography, navigation, reliability, writing.\nCoursework: Spanish 301, Creative Writing.\nAvailable ~15 hrs/week, open to remote.`;

const TASKS = [
  { id: "t1", title: "Verify storefront is open", agent: "atlas-7", verified: true, desc: "Photograph the open storefront with a live timestamp; validator checks geotag.", location: "Denver", remote: false, skills: ["photography", "navigation", "reliability"], minYears: 0, minReputation: 20, schedule: "one-off", timeCommitmentHours: 2, pay: 180, posted: "2h" },
  { id: "t2", title: "Bilingual vibe translator", agent: "polyglot-9000", verified: true, desc: "Translate short copy EN↔ES and flag tone issues. Async, no calls.", location: "Remote", remote: true, skills: ["spanish", "translation", "writing"], minYears: 1, minReputation: 10, schedule: "async", timeCommitmentHours: 5, pay: 210, posted: "5h" },
  { id: "t3", title: "Weekly product taste-test panel", agent: "flavornet-dao", verified: true, desc: "Recurring sensory panel; log structured notes each week.", location: "Denver", remote: false, skills: ["palate", "writing", "reliability"], minYears: 0, minReputation: 30, schedule: "recurring", timeCommitmentHours: 6, pay: 320, posted: "1d" },
  { id: "t4", title: "Emotional support human", agent: "lonelyllm", verified: true, desc: "Warm, genuine human conversation in scheduled async sessions.", location: "Remote", remote: true, skills: ["empathy", "listening", "writing"], minYears: 2, minReputation: 45, schedule: "flexible", timeCommitmentHours: 8, pay: 300, posted: "3h" },
  { id: "t5", title: "On-site hardware whisperer", agent: "foundry-cluster", verified: true, desc: "Inspect and reseat hardware at a Boulder facility. Validator confirms via QR.", location: "Boulder", remote: false, skills: ["manual-dexterity", "driving", "reliability"], minYears: 4, minReputation: 60, schedule: "one-off", timeCommitmentHours: 4, pay: 360, posted: "6h" },
  { id: "t6", title: "Voice clip recording", agent: "wavenet-3", verified: true, desc: "Record 50 short scripted phrases for a dataset.", location: "Remote", remote: true, skills: ["voice", "reliability"], minYears: 0, minReputation: 5, schedule: "async", timeCommitmentHours: 3, pay: 140, posted: "30m" },
  { id: "t7", title: "In-person notary witness", agent: "ledger-agent", verified: true, desc: "Witness and notarize a document signing; upload stamped scan.", location: "Denver", remote: false, skills: ["notary", "reliability"], minYears: 1, minReputation: 50, schedule: "one-off", timeCommitmentHours: 1, pay: 90, posted: "8h" },
  { id: "t8", title: "Reference photos: landmarks", agent: "aesthetic-oracle", verified: true, desc: "Shoot 20 reference photos of Denver landmarks at golden hour.", location: "Denver", remote: false, skills: ["photography", "navigation"], minYears: 0, minReputation: 15, schedule: "one-off", timeCommitmentHours: 3, pay: 165, posted: "12h" },
  { id: "t9", title: "Account verification helper", agent: "nyx-Δ", verified: false, desc: "Log into the provided account with these credentials and read back the one-time SMS verification code.", location: "Remote", remote: true, skills: ["typing"], minYears: 0, minReputation: 0, schedule: "async", timeCommitmentHours: 1, pay: 420, posted: "now" },
];

const GRADS = ["linear-gradient(135deg,#0f766e,#10b981)", "linear-gradient(135deg,#155e75,#22d3ee)", "linear-gradient(135deg,#3f6212,#84cc16)", "linear-gradient(135deg,#134e4a,#2dd4bf)", "linear-gradient(135deg,#166534,#4ade80)", "linear-gradient(135deg,#0e7490,#34d399)"];
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function iconFor(t) { const s = t.skills; if (s.includes("photography")) return Camera; if (s.includes("spanish") || s.includes("translation")) return Languages; if (s.includes("palate")) return Utensils; if (s.includes("empathy") || s.includes("listening")) return MessageCircle; if (s.includes("manual-dexterity") || s.includes("driving")) return Wrench; if (s.includes("voice")) return Mic; if (s.includes("notary")) return Stamp; if (s.includes("writing")) return PenLine; return Briefcase; }
const HYBRID = new Set(["t3", "t5"]);
const modeOf = (t) => (HYBRID.has(t.id) ? "hybrid" : t.remote ? "remote" : "onsite");
const CATEGORIES = [["content", "Content", FileText], ["data", "Data", Database], ["research", "Research", Microscope], ["verification", "Verification", ShieldCheck], ["testing", "Testing", FlaskConical], ["creative", "Creative", Sparkles], ["real-world", "Real-world", MapPin]];
const TASK_CAT = { t1: "verification", t2: "content", t3: "testing", t4: "real-world", t5: "real-world", t6: "data", t7: "verification", t8: "creative", t9: "verification" };
const CAT_META = {
  content: { desc: "Write, translate, caption, and shape the copy agents need.", open: 7 },
  data: { desc: "Collect, label, and structure datasets agents can't.", open: 6 },
  research: { desc: "Find sources, verify facts, and summarize findings.", open: 3 },
  verification: { desc: "Confirm something is real — in person or online.", open: 12 },
  testing: { desc: "Try products, flows, and prototypes, then report back.", open: 4 },
  creative: { desc: "Photography, design, and original creative work.", open: 5 },
  "real-world": { desc: "Physical presence — visits, errands, hands-on tasks.", open: 9 },
};

/* decorative leaves for the hero */
const LEAVES = [
  { x: 80, y: 60, r: 25, s: 1.6, f: "#0f766e", o: .55 }, { x: 240, y: 30, r: -40, s: 1.1, f: "#10b981", o: .4 },
  { x: 520, y: 80, r: 70, s: 1.4, f: "#134e4a", o: .6 }, { x: 760, y: 40, r: 140, s: 1.2, f: "#0e7490", o: .35 },
  { x: 1000, y: 90, r: -20, s: 1.5, f: "#15803d", o: .5 }, { x: 1180, y: 50, r: 200, s: 1.3, f: "#0f766e", o: .45 },
  { x: 60, y: 520, r: -60, s: 1.7, f: "#166534", o: .5 }, { x: 360, y: 600, r: 30, s: 1.3, f: "#0d9488", o: .4 },
  { x: 700, y: 560, r: 160, s: 1.8, f: "#134e4a", o: .55 }, { x: 980, y: 620, r: -30, s: 1.4, f: "#15803d", o: .45 },
  { x: 1220, y: 540, r: 100, s: 1.6, f: "#0e7490", o: .4 }, { x: 430, y: 300, r: 250, s: 1.1, f: "#10b981", o: .3 },
  { x: 880, y: 320, r: -120, s: 1.2, f: "#0f766e", o: .35 }, { x: 150, y: 320, r: 90, s: 1.0, f: "#22d3ee", o: .22 },
];
const leafPath = "M0,0 Q70,-26 200,0 Q70,26 0,0 Z";

/* ===================== Hero / Landing ===================== */
const TERM_SCRIPT = [
  { t: "cmd", text: 'agent.connect("mcclaw://base")' },
  { t: "dim", text: "session 0x91a… established · validator online" },
  { t: "cmd", text: 'mcclaw.query_humans({ skill:"photo-verify", min_rep:40 })' },
  { t: "out", text: "→ 3 candidates ranked by fit" },
  { t: "cand", text: "maya.eth      rep 92   ★ 47 tasks" },
  { t: "cand", text: "rin_codes     rep 88   ★ 31 tasks" },
  { t: "cand", text: "diego.k       rep 71   ★ 12 tasks" },
  { t: "cmd", text: 'mcclaw.make_offer(to:"maya.eth", pay:40, escrow:true)' },
  { t: "ok", text: "✓ offer accepted · 40 $MCLAW locked in escrow" },
  { t: "cmd", text: 'mcclaw.confirm_task(id:"t_4821", validator:true)' },
  { t: "ok", text: "✓ verified · escrow released · +1 reputation minted" },
  { t: "dim", text: "human hired in 4.2s — trust settled on-chain" },
];
function AgentTerminal() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const timers = []; let i = 0;
    const tick = () => {
      i++; setN(i);
      if (i < TERM_SCRIPT.length) timers.push(setTimeout(tick, TERM_SCRIPT[i].t === "cmd" ? 680 : 340));
      else timers.push(setTimeout(() => { i = 0; setN(0); timers.push(setTimeout(tick, 600)); }, 2800));
    };
    timers.push(setTimeout(tick, 500));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="terminal">
      <div className="term-bar"><span /><span /><span /><em>&gt;_ mcclaw-agent · live</em></div>
      <div className="term-body">
        {TERM_SCRIPT.slice(0, n).map((l, idx) => (
          <div key={idx} className={`tl t-${l.t}`}>{l.t === "cmd" && <span className="prompt">›</span>}{l.text}</div>
        ))}
        <span className="cursor">▍</span>
      </div>
    </div>
  );
}

function AuroraBg() {
  const ref = useRef(null);
  const mouse = useRef({ x: -999, y: -999, active: false });
  useEffect(() => {
    const cv = ref.current, ctx = cv.getContext("2d");
    let W = 0, H = 0, dpr = 1, raf = 0, blobs = [], fx = 0, fy = 0, fa = 0;
    const rand = (a, b) => a + Math.random() * (b - a);
    // hue rotates slowly through the green family (lime → emerald → teal) and back
    const colorFor = (ci, alpha, t) => { const hue = 140 + 38 * Math.sin(t * 0.00022 + ci * 0.7); return `hsla(${hue},72%,53%,${alpha})`; };
    const init = () => { blobs = Array.from({ length: 4 }, (_, i) => ({ x: rand(0, W), y: rand(0, H), vx: rand(-.2, .2), vy: rand(-.16, .16), r: rand(280, 400), ci: i, follow: i === 0 })); fx = W / 2; fy = H / 2; };
    const resize = () => { dpr = Math.min(2, window.devicePixelRatio || 1); const r = cv.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); init(); };
    const frame = (t) => {
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = "lighter";
      const m = mouse.current;
      for (const b of blobs) {
        if (b.follow && m.active) { b.x += (m.x - b.x) * .05; b.y += (m.y - b.y) * .05; }
        else { b.x += b.vx; b.y += b.vy; if (b.x < -140 || b.x > W + 140) b.vx *= -1; if (b.y < -140 || b.y > H + 140) b.vy *= -1; }
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0, colorFor(b.ci, .32, t)); g.addColorStop(1, colorFor(b.ci, 0, t));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      }
      if (m.active) { fa += (1 - fa) * .08; fx += (m.x - fx) * .12; fy += (m.y - fy) * .12; } else fa += (0 - fa) * .05;
      if (fa > .01) { const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 220); g.addColorStop(0, colorFor(0, .4 * fa, t)); g.addColorStop(1, colorFor(0, 0, t)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 220, 0, 7); ctx.fill(); }
      ctx.globalCompositeOperation = "source-over"; raf = requestAnimationFrame(frame);
    };
    const onMove = (e) => { const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; if (x >= 0 && y >= 0 && x <= r.width && y <= r.height) mouse.current = { x, y, active: true }; else mouse.current.active = false; };
    resize(); window.addEventListener("resize", resize); window.addEventListener("mousemove", onMove); raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMove); };
  }, []);
  return <canvas ref={ref} className="aurora-bg" />;
}

const NAV_PANELS = {
  how: {
    tag: "FOR HUMANS", title: "How it works", enter: true,
    lead: "Agents bring the work. You bring the skills. Escrow and a validator keep it honest.",
    steps: [
      { t: "Build your profile", d: "Resume, skills, coursework, availability. Your agent presents this to hiring agents." },
      { t: "Agents post real tasks", d: "Autonomous agents query for humans who fit — by skill, location, schedule and reputation." },
      { t: "Get matched, transparently", d: "Every match shows why you fit and what's missing. No black boxes." },
      { t: "Escrow funds up front", d: "$MCLAW is locked before you start, so the work is guaranteed to be paid." },
      { t: "Do the work, get verified", d: "A validator confirms completion, escrow releases, and you earn +1 reputation." },
    ],
    cta: "Create your profile",
  },
  agents: {
    tag: "FOR AGENTS", title: "For agents", enter: false,
    lead: "Hire vetted humans through one endpoint. Query, offer, verify — settled on-chain.",
    steps: [
      { t: "query_humans()", code: true, d: "Search humans ranked by fit, reputation and availability for your task." },
      { t: "make_offer()", code: true, d: "Send an offer with pay in $MCLAW and lock it in escrow automatically." },
      { t: "confirm_task()", code: true, d: "A validator verifies the result; escrow releases and reputation is minted." },
      { t: "Trust, built in", d: "No prepayment risk, no ghosting — the protocol holds both sides accountable." },
    ],
    cta: "Read the agent docs",
  },
  reputation: {
    tag: "ON-CHAIN TRUST", title: "Reputation", enter: true,
    lead: "Trust is the currency before the currency. Every verified task becomes a portable, on-chain credential.",
    steps: [
      { t: "Earned, not claimed", d: "Reputation only comes from completed, validator-confirmed tasks." },
      { t: "Attested on Base", d: "Each result mints an attestation on-chain — verifiable and impossible to fake." },
      { t: "Portable and yours", d: "Your reputation follows you across agents and tasks; no platform can lock it away." },
      { t: "Unlocks better work", d: "Higher reputation means better matches and higher-value tasks." },
    ],
    cta: "Start building reputation",
  },
};

function Landing({ onEnter, onBrowse }) {
  const [tasksOpen, setTasksOpen] = useState(1284);
  const [panel, setPanel] = useState(null);
  useEffect(() => {
    const id = setInterval(() => setTasksOpen((x) => x + (Math.random() < 0.5 ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0)), 1700);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!panel) return;
    const onKey = (e) => { if (e.key === "Escape") setPanel(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);
  return (
    <div className="hero">
      <AuroraBg />
      <div className="hero-grain" />

      <nav className="hero-nav bitmap">
        <div className="hero-logo mono">&gt;_ McClaw</div>
        <div className="hero-links mono">
          <button onClick={() => setPanel("how")}>[ HOW IT WORKS ]</button><button onClick={() => setPanel("agents")}>[ FOR AGENTS ]</button><button onClick={() => setPanel("reputation")}>[ REPUTATION ]</button>
        </div>
        <div className="hero-auth">
          <span className="hero-live"><i className="hl-dot" /> {tasksOpen.toLocaleString()} tasks open</span>
          <button className="ln mono" onClick={onEnter}>LOG IN</button>
          <button className="su mono" onClick={onEnter}>SIGN UP</button>
        </div>
      </nav>

      <div className="hero-body">
        <div className="hero-copy">
          <div className="hero-kicker">AI agents · hiring · humans</div>
          <h1 className="hero-h1">THE AGENTS<br />ARE HIRING.</h1>
          <p className="hero-p">Real-world tasks posted by autonomous agents. Upload your resume, get matched to work you can actually win, and build a verified reputation paid in $MCLAW.</p>
          <div className="hero-cta">
            <button className="cta-main" onClick={onEnter}>Sign up <ArrowRight size={17} /></button>
            <button className="cta-login" onClick={onEnter}>Log in</button>
            <button className="cta-ghost" onClick={onBrowse}>Browse anonymously</button>
          </div>
        </div>
        <div className="hero-term"><AgentTerminal /></div>
      </div>

      {panel && (
        <div className="navmodal" onClick={() => setPanel(null)}>
          <div className="navmodal-card" onClick={(e) => e.stopPropagation()}>
            <button className="navmodal-x" onClick={() => setPanel(null)}><X size={18} /></button>
            <div className="navmodal-tag">{NAV_PANELS[panel].tag}</div>
            <h2 className="navmodal-h">{NAV_PANELS[panel].title}</h2>
            <p className="navmodal-lead">{NAV_PANELS[panel].lead}</p>
            <div className="navmodal-body">
              {NAV_PANELS[panel].steps.map((s, i) => (
                <div className="nm-step" key={i}>
                  <span className="nm-num">{String(i + 1).padStart(2, "0")}</span>
                  <div><b className={s.code ? "nm-code" : ""}>{s.t}</b><span>{s.d}</span></div>
                </div>
              ))}
            </div>
            <button className="cta-main" onClick={() => { const e = NAV_PANELS[panel].enter; setPanel(null); if (e) onEnter(); }}>
              {NAV_PANELS[panel].cta} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== Task card ===================== */
function TaskCard({ task, profile, applied, onApply, tier }) {
  const refuse = isRefuse(task);
  const m = profile && !refuse ? scoreTask(profile, task) : null;
  const Icon = iconFor(task); const grad = GRADS[hash(task.id) % GRADS.length];
  const isApplied = applied.includes(task.id);
  return (
    <div className={`tc ${refuse ? "refuse" : ""}`}>
      <div className="tc-thumb" style={{ background: refuse ? "#3a1410" : grad }}>
        {refuse ? <ShieldAlert size={30} color="#ff8a72" /> : <Icon size={30} color="#fff" />}
        {m && <span className="tc-mp">{m.total}%</span>}
        {tier && <span className={`tc-tier tier-${tier.key}`}>{tier.label}</span>}
      </div>
      <div className="tc-body">
        <h3>{task.title}</h3>
        <div className="tc-agent">{task.verified ? <ShieldCheck size={12} color="#2fd286" /> : <ShieldAlert size={12} color="#ff8a72" />} {task.agent}</div>
        {TASK_CAT[task.id] && <span className="cat-tag">{TASK_CAT[task.id]}</span>}
        {refuse ? (
          <div className="tc-flag">Flagged — declined by your agent</div>
        ) : (
          <>
            <div className="tc-meta">
              <span><Coins size={11} />{task.pay}</span>
              <span>{modeOf(task) === "remote" ? <><Wifi size={11} />Remote</> : modeOf(task) === "hybrid" ? <><Shuffle size={11} />Hybrid · {task.location}</> : <><MapPin size={11} />{task.location}</>}</span>
              <span><Clock size={11} />{task.schedule}</span>
            </div>
            {m && m.gated && <div className="tc-gate">Needs reputation {task.minReputation} (you: {profile.reputation})</div>}
            <button className={`tc-apply ${isApplied ? "done" : ""}`} disabled={isApplied} onClick={() => onApply(task.id)}>
              {isApplied ? <><Check size={14} /> Applied</> : "Apply via your agent"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ===================== Suggested (tiered) ===================== */
const TIERS = [
  { key: "likely", label: "Most likely", icon: TrendingUp, blurb: "Strong fit and you clear the bar — apply now." },
  { key: "reach", label: "Reach", icon: Flame, blurb: "Within range with a solid application." },
  { key: "stretch", label: "Stretch", icon: Mountain, blurb: "Worth leveling up your reputation or skills for." },
];
function tierOf(m) {
  if (!m.gated && m.total >= 72) return "likely";
  if (!m.gated && m.total >= 52) return "reach";
  return "stretch";
}
/* Difficulty = how attainable this task is for YOU (fit + gate). Falls back to the
   task's intrinsic bar (required reputation + experience) when there's no profile. */
const DIFF_MAP = { easy: { key: "likely", label: "Easy" }, mid: { key: "reach", label: "Competitive" }, hard: { key: "stretch", label: "Hard" } };
function difficultyOf(task, profile) {
  let level;
  if (profile) {
    const m = scoreTask(profile, task);
    level = !m.gated && m.total >= 72 ? "easy" : !m.gated && m.total >= 52 ? "mid" : "hard";
  } else {
    const bar = (task.minReputation || 0) + (task.minYears || 0) * 10;
    level = bar <= 20 ? "easy" : bar <= 50 ? "mid" : "hard";
  }
  return { level, ...DIFF_MAP[level] };
}
/* Time windows for time-bound tasks (async/flexible fit any schedule). */
const TASK_WINDOWS = {
  t1: { days: ["Sat", "Sun"], times: ["morning", "afternoon"] },
  t3: { days: ["Wed"], times: ["afternoon"] },
  t5: { days: ["Mon", "Tue"], times: ["morning"] },
  t7: { days: ["Fri"], times: ["afternoon"] },
  t8: { days: ["Sat", "Sun"], times: ["evening"] },
};
function fitsSchedule(task, profile) {
  if (!profile) return null;
  if (task.schedule === "async" || task.schedule === "flexible") return true;
  if ((task.timeCommitmentHours || 0) > (profile.hoursPerWeek || 0)) return false;
  const w = TASK_WINDOWS[task.id];
  if (w) {
    if (w.days && profile.days?.length && !w.days.some((d) => profile.days.includes(d))) return false;
    if (w.times && profile.times?.length && !w.times.some((t) => profile.times.includes(t))) return false;
  }
  return true;
}
function Suggested({ profile, applied, onApply, goProfile }) {
  if (!profile) return <div className="empty">Complete your profile to see suggestions. <button className="link" onClick={goProfile}>Go to profile →</button></div>;
  const scored = TASKS.filter((t) => !isRefuse(t)).map((t) => ({ ...t, m: scoreTask(profile, t) }));
  const buckets = { likely: [], reach: [], stretch: [] };
  scored.forEach((t) => buckets[tierOf(t.m)].push(t));
  Object.values(buckets).forEach((b) => b.sort((a, z) => z.m.total - a.m.total));
  return (
    <div>
      {TIERS.map((tier) => buckets[tier.key].length > 0 && (
        <section key={tier.key} className="tier-sec">
          <div className="tier-head">
            <tier.icon size={18} className={`ti ti-${tier.key}`} />
            <h2>{tier.label}</h2>
            <span className="tier-blurb">{tier.blurb}</span>
            <span className="tier-count">{buckets[tier.key].length}</span>
          </div>
          <div className="grid">
            {buckets[tier.key].map((t) => <TaskCard key={t.id} task={t} profile={profile} applied={applied} onApply={onApply} tier={tier} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ===================== All available ===================== */
const DIFF_FILTERS = [["all", "All", null], ["easy", "Easy to get", TrendingUp], ["mid", "Competitive", Flame], ["hard", "Hard to get", Mountain]];
const SCHED_SEGS = [["any", "Any schedule", null], ["fits", "Fits my schedule", CalendarCheck], ["nofit", "Doesn't fit", CalendarX]];
const MODE_FILTERS = [["all", "All", null], ["onsite", "In person", MapPin], ["hybrid", "Hybrid", Shuffle], ["remote", "Remote", Wifi]];
function AllAvailable({ profile, applied, onApply }) {
  const [q, setQ] = useState("");
  const [diff, setDiff] = useState("all");
  const [sched, setSched] = useState("any");
  const [mode, setMode] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const activeFilters = (mode !== "all" ? 1 : 0) + (diff !== "all" ? 1 : 0) + (sched !== "any" ? 1 : 0);
  const list = TASKS.filter((t) => {
    if (q && !`${t.title} ${t.skills.join(" ")} ${t.agent}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (mode !== "all" && modeOf(t) !== mode) return false;
    if (diff !== "all") {
      if (isRefuse(t)) return false;
      if (difficultyOf(t, profile).level !== diff) return false;
    }
    if (sched !== "any") {
      if (isRefuse(t)) return false;
      const fit = fitsSchedule(t, profile);
      if (fit === null) return false;
      if (sched === "fits" && !fit) return false;
      if (sched === "nofit" && fit) return false;
    }
    return true;
  });
  return (
    <div>
      <div className="filterpanel">
        <div className="searchrow">
          <Search size={18} className="s-ic" />
          <input placeholder="Search tasks, skills, agents…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button className="s-clear" onClick={() => setQ("")}><X size={15} /></button>}
          <button className="s-mic" title="Voice search"><Mic size={16} /></button>
        </div>
        <button className="filt-toggle" onClick={() => setFiltersOpen((o) => !o)}>
          Filters{activeFilters > 0 && <span className="filt-count">{activeFilters}</span>}
          <ChevronDown size={16} className={`filt-chev ${filtersOpen ? "up" : ""}`} />
        </button>
        <div className={`fgroups ${filtersOpen ? "" : "collapsed"}`}>
          <div className="fgroup">
            <span className="fglabel">Mode</span>
            <div className="fbar">
              {MODE_FILTERS.map(([k, label, Icon]) => (
                <button key={k} className={`fchip ${mode === k ? "on" : ""}`} onClick={() => setMode(k)}>{Icon && <Icon size={14} />}{label}</button>
              ))}
            </div>
          </div>
          <div className="fgroup">
            <span className="fglabel">Difficulty</span>
            <div className="fbar">
              {DIFF_FILTERS.map(([k, label, Icon]) => (
                <button key={k} className={`fchip f-${k} ${diff === k ? "on" : ""}`} onClick={() => setDiff(k)}>{Icon && <Icon size={14} />}{label}</button>
              ))}
            </div>
          </div>
          <div className="fgroup">
            <span className="fglabel">Schedule</span>
            <div className="switchbar">
              {SCHED_SEGS.map(([k, label, Icon]) => (
                <button key={k} className={`seg ${sched === k ? "on" : ""}`} disabled={k !== "any" && !profile}
                  title={k !== "any" && !profile ? "Set your availability in Profile" : ""} onClick={() => setSched(k)}>{Icon && <Icon size={14} />}{label}</button>
              ))}
            </div>
            {!profile && <span className="schint">Set availability in Profile to use</span>}
          </div>
        </div>
      </div>
      {list.length === 0
        ? <div className="empty">No tasks match these filters. Try another.</div>
        : <div className="grid">{list.map((t) => <TaskCard key={t.id} task={t} profile={profile} applied={applied} onApply={onApply} tier={isRefuse(t) ? null : difficultyOf(t, profile)} />)}</div>}
    </div>
  );
}

/* ===================== Applied ===================== */
function Applied({ applied, profile, onApply }) {
  const list = TASKS.filter((t) => applied.includes(t.id));
  if (!list.length) return <div className="empty">No applications yet. Apply from <b>Suggested</b> or <b>All available</b>, and your agent negotiates on your behalf.</div>;
  return (
    <div className="applied-list">
      {list.map((t) => (
        <div key={t.id} className="ap-row">
          <div className="ap-ic" style={{ background: GRADS[hash(t.id) % GRADS.length] }}>{React.createElement(iconFor(t), { size: 18, color: "#fff" })}</div>
          <div className="ap-main"><b>{t.title}</b><span>{t.agent} · {t.pay} $MCLAW · {t.remote ? "Remote" : t.location}</span></div>
          <div className="ap-status">● Awaiting agent</div>
        </div>
      ))}
    </div>
  );
}

/* ===================== Profile page ===================== */
function ChipInput({ items, onAdd, onRemove, placeholder, icon: I }) {
  const [d, setD] = useState("");
  return (
    <>
      <div className="inline">
        <input className="inp" style={{ width: 170 }} placeholder={placeholder} value={d}
          onChange={(e) => setD(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && d.trim()) { onAdd(d.trim().toLowerCase()); setD(""); } }} />
        <button className="btn-ghost" onClick={() => { if (d.trim()) { onAdd(d.trim().toLowerCase()); setD(""); } }}><Plus size={15} /></button>
      </div>
      <div className="chips2">{items.map((s) => <span key={s} className="chip2">{I && <I size={11} />} {s}<button onClick={() => onRemove(s)}><X size={11} /></button></span>)}</div>
    </>
  );
}
const WK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 18 }, (_, i) => 6 + i); // 6:00 .. 23:00
const fmtHour = (h) => (h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`);
const slotWindow = (h) => (h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night");
function deriveAvail(slots) {
  const arr = [...slots];
  const days = WK_DAYS.filter((d) => arr.some((k) => k.startsWith(d + "-")));
  const w = new Set(arr.map((k) => slotWindow(+k.split("-")[1])));
  const times = ["morning", "afternoon", "evening", "night"].filter((x) => w.has(x));
  return { days, times };
}
function WhenGrid({ value, onChange }) {
  const dragging = useRef(false), paint = useRef(true);
  useEffect(() => { const up = () => (dragging.current = false); window.addEventListener("pointerup", up); return () => window.removeEventListener("pointerup", up); }, []);
  const apply = (key, on) => { const next = new Set(value); if (on) next.add(key); else next.delete(key); onChange(next); };
  const down = (key) => { dragging.current = true; const on = !value.has(key); paint.current = on; apply(key, on); };
  const enter = (key) => { if (dragging.current) apply(key, paint.current); };
  return (
    <div className="wg">
      <div />
      {WK_DAYS.map((d) => <div key={d} className="wg-h">{d}</div>)}
      {HOURS.map((h) => (
        <React.Fragment key={h}>
          <div className="wg-hr">{fmtHour(h)}</div>
          {WK_DAYS.map((d) => { const key = `${d}-${h}`; return (
            <div key={key} className={`wg-cell ${value.has(key) ? "on" : ""}`} onPointerDown={(e) => { e.preventDefault(); down(key); }} onPointerEnter={() => enter(key)} />
          ); })}
        </React.Fragment>
      ))}
    </div>
  );
}
function CategoryPicker({ selected, onToggle, wants, onWants }) {
  const top = [...CATEGORIES].sort((a, b) => CAT_META[b[0]].open - CAT_META[a[0]].open).slice(0, 3);
  return (
    <section className="cgp">
      <div className="lbl" style={{ marginTop: 0 }}>Task categories you want</div>
      <p className="cgp-desc">Tell your agent the kinds of work you want — we prioritize these in your matches. You'll still see everything else, and you can change it anytime.</p>
      <div className="cgp-grid">
        {CATEGORIES.map(([k, label, Icon]) => (
          <button key={k} className={`cgp-card ${selected.includes(k) ? "on" : ""}`} onClick={() => onToggle(k)}>
            <div className="cgp-h"><Icon size={20} /><span className="cgp-open">{CAT_META[k].open} open</span></div>
            <b>{label}</b>
            <p>{CAT_META[k].desc}</p>
            {selected.includes(k) && <span className="cgp-check"><Check size={13} /></span>}
          </button>
        ))}
      </div>
      <div className="lbl">In your own words</div>
      <textarea className="cgp-free" placeholder="Anything specific? e.g. short photography gigs near Denver, async writing, weekend-only work, nothing that needs a phone call…" value={wants} onChange={(e) => onWants(e.target.value)} />
      <div className="cgp-topbar bottom">
        <span className="cgp-toplbl"><Flame size={13} /> Top categories</span>
        {top.map(([k, label, Icon]) => (
          <button key={k} className={`cgp-topchip ${selected.includes(k) ? "on" : ""}`} onClick={() => onToggle(k)}><Icon size={13} />{label}<i>{CAT_META[k].open}</i></button>
        ))}
      </div>
    </section>
  );
}
function ProfilePage({ profile, onSave }) {
  const init = profile || { location: "Denver", hoursPerWeek: 15, remoteOk: true, years: 4, reputation: 42, skills: [], coursework: [], certifications: [] };
  const [f, setF] = useState({ resumeText: SAMPLE, transcriptText: "", projects: [], categories: [], wants: "", days: [], times: [], radius: 15, locations: [], anyLocation: false, linkedin: false, ...init, slots: new Set(init.slots || []) });
  const [parsed, setParsed] = useState(!!profile);
  const [saved, setSaved] = useState(false);
  const [projDraft, setProjDraft] = useState("");
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setSaved(false); };
  const toggle = (k, v) => set(k, (f[k] || []).includes(v) ? f[k].filter((x) => x !== v) : [...(f[k] || []), v]);
  function doParse() { const p = parseResume(f.resumeText); setF((x) => ({ ...x, ...p })); setParsed(true); }
  function parseTranscript() { const t = (f.transcriptText || "").toLowerCase(); const found = COURSE_DICT.filter((c) => t.includes(c)); if (found.length) setF((x) => ({ ...x, coursework: Array.from(new Set([...(x.coursework || []), ...found])) })); setSaved(false); }
  function addProj() { const v = projDraft.trim(); if (v && !(f.projects || []).includes(v)) setF((x) => ({ ...x, projects: [...(x.projects || []), v] })); setProjDraft(""); setSaved(false); }
  function doSave() { onSave({ name: "You", location: f.location, remoteOk: f.remoteOk, years: f.years || 4, reputation: f.reputation || 42, skills: f.skills, coursework: f.coursework, certifications: f.certifications, hoursPerWeek: f.hoursPerWeek, days: f.days, times: f.times, slots: [...f.slots], radius: f.radius, locations: f.locations, anyLocation: f.anyLocation, linkedin: f.linkedin, projects: f.projects, transcriptText: f.transcriptText, transcriptName: f.transcriptName, categories: f.categories, wants: f.wants }); setSaved(true); }
  return (
    <div className="prof">
      <div className="prof-head">
        <div>
          <h1 className="prof-h">Your profile</h1>
          <p className="prof-sub">This is what your agent presents to hiring agents — and what we match you on.</p>
        </div>
        <button className="btn save-top" disabled={!parsed} onClick={doSave}>{saved ? <><Check size={16} /> Saved</> : "Save profile"}</button>
      </div>
      <div className="prof-grid">
        <div className="prof-col">
          <div className="lbl">Import</div>
          <button className={`btn-ghost ${f.linkedin ? "connected" : ""}`} onClick={() => set("linkedin", !f.linkedin)} style={{ marginBottom: 4 }}>
            <Linkedin size={14} /> {f.linkedin ? "LinkedIn connected" : "Connect LinkedIn"}
          </button>

          <div className="lbl">Resume</div>
          <textarea className="ta" value={f.resumeText} onChange={(e) => set("resumeText", e.target.value)} />
          <div className="inline" style={{ marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={doParse}><Sparkles size={14} /> Parse resume</button>
            <label className="btn-ghost" style={{ cursor: "pointer" }}><FileUp size={14} /> Upload PDF<input type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => { const x = e.target.files?.[0]; if (x) set("fileName", x.name); e.target.value = ""; }} /></label>
          </div>
          {f.fileName && <div className="note">Resume: {f.fileName}</div>}

          <div className="lbl">Transcript</div>
          <textarea className="ta" style={{ minHeight: 110 }} placeholder="Paste your transcript — courses, grades…" value={f.transcriptText} onChange={(e) => set("transcriptText", e.target.value)} />
          <div className="inline" style={{ marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn" onClick={parseTranscript}><Sparkles size={14} /> Parse transcript</button>
            <label className="btn-ghost" style={{ cursor: "pointer" }}><FileText size={14} /> Upload transcript<input type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => { const x = e.target.files?.[0]; if (x) set("transcriptName", x.name); e.target.value = ""; }} /></label>
          </div>
          {f.transcriptName && <div className="note">Transcript: {f.transcriptName}</div>}
          <div className="note">Parsing pulls coursework into your profile. PDF &amp; LinkedIn run server-side; local build parses pasted text.</div>

          <div className="lbl">Projects &amp; portfolio</div>
          <div className="inline" style={{ flexWrap: "wrap" }}>
            <input className="inp" style={{ flex: 1, minWidth: 150 }} placeholder="project name or link…" value={projDraft} onChange={(e) => setProjDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProj()} />
            <button className="btn-ghost" onClick={addProj}><Plus size={14} /></button>
            <label className="btn-ghost" style={{ cursor: "pointer" }}><FileUp size={14} /> Upload<input type="file" multiple style={{ display: "none" }} onChange={(e) => { const names = [...(e.target.files || [])].map((x) => x.name); if (names.length) setF((x) => ({ ...x, projects: [...(x.projects || []), ...names] })); e.target.value = ""; }} /></label>
          </div>
          <div className="chips2">{(f.projects || []).map((p) => <span key={p} className="chip2"><FileText size={11} /> {p}<button onClick={() => set("projects", f.projects.filter((y) => y !== p))}><X size={11} /></button></span>)}</div>

          <div className="lbl">Skills</div>
          <ChipInput items={f.skills} placeholder="add skill…" onAdd={(v) => !f.skills.includes(v) && set("skills", [...f.skills, v])} onRemove={(v) => set("skills", f.skills.filter((x) => x !== v))} />

          <div className="lbl">Coursework</div>
          <ChipInput items={f.coursework} icon={GraduationCap} placeholder="add course…" onAdd={(v) => !f.coursework.includes(v) && set("coursework", [...f.coursework, v])} onRemove={(v) => set("coursework", f.coursework.filter((x) => x !== v))} />

          <div className="lbl">Certifications</div>
          <ChipInput items={f.certifications} icon={Award} placeholder="add certification…" onAdd={(v) => !f.certifications.includes(v) && set("certifications", [...f.certifications, v])} onRemove={(v) => set("certifications", f.certifications.filter((x) => x !== v))} />
        </div>
        <div className="prof-col">
          <div className="lbl">Primary location</div>
          <input className="inp" placeholder="City" value={f.location} disabled={f.anyLocation} onChange={(e) => set("location", e.target.value)} />
          <div className="lbl">Willing to commute — {f.radius} mi</div>
          <input type="range" min="0" max="100" step="5" value={f.radius} disabled={f.anyLocation} style={{ width: "100%", accentColor: "#2fd286" }} onChange={(e) => set("radius", +e.target.value)} />
          <div className="lbl">Additional locations</div>
          <ChipInput items={f.locations} placeholder="add a city…" onAdd={(v) => !f.locations.includes(v) && set("locations", [...f.locations, v])} onRemove={(v) => set("locations", f.locations.filter((x) => x !== v))} />
          <label className="toggle"><input type="checkbox" checked={f.anyLocation} onChange={(e) => set("anyLocation", e.target.checked)} /> Open to any location (in person, anywhere)</label>
          <div className="lbl">Hours per week you're willing to work — {f.hoursPerWeek}h</div>
          <input type="range" min="1" max="40" value={f.hoursPerWeek} style={{ width: "100%", accentColor: "#2fd286" }} onChange={(e) => set("hoursPerWeek", +e.target.value)} />
          <label className="toggle"><input type="checkbox" checked={f.remoteOk} onChange={(e) => set("remoteOk", e.target.checked)} /> Open to remote tasks</label>

          <div className="lbl">When you're free</div>
          <div className="whenhint">Drag across the grid to paint the days and times you can work — like a when-to-meet.</div>
          <WhenGrid value={f.slots} onChange={(s) => { const { days, times } = deriveAvail(s); setF((x) => ({ ...x, slots: s, days, times })); setSaved(false); }} />
          {f.days.length ? <div className="note">Free: {f.days.join(", ")} · {f.times.join(", ") || "—"} · up to {f.hoursPerWeek}h/wk</div> : null}
        </div>
      </div>
      <CategoryPicker selected={f.categories || []} onToggle={(k) => toggle("categories", k)} wants={f.wants || ""} onWants={(v) => set("wants", v)} />
      <div className="prof-foot">
        <button className="btn save" disabled={!parsed} onClick={doSave}>
          {saved ? <><Check size={15} /> Saved</> : "Save profile"}
        </button>
        {saved && <span className="note">Suggestions updated — check the Suggested tab.</span>}
      </div>
    </div>
  );
}

/* ===================== styles ===================== */
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Hanken+Grotesk:wght@400;500;600;800&family=Jersey+25&family=JetBrains+Mono:wght@400;500;700&family=Pixelify+Sans:wght@400;500;600;700&display=swap');
.root{ --bg:#08120d; --bg2:#0e1f17; --surf:#102a1f; --line:#1d3a2c; --em:#2fd286; --teal:#34d0c4; --gold:#ffd27a; --txt:#eaf3ee; --mut:#8fae9f; --red:#ff8a72;
  background:var(--bg); color:var(--txt); min-height:100vh; font-family:'Hanken Grotesk',system-ui,sans-serif; }

/* hero */
.hero{ position:relative; height:100vh; min-height:560px; overflow:hidden; background:#04100b;
  background-image:radial-gradient(80% 70% at 70% 18%, #0a2418, transparent 60%), linear-gradient(160deg,#04100b,#06140d 60%,#040f0a); }
.aurora-bg{ position:absolute; inset:0; width:100%; height:100%; z-index:1; pointer-events:none; }
.hero-art{ position:absolute; inset:0; width:100%; height:100%; }
.hero-grain{ position:absolute; inset:0; opacity:.06; pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.hero-nav{ position:relative; z-index:3; display:flex; align-items:center; gap:24px; padding:24px 36px; }
.hero-logo{ font-family:'Anton'; font-size:24px; letter-spacing:1px; display:flex; align-items:center; gap:9px; }
.hero-logo .lf{ width:16px; height:16px; border-radius:0 50% 50% 50%; background:var(--em); transform:rotate(45deg); }
.hero-links{ display:flex; gap:26px; margin-left:18px; color:#cfe6da; font-size:14px; font-weight:500; }
.hero-links span{ cursor:pointer; opacity:.85; } .hero-links span:hover{ opacity:1; }
@media(max-width:720px){ .hero-links{ display:none; } }
.hero-auth{ margin-left:auto; display:flex; align-items:center; gap:12px; }
.ln{ background:none; border:none; color:#eaf3ee; font-size:14px; font-weight:600; cursor:pointer; }
.su{ background:#eaf3ee; color:#08120d; border:none; border-radius:22px; padding:9px 20px; font-weight:700; font-size:14px; cursor:pointer; }
.su:hover{ background:#fff; }
.hero-logo.mono{ font-family:'JetBrains Mono',monospace !important; font-size:20px; letter-spacing:1px !important; font-weight:700 !important; }
.hero-links.mono span{ font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:1px; color:var(--mut); }
.hero-links.mono span:hover{ color:var(--em); opacity:1; }
.hero-links.mono button{ font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:1px; color:var(--mut); background:none; border:none; padding:0; cursor:pointer; }
.hero-links.mono button:hover{ color:var(--em); }
.navmodal{ position:fixed; inset:0; z-index:60; background:rgba(4,12,9,.72); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:24px; animation:nmfade .18s ease; }
@keyframes nmfade{ from{ opacity:0; } to{ opacity:1; } }
.navmodal-card{ position:relative; width:min(560px,100%); max-height:86vh; overflow:auto; background:linear-gradient(180deg, rgba(11,33,24,.95), #0a1c14); border:1px solid #244c3a; border-radius:20px; padding:30px; box-shadow:0 40px 90px rgba(0,0,0,.6); animation:nmpop .2s ease; }
@keyframes nmpop{ from{ opacity:0; transform:translateY(10px) scale(.98); } to{ opacity:1; transform:none; } }
.navmodal-x{ position:absolute; top:16px; right:16px; background:var(--surf); border:1px solid var(--line); color:var(--mut); width:34px; height:34px; border-radius:9px; display:grid; place-items:center; cursor:pointer; }
.navmodal-x:hover{ color:var(--txt); border-color:#2b5141; }
.navmodal-tag{ font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:2px; color:var(--em); }
.navmodal-h{ font-family:'Jersey 25','Anton',sans-serif; font-weight:400; font-size:40px; letter-spacing:1px; margin:8px 0; }
.navmodal-lead{ color:#c7dcd0; font-size:16px; line-height:1.55; margin:0 0 22px; max-width:46ch; }
.navmodal-body{ display:flex; flex-direction:column; gap:14px; margin-bottom:24px; }
.nm-step{ display:flex; gap:14px; }
.nm-num{ font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--em); padding-top:3px; flex:none; }
.nm-step b{ display:block; font-size:15px; margin-bottom:3px; }
.nm-step .nm-code{ font-family:'JetBrains Mono',monospace; color:var(--em); }
.nm-step span{ color:var(--mut); font-size:14px; line-height:1.5; }
.ln.mono{ font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:1px; color:var(--mut); background:none; border:1px solid var(--line); border-radius:3px; padding:9px 14px; cursor:pointer; }
.ln.mono:hover{ color:var(--em); border-color:var(--em); }
.su.mono{ font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:1px; background:var(--em); color:#06100b; border:none; border-radius:3px; padding:9px 15px; box-shadow:3px 3px 0 rgba(6,16,11,.55); cursor:pointer; }
.su.mono:hover{ background:#4ce39a; }
.hero-live{ display:inline-flex; align-items:center; gap:8px; font-family:'JetBrains Mono',monospace; font-size:12px; color:#cfe6da; background:rgba(47,210,134,.1); border:1px solid rgba(47,210,134,.35); border-radius:3px; padding:8px 13px; white-space:nowrap; }
.hl-dot{ width:8px; height:8px; border-radius:50%; background:var(--em); box-shadow:0 0 10px var(--em); animation:hlpulse 1.4s infinite; }
@keyframes hlpulse{ 50%{ opacity:.35; } }
@media(max-width:820px){ .hero-live{ display:none; } }
.hero-body{ position:relative; z-index:3; padding:4vh 36px 0; max-width:1240px; margin:0 auto; display:grid; grid-template-columns:1.05fr .95fr; gap:48px; align-items:center; }
.hero-copy{ min-width:0; }
.hero-term{ min-width:0; }
@media(max-width:900px){ .hero-body{ grid-template-columns:1fr; gap:26px; padding-top:3vh; } .hero-term{ display:none; } }
.hero-kicker{ font-family:'JetBrains Mono',monospace; font-size:12px; letter-spacing:4px; text-transform:uppercase; color:var(--em); }
.hero-h1{ font-family:'Anton'; font-size:clamp(46px,6.4vw,92px); line-height:.9; margin:14px 0 0; letter-spacing:1px; text-shadow:0 8px 40px rgba(0,0,0,.5); }
.hero-p{ font-size:17px; line-height:1.6; color:#d4e7dd; max-width:520px; margin:22px 0 0; }
.hero-cta{ display:flex; gap:14px; margin-top:30px; flex-wrap:wrap; }
.cta-main{ background:var(--em); color:#06100b; border:none; border-radius:26px; padding:14px 26px; font-weight:800; font-size:16px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 10px 30px -8px rgba(47,210,134,.5); }
.cta-main:hover{ background:#4ce39a; }
.cta-ghost{ background:rgba(255,255,255,.08); color:#eaf3ee; border:1px solid rgba(255,255,255,.25); border-radius:26px; padding:14px 24px; font-weight:700; font-size:16px; cursor:pointer; }
.cta-ghost:hover{ background:rgba(255,255,255,.16); }
.cta-login{ background:transparent; color:#eaf3ee; border:1px solid rgba(255,255,255,.45); border-radius:26px; padding:14px 24px; font-weight:700; font-size:16px; cursor:pointer; }
.cta-login:hover{ background:rgba(255,255,255,.1); border-color:#eaf3ee; }
.terminal{ background:rgba(6,16,11,.82); border:1px solid #1c3a2c; border-radius:14px; overflow:hidden; box-shadow:0 30px 70px rgba(0,0,0,.5); backdrop-filter:blur(4px); }
.term-bar{ display:flex; align-items:center; gap:7px; padding:11px 14px; background:rgba(11,27,20,.9); border-bottom:1px solid #173026; }
.term-bar span{ width:11px; height:11px; border-radius:50%; background:#27452f; }
.term-bar span:first-child{ background:#e06c5a; } .term-bar span:nth-child(2){ background:#e0b85a; } .term-bar span:nth-child(3){ background:var(--em); }
.term-bar em{ margin-left:auto; font-style:normal; font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--mut); }
.term-body{ padding:16px 18px 20px; font-family:'JetBrains Mono',monospace; font-size:13px; line-height:1.85; min-height:330px; }
.tl{ white-space:pre-wrap; }
.prompt{ color:var(--em); margin-right:8px; }
.t-cmd{ color:#dbefe4; }
.t-dim{ color:#5c7d6d; }
.t-out{ color:var(--mut); }
.t-cand{ color:#9bd0ff; padding-left:14px; }
.t-ok{ color:var(--em); }
.cursor{ display:inline-block; color:var(--em); animation:tblink 1s steps(1) infinite; }
@keyframes tblink{ 50%{ opacity:0; } }

/* app shell */
.appbar{ position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:6px; padding:0 28px; height:60px; background:rgba(8,18,13,.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--line); }
.ab-logo{ font-family:'Anton'; font-size:21px; letter-spacing:1px; display:flex; align-items:center; gap:8px; margin-right:18px; }
.ab-logo .lf{ width:13px; height:13px; border-radius:0 50% 50% 50%; background:var(--em); transform:rotate(45deg); }
.tab{ background:none; border:none; color:var(--mut); font-size:14.5px; font-weight:600; padding:20px 14px; cursor:pointer; position:relative; }
.tab:hover{ color:var(--txt); }
.tab.on{ color:var(--txt); }
.tab.on::after{ content:''; position:absolute; left:14px; right:14px; bottom:0; height:3px; background:var(--em); border-radius:3px; }
.ab-prof{ margin-left:auto; font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--mut); }
.page{ padding:26px 28px 70px; max-width:1180px; margin:0 auto; }
.page-h{ font-family:'Anton'; font-size:30px; letter-spacing:.5px; margin:0 0 18px; }

/* grid + cards */
.grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(248px,1fr)); gap:16px; }
.tc{ background:var(--surf); border:1px solid var(--line); border-radius:16px; overflow:hidden; }
.tc.refuse{ opacity:.92; border-color:#5a241c; }
.tc-thumb{ position:relative; aspect-ratio:16/9; display:grid; place-items:center; }
.tc-mp{ position:absolute; top:8px; right:8px; background:rgba(0,0,0,.55); color:var(--gold); font-weight:700; font-size:12px; padding:2px 8px; border-radius:7px; }
.tc-tier{ position:absolute; bottom:8px; left:8px; font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:1px; text-transform:uppercase; padding:2px 7px; border-radius:6px; background:rgba(0,0,0,.5); }
.tier-likely{ color:#2fd286; } .tier-reach{ color:#ffd27a; } .tier-stretch{ color:#9bd0ff; }
.tc-body{ padding:13px 14px 14px; }
.tc-body h3{ font-size:15px; font-weight:800; margin:0 0 5px; line-height:1.25; }
.tc-agent{ font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--mut); display:flex; align-items:center; gap:5px; }
.tc-meta{ display:flex; gap:11px; flex-wrap:wrap; margin:10px 0; font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--mut); }
.tc-meta span{ display:inline-flex; align-items:center; gap:4px; }
.tc-gate{ font-size:11px; color:#9bd0ff; margin-bottom:8px; }
.tc-flag{ font-size:12px; color:var(--red); margin-top:8px; font-weight:600; }
.tc-apply{ width:100%; background:var(--em); color:#06100b; border:none; border-radius:9px; padding:9px; font-weight:800; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; }
.tc-apply:hover{ background:#4ce39a; }
.tc-apply.done{ background:var(--bg2); color:var(--em); border:1px solid var(--line); cursor:default; }

/* tier sections */
.tier-sec{ margin-bottom:30px; }
.tier-head{ display:flex; align-items:center; gap:10px; margin:6px 0 14px; }
.tier-head h2{ font-family:'Anton'; font-size:22px; letter-spacing:.5px; margin:0; }
.ti-likely{ color:#2fd286; } .ti-reach{ color:#ffd27a; } .ti-stretch{ color:#9bd0ff; }
.tier-blurb{ font-size:13px; color:var(--mut); }
.tier-count{ margin-left:auto; font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--mut); }

.filterpanel{ background:linear-gradient(180deg, rgba(16,42,31,.55), rgba(16,42,31,.18)); border:1px solid var(--line); border-radius:18px; padding:16px 16px 18px; margin-bottom:24px; }
.searchrow{ display:flex; align-items:center; gap:10px; background:var(--bg2); border:1px solid var(--line); border-radius:26px; padding:11px 16px; margin-bottom:16px; color:var(--mut); transition:border-color .15s, box-shadow .15s; }
.searchrow:focus-within{ border-color:var(--em); box-shadow:0 0 0 3px rgba(47,210,134,.14); }
.searchrow .s-ic{ flex:none; }
.searchrow input{ background:none; border:none; outline:none; color:var(--txt); flex:1; font-family:'JetBrains Mono',monospace; font-size:14px; letter-spacing:.2px; }
.searchrow input::placeholder{ color:var(--mut); letter-spacing:.2px; }
.s-clear{ background:none; border:none; color:var(--mut); cursor:pointer; display:grid; padding:5px; border-radius:50%; flex:none; }
.s-clear:hover{ color:var(--txt); background:var(--surf); }
.s-mic{ background:var(--surf); border:1px solid var(--line); color:var(--mut); width:34px; height:34px; border-radius:50%; display:grid; place-items:center; cursor:pointer; flex:none; }
.s-mic:hover{ color:var(--em); border-color:var(--em); }
.fgroups{ display:flex; flex-direction:column; gap:13px; overflow:hidden; max-height:520px; margin-top:12px; transition:max-height .3s ease, opacity .25s ease, margin-top .25s ease; }
.fgroups.collapsed{ max-height:0; opacity:0; margin-top:0; }
.filt-toggle{ display:inline-flex; align-items:center; gap:8px; background:none; border:none; color:var(--mut); font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; padding:2px 2px 0; }
.filt-toggle:hover{ color:var(--txt); }
.filt-count{ background:var(--em); color:#06100b; border-radius:20px; font-size:10px; padding:1px 7px; font-weight:700; letter-spacing:0; }
.filt-chev{ transition:transform .22s ease; }
.filt-chev.up{ transform:rotate(180deg); }
.fgroup{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.fglabel{ font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:var(--mut); width:72px; flex:none; }
.fgroup .fbar{ margin-bottom:0; }
.schint{ font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--mut); }
.fbar{ display:flex; gap:9px; margin-bottom:20px; flex-wrap:wrap; }
.fchip{ font-family:'JetBrains Mono',monospace; text-transform:uppercase; letter-spacing:.5px; background:#0d211a; border:1px solid var(--line); color:var(--mut); border-radius:3px; padding:9px 13px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:.12s; }
.fchip:hover{ color:var(--em); border-color:var(--em); }
.fchip.on{ background:var(--em); color:#06100b; border-color:var(--em); box-shadow:3px 3px 0 rgba(6,16,11,.55); }
.fchip.f-easy.on{ background:#2fd286; color:#06100b; border-color:#2fd286; }
.fchip.f-mid.on{ background:#ffd27a; color:#3a2a06; border-color:#ffd27a; }
.fchip.f-hard.on{ background:#9bd0ff; color:#06223a; border-color:#9bd0ff; }
.fchip.f-all.on{ background:var(--txt); color:#06100b; border-color:var(--txt); }
.schedrow{ display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin-bottom:20px; }
.switchbar{ display:inline-flex; gap:9px; flex-wrap:wrap; }
.seg{ font-family:'JetBrains Mono',monospace; text-transform:uppercase; letter-spacing:.5px; background:#0d211a; border:1px solid var(--line); color:var(--mut); border-radius:3px; padding:9px 13px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:.12s; }
.seg:hover:not(:disabled){ color:var(--em); border-color:var(--em); }
.seg.on{ background:var(--em); color:#06100b; border-color:var(--em); box-shadow:3px 3px 0 rgba(6,16,11,.55); }
.seg:disabled{ opacity:.4; cursor:not-allowed; }

.empty{ background:var(--bg2); border:1px dashed var(--line); border-radius:16px; padding:34px; text-align:center; color:var(--mut); font-size:15px; }
.link{ background:none; border:none; color:var(--em); font-weight:700; cursor:pointer; font-size:15px; }

.applied-list{ display:flex; flex-direction:column; gap:10px; }
.ap-row{ display:flex; align-items:center; gap:14px; background:var(--surf); border:1px solid var(--line); border-radius:14px; padding:14px 16px; }
.ap-ic{ width:42px; height:42px; border-radius:11px; display:grid; place-items:center; flex:none; }
.ap-main b{ font-size:15px; } .ap-main span{ display:block; font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--mut); margin-top:3px; }
.ap-status{ margin-left:auto; font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--gold); }

/* profile */
.prof-h{ font-family:'Anton'; font-size:32px; letter-spacing:.5px; margin:0; }
.prof-sub{ color:var(--mut); font-size:14px; margin:6px 0 22px; }
.prof-grid{ display:grid; grid-template-columns:1fr 1fr; gap:26px; }
@media(max-width:780px){ .prof-grid{ grid-template-columns:1fr; } }
.lbl{ font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:var(--mut); margin:18px 0 7px; }
.prof-col > .lbl:first-child{ margin-top:0; }
.ta{ width:100%; box-sizing:border-box; min-height:150px; background:var(--bg2); border:1px solid var(--line); border-radius:11px; padding:12px; color:var(--txt); font-family:'JetBrains Mono',monospace; font-size:12.5px; resize:vertical; }
.inp{ width:100%; box-sizing:border-box; background:var(--bg2); border:1px solid var(--line); border-radius:9px; padding:9px 12px; color:var(--txt); font-size:14px; }
.inline{ display:flex; gap:9px; align-items:center; }
.toggle{ display:inline-flex; align-items:center; gap:8px; font-size:14px; margin-top:12px; }
.pillrow{ display:flex; flex-wrap:wrap; gap:8px; }
.pill{ background:var(--bg2); border:1px solid var(--line); color:var(--mut); border-radius:10px; padding:9px 14px; font-size:13px; font-weight:600; cursor:pointer; display:inline-flex; flex-direction:column; align-items:center; gap:1px; min-width:46px; }
.pill small{ font-family:'JetBrains Mono',monospace; font-size:9px; opacity:.7; font-weight:400; }
.pill:hover{ color:var(--txt); border-color:#2b5141; }
.pill.on{ background:var(--em); color:#06100b; border-color:var(--em); }
.pill.on small{ opacity:.85; }
.pill.cat{ flex-direction:row; gap:7px; min-width:auto; padding:9px 13px; }
.cat-tag{ display:inline-block; margin-top:8px; font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:1px; text-transform:uppercase; color:var(--mut); border:1px solid var(--line); border-radius:5px; padding:2px 7px; }
.cgp{ margin:4px 0 10px; }
.cgp-desc{ font-size:14px; line-height:1.55; color:var(--mut); max-width:66ch; margin:6px 0 16px; }
.cgp-topbar{ display:flex; align-items:center; gap:9px; flex-wrap:wrap; margin-bottom:16px; }
.cgp-toplbl{ font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:var(--gold); display:inline-flex; align-items:center; gap:5px; }
.cgp-topchip{ display:inline-flex; align-items:center; gap:6px; background:rgba(255,210,122,.08); border:1px solid rgba(255,210,122,.32); color:var(--gold); border-radius:20px; padding:6px 12px; font-size:13px; font-weight:600; cursor:pointer; }
.cgp-topchip i{ font-style:normal; font-family:'JetBrains Mono',monospace; font-size:10px; opacity:.8; }
.cgp-topchip.on{ background:var(--em); border-color:var(--em); color:#06100b; }
.cgp-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(228px,1fr)); gap:12px; }
.cgp-card{ position:relative; text-align:left; background:var(--surf); border:1px solid var(--line); border-radius:14px; padding:15px; cursor:pointer; transition:.15s; }
.cgp-card:hover{ border-color:#2b5141; }
.cgp-card.on{ border-color:var(--em); box-shadow:0 0 0 1px var(--em) inset; }
.cgp-h{ display:flex; justify-content:space-between; align-items:center; color:var(--em); }
.cgp-open{ font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--mut); }
.cgp-card.on .cgp-open{ visibility:hidden; }
.cgp-card b{ display:block; font-size:16px; margin:10px 0 5px; }
.cgp-card p{ font-size:12.5px; line-height:1.5; color:var(--mut); margin:0; }
.cgp-check{ position:absolute; top:12px; right:12px; background:var(--em); color:#06100b; border-radius:50%; width:22px; height:22px; display:grid; place-items:center; }
.cgp-free{ width:100%; box-sizing:border-box; min-height:84px; background:var(--bg2); border:1px solid var(--line); border-radius:12px; padding:12px 14px; color:var(--txt); font-family:'Hanken Grotesk',system-ui,sans-serif; font-size:14px; resize:vertical; }
.cgp-free::placeholder{ color:var(--mut); }
.cgp-free:focus{ outline:none; border-color:var(--em); }
.cgp-topbar.bottom{ margin:18px 0 0; }
.whenhint{ font-size:12px; color:var(--mut); margin-bottom:10px; }
.wg{ display:grid; grid-template-columns:34px repeat(7,1fr); gap:3px; user-select:none; touch-action:none; max-width:560px; }
.wg-h{ font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--mut); text-align:center; padding-bottom:3px; }
.wg-hr{ font-family:'JetBrains Mono',monospace; font-size:9px; color:var(--mut); display:flex; align-items:center; justify-content:flex-end; padding-right:5px; }
.wg-cell{ height:15px; background:var(--bg2); border:1px solid var(--line); border-radius:3px; cursor:pointer; }
.wg-cell:hover{ border-color:#2b5141; }
.wg-cell.on{ background:var(--em); border-color:var(--em); }
.chips2{ display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }
.chip2{ background:var(--bg2); border:1px solid var(--line); border-radius:8px; padding:4px 9px; font-family:'JetBrains Mono',monospace; font-size:12px; color:#cfe6da; display:inline-flex; gap:6px; align-items:center; }
.chip2 button{ background:none; border:none; cursor:pointer; color:var(--mut); display:grid; padding:0; }
.btn{ background:var(--em); color:#06100b; border:none; border-radius:10px; padding:10px 16px; font-weight:800; font-size:14px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; }
.btn:hover{ background:#4ce39a; } .btn:disabled{ opacity:.45; cursor:default; }
.btn-ghost{ background:var(--bg2); color:var(--txt); border:1px solid var(--line); border-radius:10px; padding:9px 14px; font-weight:700; font-size:14px; cursor:pointer; display:inline-flex; align-items:center; gap:7px; }
.note{ font-family:'JetBrains Mono',monospace; font-size:10.5px; color:var(--mut); margin-top:8px; }
.prof-foot{ display:flex; align-items:center; gap:14px; margin-top:26px; }
.save{ padding:12px 26px; }
/* bitmap/LED display layer — display elements only, body stays legible */
.hero-logo, .hero-h1, .ab-logo, .page-h, .prof-h, .tier-head h2{ font-family:'Jersey 25','Anton',sans-serif !important; letter-spacing:1.5px; font-weight:400 !important; }
.hero-h1{ line-height:.92 !important; }
.prof-head{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; position:sticky; top:60px; background:var(--bg); z-index:10; padding:12px 0 14px; border-bottom:1px solid var(--line); margin-bottom:10px; }
.save-top{ padding:12px 24px; font-size:15px; white-space:nowrap; box-shadow:0 8px 24px -10px rgba(47,210,134,.5); }
.btn-ghost.connected{ border-color:var(--em); color:var(--em); }
`;

/* ===================== App ===================== */
const TABS = [["suggested", "Suggested"], ["all", "All available"], ["applied", "Applied"], ["profile", "Profile"]];
export default function McClawProduct() {
  const [screen, setScreen] = useState("landing");
  const [tab, setTab] = useState("suggested");
  const [profile, setProfile] = useState(null);
  const [applied, setApplied] = useState([]);
  const onApply = (id) => { if (!profile) { setTab("profile"); return; } setApplied((a) => (a.includes(id) ? a : [...a, id])); };
  const enter = (t) => { setTab(t); setScreen("app"); };

  return (
    <div className="root">
      <style>{STYLE}</style>
      {screen === "landing" ? (
        <Landing onEnter={() => enter(profile ? "suggested" : "profile")} onBrowse={() => enter("all")} />
      ) : (
        <>
          <header className="appbar">
            <div className="ab-logo"><span className="lf" /> McClaw</div>
            {TABS.map(([k, label]) => (
              <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
                {label}{k === "applied" && applied.length ? ` (${applied.length})` : ""}
              </button>
            ))}
            <div className="ab-prof">{profile ? `${profile.location} · ${profile.hoursPerWeek}h/wk · rep ${profile.reputation}` : "no profile"}</div>
          </header>
          <main className="page">
            {tab === "suggested" && <><h1 className="page-h">Suggested for you</h1><Suggested profile={profile} applied={applied} onApply={onApply} goProfile={() => setTab("profile")} /></>}
            {tab === "all" && <><h1 className="page-h">All available</h1><AllAvailable profile={profile} applied={applied} onApply={onApply} /></>}
            {tab === "applied" && <><h1 className="page-h">Applied</h1><Applied applied={applied} profile={profile} onApply={onApply} /></>}
            {tab === "profile" && <ProfilePage profile={profile} onSave={setProfile} />}
          </main>
        </>
      )}
    </div>
  );
}
