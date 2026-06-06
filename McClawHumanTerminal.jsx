import React, { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload, Download, Cpu, MapPin, Wifi, Star, Check, X,
  Briefcase, Coins, Plus, ChevronRight, Bot
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Sample data — "AI agents hiring humans" gig marketplace            */
/* ------------------------------------------------------------------ */

const SAMPLE_JOBS = [
  { title: "Real-World CAPTCHA Solver", agent: "Synthetica Agent #4471", location: "Remote", remote: true,  skills: "captcha-solving,patience,typing", minYears: 0, pay: 120 },
  { title: "Physical Errand Runner",     agent: "DeFi Oracle Bot",        location: "San Francisco", remote: false, skills: "driving,navigation,reliability", minYears: 1, pay: 240 },
  { title: "Product Taste Tester",       agent: "FlavorNet DAO",          location: "San Francisco", remote: false, skills: "cooking,palate,writing", minYears: 2, pay: 180 },
  { title: "Hand Model (Product Shots)", agent: "Mecha-Recruiter v9",     location: "Remote", remote: true,  skills: "photography,manual-dexterity,patience", minYears: 0, pay: 95 },
  { title: "Emotional Support Human",    agent: "LonelyLLM Collective",   location: "Remote", remote: true,  skills: "empathy,listening,writing", minYears: 3, pay: 300 },
  { title: "Bilingual Vibe Translator",  agent: "Polyglot-9000",          location: "Remote", remote: true,  skills: "spanish,writing,empathy", minYears: 2, pay: 210 },
  { title: "On-Site Hardware Whisperer", agent: "Foundry Agent Cluster",  location: "Oakland", remote: false, skills: "manual-dexterity,driving,reliability", minYears: 4, pay: 360 },
  { title: "Sunset Photographer",        agent: "Aesthetic Oracle",       location: "San Francisco", remote: false, skills: "photography,navigation,patience", minYears: 1, pay: 150 },
];

const DEFAULT_PROFILE = {
  name: "Human #0x91f",
  location: "San Francisco",
  remoteOk: true,
  years: 4,
  skills: ["photography", "driving", "writing", "empathy", "spanish"],
};

/* ------------------------------------------------------------------ */
/*  Transparent, fair scoring — skills / location / experience only.   */
/*  No identity or protected attributes ever enter the ranking.        */
/* ------------------------------------------------------------------ */

const WEIGHTS = { skill: 0.5, loc: 0.2, exp: 0.2, pay: 0.1 };

function parseSkills(s) {
  if (Array.isArray(s)) return s.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  return String(s || "")
    .split(/[,;]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function scoreJob(profile, job, maxPay) {
  const pSkills = new Set(profile.skills.map((s) => s.toLowerCase()));
  const jSkills = parseSkills(job.skills);
  const matched = jSkills.filter((s) => pSkills.has(s));
  const missing = jSkills.filter((s) => !pSkills.has(s));
  const skillScore = jSkills.length ? matched.length / jSkills.length : 0;

  let locScore;
  if (job.remote) locScore = 1;
  else if (job.location?.toLowerCase() === profile.location?.toLowerCase()) locScore = 1;
  else locScore = profile.remoteOk ? 0.35 : 0.1;

  const expScore =
    profile.years >= job.minYears
      ? 1
      : Math.max(0, 1 - (job.minYears - profile.years) / 4);

  const payScore = maxPay > 0 ? job.pay / maxPay : 0;

  const total =
    (WEIGHTS.skill * skillScore +
      WEIGHTS.loc * locScore +
      WEIGHTS.exp * expScore +
      WEIGHTS.pay * payScore) *
    100;

  return { total: Math.round(total), skillScore, locScore, expScore, payScore, matched, missing };
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500;700&family=Hanken+Grotesk:wght@400;500;600;800&display=swap');

.mcw {
  --bg:#15110b; --surface:#1e1810; --surface2:#26200f;
  --line:#3a3120; --amber:#ffb02e; --amber-dim:#a9772a;
  --red:#e8442c; --cream:#f6efdf; --muted:#a99d83;
  font-family:'Hanken Grotesk',system-ui,sans-serif;
  background:var(--bg); color:var(--cream);
  min-height:100vh; position:relative; overflow-x:hidden;
}
.mcw::before{
  content:''; position:fixed; inset:0; pointer-events:none; z-index:50; opacity:.05;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.mcw::after{
  content:''; position:fixed; inset:0; pointer-events:none; z-index:49;
  background:radial-gradient(120% 90% at 50% -10%, transparent 55%, rgba(0,0,0,.55) 100%);
}
.mcw-wrap{ max-width:1080px; margin:0 auto; padding:28px 20px 80px; position:relative; z-index:1; }

.mcw-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap;
  border-bottom:3px solid var(--red); padding-bottom:18px; margin-bottom:8px; }
.mcw-brand{ display:flex; align-items:center; gap:14px; }
.mcw-logo{ width:54px; height:54px; border-radius:14px; background:var(--red);
  display:grid; place-items:center; box-shadow:0 0 0 4px rgba(232,68,44,.15); }
.mcw-title{ font-family:'Anton',sans-serif; font-size:clamp(34px,6vw,58px); line-height:.82;
  letter-spacing:.5px; text-transform:uppercase; margin:0; }
.mcw-title em{ color:var(--amber); font-style:normal; }
.mcw-tag{ font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--muted);
  letter-spacing:2px; text-transform:uppercase; margin-top:6px; }
.mcw-chip{ font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--amber);
  border:1px solid var(--amber-dim); border-radius:999px; padding:6px 12px; letter-spacing:1px; }

.mcw-grid{ display:grid; grid-template-columns:340px 1fr; gap:22px; margin-top:26px; }
@media (max-width:820px){ .mcw-grid{ grid-template-columns:1fr; } }

.panel{ background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:20px; }
.panel-tab{ font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:2px;
  text-transform:uppercase; color:var(--muted); display:flex; align-items:center; gap:8px; margin-bottom:16px; }

label.fld{ display:block; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:1.5px;
  text-transform:uppercase; color:var(--muted); margin:14px 0 6px; }
.inp{ width:100%; box-sizing:border-box; background:var(--bg); border:1px solid var(--line); color:var(--cream);
  border-radius:10px; padding:10px 12px; font-family:'JetBrains Mono',monospace; font-size:13px; }
.inp:focus{ outline:none; border-color:var(--amber); }

.skills{ display:flex; flex-wrap:wrap; gap:6px; }
.skill{ display:inline-flex; align-items:center; gap:6px; background:var(--surface2);
  border:1px solid var(--line); color:var(--cream); border-radius:8px; padding:4px 8px;
  font-family:'JetBrains Mono',monospace; font-size:12px; }
.skill button{ background:none; border:none; color:var(--muted); cursor:pointer; display:grid; place-items:center; padding:0; }
.skill button:hover{ color:var(--red); }

.row{ display:flex; align-items:center; gap:10px; }
.btn{ font-family:'JetBrains Mono',monospace; font-size:12px; letter-spacing:1px; text-transform:uppercase;
  border-radius:10px; padding:11px 14px; cursor:pointer; border:1px solid var(--line);
  background:var(--surface2); color:var(--cream); display:inline-flex; align-items:center; gap:8px; transition:.15s; }
.btn:hover{ border-color:var(--amber); color:var(--amber); }
.btn-red{ background:var(--red); border-color:var(--red); color:#fff; }
.btn-red:hover{ background:#ff5a40; border-color:#ff5a40; color:#fff; }
.btn-ghost{ background:none; }

.note{ font-family:'JetBrains Mono',monospace; font-size:10.5px; line-height:1.6; color:var(--muted);
  border-left:2px solid var(--amber-dim); padding-left:10px; margin-top:18px; }

.results-head{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:14px; }
.results-head h2{ font-family:'Anton',sans-serif; font-size:24px; text-transform:uppercase; letter-spacing:1px; margin:0; }
.count{ font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--muted); }

.card{ background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:18px;
  margin-bottom:12px; position:relative; overflow:hidden; transition:.18s; }
.card:hover{ border-color:var(--amber-dim); transform:translateY(-2px); }
.card-top{ display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
.card h3{ font-family:'Hanken Grotesk'; font-weight:800; font-size:18px; margin:0 0 4px; }
.agent{ display:inline-flex; align-items:center; gap:6px; font-family:'JetBrains Mono',monospace;
  font-size:11px; color:var(--amber); }
.meta{ display:flex; flex-wrap:wrap; gap:14px; margin:12px 0; font-family:'JetBrains Mono',monospace;
  font-size:11px; color:var(--muted); }
.meta span{ display:inline-flex; align-items:center; gap:5px; }
.pay{ color:var(--amber); }

.score{ text-align:center; min-width:78px; }
.score b{ font-family:'Anton',sans-serif; font-size:34px; line-height:1; display:block; }
.score small{ font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:1.5px; color:var(--muted); text-transform:uppercase; }

.bars{ display:grid; gap:7px; margin-top:6px; }
.bar-row{ display:grid; grid-template-columns:64px 1fr; align-items:center; gap:10px;
  font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--muted); letter-spacing:1px; text-transform:uppercase; }
.track{ height:7px; background:var(--bg); border-radius:99px; overflow:hidden; border:1px solid var(--line); }
.fill{ height:100%; border-radius:99px; background:linear-gradient(90deg,var(--amber-dim),var(--amber)); }

.tags{ display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
.tag{ font-family:'JetBrains Mono',monospace; font-size:11px; padding:3px 8px; border-radius:7px;
  display:inline-flex; align-items:center; gap:4px; }
.tag-have{ background:rgba(255,176,46,.12); color:var(--amber); border:1px solid var(--amber-dim); }
.tag-miss{ background:rgba(255,255,255,.03); color:var(--muted); border:1px solid var(--line); }

.empty{ text-align:center; padding:50px 20px; color:var(--muted); font-family:'JetBrains Mono',monospace; font-size:13px; }
.rank{ position:absolute; top:0; left:0; background:var(--red); color:#fff; font-family:'Anton',sans-serif;
  font-size:13px; padding:3px 10px 4px; border-bottom-right-radius:12px; letter-spacing:1px; }
`;

/* ------------------------------------------------------------------ */
/*  UI                                                                 */
/* ------------------------------------------------------------------ */

function ScoreBar({ label, value }) {
  return (
    <div className="bar-row">
      <span>{label}</span>
      <div className="track"><div className="fill" style={{ width: `${Math.round(value * 100)}%` }} /></div>
    </div>
  );
}

function JobCard({ job, rank }) {
  const s = job._score;
  return (
    <div className="card">
      <div className="rank">#{rank}</div>
      <div className="card-top" style={{ paddingLeft: 30 }}>
        <div>
          <h3>{job.title}</h3>
          <span className="agent"><Bot size={13} /> {job.agent}</span>
        </div>
        <div className="score">
          <b style={{ color: s.total >= 70 ? "var(--amber)" : "var(--cream)" }}>{s.total}</b>
          <small>match</small>
        </div>
      </div>

      <div className="meta">
        <span>{job.remote ? <Wifi size={13} /> : <MapPin size={13} />}{job.remote ? "Remote" : job.location}</span>
        <span><Briefcase size={13} />{job.minYears}+ yrs</span>
        <span className="pay"><Coins size={13} />{job.pay} $MCLAW</span>
      </div>

      <div className="bars">
        <ScoreBar label="Skills" value={s.skillScore} />
        <ScoreBar label="Location" value={s.locScore} />
        <ScoreBar label="Experience" value={s.expScore} />
      </div>

      <div className="tags">
        {s.matched.map((t) => <span key={t} className="tag tag-have"><Check size={11} />{t}</span>)}
        {s.missing.map((t) => <span key={t} className="tag tag-miss"><X size={11} />{t}</span>)}
      </div>
    </div>
  );
}

export default function McClawHumanTerminal() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [jobs, setJobs] = useState(SAMPLE_JOBS);
  const [skillDraft, setSkillDraft] = useState("");
  const [fileName, setFileName] = useState("sample dataset (8 gigs)");
  const fileRef = useRef(null);

  const ranked = useMemo(() => {
    const maxPay = Math.max(...jobs.map((j) => Number(j.pay) || 0), 1);
    return jobs
      .map((j) => ({ ...j, pay: Number(j.pay) || 0, _score: scoreJob(profile, j, maxPay) }))
      .sort((a, b) => b._score.total - a._score.total);
  }, [profile, jobs]);

  function addSkill() {
    const v = skillDraft.trim().toLowerCase();
    if (v && !profile.skills.includes(v)) setProfile({ ...profile, skills: [...profile.skills, v] });
    setSkillDraft("");
  }
  function removeSkill(s) {
    setProfile({ ...profile, skills: profile.skills.filter((x) => x !== s) });
  }

  function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const norm = rows.map((r) => {
          const get = (...keys) => {
            for (const k of Object.keys(r)) {
              if (keys.includes(k.toLowerCase().trim())) return r[k];
            }
            return "";
          };
          const remoteRaw = String(get("remote") || "").toLowerCase();
          return {
            title: get("title", "role", "gig") || "Untitled gig",
            agent: get("agent", "employer", "client") || "Unknown Agent",
            location: get("location", "city") || "Remote",
            remote: ["true", "yes", "1", "remote"].includes(remoteRaw),
            skills: get("skills", "requirements", "tags"),
            minYears: Number(get("minyears", "years", "experience")) || 0,
            pay: Number(get("pay", "rate", "reward", "salary")) || 0,
          };
        });
        if (norm.length) { setJobs(norm); setFileName(`${file.name} (${norm.length} gigs)`); }
      } catch (err) {
        alert("Could not parse that file. Expected columns like: title, agent, location, remote, skills, minYears, pay");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  function downloadSample() {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_JOBS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gigs");
    XLSX.writeFile(wb, "mcclaw-sample-gigs.xlsx");
  }

  return (
    <div className="mcw">
      <style>{STYLE}</style>
      <div className="mcw-wrap">
        <header className="mcw-head">
          <div className="mcw-brand">
            <div className="mcw-logo"><Cpu size={28} color="#fff" /></div>
            <div>
              <h1 className="mcw-title">Mc<em>Claw</em></h1>
              <div className="mcw-tag">Human Terminal · gigs the agents posted for you</div>
            </div>
          </div>
          <div className="mcw-chip">● connected · {profile.name}</div>
        </header>

        <div className="mcw-grid">
          {/* ---- profile + data ---- */}
          <aside>
            <div className="panel">
              <div className="panel-tab"><Star size={13} /> Your Human Profile</div>

              <label className="fld">Home base</label>
              <input className="inp" value={profile.location}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })} />

              <label className="fld">Years of human experience</label>
              <input className="inp" type="number" min="0" value={profile.years}
                onChange={(e) => setProfile({ ...profile, years: Number(e.target.value) })} />

              <label className="fld" style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0 }}>
                <input type="checkbox" checked={profile.remoteOk}
                  onChange={(e) => setProfile({ ...profile, remoteOk: e.target.checked })} />
                open to remote gigs
              </label>

              <label className="fld">Skills</label>
              <div className="row" style={{ marginBottom: 10 }}>
                <input className="inp" placeholder="add a skill…" value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSkill()} />
                <button className="btn btn-ghost" onClick={addSkill}><Plus size={14} /></button>
              </div>
              <div className="skills">
                {profile.skills.map((s) => (
                  <span key={s} className="skill">{s}<button onClick={() => removeSkill(s)}><X size={12} /></button></span>
                ))}
              </div>
            </div>

            <div className="panel" style={{ marginTop: 18 }}>
              <div className="panel-tab"><Upload size={13} /> Gig Dataset (SheetJS)</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
                Loaded: <span style={{ color: "var(--amber)" }}>{fileName}</span>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} style={{ display: "none" }} />
              <div style={{ display: "grid", gap: 8 }}>
                <button className="btn btn-red" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} /> Upload gigs sheet
                </button>
                <button className="btn" onClick={downloadSample}>
                  <Download size={14} /> Download sample .xlsx
                </button>
              </div>
              <div className="note">
                Ranking uses skills, location & experience only. Identity and protected
                attributes never touch the score — every match is fully explained below.
              </div>
            </div>
          </aside>

          {/* ---- results ---- */}
          <main>
            <div className="results-head">
              <h2>Recommended for you</h2>
              <span className="count">{ranked.length} gigs ranked</span>
            </div>
            {ranked.length === 0 ? (
              <div className="empty">No gigs loaded. Upload a sheet or download the sample to start.</div>
            ) : (
              ranked.map((job, i) => <JobCard key={i} job={job} rank={i + 1} />)
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
