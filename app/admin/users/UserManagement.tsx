"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BLOCKS } from "../../lib/constants";

type User = { id: string; username: string; displayName: string; role: string; blockNo: string | null; active: number };

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [role, setRole] = useState("block");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/users");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    setUsers(payload.users);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/users").then(async (response) => ({ response, payload: await response.json() })).then(({ response, payload }) => {
      if (!active) return;
      if (!response.ok) setError(payload.error);
      else setUsers(payload.users);
    }).catch(() => active && setError("Unable to load users."));
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    const form = event.currentTarget;
    const response = await fetch("/api/admin/users", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error); return; }
    if (payload.signedOut) { window.location.reload(); return; }
    form.reset(); setRole("block"); setMessage("User saved. Existing sessions for that username were signed out.");
    await load();
  }

  async function toggle(user: User) {
    setError("");
    const response = await fetch("/api/admin/users", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: user.id, active: !user.active }),
    });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error); return; }
    await load();
  }

  return <section className="wrap users-shell">
    {error && <p className="form-error">{error}</p>}{message && <p className="form-success">{message}</p>}
    <div className="admin-card">
      <form className="user-form" onSubmit={submit}>
        <label>Name<input name="displayName" required /></label>
        <label>Username<input name="username" required minLength={3} autoCapitalize="none" /></label>
        <label>Password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
        <label>Role<select name="role" value={role} onChange={(event) => setRole(event.target.value)}><option value="block">Block Coordinator</option><option value="cultural">Cultural Committee</option><option value="admin">Portal Administrator</option></select></label>
        {role === "block" && <label>Assigned block<select name="blockNo" required>{BLOCKS.map((block) => <option key={block}>{block}</option>)}</select></label>}
        <button className="button primary user-submit">Save User Access</button>
      </form>
      <p className="user-help">Submitting an existing username resets its password, role and block assignment.</p>
      <div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Block</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {users.map((user) => <tr key={user.id}><td><strong>{user.displayName}</strong><small>{user.username}</small></td><td>{user.role === "block" ? "Block Coordinator" : user.role === "cultural" ? "Cultural Committee" : "Portal Administrator"}</td><td>{user.blockNo ?? (user.role === "block" ? "—" : "All")}</td><td>{user.active ? "Active" : "Disabled"}</td><td><button className="button quiet" onClick={() => void toggle(user)}>{user.active ? "Disable" : "Reactivate"}</button></td></tr>)}
      </tbody></table></div>
    </div>
  </section>;
}
