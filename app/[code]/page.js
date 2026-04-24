"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"

const BG     = "#0F1923"
const CARD   = "#1C2B3A"
const GOLD   = "#C9A84C"
const TEXT   = "#E8DCC8"
const GOOD   = "#4A8FD4"
const EVIL   = "#AA2222"
const TEAL   = "#12BAAA"

const MIN_PLAYERS = 5
const MAX_PLAYERS = 10

function loadProfile() {
  try {
    const local = JSON.parse(localStorage.getItem("jackgames:profile") || "null")
    if (local?.firstName && local?.lastName) return local
    const match = document.cookie.match(/(?:^|;\s*)jackgames_profile=([^;]*)/)
    if (match) return JSON.parse(decodeURIComponent(match[1]))
  } catch {}
  return null
}

function saveProfile(profile) {
  const json = JSON.stringify(profile)
  localStorage.setItem("jackgames:profile", json)
  document.cookie = `jackgames_profile=${encodeURIComponent(json)}; domain=.jackbrannen.com; max-age=31536000; path=/; SameSite=Lax`
}

const inputStyle = {
  background: "rgba(255,255,255,0.07)", color: TEXT,
  fontSize: 20, padding: "16px 18px",
  width: "100%", display: "block",
  border: "none", outline: "none", boxSizing: "border-box",
}

export default function Lobby({ params }) {
  const router = useRouter()
  const code = useMemo(() => params.code.toUpperCase(), [params.code])

  const [gameExists, setGameExists]   = useState(null)
  const [gamePhase, setGamePhase]     = useState("lobby")
  const [players, setPlayers]         = useState([])
  const [myPlayerId, setMyPlayerId]   = useState(null)
  const [savedProfile, setSavedProfile] = useState(null)
  const [firstName, setFirstName]     = useState("")
  const [lastName, setLastName]       = useState("")
  const [name, setName]               = useState("")
  const [joining, setJoining]         = useState(false)
  const [joinError, setJoinError]     = useState("")
  const [starting, setStarting]       = useState(false)

  async function refreshPlayers() {
    const { data } = await supabase
      .from("avalon_players")
      .select("id,name,ready,created_at")
      .eq("game_code", code)
      .order("created_at", { ascending: true })
    if (data) setPlayers(data)
  }

  async function loadGame() {
    const { data, error } = await supabase
      .from("avalon_games")
      .select("code,phase")
      .eq("code", code)
      .single()
    if (error || !data) { setGameExists(false); return }
    setGameExists(true)
    setGamePhase(data.phase)
  }

  useEffect(() => {
    const saved = loadProfile()
    if (saved) { saveProfile(saved); setSavedProfile(saved); setName(saved.username || "") }
  }, [])

  useEffect(() => {
    const existing = localStorage.getItem(`avalon:${code}:playerId`)
    if (existing) setMyPlayerId(existing)
    loadGame().then(() => refreshPlayers())
  }, [code])

  useEffect(() => {
    const poll = setInterval(async () => {
      await refreshPlayers()
      const { data } = await supabase
        .from("avalon_games")
        .select("phase")
        .eq("code", code)
        .single()
      if (data) setGamePhase(data.phase)
    }, 1500)
    return () => clearInterval(poll)
  }, [code])

  useEffect(() => {
    if (gamePhase !== "lobby") router.replace(`/${code}/play`)
  }, [gamePhase])

  async function join() {
    const trimmed = name.trim()
    if (!trimmed || joining) return
    const trimmedFirst = (savedProfile?.firstName || firstName).trim()
    const trimmedLast  = (savedProfile?.lastName  || lastName).trim()
    if (!trimmedFirst || !trimmedLast) return

    setJoining(true)
    setJoinError("")

    const { data: existing } = await supabase
      .from("avalon_players")
      .select("id")
      .eq("game_code", code)
      .ilike("name", trimmed)
      .limit(1)
    if (existing?.length > 0) {
      // If this is our own saved username, recover the player ID (e.g. localStorage was cleared)
      if (savedProfile?.username?.toLowerCase() === trimmed.toLowerCase()) {
        localStorage.setItem(`avalon:${code}:playerId`, existing[0].id)
        setMyPlayerId(existing[0].id)
        await refreshPlayers()
        setJoining(false)
        return
      }
      setJoinError("That name is taken.")
      setJoining(false)
      return
    }

    const newProfile = { firstName: trimmedFirst, lastName: trimmedLast, username: trimmed }
    saveProfile(newProfile)
    setSavedProfile(newProfile)

    const { data, error } = await supabase
      .from("avalon_players")
      .insert({ game_code: code, name: trimmed, first_name: trimmedFirst, last_name: trimmedLast })
      .select("id")
      .single()

    if (error) { alert("Join error: " + error.message + " | code: " + error.code); setJoinError("Failed to join."); setJoining(false); return }
    if (!data) { alert("Join error: insert returned no data"); setJoining(false); return }
    localStorage.setItem(`avalon:${code}:playerId`, data.id)
    setMyPlayerId(data.id)
    await refreshPlayers()
    setJoining(false)
  }

  async function startGame() {
    if (starting) return
    setStarting(true)
    const { error } = await supabase.rpc("start_avalon_game", { p_code: code })
    if (error) { alert("Start failed: " + error.message); setStarting(false); return }
    router.push(`/${code}/play`)
  }

  const me = players.find(p => p.id === myPlayerId)
  const count = players.length
  const canStart = !!me && count >= MIN_PLAYERS && count <= MAX_PLAYERS

  if (gameExists === null) {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(232,220,200,0.4)", fontSize: 18, fontWeight: 700 }}>Loading…</p>
      </div>
    )
  }

  if (!gameExists) {
    return (
      <div style={{ minHeight: "100dvh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <p style={{ color: TEXT, fontSize: 24, fontWeight: 900 }}>Game not found.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100dvh", background: BG, color: TEXT, paddingBottom: "max(48px, calc(48px + env(safe-area-inset-bottom, 0px)))" }}>

      {/* Header */}
      <div style={{ padding: "28px 24px 24px", background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", opacity: 0.45, marginBottom: 4 }}>
            Avalon
          </div>
          <div style={{ fontSize: "clamp(18px, 6vw, 38px)", fontWeight: 900, letterSpacing: "-1px", lineHeight: 1, color: GOLD }}>
            {code}
          </div>
        </div>
        <button
          onClick={async () => {
            const url = window.location.href
            if (navigator.share) await navigator.share({ title: `Join Avalon — ${code}`, url })
            else { await navigator.clipboard.writeText(url); alert("Link copied!") }
          }}
          style={{ background: "rgba(255,255,255,0.08)", color: TEXT, fontSize: 13, fontWeight: 800, padding: "10px 16px", marginTop: 4, flexShrink: 0 }}
        >
          Invite
        </button>
      </div>

      {/* Start CTA */}
      {canStart && (
        <div style={{ padding: "20px 24px", background: GOLD }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(0,0,0,0.5)", marginBottom: 12 }}>
            {count} players — ready to start!
          </div>
          <button
            onClick={startGame}
            disabled={starting}
            style={{ background: "#000", color: GOLD, fontSize: 24, fontWeight: 900, padding: "20px", width: "100%", display: "block" }}
          >
            {starting ? "Starting…" : "Start Game"}
          </button>
        </div>
      )}

      {/* Players */}
      <div style={{ padding: "28px 24px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(232,220,200,0.35)", marginBottom: 14 }}>
          Players — {count} / {MAX_PLAYERS}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {players.map((p, i) => (
            <div key={p.id} style={{
              background: CARD, padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.3, minWidth: 20 }}>{i + 1}</span>
              <span style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>
                {p.name}
                {p.id === myPlayerId && <span style={{ opacity: 0.4, fontSize: 12, fontWeight: 600 }}> you</span>}
              </span>
            </div>
          ))}
          {count < MIN_PLAYERS && (
            <div style={{ background: CARD, padding: "14px 16px", opacity: 0.35, fontSize: 14, fontStyle: "italic" }}>
              Need at least {MIN_PLAYERS} players
            </div>
          )}
        </div>
      </div>

      {/* Join */}
      <div style={{ padding: "28px 24px 0" }}>
        {!me ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "rgba(232,220,200,0.35)", marginBottom: 14 }}>
              Join Game
            </div>
            {!savedProfile && (
              <>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" maxLength={40} style={{ ...inputStyle, marginBottom: 8 }} />
                <input value={lastName}  onChange={e => setLastName(e.target.value)}  placeholder="Last name"  maxLength={40} style={{ ...inputStyle, marginBottom: 8 }} />
              </>
            )}
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && join()}
              placeholder="Display Name"
              maxLength={45}
              style={inputStyle}
            />
            <button
              onClick={join}
              disabled={!name.trim() || (!savedProfile && (!firstName.trim() || !lastName.trim())) || joining || count >= MAX_PLAYERS}
              style={{ background: GOLD, color: "#000", fontSize: 20, fontWeight: 900, padding: "18px", width: "100%", marginTop: 8, display: "block" }}
            >
              {joining ? "Joining…" : "Join"}
            </button>
            {joinError && <p style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: GOLD }}>{joinError}</p>}
          </>
        ) : (
          <div style={{ padding: "12px 0", fontSize: 16, opacity: 0.6 }}>
            Waiting for the host to start…
          </div>
        )}
      </div>

    </div>
  )
}
