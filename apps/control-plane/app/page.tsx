const cards = [
  ["Decisions waiting", "0", "Approvals and human requests"],
  ["Blocked workflows", "0", "Durable runs needing attention"],
  ["Financial exposure", "$0.00", "Reserved and committed"],
  ["Autonomous actions", "0", "Recorded in the audit stream"]
];

export default function Home() {
  return <main><p className="muted">Agent Foundry / control plane</p><h1>CEO overview</h1><p className="muted">A governed operating console, not a chat interface.</p><section className="grid">{cards.map(([label, value, detail]) => <article className="card" key={label}><p className="muted">{label}</p><h2>{value}</h2><p className="muted">{detail}</p></article>)}</section><section className="card" style={{ marginTop: 16 }}><h2>Foundation status</h2><p>Production writes are disabled. Mock integrations and policy tests are active.</p></section></main>;
}
