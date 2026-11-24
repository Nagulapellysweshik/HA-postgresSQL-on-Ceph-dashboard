import { Link, useParams, Navigate } from "react-router-dom";
import { tests, testBySlug, TRAFFIC } from "./data/tests.js";
import { steps } from "./data/steps.js";
import { blockers, designFindings } from "./data/blockers.js";
import { EvidencePanel, DebugDoc, evidenceIndex, hasIssues } from "./viewers.jsx";
import { Md, Shot, Shots, Chart, Video, Table, Stats, Learnings, Callout, SectionHead, FailoverBar } from "./components.jsx";
import ArchPage from "./ArchPage.jsx";

const STACK = ["Amazon EKS 1.37 (private)", "eksctl", "Rook 1.21 / Ceph 20", "CloudNativePG 1.30", "PostgreSQL 18.6 → 18.7", "PgBouncer 1.26", "HAProxy 3.4", "S3 + barman-cloud", "IRSA", "Python load generator", "Bash", "Helm"];

/* ================= Overview ================= */
export function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="kicker">Hands-on SRE / database reliability lab · Nov 2026</div>
          <h1>Building, breaking and measuring <span className="grad">highly available PostgreSQL</span> on Kubernetes</h1>
          <p className="lede">
            A 3-zone CloudNativePG cluster on Rook-Ceph, behind PgBouncer and HAProxy, on a fully private Amazon EKS cluster with no internet path.
            Then 13 tests under a payment-shaped workload — pod crashes, a whole-zone outage, disk loss, connection storms, an upgrade, a fat-finger DELETE —
            each measured from the client side, with financial invariants checked after every run.
          </p>
          <div className="tags">{STACK.map((s) => <span key={s} className="tag">{s}</span>)}</div>
          <div className="cta">
            <Link className="btn primary" to="/tests">See the failure tests →</Link>
            <Link className="btn" to="/case-study">Debugging case study</Link>
            <Link className="btn" to="/evidence">Raw logs &amp; recordings</Link>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <Stats items={[
            { v: "0", l: "acknowledged payments lost across every failure test (millions of payments)", tone: "ok" },
            { v: "24.5 s", l: "write outage when an entire availability zone was stopped", tone: "acc" },
            { v: "30 → 8 s", l: "planned-switchover outage after root-causing a PgBouncer default", tone: "acc" },
            { v: "97 s", l: "point-in-time restore after a DELETE, to 6 ms before the target" },
            { v: "3 200 tx/s", l: "durable cross-AZ payment capacity on three 4-vCPU nodes" },
            { v: String(blockers.length), l: "blockers hit and root-caused, each with evidence" },
          ]} />
        </div>
      </section>



      <ArchPage />
    </>
  );
}

/* ================= Build log ================= */
function BuildSteps() {
  return (
    <section>
      <div className="wrap narrow">
        <SectionHead kicker="Build log" title="Ten steps, bottom-up" sub="Each layer checked before the next started: a broken Ceph makes every later test meaningless. Every step has its captured logs, and the issues hit along the way (symptom → diagnosis → root cause → fix → lesson)." />
        <div className="steps">
          {steps.map((s) => (
            <div key={s.n} className="step" data-n={s.n}>
              <h3>{s.title}</h3>
              <p><Md>{s.what}</Md></p>
              {s.code && <pre><code>{s.code}</code></pre>}
              {s.result && (
                <ul className="checks">{s.result.map((r) => <li key={r}><Md>{r}</Md></li>)}</ul>
              )}
              {s.blockers?.map((b) => (
                <Callout key={b.t} tone="bad" title={<>Blocker: <Md>{b.t}</Md></>}><p><Md>{b.d}</Md></p></Callout>
              ))}
              {s.shots && <div className="grid g2">{s.shots.map((sh) => <Shot key={sh.src} {...sh} crop />)}</div>}
              <EvidencePanel groupKey={s.key} title="Logs from this step" />
              <DebugDoc docKey={s.key} title={`Step ${s.n}: issues faced and how they were fixed`} open={false} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= Tests ================= */
const GROUPS = ["Baseline", "Availability", "Connections", "Operations"];

export function Tests() {
  return (
    <section>
      <div className="wrap">
        <SectionHead kicker="Failure tests" title="13 tests under payment traffic" sub={`Every failure test ran under ${TRAFFIC} Pass criteria: zero acknowledged payments lost and the books balanced.`} />
        {GROUPS.map((g) => (
          <div key={g}>
            <h4>{g}</h4>
            <div className="grid g3">
              {tests.filter((t) => t.group === g).map((t) => (
                <Link key={t.id} to={`/tests/${t.slug}`} className="card link tcard">
                  <div className="test-head"><span className="test-id">{t.id}</span><span className="tc-title">{t.title}</span></div>
                  <p className="small"><Md>{t.headline}</Md></p>
                  <div className="tc-stats">{t.verdict.slice(0, 2).map((v) => <span key={v.l} className={`pill ${v.tone || ""}`}>{v.v} · {v.l}</span>)}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function TestDetail() {
  const { slug } = useParams();
  const t = testBySlug[slug];
  if (!t) return <Navigate to="/tests" replace />;
  const i = tests.indexOf(t);
  const prev = tests[i - 1], next = tests[i + 1];
  return (
    <section>
      <div className="wrap test-layout">
        <aside className="test-nav">
          <Link to="/tests" className="muted small">← All tests</Link>
          {tests.map((x) => <Link key={x.id} to={`/tests/${x.slug}`} className={x === t ? "on" : ""} ref={x === t ? (el) => el?.scrollIntoView({ inline: "center", block: "nearest" }) : undefined}><b>{x.id}</b> {x.title}</Link>)}
        </aside>
        <article className="test-body">
          <div className="test-head"><span className="test-id lg">{t.id}</span><span className="pill">{t.group}</span></div>
          <h1 className="t-title">{t.title}</h1>
          <p className="lede"><Md>{t.headline}</Md></p>
          <Stats items={t.verdict} compact />

          <h3>Question</h3>
          <p><Md>{t.question}</Md></p>
          <h3>Setup</h3>
          <ul>{t.setup.map((s) => <li key={s}><Md>{s}</Md></li>)}</ul>

          {t.preflight && (
            <>
              <h3>Pre-flight: three design flaws found before the fault</h3>
              <div className="grid g3">{t.preflight.map((p, k) => (
                <div key={p.title} className="card warn-card"><div className="pill warn">Finding {k + 1}</div><h3>{p.title}</h3><p className="small"><Md>{p.body}</Md></p></div>
              ))}</div>
            </>
          )}

          <h3>Results</h3>
          {t.tables?.map((tb) => <Table key={tb.caption} {...tb} />)}
          {t.failoverBar && (
            <>
              <h4>Anatomy of a 24 s unplanned failover (t2-r4)</h4>
              <FailoverBar />
            </>
          )}
          {t.chart && <Chart {...t.chart} />}
          {t.timeline && <Table caption={t.timeline.caption} head={["UTC", "+s", "Event"]} rows={t.timeline.rows} />}
          {t.caseStudy && <Callout title="Full investigation"><p>The log-by-log walk from symptom to root cause to verified fix is on the <Link to="/case-study">case study page</Link>.</p></Callout>}
          {t.video && <Video {...t.video} />}

          <h3>Learnings</h3>
          <Learnings items={t.learnings} />

          {t.blockers && (
            <>
              <h3>Blockers hit</h3>
              {t.blockers.map((b) => <Callout key={b} tone="bad"><p><Md>{b}</Md></p></Callout>)}
            </>
          )}

          <h3>Evidence</h3>
          <EvidencePanel groupKey={t.id} shots={t.shots} />
          {t.id === "T0" && <EvidencePanel groupKey="step-10" title="Load generator validation" />}

          <div className="pager">
            {prev ? <Link to={`/tests/${prev.slug}`} className="btn">← {prev.id} {prev.title}</Link> : <span />}
            {next && <Link to={`/tests/${next.slug}`} className="btn">{next.id} {next.title} →</Link>}
          </div>
        </article>
      </div>
    </section>
  );
}

/* ================= Case study ================= */
export function CaseStudy() {
  return (
    <section>
      <div className="wrap narrow">
        <div className="kicker">Debugging case study · T3</div>
        <h1>A 7.5 s database switchover that cost clients 30 s</h1>
        <p className="lede">A planned switchover under 1 500 payment tx/s finished in 7.6 s at the database, but the application couldn't write for 30.0 s. Logs from four components traced the extra 24 s to PgBouncer caching failed server logins for <code>server_login_retry</code> (default 15 s) — twice. Setting it to 1 s cut the client outage to 8.0 s, verified by re-running the identical test.</p>
        <Stats items={[
          { v: "30.0 s → 8.0 s", l: "client write outage", tone: "ok" },
          { v: "24.3 s → 2.4 s", l: "clients back after DB ready" },
          { v: "5 739 → 721", l: "client errors" },
          { v: "0 / 0", l: "acked lost, books balanced", tone: "ok" },
        ]} compact />
        <Chart src="charts/t3-compare.svg" caption="Client writes per second, both runs aligned at the promote command." />

        <h3>1 · The symptom</h3>
        <Video src="media/t3-switchover.mp4" poster="media/t3-poster.jpg" rate={2} caption="Recording of t3-r1, playing at 2×." />
        <Shot src="img/t3-r1-switchover-4-pane-live.png" caption="t3-r1 live: test summary, traffic per second, pods, operator log. Writes at 0 for 30 s while reads mostly continue." />
        <Table head={["Seconds (UTC)", "Writes ok/s", "Clients connected", "Client errors/s", "Reads ok/s"]} rows={[
          ["≤ 08:14:52", "~1 500", "64/64", "0", "~2 000"],
          ["08:14:53 – 08:15:07 (**phase A**)", "0", "**25/64**", "~39", "~2 000"],
          ["08:15:08 – 08:15:22 (**phase B**)", "0", "**3–5/64**", "**~340**", "~1 300"],
          ["08:15:23 →", "1 595 → 1 500", "64/64", "0", "~2 000"],
        ]} />

        <h3>2 · Was the database slow? No.</h3>
        <pre><code>{`08:14:50.987  promote pg-lab-1
08:14:52.398  operator: Setting primary label to unhealthy in the old primary
08:14:57.769  operator: Setting primary label
08:14:58.572  new primary = pg-lab-1          <- database side done in 7.6 s
08:15:22.902  first client ack                 <- 24.3 s later`}</code></pre>
        <p className="muted">The new primary's instance log confirms a clean promotion with no lease wait. The gap is between the database and the clients.</p>

        <h3>3 · What did PgBouncer do?</h3>
        <pre><code>{`08:14:52.835 .. 08:14:52.873    110  server conn crashed?                     <- old primary shutting down
08:14:52     ..                   4  closing because: connect failed          <- reconnect hits the old primary
`}<span className="hl">{`08:14:52     .. 08:15:07       1440  server login has been failing, cached error: connect failed (server_login_retry)`}</span>{`
08:15:07     ..                  61  new connection to server / SSL established   <- reaches the NEW primary
08:15:07     ..                  27  password authentication failed for user "app"
`}<span className="hl">{`08:15:07     .. 08:15:22       4954  server login has been failing, cached error: password authentication failed`}</span></code></pre>
        <Callout tone="warn" title="Phases A and B are each exactly one server_login_retry window (15 s).">
          <p>After one failed server login, PgBouncer caches the error and rejects every client login until the window expires — even though the new primary was ready 6 s into phase A.</p>
        </Callout>

        <h3>4 · Why did the login to the new primary fail?</h3>
        <pre><code>{`FATAL   password authentication failed for user "app"
DETAIL  Connection matched file "pg_hba.conf" line 26: "host all all all scram-sha-256"`}</code></pre>
        <ul>
          <li>The normal SCRAM rule, not a missing <code>pg_hba</code> entry; no role or password change around the promotion.</li>
          <li>The failures were PgBouncer's client sessions connected <i>before</i> the switchover (<code>age=49s</code>); fresh logins succeeded.</li>
          <li>Reproduced 2/2. Recorded as <b>open</b> (PgBouncer SCRAM pass-through), contained to &lt; 1 s by the fix.</li>
        </ul>

        <h3>5 · Fix</h3>
        <pre><code>{`# manifests/30-pooler-rw.yaml and 30-pooler-ro.yaml
spec:
  pgbouncer:
    parameters:
      server_login_retry: "1"   # was default 15 s`}</code></pre>

        <h3>6 · Verification: same test, same load</h3>
        <Shot src="img/t3-r2-switchover-tuned-4-pane-live.png" caption="t3-r2 after the fix: write outage 8.0 s" />
        <pre><code>{`08:30:09.739  promote pg-lab-2
08:30:17.197  new primary = pg-lab-2           <- database side 7.5 s (unchanged)
08:30:19.636  first client ack                 <- 2.4 s later (was 24.3 s)
`}<span className="ok">{`write_outage_s=8.037   acked_rows_lost=0   invariants_hold=True (110 851 payments)`}</span></code></pre>

        <h3>Lessons</h3>
        <Learnings items={testBySlug["t3-switchover"].learnings} />
        <h3>Evidence</h3>
        <EvidencePanel groupKey="T3" />
      </div>
    </section>
  );
}

/* ================= Blockers ================= */
function IssuesSection() {
  return (
    <section>
      <div className="wrap">
        <SectionHead kicker="Issues faced" title={`${blockers.length} issues, each root-caused`} sub="Only problems actually hit during the build and the tests: symptom → evidence → diagnosis → root cause → fix → lesson." />
        <div className="grid g3">
          {designFindings.map((d) => <div key={d.title} className="card"><h3>{d.title}</h3><p className="muted small"><Md>{d.body}</Md></p></div>)}
        </div>

        <h3>How each test issue was diagnosed</h3>
        <p className="muted small">Build-step issues are listed under each step above.</p>
        <div className="doclist">
          {tests.filter((t) => hasIssues(t.id)).map((t) => <DebugDoc key={t.id} docKey={t.id} title={`${t.id} · ${t.title}`} open={false} />)}
        </div>

      </div>
    </section>
  );
}

/* ================= Evidence ================= */
export function Evidence() {
  const stepGroups = steps.filter((st) => st.shots || evidenceIndex.some((g) => g.key === st.key));
  return (
    <section>
      <div className="wrap">
        <SectionHead kicker="Evidence" title="Screenshots, recordings and logs, per step and per test" sub="Captured live during the runs. Logs are a hand-picked subset, scrubbed of account, user, bucket and network identifiers and scanned for credentials before publishing. Click any log to read it in place." />
        <div className="toc">
          {stepGroups.map((st) => <a key={st.key} href={`#ev-${st.key}`} onClick={(e) => { e.preventDefault(); document.getElementById(`ev-${st.key}`).scrollIntoView({ behavior: "smooth" }); }}>Step {st.n}</a>)}
          {tests.map((t) => <a key={t.id} href={`#ev-${t.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`ev-${t.id}`).scrollIntoView({ behavior: "smooth" }); }}>{t.id}</a>)}
          <a href="#ev-video" onClick={(e) => { e.preventDefault(); document.getElementById("ev-video").scrollIntoView({ behavior: "smooth" }); }}>Recordings</a>
        </div>

        <h2 className="ev-h">Setup</h2>
        {stepGroups.map((st) => (
          <div key={st.key} id={`ev-${st.key}`} className="ev-group">
            <div className="ev-head"><span className="test-id">Step {st.n}</span><h3>{st.title}</h3><Link to="/build" className="small">build log →</Link></div>
            <EvidencePanel groupKey={st.key} shots={st.shots} />
          </div>
        ))}

        <h2 className="ev-h">Failure tests</h2>
        {tests.map((t) => (
          <div key={t.id} id={`ev-${t.id}`} className="ev-group">
            <div className="ev-head"><span className="test-id">{t.id}</span><h3>{t.title}</h3><Link to={`/tests/${t.slug}`} className="small">full write-up →</Link></div>
            {t.chart && <Chart {...t.chart} />}
            <EvidencePanel groupKey={t.id} shots={t.shots} />
          </div>
        ))}

        <h2 className="ev-h">Screen recordings</h2>
        <div id="ev-video" className="ev-group">
          <div className="grid g2">
            <Video src="media/t2-primary-kill.mp4" poster="media/t2-poster.jpg" rate={2} caption="**T2** primary killed (direct path), run 4, 2.3 min. Starts at 2×." />
            <Video src="media/t3-switchover.mp4" poster="media/t3-poster.jpg" rate={2} caption="**T3** planned switchover before the PgBouncer fix (30 s client outage), 2.5 min. Starts at 2×." />
            <Video src="media/t4-app-path-crash.mp4" poster="media/t4-poster.jpg" rate={2} caption="**T4** primary killed through HAProxy → PgBouncer, 1.7 min. Starts at 2×." />
            <Video src="media/t6-zone-loss-realtime.mp4" poster="media/t6-poster.jpg" rate={10} caption="**T6** whole-zone outage, 20 min. Starts at 10×." />
            <Video src="media/t10-haproxy-timing.mp4" poster="media/t10-poster.jpg" rate={4} caption="**T10** HAProxy health-check timing, 4.4 min. Starts at 4×." />
            <Video src="media/t11-upgrade-start.mp4" poster="media/t11-poster.jpg" caption="**T11** rolling upgrade, first 5 min. Starts at 1×." />
          </div>
        </div>

      </div>
    </section>
  );
}

/* ================= Build & code (one tab) ================= */
export function Build() {
  const jump = (id) => (e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };
  return (
    <>
      <div className="wrap narrow toc-top">
        <div className="toc">
          <a href="#/build" onClick={jump("steps")}>Build steps</a>
          <a href="#/build" onClick={jump("issues")}>Issues faced</a>
          <a href="https://github.com/Nagulapellysweshik/HA-postgresSQL-on-Ceph" target="_blank" rel="noreferrer">Source on GitHub ↗</a>
        </div>
      </div>
      <div id="steps"><BuildSteps /></div>
      <div id="issues" className="anchor"><IssuesSection /></div>
    </>
  );
}
