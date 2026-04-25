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
const TEAL = "#12BAAA"

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
  loyal:    "Loyal Servant of Arthur",
  assassin: "The Assassin",
  minion:   "Minion of Mordred",
}

export default function Play({ params }) {
  const code   = useMemo(() => params.code.toUpperCase(), [params.code])
  const router = useRouter()

  const [game, setGame]       = useState(null)
  const [players, setPlayers] = useState([])
  const [myId, setMyId]       = useState(null)
  const [selected, setSelected] = useState([])
  const [target, setTarget]   = useState(null)
  // "unset" | "shown" | "hiding" | "mini"
  const [cardPhase, setCardPhase] = useState("unset")
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

  const phase = game?.phase
  useEffect(() => {
    setSelected([])
    setTarget(null)
    setCardPhase("unset")
    setActing(false)
  }, [phase])

  const me        = players.find(p => p.id === myId)
  const leader    = players.find(p => p.id === game?.leader_id)
  const sizes     = QUEST_SIZES[game?.player_count ?? 5] ?? [2,3,2,3,3]
  const questSize = sizes[(game?.quest_number ?? 1) - 1]
  const proposed  = players.filter(p => (game?.proposed_ids ?? []).includes(p.id))

  async function rpc(fn, args = {}) {
    if (acting) return
    setActing(true)
    await supabase.rpc(fn, args)
    await refresh()
    setActing(false)
  }

  // ─── sub-renderers ────────────────────────────────────────────

  function QuestTrack() {
    const results = game.quest_results ?? []
    return (
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(232,220,200,0.35)", textAlign: "center", paddingTop: 14, paddingBottom: 4 }}>
          Quests
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: "0 24px 18px" }}>
          {sizes.map((sz, i) => {
            const qn     = i + 1
            const result = results[i]
            const curr   = qn === game.quest_number && !result
            const dbl    = qn === 4 && (game.player_count ?? 5) >= 7
            const bg     = result === "success" ? GOOD : result === "fail" ? EVIL : curr ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.06)"
            const border = curr ? `2px solid ${GOLD}` : result ? "2px solid transparent" : "2px solid rgba(255,255,255,0.12)"
            const col    = result ? "#fff" : curr ? GOLD : "rgba(232,220,200,0.4)"
            return (
              <div key={i} style={{ flex: 1, maxWidth: 60, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: "100%", aspectRatio: "1", borderRadius: "50%", background: bg, border, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: col, lineHeight: 1 }}>{sz}</span>
                  {dbl && <span style={{ fontSize: 8, fontWeight: 800, color: col, marginTop: 1 }}>†</span>}
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(232,220,200,0.3)", marginTop: 4 }}>{qn}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function Header({ sub, showTrack = true }) {
    return (
      <div style={{ background: "rgba(0,0,0,0.35)" }}>
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(232,220,200,0.35)" }}>
            Avalon · {code}
          </div>
          {sub && <div style={{ fontSize: 14, fontWeight: 800, color: GOLD, marginTop: 4 }}>{sub}</div>}
        </div>
        {showTrack && <QuestTrack />}
        {!showTrack && <div style={{ paddingBottom: 16 }} />}
      </div>
    )
  }

  function PlayerRow({ p, onClick, highlight, badge }) {
    return (
      <div
        onClick={onClick}
        style={{
          background: highlight ? "rgba(201,168,76,0.18)" : CARD,
          border: highlight ? `2px solid ${GOLD}` : "2px solid transparent",
          padding: "13px 16px",
          display: "flex", alignItems: "center", gap: 10,
          cursor: onClick ? "pointer" : "default",
        }}
      >
        {highlight !== undefined && (
          <div style={{ width: 22, height: 22, borderRadius: "50%", background: highlight ? GOLD : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {highlight && <span style={{ fontSize: 11, fontWeight: 900, color: "#000" }}>✓</span>}
          </div>
        )}
        <span style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>
          {p.name}
          {p.id === myId         && <span style={{ opacity: 0.4, fontSize: 11, fontWeight: 600 }}> you</span>}
          {p.id === game?.leader_id && <span style={{ opacity: 0.45, fontSize: 11, fontWeight: 600 }}> ♛</span>}
        </span>
        {badge}
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
    const evilPlayers = players.filter(p => p.team === "evil")
    const evilOthers  = evilPlayers.filter(p => p.id !== myId)
    const amReady     = me.ready
    const teamColor   = me.team === "good" ? GOOD : EVIL
    const teamLabel   = me.team === "good" ? "Good" : "Evil — Minions of Mordred"

    let knownSection = null
    if (me.role === "merlin") {
      knownSection = (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: EVIL, marginBottom: 8 }}>
            Evil Minions of Mordred
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {evilPlayers.map(p => (
              <div key={p.id} style={{ background: "rgba(170,34,34,0.15)", border: "1px solid rgba(170,34,34,0.3)", padding: "10px 14px" }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: TEXT }}>{p.name}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "rgba(232,220,200,0.55)", marginTop: 10, lineHeight: 1.6 }}>
            You are the only good player who knows the identity of the evil Minions of Mordred.
          </div>
        </div>
      )
    } else if (me.team === "evil") {
      knownSection = evilOthers.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: EVIL, marginBottom: 8 }}>
            Fellow Minions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {evilOthers.map(p => (
              <div key={p.id} style={{ background: "rgba(170,34,34,0.15)", border: "1px solid rgba(170,34,34,0.3)", padding: "10px 14px" }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: TEXT }}>{p.name}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "rgba(232,220,200,0.55)", marginTop: 10, lineHeight: 1.6 }}>
            You all know each other's identities.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14, fontSize: 14, color: "rgba(232,220,200,0.5)", lineHeight: 1.5 }}>
          You act alone.
        </div>
      )
    } else {
      knownSection = (
        <div style={{ marginTop: 14, fontSize: 14, color: "rgba(232,220,200,0.5)", lineHeight: 1.5 }}>
          You know nothing beyond your own allegiance.
        </div>
      )
    }

    function handleReveal() { setCardPhase("shown") }
    function handleHide() {
      setCardPhase("hiding")
      setTimeout(() => setCardPhase("mini"), 380)
    }
    function handleReopen() { setCardPhase("shown") }

    const showFullCard = cardPhase === "unset" || cardPhase === "shown" || cardPhase === "hiding"

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 120 }}>
        <style>{`
          @keyframes avFlipIn {
            0%   { transform: perspective(700px) rotateY(-80deg) scale(0.85); opacity: 0; }
            100% { transform: perspective(700px) rotateY(0deg)   scale(1);    opacity: 1; }
          }
          @keyframes avFlipOut {
            0%   { transform: perspective(700px) rotateY(0deg)  scale(1);    opacity: 1; }
            100% { transform: perspective(700px) rotateY(80deg) scale(0.5);  opacity: 0; }
          }
          @keyframes avMiniIn {
            0%   { transform: scale(0.6) translateY(12px); opacity: 0; }
            100% { transform: scale(1)   translateY(0);    opacity: 1; }
          }
          .av-flip-in  { animation: avFlipIn  0.35s ease forwards; }
          .av-flip-out { animation: avFlipOut 0.32s ease forwards; }
          .av-mini-in  { animation: avMiniIn  0.28s ease 0.3s both; }
        `}</style>

        {/* Header — no quest track during role reveal */}
        <div style={{ background: "rgba(0,0,0,0.35)", padding: "20px 24px 24px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: "rgba(232,220,200,0.35)" }}>
            Avalon · {code}
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color: GOLD, marginTop: 8, letterSpacing: "-1.5px", lineHeight: 1 }}>
            Role Reveal
          </div>
        </div>

        <div style={{ padding: "24px" }}>

          {/* Role card — visible when not in mini state */}
          {showFullCard && (
            <div
              className={cardPhase === "shown" ? "av-flip-in" : cardPhase === "hiding" ? "av-flip-out" : ""}
              style={{ background: CARD, padding: 24, marginBottom: 20 }}
            >
              {cardPhase === "unset" ? (
                <BigBtn label="Reveal My Role" onClick={handleReveal} />
              ) : (
                <>
                  <div style={{ fontSize: 36, fontWeight: 900, color: teamColor, lineHeight: 1.1 }}>
                    {ROLE_LABEL[me.role] ?? me.role}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: teamColor, opacity: 0.75, marginTop: 6 }}>
                    {teamLabel}
                  </div>
                  {knownSection}
                  <button
                    onClick={handleHide}
                    style={{ background: "rgba(255,255,255,0.07)", color: TEXT, fontSize: 13, fontWeight: 700, padding: "10px 18px", marginTop: 22, display: "inline-block" }}
                  >
                    Hide
                  </button>
                </>
              )}
            </div>
          )}

          {/* Mini card — fixed bottom-right */}
          {cardPhase === "mini" && (
            <div
              className="av-mini-in"
              onClick={handleReopen}
              style={{
                position: "fixed", bottom: 24, right: 24,
                background: CARD, border: `2px solid ${teamColor}`,
                padding: "14px 18px", cursor: "pointer", zIndex: 100,
                boxShadow: "0 6px 24px rgba(0,0,0,0.6)",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(232,220,200,0.4)" }}>My Role</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: teamColor, marginTop: 3 }}>{ROLE_LABEL[me.role] ?? me.role}</div>
            </div>
          )}

          {/* Ready button */}
          <div style={{ marginBottom: 20 }}>
            {!amReady ? (
              <BigBtn
                label={acting ? "…" : "I'm ready to play"}
                onClick={() => rpc("mark_avalon_ready", { p_code: code, p_player_id: myId })}
                disabled={acting}
              />
            ) : (
              <div style={{ background: "rgba(74,143,212,0.1)", border: `2px solid ${GOOD}`, padding: "16px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 17, fontWeight: 900, color: GOOD }}>You're ready!</div>
                <div style={{ fontSize: 13, color: "rgba(232,220,200,0.45)", marginTop: 4 }}>Waiting for everyone…</div>
              </div>
            )}
          </div>

          {/* Player ready list */}
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(232,220,200,0.35)", marginBottom: 10 }}>
            Players
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {players.map(p => (
              <div key={p.id} style={{ background: CARD, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: p.ready ? GOOD : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.ready && <span style={{ fontSize: 11, fontWeight: 900, color: "#fff" }}>✓</span>}
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>
                  {p.name}
                  {p.id === myId && <span style={{ opacity: 0.4, fontSize: 11 }}> you</span>}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: p.ready ? GOOD : "rgba(232,220,200,0.3)" }}>
                  {p.ready ? "Ready" : "Not ready"}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    )
  }

  // ─── propose ─────────────────────────────────────────────────

  if (game.phase === "propose") {
    const amLeader = me.id === game.leader_id
    const dblFail  = game.quest_number === 4 && (game.player_count ?? 5) >= 7

    function toggleSelect(pid) {
      setSelected(prev =>
        prev.includes(pid)
          ? prev.filter(x => x !== pid)
          : prev.length < questSize ? [...prev, pid] : prev
      )
    }

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header />
        <div style={{ padding: "20px 24px 0" }}>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 30, fontWeight: 900, color: GOLD, lineHeight: 1, letterSpacing: "-1px" }}>
              Quest {game.quest_number}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "rgba(232,220,200,0.65)", marginTop: 6 }}>
              {questSize} players needed
            </div>
            {dblFail && (
              <div style={{ fontSize: 14, color: "rgba(232,220,200,0.45)", marginTop: 4, lineHeight: 1.5 }}>
                This quest only fails if there are two fail votes.
              </div>
            )}
          </div>

          {game.reject_count > 0 && (
            <div style={{ fontSize: 13, fontWeight: 700, color: EVIL, marginBottom: 12 }}>
              {game.reject_count} / 5 consecutive rejections
            </div>
          )}

          <div style={{ fontSize: 16, fontWeight: 700, color: amLeader ? GOLD : "rgba(232,220,200,0.55)", marginBottom: 10 }}>
            {amLeader ? "Choose your team" : `${leader?.name ?? "?"} is choosing`}
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
        <Header sub={`Quest ${game.quest_number}`} />
        <div style={{ padding: "20px 24px" }}>

          <div style={{ fontSize: 28, fontWeight: 900, color: TEXT, marginBottom: 12 }}>
            Proposed Team
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 16 }}>
            {proposed.map(p => <PlayerRow key={p.id} p={p} />)}
          </div>

          <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(232,220,200,0.65)", marginBottom: 20, lineHeight: 1.55 }}>
            Vote in person. {leader?.name ?? "The leader"} will enter the result.
          </div>

          {game.reject_count > 0 && (
            <div style={{ fontSize: 13, fontWeight: 700, color: EVIL, marginBottom: 16 }}>
              {game.reject_count} / 5 consecutive rejections
            </div>
          )}

          {amLeader ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(232,220,200,0.6)", marginBottom: 14 }}>
                A tied vote means the team is rejected.
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

  // ─── quest ────────────────────────────────────────────────────

  if (game.phase === "mission") {
    const onQuest   = (game.proposed_ids ?? []).includes(me.id)
    const submitted = proposed.filter(p => p.submitted_card).length
    const total     = proposed.length
    const myCard    = me.submitted_card

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header sub={`Quest ${game.quest_number}`} />
        <div style={{ padding: "20px 24px" }}>

          <div style={{ background: "rgba(74,143,212,0.1)", border: `1px solid rgba(74,143,212,0.3)`, padding: "14px 18px", marginBottom: 20, textAlign: "center" }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: GOOD }}>Team approved!</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(232,220,200,0.6)", marginTop: 4 }}>Now time for the quest.</div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(232,220,200,0.35)", marginBottom: 8 }}>
            On this quest ({submitted}/{total} submitted)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 24 }}>
            {proposed.map(p => (
              <div key={p.id} style={{ background: CARD, padding: "13px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: p.submitted_card ? TEAL : "rgba(255,255,255,0.18)" }} />
                <span style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>
                  {p.name}
                  {p.id === myId && <span style={{ opacity: 0.4, fontSize: 11 }}> you</span>}
                </span>
                {p.submitted_card && <span style={{ fontSize: 11, color: TEAL, fontWeight: 700 }}>✓</span>}
              </div>
            ))}
          </div>

          {onQuest && !myCard && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button
                  onClick={() => rpc("submit_avalon_card", { p_code: code, p_player_id: me.id, p_card: "success" })}
                  disabled={acting}
                  style={{ flex: 1, background: GOOD, color: "#fff", fontSize: 18, fontWeight: 900, padding: 18 }}
                >
                  Quest Succeeds
                </button>
                {me.team === "evil" && (
                  <button
                    onClick={() => rpc("submit_avalon_card", { p_code: code, p_player_id: me.id, p_card: "fail" })}
                    disabled={acting}
                    style={{ flex: 1, background: EVIL, color: "#fff", fontSize: 18, fontWeight: 900, padding: 18 }}
                  >
                    Quest Fails
                  </button>
                )}
              </div>
              {me.team === "good" && (
                <div style={{ background: "rgba(74,143,212,0.08)", borderLeft: `3px solid rgba(74,143,212,0.4)`, padding: "12px 16px" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(232,220,200,0.8)", lineHeight: 1.55 }}>
                    As a loyal servant of King Arthur, you can only vote for the quest to succeed.
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(232,220,200,0.3)", marginTop: 6 }}>
                    Thank you for your service.
                  </div>
                </div>
              )}
            </>
          )}
          {onQuest && myCard && (
            <div style={{ fontSize: 15, color: TEAL, fontWeight: 700 }}>
              Card submitted — waiting for others…
            </div>
          )}
          {!onQuest && (
            <div style={{ fontSize: 15, opacity: 0.55 }}>
              You're not on this quest. Hang tight for the outcome…
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
    const resultColor = lastResult === "success" ? GOOD : EVIL

    const nextLabel = goodWins >= 3
      ? (acting ? "…" : "Unless…")
      : evilWins >= 3
        ? (acting ? "…" : "View Final Results →")
        : (acting ? "…" : "Next Quest →")

    const voteCards = [
      ...Array(succCount).fill("succeed"),
      ...Array(failCount).fill("fail"),
    ]

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header />
        <div style={{ padding: "20px 24px" }}>

          {/* Score */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "-0.5px" }}>
              <span style={{ color: GOOD }}>Good: {goodWins}</span>
              <span style={{ color: "rgba(232,220,200,0.25)", margin: "0 10px" }}>·</span>
              <span style={{ color: EVIL }}>Evil: {evilWins}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(232,220,200,0.4)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              First to three wins
            </div>
          </div>

          {/* Result banner */}
          <div style={{
            background: lastResult === "success" ? "rgba(74,143,212,0.12)" : "rgba(170,34,34,0.12)",
            border: `2px solid ${resultColor}`,
            padding: "24px 20px", marginBottom: 20, textAlign: "center",
          }}>
            <div style={{ fontSize: 38, fontWeight: 900, color: resultColor, lineHeight: 1.1 }}>
              {lastResult === "success" ? "Quest Succeeded" : "Quest Failed"}
            </div>
          </div>

          {/* Vote cards */}
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(232,220,200,0.35)", marginBottom: 10 }}>
            Quest Cards
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
            {voteCards.map((v, i) => (
              <div key={i} style={{
                background: v === "succeed" ? "rgba(74,143,212,0.15)" : "rgba(170,34,34,0.15)",
                border: `2px solid ${v === "succeed" ? GOOD : EVIL}`,
                padding: "12px 18px", minWidth: 90, textAlign: "center",
              }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: v === "succeed" ? GOOD : EVIL }}>
                  {v === "succeed" ? "Succeed" : "Fail"}
                </div>
              </div>
            ))}
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
    const amAssassin  = me.role === "assassin"
    const goodPlayers = players.filter(p => p.team === "good")

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header sub="Assassination" showTrack={false} />
        <div style={{ padding: "20px 24px" }}>

          <div style={{ background: "rgba(74,143,212,0.1)", border: `1px solid rgba(74,143,212,0.3)`, padding: "16px 20px", marginBottom: 20, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: GOOD }}>Loyal Servants of King Arthur win!</div>
          </div>

          {amAssassin ? (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.6, marginBottom: 20, color: "rgba(232,220,200,0.85)" }}>
                If you successfully assassinate Merlin, your team wins the game.
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
            <div style={{ background: "rgba(170,34,34,0.1)", border: `1px solid rgba(170,34,34,0.35)`, padding: "20px 18px" }}>
              <div style={{ fontSize: 19, fontWeight: 900, color: EVIL, marginBottom: 10 }}>
                The Assassin is choosing their target.
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(232,220,200,0.75)", lineHeight: 1.6 }}>
                If the Assassin is able to guess Merlin's identity, evil wins the game.
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── finished ────────────────────────────────────────────────

  if (game.phase === "finished") {
    const goodWon     = game.winning_team === "good"
    const winColor    = goodWon ? GOOD : EVIL
    const goodPlayers = players.filter(p => p.team === "good")
    const evilPlayers = players.filter(p => p.team === "evil")

    function RoleCard({ p }) {
      const isGood = p.team === "good"
      const color  = isGood ? GOOD : EVIL
      return (
        <div style={{
          background: isGood ? "rgba(74,143,212,0.1)" : "rgba(170,34,34,0.1)",
          border: `2px solid ${color}`,
          padding: "16px 18px",
          flex: "1 1 130px",
        }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: TEXT }}>
            {p.name}
            {p.id === myId && <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.4 }}> you</span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 5 }}>{ROLE_LABEL[p.role] ?? p.role}</div>
        </div>
      )
    }

    return (
      <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: 48 }}>
        <Header sub="Game Over" showTrack={false} />
        <div style={{ padding: "20px 24px" }}>

          <div style={{
            background: goodWon ? "rgba(74,143,212,0.12)" : "rgba(170,34,34,0.12)",
            border: `2px solid ${winColor}`,
            padding: "28px 24px", marginBottom: 28, textAlign: "center",
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: winColor, marginBottom: 10 }}>
              {goodWon ? "Good" : "Evil"} wins
            </div>
            <div style={{ fontSize: 34, fontWeight: 900, color: winColor, lineHeight: 1.2 }}>
              {goodWon ? "Long Live King Arthur." : "Evil Triumphs"}
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: GOOD, marginBottom: 10 }}>
            Loyal Servants of King Arthur
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
            {goodPlayers.map(p => <RoleCard key={p.id} p={p} />)}
          </div>

          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: EVIL, marginBottom: 10 }}>
            Minions of Mordred
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
            {evilPlayers.map(p => <RoleCard key={p.id} p={p} />)}
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
                role: null, team: null, seat: null, submitted_card: null, ready: false,
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
