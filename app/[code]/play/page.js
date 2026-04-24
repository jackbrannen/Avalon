"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../../lib/supabase"

const BG   = "#0F1923"
const CARD = "#1C2B3A"
const GOLD = "#C9A84C"
const TEXT = "#E8DCC8"
const GOOD = "#4A8FD4"
const EVIL = "#AA2222"

const QUEST_SIZES = {
  5:  [2,3,2,3,3],
  6:  [2,3,4,3,4],
  7:  [2,3,3,4,4],
  8:  [3,4,4,5,5],
  9:  [3,4,4,5,5],
  10: [3,4,4,5,5],
}

const ROLE_LABEL = {
  merlin:   "Merlin",
  percival: "Percival",
  loyal:    "Loyal Servant of Arthur",
  assassin: "The Assassin",
  morgana:  "Morgana",
  minion:   "Minion of Mordred",
}

export default function Play({ params }) {
  const code   = useMemo(() => params.code.toUpperCase(), [params.code])
  const router = useRouter()

  const [game, setGame]       = useState(null)
  const [players, setPlayers] = useState([])
  const [myId, setMyId]       = useState(null)
  const [selected, setSelected] = useState([])   // proposal selection
  const [target, setTarget]   = useState(null)   // assassination target
  const [revealed, setRevealed] = useState(false) // role visibility
  const [acting, setActing]   = useState(false)

  useEffect(() => {
    const id = localStorage.getItem(`avalon:${code}:playerId`)
    if (!id) { router.replace(`/${code}`); return }
    setMyId(id)
  }, [code])

  async function refresh() {
    const [{ data: g }, { data: p }] = await Promise.all([
      supabase.from("avalon_games").select("*").eq("code", code).single(),
      supabase.from("avalon_players").select("*").eq("game_code", code).order("seat"),
    ])
    if (g) setGame(g)
    if (p) setPlayers(p)
  }

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 1500)
    return () => clearInterval(t)
  }, [code])

  // Reset local state on phase change
  const phase = game?.phase
  useEffect(() => {
    setSelected([])
    setTarget(null)
    setRevealed(false)
    setActing(false)
  }, [phase])

  const me       = players.find(p => p.id === myId)
  const leader   = players.find(p => p.id === game?.leader_id)
  const sizes    = QUEST_SIZES[game?.player_count ?? 5] ?? [2,3,2,3,3]
  const questSize = sizes[(game?.quest_number ?? 1) - 1]
  const proposed = players.filter(p => (game?.proposed_ids ?? []).includes(p.id))

  async function rpc(fn, args = {}) {
    if (acting) return
    setActing(true)
    await supabase.rpc(fn, args)
    await refresh()
    setActing(false)
  }

  // ─── shared sub-renderers ─────────────────────────────────────

  function QuestTrack() {
    const results = game.quest_results ?? []
    return (
      <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "16px 24px 20px" }}>
        {sizes.map((sz, i) => {
          const qn     = i + 1
          const result = results[i]
          const curr   = qn === game.quest_number && !result
          const dbl    = qn === 4 && (game.player_count ?? 5) >= 7
          const bg     = result === "success" ? GOOD : result === "fail" ? EVIL : curr ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.06)"
          const border = curr ? `2px solid ${GOLD}` : result ? "2px solid transparent" : "2px solid rgba(255,255,255,0.12)"
          const col    = result ? "#fff" : curr ? GOLD : "rgba(232,220,200,0.4)"
          return (
            <div key={i} style={{ flex: 1, maxWidth: 60, aspectRatio: "1", borderRadius: "50%", background: bg, border, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: col, lineHeight: 1 }}>{sz}</span>
              {dbl && <span style={{ fontSize: 8, fontWeight: 800, color: col, marginTop: 1 }}>†</span>}
            </div>
          )
        })}
      </div>
    )
  }

  function Header({ sub }) {
    return (
      <div style={{ background: "rgba(0,0,0,0.35)", paddingBottom: 0 }}>
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(232,220,200,0.35)" }}>
            Avalon · {code}
          </div>
          {sub && <div style={{ fontSize: 14, fontWeight: 800, color: GOLD, marginTop: 4 }}>{sub}</div>}
        </div>
        <QuestTrack />
      </div>
    )
  }

  function PlayerRow({ p, onClick, highlight, dim }) {
    return (
      <div
        onClick={onClick}
        style={{
          background: highlight ? "rgba(201,168,76,0.18)" : CARD,
          border: highlight ? `2px solid ${GOLD}` : "2px solid transparent",
          padding: "13px 16px",
          display: "flex", alignItems: "center", gap: 10,
          cursor: onClick ? "pointer" : "default",
          opacity: dim ? 0.45 : 1,
        }}
      >
        {highlight !== undefined && (
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: highlight ? GOLD : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {highlight && <span style={{ fontSize: 11, fontWeight: 900, color: "#000" }}>✓</span>}
          </div>
        )}
        <span style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>
          {p.name}
          {p.id === myId   && <span style={{ opacity: 0.4, fontSize: 11, fontWeight: 600 }}> you</span>}
          {p.id === game?.leader_id && <span style={{ opacity: 0.45, fontSize: 11, fontWeight: 600 }}> ♛</span>}
        </span>
      </div>
    )
  }

  function BigBtn({ label, onClick, disabled, color = GOLD, textColor = "#000" }) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          background: disabled ? "rgba(255,255,255,0.05)" : color,
          color: disabled ? "rgba(232,220,200,0.25)" : textColor,
          fontSize: 20, fontWeight: 900, padding: "18px", width: "100%", display: "block",
        }}
      >
        {label}
      </button>
    )
  }

  // ─── loading ──────────────────────────────────────────────────

  if (!game || !me) {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(232,220,200,0.4)", fontSize: 18, fontWeight: 700 }}>Loading…</p>
      </div>
    )
  }

  // ─── role_reveal ──────────────────────────────────────────────

  if (game.phase === "role_reveal") {
    const evilPlayers      = players.filter(p => p.team === "evil")
    const merlinCandidates = players.filter(p => p.role === "merlin" || p.role === "morgana")
    const evilOthers       = evilPlayers.filter(p => p.id !== myId)

    let knownInfo
    if (me.role === "merlin") {
      knownInfo = `Evil players: ${evilPlayers.map(p => p.name).join(", ")}`
    } else if (me.role === "percival") {
      knownInfo = `Merlin is one of: ${merlinCandidates.map(p => p.name).join(", ")}`
    } else if (me.team === "evil") {
      knownInfo = evilOthers.length
        ? `Fellow evil: ${evilOthers.map(p => p.name).join(", ")}`
        : "You act alone."
    } else {
      knownInfo = "You know nothing beyond your own allegiance."
    }

    const teamColor = me.team === "good" ? GOOD : EVIL

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header sub="Role Reveal" />
        <div style={{ padding: "24px" }}>
          <div style={{ background: CARD, padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(232,220,200,0.35)", marginBottom: 14 }}>
              Your Role
            </div>
            {!revealed ? (
              <BigBtn label="Reveal My Role" onClick={() => setRevealed(true)} />
            ) : (
              <>
                <div style={{ fontSize: 30, fontWeight: 900, color: teamColor, marginBottom: 6 }}>
                  {ROLE_LABEL[me.role] ?? me.role}
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: teamColor, marginBottom: 16, opacity: 0.8 }}>
                  {me.team}
                </div>
                <div style={{ fontSize: 14, color: "rgba(232,220,200,0.65)", lineHeight: 1.55, marginBottom: 16 }}>
                  {knownInfo}
                </div>
                <button
                  onClick={() => setRevealed(false)}
                  style={{ background: "rgba(255,255,255,0.07)", color: TEXT, fontSize: 13, fontWeight: 700, padding: "10px 18px" }}
                >
                  Hide
                </button>
              </>
            )}
          </div>

          <BigBtn
            label={acting ? "Starting…" : "Everyone has seen their role — Begin Quests"}
            color="rgba(255,255,255,0.08)"
            textColor={TEXT}
            onClick={() => rpc("begin_avalon_quests", { p_code: code })}
            disabled={acting}
          />
        </div>
      </div>
    )
  }

  // ─── propose ─────────────────────────────────────────────────

  if (game.phase === "propose") {
    const amLeader = me.id === game.leader_id

    function toggleSelect(pid) {
      setSelected(prev =>
        prev.includes(pid)
          ? prev.filter(x => x !== pid)
          : prev.length < questSize ? [...prev, pid] : prev
      )
    }

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header sub={`Quest ${game.quest_number} — ${amLeader ? "Choose your team" : `${leader?.name ?? "?"} is choosing`}`} />
        <div style={{ padding: "20px 24px 0" }}>
          {game.reject_count > 0 && (
            <div style={{ fontSize: 13, fontWeight: 700, color: EVIL, marginBottom: 12 }}>
              {game.reject_count} / 5 consecutive rejections
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(232,220,200,0.35)", marginBottom: 8 }}>
            {amLeader ? `Select ${questSize} players` : `Need ${questSize} players`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 16 }}>
            {players.map(p => (
              <PlayerRow
                key={p.id} p={p}
                onClick={amLeader ? () => toggleSelect(p.id) : undefined}
                highlight={amLeader ? selected.includes(p.id) : undefined}
              />
            ))}
          </div>

          {amLeader && (
            <BigBtn
              label={acting ? "Submitting…" : `Propose Team (${selected.length}/${questSize})`}
              disabled={selected.length !== questSize || acting}
              onClick={() => rpc("submit_avalon_proposal", { p_code: code, p_leader_id: me.id, p_player_ids: selected })}
            />
          )}
        </div>
      </div>
    )
  }

  // ─── vote ─────────────────────────────────────────────────────

  if (game.phase === "vote") {
    const amLeader = me.id === game.leader_id
    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header sub={`Quest ${game.quest_number} — Vote`} />
        <div style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(232,220,200,0.35)", marginBottom: 8 }}>
            Proposed Team
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 20 }}>
            {proposed.map(p => <PlayerRow key={p.id} p={p} />)}
          </div>

          {game.reject_count > 0 && (
            <div style={{ fontSize: 13, fontWeight: 700, color: EVIL, marginBottom: 16 }}>
              {game.reject_count} / 5 consecutive rejections
            </div>
          )}

          {amLeader ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.6, marginBottom: 14 }}>
                Everyone votes — then record the result:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => rpc("resolve_avalon_vote", { p_code: code, p_approved: true })}
                  disabled={acting}
                  style={{ flex: 1, background: GOOD, color: "#fff", fontSize: 18, fontWeight: 900, padding: 18 }}
                >
                  Approved
                </button>
                <button
                  onClick={() => rpc("resolve_avalon_vote", { p_code: code, p_approved: false })}
                  disabled={acting}
                  style={{ flex: 1, background: EVIL, color: "#fff", fontSize: 18, fontWeight: 900, padding: 18 }}
                >
                  Rejected
                </button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 15, opacity: 0.55, paddingTop: 8 }}>
              Waiting for {leader?.name ?? "the leader"} to record the vote…
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── mission ──────────────────────────────────────────────────

  if (game.phase === "mission") {
    const onMission    = (game.proposed_ids ?? []).includes(me.id)
    const submitted    = proposed.filter(p => p.submitted_card).length
    const total        = proposed.length
    const myCard       = me.submitted_card

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header sub={`Quest ${game.quest_number} — Mission`} />
        <div style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(232,220,200,0.35)", marginBottom: 8 }}>
            On this mission ({submitted}/{total} submitted)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 24 }}>
            {proposed.map(p => (
              <div key={p.id} style={{ background: CARD, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: p.submitted_card ? "#12BAAA" : "rgba(255,255,255,0.18)" }} />
                <span style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>
                  {p.name}
                  {p.id === myId && <span style={{ opacity: 0.4, fontSize: 11 }}> you</span>}
                </span>
                {p.submitted_card && <span style={{ fontSize: 11, color: "#12BAAA", fontWeight: 700 }}>✓</span>}
              </div>
            ))}
          </div>

          {onMission && !myCard && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.65, marginBottom: 14 }}>
                Play your mission card secretly:
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => rpc("submit_avalon_card", { p_code: code, p_player_id: me.id, p_card: "success" })}
                  disabled={acting}
                  style={{ flex: 1, background: GOOD, color: "#fff", fontSize: 18, fontWeight: 900, padding: 18 }}
                >
                  Success
                </button>
                {me.team === "evil" && (
                  <button
                    onClick={() => rpc("submit_avalon_card", { p_code: code, p_player_id: me.id, p_card: "fail" })}
                    disabled={acting}
                    style={{ flex: 1, background: EVIL, color: "#fff", fontSize: 18, fontWeight: 900, padding: 18 }}
                  >
                    Fail
                  </button>
                )}
              </div>
            </>
          )}
          {onMission && myCard && (
            <div style={{ fontSize: 15, color: "#12BAAA", fontWeight: 700 }}>
              Card submitted — waiting for others…
            </div>
          )}
          {!onMission && (
            <div style={{ fontSize: 15, opacity: 0.55 }}>
              You are not on this mission. Waiting…
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── result ───────────────────────────────────────────────────

  if (game.phase === "result") {
    const results    = game.quest_results ?? []
    const lastResult = results[results.length - 1]
    const goodWins   = results.filter(r => r === "success").length
    const evilWins   = results.filter(r => r === "fail").length
    const failCount  = proposed.filter(p => p.submitted_card === "fail").length
    const succCount  = proposed.length - failCount

    const nextLabel  = goodWins >= 3
      ? (acting ? "…" : "Proceed to Assassination →")
      : evilWins >= 3
        ? (acting ? "…" : "View Final Results →")
        : (acting ? "…" : "Next Quest →")

    const resultColor = lastResult === "success" ? GOOD : EVIL

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header sub={`Quest ${game.quest_number} — Result`} />
        <div style={{ padding: "20px 24px" }}>
          <div style={{
            background: lastResult === "success" ? "rgba(74,143,212,0.12)" : "rgba(170,34,34,0.12)",
            border: `2px solid ${resultColor}`,
            padding: "28px 24px", marginBottom: 24, textAlign: "center",
          }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: resultColor, marginBottom: 8 }}>
              {lastResult === "success" ? "Success" : "Fail"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.65 }}>
              {succCount} success · {failCount} fail
            </div>
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, textAlign: "center", marginBottom: 24, opacity: 0.55 }}>
            Quest wins — Good: {goodWins} · Evil: {evilWins}
          </div>

          <BigBtn
            label={nextLabel}
            onClick={() => rpc("advance_avalon_quest", { p_code: code })}
            disabled={acting}
          />
        </div>
      </div>
    )
  }

  // ─── assassination ────────────────────────────────────────────

  if (game.phase === "assassination") {
    const amAssassin = me.role === "assassin"
    const goodPlayers = players.filter(p => p.team === "good")

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header sub="Assassination" />
        <div style={{ padding: "20px 24px" }}>
          {amAssassin ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.55, marginBottom: 20, color: "rgba(232,220,200,0.8)" }}>
                Good has won 3 quests. Who is Merlin? Choose wisely — your choice determines the game.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 20 }}>
                {goodPlayers.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setTarget(p.id)}
                    style={{
                      background: target === p.id ? "rgba(170,34,34,0.2)" : CARD,
                      border: target === p.id ? `2px solid ${EVIL}` : "2px solid transparent",
                      padding: "13px 16px",
                      display: "flex", alignItems: "center", gap: 10,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: target === p.id ? EVIL : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {target === p.id && <span style={{ fontSize: 11, color: "#fff", fontWeight: 900 }}>✗</span>}
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>
                      {p.name}
                      {p.id === myId && <span style={{ opacity: 0.4, fontSize: 11 }}> you</span>}
                    </span>
                  </div>
                ))}
              </div>
              <BigBtn
                label={acting ? "…" : "Assassinate"}
                color={EVIL}
                textColor="#fff"
                disabled={!target || acting}
                onClick={() => rpc("submit_avalon_assassination", { p_code: code, p_target_id: target })}
              />
            </>
          ) : (
            <div style={{ fontSize: 15, opacity: 0.55, paddingTop: 8 }}>
              The Assassin is choosing their target…
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── finished ────────────────────────────────────────────────

  if (game.phase === "finished") {
    const goodWon = game.winning_team === "good"
    const winColor = goodWon ? GOOD : EVIL

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header sub="Game Over" />
        <div style={{ padding: "20px 24px" }}>
          <div style={{
            background: goodWon ? "rgba(74,143,212,0.12)" : "rgba(170,34,34,0.12)",
            border: `2px solid ${winColor}`,
            padding: "28px 24px", marginBottom: 24, textAlign: "center",
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: winColor, marginBottom: 10 }}>
              {goodWon ? "Good" : "Evil"} wins
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: winColor, lineHeight: 1.2 }}>
              {goodWon ? "The Round Table Prevails" : "Evil Triumphs"}
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(232,220,200,0.35)", marginBottom: 10 }}>
            Roles Revealed
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 20 }}>
            {players.map(p => (
              <div key={p.id} style={{
                background: CARD, padding: "13px 16px",
                display: "flex", alignItems: "center", gap: 10,
                borderLeft: `3px solid ${p.team === "good" ? GOOD : EVIL}`,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    {p.name}
                    {p.id === myId && <span style={{ opacity: 0.4, fontSize: 11 }}> you</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: p.team === "good" ? GOOD : EVIL, marginTop: 2 }}>
                    {ROLE_LABEL[p.role] ?? p.role}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <BigBtn
            label="Play Again"
            color="rgba(255,255,255,0.08)"
            textColor={TEXT}
            onClick={async () => {
              await supabase.from("avalon_games").update({
                phase: "lobby", quest_results: [], winning_team: null,
                proposed_ids: [], reject_count: 0, quest_number: 1,
                leader_id: null, player_count: null,
              }).eq("code", code)
              await supabase.from("avalon_players").update({
                role: null, team: null, seat: null, submitted_card: null,
              }).eq("game_code", code)
              router.replace(`/${code}`)
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "rgba(232,220,200,0.4)", fontSize: 18, fontWeight: 700 }}>Loading…</p>
    </div>
  )
}
