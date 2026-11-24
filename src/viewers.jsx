import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import python from "highlight.js/lib/languages/python";
import json from "highlight.js/lib/languages/json";
import sql from "highlight.js/lib/languages/sql";
import ini from "highlight.js/lib/languages/ini";
import plaintext from "highlight.js/lib/languages/plaintext";
import evidenceIndex from "./data/evidence-index.json";
import fileContent from "./data/file-content.json";
import { Shots } from "./components.jsx";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("python", python);
hljs.registerLanguage("json", json);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("plaintext", plaintext);

const LANG = { sh: "bash", yaml: "yaml", yml: "yaml", py: "python", json: "json", sql: "sql", md: "plaintext", txt: "plaintext", csv: "plaintext", log: "plaintext" };
export const langOf = (name) => LANG[name.split(".").pop()] || (name.endsWith("VERSIONS") ? "plaintext" : "plaintext");
export const kb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`);

/* ---------- file text: embedded in the bundle, fetch only as a fallback ---------- */
const cache = new Map(Object.entries(fileContent));
export function useText(url) {
  const [state, set] = useState(() => (cache.has(url) ? { text: cache.get(url) } : { loading: true }));
  useEffect(() => {
    if (!url) return;
    if (cache.has(url)) { set({ text: cache.get(url) }); return; }
    let live = true;
    set({ loading: true });
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status))))
      .then((t) => { cache.set(url, t); live && set({ text: t }); })
      .catch((e) => live && set({ error: String(e) }));
    return () => { live = false; };
  }, [url]);
  return state;
}

/* ---------- highlighted code with line numbers ---------- */
export function CodeBlock({ text, lang = "plaintext", maxHeight }) {
  const html = useMemo(() => {
    try { return hljs.highlight(text, { language: lang, ignoreIllegals: true }).value; } catch { return text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]); }
  }, [text, lang]);
  const lines = text.split("\n").length;
  return (
    <div className="codeblock" style={maxHeight ? { maxHeight } : undefined}>
      <pre className="gutter" aria-hidden>{Array.from({ length: lines }, (_, i) => i + 1).join("\n")}</pre>
      <pre className="hl-code"><code className={`hljs language-${lang}`} dangerouslySetInnerHTML={{ __html: html }} /></pre>
    </div>
  );
}

function CopyBtn({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="mini" onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1200); })}>
      {ok ? "Copied" : "Copy"}
    </button>
  );
}

/* ---------- one log file: label, inline viewer ---------- */
export function LogFile({ file, open: initial = false }) {
  const [open, setOpen] = useState(initial);
  const { text, loading, error } = useText(open ? file.path : null);
  return (
    <div className={`logfile ${open ? "open" : ""}`}>
      <button className="logfile-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="chev">{open ? "▾" : "▸"}</span>
        <span className="lf-name">{file.name}</span>
        <span className="lf-label">{file.label}</span>
        <span className="lf-size">{kb(file.bytes)}</span>
      </button>
      {open && (
        <div className="logfile-body">
          <div className="lf-tools">
            {text && <CopyBtn text={text} />}
            <a className="mini" href={file.path} target="_blank" rel="noreferrer">Open raw</a>
            <a className="mini" href={file.path} download>Download</a>
          </div>
          {loading && <div className="muted small pad">Loading…</div>}
          {error && <div className="muted small pad">Could not load ({error})</div>}
          {text && <CodeBlock text={text} lang={langOf(file.name)} maxHeight={460} />}
        </div>
      )}
    </div>
  );
}

const groupByKey = Object.fromEntries(evidenceIndex.map((g) => [g.key, g]));

export function EvidencePanel({ groupKey, shots, title = "Raw logs" }) {
  const g = groupByKey[groupKey];
  if (!g && !shots?.length) return null;
  return (
    <div className="evidence-panel">
      {g && (
        <>
          <h4>{title} <span className="count">{g.files.length}</span></h4>
          <p className="muted small">Captured during the run, scrubbed of account, network and user identifiers. Click a file to read it here.</p>
          <div className="logfiles">{g.files.map((f) => <LogFile key={f.path} file={f} />)}</div>
        </>
      )}
      {shots?.length > 0 && <><h4>Screenshots <span className="count">{shots.length}</span></h4><Shots items={shots} /></>}
    </div>
  );
}

/* ---------- debugging docs (markdown from the repo) ---------- */
const DOCS = import.meta.glob("./content/debugging/*.md", { query: "?raw", import: "default", eager: true });
const docText = (key) => DOCS[`./content/debugging/${key}.md`];
const evidenceNames = new Map(evidenceIndex.flatMap((g) => g.files.map((f) => [f.name.replace(/\.txt$/, ""), f.path])));

function renderMd(md) {
  const renderer = new marked.Renderer();
  renderer.image = ({ href, text }) => {
    const name = href.split("/").pop();
    return `<img class="doc-img" src="img/${name}" alt="${text || name}" loading="lazy" />`;
  };
  renderer.link = ({ href, text }) => {
    const name = href.split("/").pop().split("#")[0];
    if (/^https?:/.test(href)) return `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`;
    const ev = evidenceNames.get(name) || evidenceNames.get(name.replace(/\.txt$/, ""));
    if (ev) return `<a href="${ev}" target="_blank" rel="noreferrer">${text}</a>`;
    if (/screenshots\/.+\.png$/.test(href)) return `<a href="img/${name}" target="_blank" rel="noreferrer">${text}</a>`;
    return `<span class="doc-ref">${text}</span>`;
  };
  renderer.code = ({ text, lang }) => {
    const l = hljs.getLanguage(lang || "") ? lang : "plaintext";
    return `<pre><code class="hljs">${hljs.highlight(text, { language: l, ignoreIllegals: true }).value}</code></pre>`;
  };
  return marked.parse(md, { renderer, gfm: true });
}

export function DebugDoc({ docKey, title = "Debugging notes", open = true, dropFirstHeading = true }) {
  const md = docText(docKey);
  const html = useMemo(() => {
    if (!md) return "";
    const body = dropFirstHeading ? md.replace(/^# .*\n/, "") : md;
    return renderMd(body);
  }, [md, dropFirstHeading]);
  if (!hasIssues(docKey)) return null;
  return (
    <details className="debugdoc" open={open}>
      <summary><span className="pill bad">Debugging</span> {title}</summary>
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </details>
  );
}

// A doc is shown only if it records at least one issue actually hit.
export function hasIssues(key) {
  const md = docText(key);
  if (!md) return false;
  const body = md.replace(/^# .*\n/, "").trim();
  return body.length > 0 && !/^## Blockers hit\s*\nNone\./.test(body);
}

export const debugDocKeys = Object.keys(DOCS).map((k) => k.split("/").pop().replace(/\.md$/, ""));

export { evidenceIndex };
