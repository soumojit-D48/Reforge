import { ArrowRight, Code2, ShieldCheck, Terminal, Zap } from "lucide-react";
import Link from "next/link";
import { Reveal } from "./shared";

export function IntegrationSection() {
  return (
    <section id="docs" className="content-section integration-section page-shell">
      <Reveal className="integration-copy">
        <div className="section-kicker mono">05 / CONNECT</div>
        <h2>Instrument in minutes. Investigate for real.</h2>
        <p>
          Send the structured execution data you already have. Reforge turns it into an ordered,
          replayable record.
        </p>
        <div className="integration-notes">
          {[
            [Code2, "structured traces"],
            [Zap, "async processing"],
            [ShieldCheck, "project-scoped keys"],
          ].map(([Icon, label]) => {
            const I = Icon as typeof Code2;
            return (
              <span key={String(label)}>
                <I />
                {String(label)}
              </span>
            );
          })}
        </div>
        <Link className="text-link" href="#docs">
          Read the instrumentation guide <ArrowRight />
        </Link>
      </Reveal>
      <Reveal className="code-window" delay={100}>
        <div className="code-head">
          <span>
            <i />
            <i />
            <i />
          </span>
          <span className="mono">illustrative example · TypeScript</span>
        </div>
        <pre aria-label="Illustrative Reforge trace example">
          <code>
            <span className="code-key">await</span> reforge.
            <span className="code-method">trace</span>({`({\n  `}
            <span className="code-prop">name</span>:{" "}
            <span className="code-string">"customer-support-run"</span>,{`\n  `}
            <span className="code-prop">environment</span>:{" "}
            <span className="code-string">"production"</span>,{`\n  `}
            <span className="code-prop">spans</span>: run.spans,{`\n`}
            {`});`}
          </code>
        </pre>
        <div className="code-foot mono">
          <Terminal /> API SHAPE SHOWN FOR ILLUSTRATION
        </div>
      </Reveal>
    </section>
  );
}

export function AudienceSection() {
  const groups = [
    ["01", "Developers", "Find the exact step that broke, with every input and output attached."],
    ["02", "Reviewers", "Confirm uncertain evaluations with the full execution context in view."],
    ["03", "Teams", "Turn production failures into shared regression coverage that compounds."],
  ];
  return (
    <section id="teams" className="content-section audience-section page-shell">
      <Reveal>
        <div className="section-kicker mono">06 / OWNERSHIP</div>
        <h2>Built for the people who own the failure.</h2>
      </Reveal>
      <div className="audience-list">
        {groups.map(([number, title, body], index) => (
          <Reveal className="audience-item" delay={index * 70} key={title}>
            <span className="mono">{number}</span>
            <h3>{title}</h3>
            <p>{body}</p>
            <ArrowRight aria-hidden="true" />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
