"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Vote, ShoppingBag, ListChecks, Trash2 } from "lucide-react";
import {
  addGroupChecklist, addGroupExpense, createGroup, getGroup, GroupTrip, inviteToGroup,
  listGroups, voteOnGroup,
} from "@/lib/api";

export default function GroupTrips({ loggedIn }: { loggedIn: boolean }) {
  const [owned, setOwned] = useState<GroupTrip[]>([]);
  const [joined, setJoined] = useState<GroupTrip[]>([]);
  const [selected, setSelected] = useState<GroupTrip | null>(null);
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [voteOption, setVoteOption] = useState("");
  const [newMember, setNewMember] = useState("");
  const [splitMember, setSplitMember] = useState("");
  const [splitAmount, setSplitAmount] = useState(0);
  const [splitLabel, setSplitLabel] = useState("");
  const [checkItem, setCheckItem] = useState("");

  async function load() {
    if (!loggedIn) return;
    setBusy(true); setError(null);
    try {
      const out = await listGroups();
      setOwned(out.owned as GroupTrip[]);
      setJoined(out.joined as GroupTrip[]);
      if (selected) setSelected(await getGroup(selected.id));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load groups."); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, [loggedIn]);

  if (!loggedIn) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <p className="text-sm text-mist2">Sign in to plan trips together with friends.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 rise-in">
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Users size={13} className="text-amber" /> Group Trips
        </p>
        <p className="text-sm text-mist2 mt-1">Plan together, vote on ideas, split expenses, and share checklists.</p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name"
            className="bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Destination (optional)"
            className="bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          <button onClick={async () => {
            if (!name.trim()) return;
            try {
              await createGroup({ name: name.trim(), trip_destination: destination.trim() });
              setName(""); setDestination("");
              await load();
            } catch (e) { setError(e instanceof Error ? e.message : "Could not create group."); }
          }} className="text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold flex items-center gap-1.5 justify-center">
            <Plus size={12} /> Create
          </button>
        </div>

        {error && <p className="text-xs text-alert mt-2">{error}</p>}
        {busy && <p className="text-xs text-mist2 mt-2">Loading…</p>}
      </div>

      {(owned.length || joined.length) > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...owned, ...joined].map((g) => (
            <button key={g.id} onClick={() => setSelected(g)}
              className={`glass-panel rounded-2xl p-4 text-left border ${selected?.id === g.id ? "border-amber" : "border-line2"}`}>
              <p className="font-semibold">{g.name}</p>
              <p className="text-xs text-mist2 mt-1">Code: {g.share_code}</p>
              <p className="text-xs text-mist2 mt-0.5">{g.members?.length ?? 0} members · {g.trip_destination ?? "no destination"}</p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <GroupDetails group={selected} voteOption={voteOption} setVoteOption={setVoteOption}
                      newMember={newMember} setNewMember={setNewMember}
                      splitMember={splitMember} setSplitMember={setSplitMember}
                      splitAmount={splitAmount} setSplitAmount={setSplitAmount}
                      splitLabel={splitLabel} setSplitLabel={setSplitLabel}
                      checkItem={checkItem} setCheckItem={setCheckItem}
                      onChanged={async () => { await load(); }}
                      voteOnGroup={voteOnGroup}
                      inviteToGroup={inviteToGroup}
                      addGroupExpense={addGroupExpense}
                      addGroupChecklist={addGroupChecklist}
        />
      )}
    </div>
  );
}

function GroupDetails(props: {
  group: GroupTrip;
  voteOption: string; setVoteOption: (s: string) => void;
  newMember: string; setNewMember: (s: string) => void;
  splitMember: string; setSplitMember: (s: string) => void;
  splitAmount: number; setSplitAmount: (n: number) => void;
  splitLabel: string; setSplitLabel: (s: string) => void;
  checkItem: string; setCheckItem: (s: string) => void;
  onChanged: () => Promise<void>;
  voteOnGroup: typeof voteOnGroup;
  inviteToGroup: typeof inviteToGroup;
  addGroupExpense: typeof addGroupExpense;
  addGroupChecklist: typeof addGroupChecklist;
}) {
  const totalSplits = (props.group.expense_splits ?? []).reduce<number>(
    (s, e: Record<string, unknown>) => s + (Number(e.amount) || 0), 0);
  return (
    <div className="glass-panel rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-mist2">{props.group.name} · share code {props.group.share_code}</p>
        <p className="text-sm text-mist2 mt-1">Trip to {props.group.trip_destination ?? "—"}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-mist2">Members</p>
        <ul className="mt-2 space-y-1">
          {(props.group.members ?? []).map((m, i) => (
            <li key={i} className="text-sm flex justify-between border-b border-line2 py-1">
              <span>{m.name}</span><span className="text-xs text-amber">{m.role}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input value={props.newMember} onChange={(e) => props.setNewMember(e.target.value)}
            placeholder="Friend's name" className="flex-1 bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          <button onClick={async () => {
            if (!props.newMember.trim()) return;
            try { await props.inviteToGroup(props.group.id, [props.newMember.trim()]);
                  props.setNewMember(""); await props.onChanged(); }
            catch { /* ignore */ }
          }} className="text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold flex items-center gap-1.5">
            <Plus size={12} /> Invite
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <Vote size={12} className="text-amber" /> Vote
        </p>
        <div className="mt-2 flex gap-2">
          <input value={props.voteOption} onChange={(e) => props.setVoteOption(e.target.value)}
            placeholder="Option (e.g. Beach resort)" className="flex-1 bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          <button onClick={async () => {
            if (!props.voteOption.trim()) return;
            await props.voteOnGroup(props.group.id, { option: props.voteOption.trim() });
            props.setVoteOption(""); await props.onChanged();
          }} className="text-xs px-3 py-2 rounded-lg border border-amber text-amber">Vote</button>
        </div>
        <ul className="mt-2 space-y-1">
          {(props.group.votes ?? []).map((v: Record<string, unknown>, i) => (
            <li key={i} className="text-xs flex justify-between border-b border-line2 py-1">
              <span>{String(v.voter ?? "Member")}: <b>{String(v.option ?? "")}</b></span>
              <span className="text-mist2">{String(v.at ?? "").slice(11, 16)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <ShoppingBag size={12} className="text-amber" /> Expense split · total ₹{totalSplits.toFixed(2)}
        </p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input value={props.splitMember} onChange={(e) => props.setSplitMember(e.target.value)}
            placeholder="Member name" className="bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          <input type="number" value={props.splitAmount || ""} onChange={(e) => props.setSplitAmount(Number(e.target.value) || 0)}
            placeholder="Amount" className="bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          <input value={props.splitLabel} onChange={(e) => props.setSplitLabel(e.target.value)}
            placeholder="Label (optional)" className="bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
        </div>
        <button onClick={async () => {
          if (!props.splitMember.trim() || !props.splitAmount) return;
          await props.addGroupExpense(props.group.id, {
            member_name: props.splitMember.trim(),
            amount: props.splitAmount,
            label: props.splitLabel.trim() || undefined,
          });
          props.setSplitMember(""); props.setSplitAmount(0); props.setSplitLabel("");
          await props.onChanged();
        }} className="mt-2 text-xs px-3 py-2 rounded-lg bg-gradient-to-r from-amber to-amberDim text-ink font-semibold">
          Add expense
        </button>
        <ul className="mt-2 space-y-1">
          {(props.group.expense_splits ?? []).map((s: Record<string, unknown>, i) => (
            <li key={i} className="text-xs flex justify-between border-b border-line2 py-1">
              <span>{s.member_name as string} {s.label ? `· ${s.label as string}` : ""}</span>
              <span className="text-amber">₹{Number(s.amount).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-mist2 flex items-center gap-1.5">
          <ListChecks size={12} className="text-amber" /> Shared checklist
        </p>
        <div className="mt-2 flex gap-2">
          <input value={props.checkItem} onChange={(e) => props.setCheckItem(e.target.value)}
            placeholder="Add item" className="flex-1 bg-panel border border-line rounded-lg px-3 py-2 text-xs" />
          <button onClick={async () => {
            if (!props.checkItem.trim()) return;
            await props.addGroupChecklist(props.group.id, props.checkItem.trim());
            props.setCheckItem(""); await props.onChanged();
          }} className="text-xs px-3 py-2 rounded-lg border border-amber text-amber flex items-center gap-1.5">
            <Plus size={11} /> Add
          </button>
        </div>
        <ul className="mt-2 space-y-1">
          {(props.group.checklist ?? []).map((c: Record<string, unknown>, i: number) => (
            <li key={i} className="text-xs flex items-center justify-between border-b border-line2 py-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked={Boolean(c.done)}
                  onChange={async (e) => {
                    const { toggleGroupChecklist } = await import("@/lib/api");
                    await toggleGroupChecklist(props.group.id, String(c.id), e.target.checked);
                    await props.onChanged();
                  }} />
                {c.label as string}
              </label>
              <span className="text-[10px] text-mist2">{c.added_by as string}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
