"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BLOCKS } from "../lib/constants";

type Flat = {
  id: string;
  blockNo: string;
  flatNo: string;
  residentName: string;
  visitStatus: string;
  visitNotes: string;
};

type User = { role: string; blockNo: string | null };

export function PendingFlats() {
  const [flats, setFlats] = useState<Flat[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [block, setBlock] = useState("");
  const [error, setError] = useState("");

  const applyPayload = useCallback((payload: { flats: Flat[]; user: User; block?: string }) => {
    setFlats(payload.flats);
    setUser(payload.user);
    setBlock(payload.block ?? payload.user.blockNo ?? "");
  }, []);

  const load = useCallback(async (requestedBlock?: string) => {
    const response = await fetch(`/api/flats${requestedBlock ? `?block=${requestedBlock}` : ""}`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error);
      return;
    }
    setError("");
    applyPayload(payload);
  }, [applyPayload]);

  useEffect(() => {
    let active = true;
    fetch("/api/flats")
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok) setError(payload.error);
        else applyPayload(payload);
      })
      .catch(() => active && setError("Unable to load the visit queue."));
    return () => { active = false; };
  }, [applyPayload]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    payload.blockNo = block;
    const response = await fetch("/api/flats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error);
      return;
    }
    form.reset();
    await load(block);
  }

  async function update(id: string, status: string, notes: string) {
    const response = await fetch("/api/flats", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, visitStatus: status, visitNotes: notes }),
    });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error);
      return;
    }
    await load(block);
  }

  return (
    <section className="wrap pending-shell">
      {error && <p className="form-error">{error}</p>}
      <div className="admin-card">
        <header>
          <div><span className="card-kicker">Visit queue</span><h2>{block ? `Block ${block}` : "Choose a block"}</h2></div>
          {user?.role === "admin" && (
            <select className="block-filter" aria-label="Choose block" value={block} onChange={(event) => { setBlock(event.target.value); void load(event.target.value); }}>
              <option value="">Choose block</option>
              {BLOCKS.map((item) => <option key={item}>{item}</option>)}
            </select>
          )}
        </header>
        <form className="inline-add" onSubmit={add}>
          <input name="flatNo" required placeholder="Flat number" />
          <input name="residentName" placeholder="Resident name (optional)" />
          <button className="button primary">Add to visit list</button>
        </form>
        <div className="flat-grid">
          {flats.map((flat) => <FlatCard key={flat.id} flat={flat} save={update} />)}
        </div>
        {!flats.length && <div className="empty-state"><p>No pending or revisit flats in this block. Add the official flat list when available.</p></div>}
      </div>
    </section>
  );
}

function FlatCard({ flat, save }: { flat: Flat; save: (id: string, status: string, notes: string) => void }) {
  const [notes, setNotes] = useState(flat.visitNotes);
  return (
    <article>
      <div><strong>Flat {flat.flatNo}</strong><small>{flat.residentName || "Resident not recorded"}</small></div>
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Visit notes" />
      <div className="row-actions">
        <button onClick={() => save(flat.id, "visited", notes)}>Visited</button>
        <button onClick={() => save(flat.id, "visit_again", notes)}>Visit again</button>
        <button className="danger" onClick={() => save(flat.id, "pending", notes)}>Pending</button>
      </div>
    </article>
  );
}
