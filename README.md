# VELVET VAULT — The Meridian Museum Heist

[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Freshaaaa/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Freshaaaa/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![entries](https://make.fun/badge/best-heist-game-20261122-0559/Freshaaaa/best-heist-game-20261122-0559/entries.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

**Entry for [Make the best heist game](https://make.fun/bounty/best-heist-game-20261122-0559) — $50 bounty.**

You are **Wren**, the thief the Meridian never saw coming. Three rooms stand between you and the **Aurum Star** — a $5,000 gem on a laser-guarded pedestal in the vault. Wardens patrol with sweeping vision cones. CCTV cameras sweep the halls. The alarm meter is always watching.

## The heist

- **3 rooms** — Lobby, Gallery (Hall of Kings), Vault — each with several routes, cover to hide behind, and loot to lift.
- **5 wardens + 5 cameras** — patrols and cones you have to read before you move. A cone turns orange when a warden grows suspicious, red when it hunts.
- **3 tools at a cost** — EMP Pulse (kills cameras + lasers for 8s), Smoke Bomb (hides you for 6s), Lockpick (the Star's lock opens in 1.2s instead of 3s). Every tool spends a charge.
- **9 loot pieces worth $7,400** — paintings, vases, the Crown of Saint Anselm, and the Aurum Star itself.
- **Alarm meter 0–100%** — rises when you are spotted, trips lasers, or let a warden fill its detection. At 100% the museum locks down and every warden hunts.
- **Win** — steal the Aurum Star and reach the escape tunnel. **Lose** — get grabbed by a warden.

## Play

`node serve.ts` then open http://localhost:8095/ — **WASD / arrows** move, **Shift** sneaks, **click** walks to a spot, **E** (hold) lifts loot, **1** EMP, **2** Smoke, **3** Lockpick.

Built with vanilla JavaScript + canvas, no libraries, no network. Sounds are synthesized with WebAudio.
