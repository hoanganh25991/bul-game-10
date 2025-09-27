# Audio System

Status: Implemented
Scope: SFX for combat and skills + lightweight ambient music

Overview
- Primarily procedural via WebAudio for a zero-dependency, free baseline. Optional streaming track ("audio/Ice and Snow.mp3") can be used as background music.
- Autoplay-safe. AudioContext is created/resumed only after the first user interaction.
- Background music is a gentle generative loop designed for focus/relaxation.
- SFX cover core gameplay beats without changing any game logic.

Modules
- src/audio.js: WebAudio helper module (ES module). Exposes:
  - audio.startOnFirstUserGesture(el? = document) — also wires page visibility/focus handlers
  - audio.attachPageVisibilityHandlers()
  - audio.pauseForBackground()
  - audio.resumeFromForeground()
  - audio.sfx(name, opts?)
  - audio.startMusic(preset? = "focus")
  - audio.stopMusic()
  - audio.startStreamMusic(url, opts? { volume?: number, loop?: boolean })
  - audio.stopStreamMusic()
  - audio.setSfxVolume(0..1)
  - audio.setMusicVolume(0..1)
  - audio.setEnabled(boolean)

Integration Points
- src/main.js
  - Initializes audio via audio.startOnFirstUserGesture(document) (attaches visibility/focus handlers)
  - Starts background music on first user gesture if enabled by Settings:
    - Prefers streaming track "audio/Ice and Snow.mp3" via audio.startStreamMusic("audio/Ice and Snow.mp3", { volume: 0.35, loop: true })
    - Falls back to generative audio.startMusic() if streaming fails (e.g., CORS)
  - Settings panel toggles:
    - Music toggle starts/stops stream/generative and persists preference
    - SFX toggle adjusts audio.setSfxVolume and persists preference
  - Game events:
    - Plays SFX when the player is hit by enemies
    - Plays SFX when enemies die
- src/skills.js
  - Basic Attack: audio.sfx("basic")
  - Chain-type skills:
    - On cast: audio.sfx("cast_chain")
    - On each jump/hit: audio.sfx("chain_hit")
  - AOE skills:
    - On cast: audio.sfx("cast_aoe")
    - On impact: audio.sfx("boom")
  - Beam skills:
    - On cast: audio.sfx("cast_beam")
    - On hit: audio.sfx("beam")
  - Nova skills:
    - On cast: audio.sfx("cast_nova")
    - On impact: audio.sfx("boom")
  - Aura skills:
    - Toggle on: audio.sfx("aura_on")
    - Toggle off: audio.sfx("aura_off")
    - Tick: audio.sfx("aura_tick")
  - Storm skills:
    - On cast: audio.sfx("storm_start")
    - Each strike: audio.sfx("strike")

Event Coverage Matrix
- Basic attack: yes (basic)
- Cast skill: yes (type-specific cast SFX)
- Skill effects (if has):
  - Chain hit: chain_hit
  - Beam impact: beam
  - Nova/AOE impact: boom
  - Aura tick: aura_tick
  - Storm strikes: strike
- Enemy died: yes (enemy_die)
- Player attacked by enemies: yes (player_hit)
- Background music loop: yes (focus preset)

Design Notes
- WebAudio graph
  - Master gain -> destination
  - sfxGain and musicGain connect into master gain for independent volume control
  - SFX built from:
    - Oscillator sweeps (zap-like)
    - Filtered noise bursts (boom/strike textures)
    - Small sine blips for UI-like cues (aura toggles)
  - Music is scheduled generatively:
    - Slow BPM (≈48), pentatonic scale for low dissonance
    - 2–3 overlapping long, low-gain notes per bar
    - Softly filtered sine/triangle layers
- Performance
  - Limits active SFX voices; short envelopes and automatic cleanup
  - Minimal allocations per sound; shared 1s noise buffer reused

Usage and Controls
- Initialization (autoplay safe):
  - audio.startOnFirstUserGesture(document)
  - Start background music after the first user gesture:
    - audio.startStreamMusic("audio/Ice and Snow.mp3", { volume: 0.35, loop: true }) or
    - audio.startMusic() as a fallback when streaming is unavailable
- Volume control (e.g., via DevTools console):
  - audio.setSfxVolume(0.0 .. 1.0)
  - audio.setMusicVolume(0.0 .. 1.0)
- Disable all audio:
  - audio.setEnabled(false)

Extensibility
- Add new SFX:
  - Extend audio.sfx(name) switch with a new synthesized pattern
  - Call it at the appropriate event hook in code
- Add music presets:
  - Extend the scales/presets table and tweak BPM/voice count

Autoplay Considerations
- Most browsers require user gesture before starting/resuming AudioContext.
- On the first click/touchstart/keydown:
  - Initialize/resume AudioContext
  - Start background music (streaming preferred, generative fallback)
  - Attach visibilitychange/blur/focus handlers to pause/resume audio when the page is backgrounded/foregrounded
- Settings panel provides Music/SFX toggles and persists preferences.
