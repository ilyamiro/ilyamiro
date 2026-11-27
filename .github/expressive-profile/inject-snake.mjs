#!/usr/bin/env node
/**
 * Port of Serpantinum's snake (FluidBackground / Snake.js / snake.frag)
 * into the Expressive Profile GitHub README SVGs.
 *
 * - Runs an autonomous Serpantinum steering AI (FluidBackground roaming &
 *   lounging + Snake.js organic wander & quadratic wall repulsion) at 60 Hz
 *   across the unified Hero (840x210) + Socials (840x88) space for ~48-54s
 *   of liquid-smooth, structure-aware, edge-respecting movement.
 * - Uses a fresh random seed on every run (or --seed=<uint> for reproducibility).
 * - Randomly chooses over/under layering for EVERY bottom social button
 *   (Telegram, YouTube, Reddit, Discord, Email) on EVERY Socials excursion.
 * - Renders pixel-accurate self-crossing cast shadows (3 concentric exact-
 *   boundary shells matching snake.frag's Gaussian falloff with zero bleed),
 *   exact midpoint-to-midpoint C1 piece joins (zero corner spikes on turns),
 *   exact head cutout (evenodd), and fluttering forked tongue.
 * - Uses compact relative SMIL paths (M + l/q/c/z only) + high-fps adaptive
 *   keyframes (10-15 fps, <=0.65px error) for fluid Chrome/Firefox/Safari motion.
 * - Idempotent: strips any previous injection before re-injecting.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, 'assets');

// ============================================================================
// 0. Seeded PRNG (fresh random seed each run; override with --seed=12345)
// ============================================================================
const seedArg = process.argv.find((a) => a.startsWith('--seed='));
const SEED = seedArg
  ? (Number(seedArg.slice('--seed='.length)) >>> 0)
  : ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// 1. Unified README Coordinate System (measured from real GitHub README)
// ============================================================================
// Hero card:    x in [0, 840], y in [0, 210]
// Physical gap: y in [210, 216] (5.5 SVG units on GitHub)
// Socials bar:  x in [0, 840], y in [216, 304] (local y = global y - 216)
const HERO_H = 210;
const SOCIAL_Y0 = 216;
const SOCIAL_H = 88;

const SLICES = [
  { name: 'hero',     x0: 0,      x1: 840,    y0: 0,         y1: HERO_H,             isHero: true },
  { name: 'social-l', x0: 0,      x1: 73.5,   y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, clipRect: [0, 0, 113.5, 88, 32], btnIdx: -1 },
  { name: 'social-1', x0: 73.5,   x1: 225.73, y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, btnIdx: 0, label: 'Telegram' },
  { name: 'social-2', x0: 225.73, x1: 373.43, y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, btnIdx: 1, label: 'YouTube' },
  { name: 'social-3', x0: 373.43, x1: 503.47, y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, btnIdx: 2, label: 'Reddit' },
  { name: 'social-4', x0: 503.47, x1: 645.02, y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, btnIdx: 3, label: 'Discord' },
  { name: 'social-5', x0: 645.02, x1: 766.5,  y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, btnIdx: 4, label: 'Email' },
  { name: 'social-r', x0: 766.5,  x1: 840,    y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, clipRect: [-40, 0, 113.5, 88, 32], btnIdx: -1 },
];

// Button center X positions (safe crossing doors away from slice seams)
const SOCIAL_DOORS = [149.6, 299.6, 438.4, 574.2, 705.8];

// Generous interior margins (never crowds edges or rounded card corners)
const HERO_SAFE = { minX: 78, maxX: 762, minY: 44, maxY: 174 };
const SOC_SAFE  = { minX: 112, maxX: 728, minY: 239, maxY: 281 };

// ============================================================================
// 2. Serpantinum Snake Constants (liquid-smooth curvature + zero-kink stiffness)
// ============================================================================
const UNIT = 0.78;
const FIXED_DT = 1 / 60;
const SNAKE_SEGMENTS = 44;
const SNAKE_SEG_LEN = 6.8 * UNIT;
const MAX_TURN_PER_SEG = 0.205; // graceful curves, prevents inner-edge cusps
const COS_MAX_TURN = Math.cos(MAX_TURN_PER_SEG);
const SIN_MAX_TURN = Math.sin(MAX_TURN_PER_SEG);
const MIN_TURN_RADIUS = 30 * UNIT;
const ACCEL_UP_BLEND = 1 - Math.exp(-2.8 * FIXED_DT);
const ACCEL_DOWN_BLEND = 1 - Math.exp(-3.2 * FIXED_DT);
const WEAVE_AMPLITUDE = 8.2 * UNIT;
const NOMINAL_WAVENUMBER = (Math.PI * 2) / (200 * UNIT);
const WEAVE_NECK_SEGMENTS = 12;

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function edgeWeight(distance, margin) {
  const t = 1 - Math.max(0, distance) / margin;
  return t * t;
}

function snakeHalfWidth(index) {
  if (index === 0) return 4.9 * UNIT;
  if (index === 1) return 4.8 * UNIT;
  if (index === 2) return 4.95 * UNIT;
  const u = (index - 2) / (SNAKE_SEGMENTS - 3);
  if (u < 0.65) {
    const swell = Math.sin((u / 0.65) * Math.PI) * 0.75;
    return (5.1 + swell) * UNIT;
  }
  const t = (u - 0.65) / 0.35;
  return (5.1 - 2.9 * t * t) * UNIT;
}

// ============================================================================
// 3. Autonomous Serpantinum Steering AI (FluidBackground + Snake.js)
// ============================================================================
const HERO_ZONES = [
  { id: 'avatar',  cx: 281, cy: 105, rx: 52, ry: 40, weight: 1.5 },
  { id: 'title',   cx: 524, cy:  66, rx: 86, ry: 18, weight: 1.4 },
  { id: 'denmark', cx: 474, cy: 148, rx: 46, ry: 14, weight: 1.2 },
  { id: 'foss',    cx: 586, cy: 148, rx: 38, ry: 14, weight: 1.2 },
  { id: 'left',    cx: 152, cy: 108, rx: 42, ry: 44, weight: 1.0 },
  { id: 'right',   cx: 680, cy: 106, rx: 42, ry: 42, weight: 1.1 },
  { id: 'free',    cx: 420, cy: 108, rx: 270, ry: 52, weight: 1.4 },
];

function simulateAutonomousPath(seed) {
  const rng = mulberry32(seed);
  const randRange = (lo, hi) => lo + rng() * (hi - lo);

  const TARGET_ROAM_SEC = 44; // ~48-54s total after smooth return home (10-15 fps!)
  const WARMUP_SEC = 5.0;

  const jointX = new Float64Array(SNAKE_SEGMENTS);
  const jointY = new Float64Array(SNAKE_SEGMENTS);
  const halfWidths = new Float64Array(SNAKE_SEGMENTS);
  const weaveEnvelope = new Float64Array(SNAKE_SEGMENTS);

  for (let i = 0; i < SNAKE_SEGMENTS; i++) {
    halfWidths[i] = snakeHalfWidth(i);
    if (i <= 1) {
      weaveEnvelope[i] = 0;
    } else {
      const neck = Math.min(1, (i - 1) / WEAVE_NECK_SEGMENTS);
      const tail = 1 - 0.4 * (i / (SNAKE_SEGMENTS - 1));
      weaveEnvelope[i] = WEAVE_AMPLITUDE * neck * neck * (3 - 2 * neck) * tail;
    }
  }

  // Initial pose in Hero interior
  const initX = randRange(230, 560);
  const initY = randRange(78, 138);
  let headAngle = normalizeAngle(randRange(-0.45, 0.45) + (rng() < 0.5 ? 0 : Math.PI));
  for (let i = 0; i < SNAKE_SEGMENTS; i++) {
    jointX[i] = initX - Math.cos(headAngle) * i * SNAKE_SEG_LEN;
    jointY[i] = initY - Math.sin(headAngle) * i * SNAKE_SEG_LEN;
  }

  let headSpeed = 110;
  let cruiseSpeed = 118;
  let speedTimer = randRange(1.5, 3.0);
  let wanderTurn = 0;
  let wanderTarget = 0;
  let wanderTimer = randRange(1.0, 2.0);
  let turnVel = 0; // smooth angular velocity (prevents sudden steering kinks!)
  let turnCommitSign = 1;
  let weaveScale = 0.85;
  let tongueTimer = randRange(2.4, 5.2);
  let tongueProgress = 0;

  // Autonomous behavioral state
  let mode = 'HERO_ROAM';
  let lastZoneId = '';
  let lastDoorIdx = -1;
  let targetX = 480;
  let targetY = 100;
  let roamTimer = 0;

  let timeSinceSocials = randRange(3, 5);
  let nextSocialsInterval = randRange(7.5, 11.5);
  let timeSinceCoil = randRange(4, 7);
  let nextCoilInterval = randRange(11, 16);

  // Coil / lounge state (FluidBackground-inspired natural orbit)
  let coilCenterX = 0;
  let coilCenterY = 0;
  let coilSign = 1;
  let coilRadius = 34;
  let coilTimeLeft = 0;

  // Socials excursion state + random per-excursion button over/under modes
  let doorX = 438.4;
  let divePhase = 0;
  let socDir = 1;
  let socExitX = 149.6;
  let socWavePhase = 0;
  let socWaveFreq = 0.020;
  let socVisits = 0;
  let coilCount = 0;
  const visitedBtns = new Uint8Array(SOCIAL_DOORS.length);
  let activeSocialModes = ['over', 'under', 'over', 'under', 'over'];
  const excursionLogs = [];

  function rollRandomSocialModes() {
    // Independently choose 'over' or 'under' for each of the 5 bottom buttons!
    const modes = [];
    for (let b = 0; b < 5; b++) {
      modes.push(rng() < 0.5 ? 'over' : 'under');
    }
    // Avoid degenerate all-5-same so both over and under appear organically
    if (modes.every((m) => m === modes[0])) {
      const flip = Math.floor(rng() * 5);
      modes[flip] = modes[flip] === 'over' ? 'under' : 'over';
    }
    return modes;
  }

  let startSnap = null;
  let homeApproachX = 0;
  let homeApproachY = 0;
  let homingTimer = 0;

  function pickHeroTarget() {
    const totalW = HERO_ZONES.reduce((s, z) => s + (z.id === lastZoneId ? z.weight * 0.25 : z.weight), 0);
    let bestX = 420, bestY = 108, bestZone = 'free';
    for (let attempt = 0; attempt < 8; attempt++) {
      let r = rng() * totalW;
      let z = HERO_ZONES[HERO_ZONES.length - 1];
      for (const cand of HERO_ZONES) {
        const w = cand.id === lastZoneId ? cand.weight * 0.25 : cand.weight;
        r -= w;
        if (r <= 0) { z = cand; break; }
      }
      const cx = Math.max(HERO_SAFE.minX + 18, Math.min(HERO_SAFE.maxX - 18, z.cx + randRange(-z.rx, z.rx)));
      const cy = Math.max(HERO_SAFE.minY + 8, Math.min(HERO_SAFE.maxY - 8, z.cy + randRange(-z.ry, z.ry)));
      const d = Math.hypot(cx - jointX[0], cy - jointY[0]);
      bestX = cx;
      bestY = cy;
      bestZone = z.id;
      if (d >= 165) break;
    }
    lastZoneId = bestZone;
    targetX = bestX;
    targetY = bestY;
    roamTimer = randRange(2.4, 4.2);
  }

  function startSocialsDive() {
    // Roll fresh random over/under layering for all 5 bottom buttons while snake is still in Hero!
    activeSocialModes = rollRandomSocialModes();

    const cands = SOCIAL_DOORS.map((x, idx) => ({
      idx,
      x,
      w: (idx === lastDoorIdx ? 0.12 : 1.0) * (visitedBtns[idx] ? 0.4 : 2.5) / (1 + Math.abs(x - jointX[0]) / 340),
    }));
    const sumW = cands.reduce((s, c) => s + c.w, 0);
    let r = rng() * sumW;
    let chosen = cands[0];
    for (const c of cands) {
      r -= c.w;
      if (r <= 0) { chosen = c; break; }
    }
    lastDoorIdx = chosen.idx;
    doorX = chosen.x + randRange(-12, 12);
    divePhase = 0;
    mode = 'DIVE_TO_SOCIALS';
  }

  function startHeroCoil() {
    coilSign = rng() < 0.5 ? 1 : -1;
    coilRadius = randRange(31, 38); // matches website lounge radius (zero pinching!)
    const nx = -Math.sin(headAngle) * coilSign;
    const ny = Math.cos(headAngle) * coilSign;
    coilCenterX = Math.max(HERO_SAFE.minX + 56, Math.min(HERO_SAFE.maxX - 56, jointX[0] + nx * coilRadius));
    coilCenterY = Math.max(HERO_SAFE.minY + 38, Math.min(HERO_SAFE.maxY - 38, jointY[0] + ny * coilRadius));
    coilTimeLeft = randRange(2.5, 3.3);
    mode = 'HERO_COIL';
    coilCount++;
  }

  function startSocialsWeave() {
    const enterIdx = SOCIAL_DOORS.reduce(
      (best, x, i) => (Math.abs(x - jointX[0]) < Math.abs(SOCIAL_DOORS[best] - jointX[0]) ? i : best),
      0
    );
    let leftUnvis = 0, rightUnvis = 0;
    for (let i = 0; i < enterIdx; i++) if (!visitedBtns[i]) leftUnvis++;
    for (let i = enterIdx + 1; i < SOCIAL_DOORS.length; i++) if (!visitedBtns[i]) rightUnvis++;
    const rightRoom = SOCIAL_DOORS.length - 1 - enterIdx;
    const leftRoom = enterIdx;
    if (rightRoom === 0) socDir = -1;
    else if (leftRoom === 0) socDir = 1;
    else {
      const rWeight = rightRoom + rightUnvis * 2.8;
      const lWeight = leftRoom + leftUnvis * 2.8;
      socDir = rng() < rWeight / (rWeight + lWeight) ? 1 : -1;
    }

    const maxSpan = socDir > 0 ? rightRoom : leftRoom;
    const span = Math.max(1, Math.min(maxSpan, Math.floor(randRange(1.8, maxSpan + 0.99))));
    const exitIdx = enterIdx + socDir * span;
    const lo = Math.min(enterIdx, exitIdx);
    const hi = Math.max(enterIdx, exitIdx);
    for (let i = lo; i <= hi; i++) visitedBtns[i] = 1;
    socExitX = SOCIAL_DOORS[exitIdx] + randRange(-12, 12);
    socWavePhase = randRange(0, Math.PI * 2);
    socWaveFreq = randRange(0.016, 0.022);
    socVisits++;
    const names = ['Tg', 'YT', 'Rd', 'Dc', 'Em'];
    const summary = [];
    for (let i = enterIdx; i !== exitIdx + socDir; i += socDir) {
      summary.push(`${names[i]}:${activeSocialModes[i][0].toUpperCase()}`);
    }
    excursionLogs.push(summary.join('->'));
    mode = 'SOCIALS_WEAVE';
  }

  pickHeroTarget();

  const recorded = [];
  let simTime = 0;
  let recTime = 0;
  let totalArcLen = 0;
  let finished = false;
  const MAX_REC_SEC = TARGET_ROAM_SEC + 26;

  while (!finished && recTime < MAX_REC_SEC) {
    const isRecording = simTime >= WARMUP_SEC;
    if (isRecording && !startSnap) {
      startSnap = {
        jointX: Float64Array.from(jointX),
        jointY: Float64Array.from(jointY),
        headAngle,
        headSpeed,
        weaveScale,
      };
    }

    // Autonomous speed & organic wander drift (Snake.js style)
    speedTimer -= FIXED_DT;
    if (speedTimer <= 0) {
      cruiseSpeed = rng() < 0.24 ? randRange(74, 96) : randRange(108, 142);
      speedTimer = randRange(2.0, 3.6);
    }
    wanderTimer -= FIXED_DT;
    if (wanderTimer <= 0) {
      const mag = rng() < 0.3 ? randRange(0.04, 0.14) : randRange(0.16, 0.36);
      wanderTarget = (rng() < 0.5 ? -1 : 1) * mag;
      wanderTimer = randRange(1.2, 2.4);
    }
    wanderTurn += (wanderTarget - wanderTurn) * (1 - Math.exp(-1.3 * FIXED_DT));

    // Begin smooth homing once target roam duration is reached and snake is cleanly inside Hero
    if (isRecording && recTime >= TARGET_ROAM_SEC && mode === 'HERO_ROAM' && jointY[0] < HERO_H - 25) {
      const backDist = 72;
      homeApproachX = Math.max(
        HERO_SAFE.minX + 14,
        Math.min(HERO_SAFE.maxX - 14, startSnap.jointX[0] - Math.cos(startSnap.headAngle) * backDist)
      );
      homeApproachY = Math.max(
        HERO_SAFE.minY + 6,
        Math.min(HERO_SAFE.maxY - 6, startSnap.jointY[0] - Math.sin(startSnap.headAngle) * backDist)
      );
      homingTimer = 0;
      mode = 'HOMING_APPROACH';
    }

    const hx = jointX[0];
    const hy = jointY[0];
    let desiredTargetX = targetX;
    let desiredTargetY = targetY;
    let desiredSpeedBase = cruiseSpeed;
    let targetWeave = 0.84;
    let wanderStrength = 0.34;
    let useHeroWalls = true;
    let useSocialWalls = false;

    if (mode === 'HERO_ROAM') {
      if (isRecording) {
        timeSinceSocials += FIXED_DT;
        timeSinceCoil += FIXED_DT;
      }
      roamTimer -= FIXED_DT;
      const dToTarget = Math.hypot(targetX - hx, targetY - hy);
      // Ensure tail has fully cleared Socials before allowing next dive (keeps over/under mode switch 100% clean!)
      let tailInHero = true;
      for (let i = 0; i < SNAKE_SEGMENTS; i++) {
        if (jointY[i] >= HERO_H - 6) { tailInHero = false; break; }
      }
      if (dToTarget < 54 || roamTimer <= 0) {
        const canDive = isRecording && tailInHero && recTime < TARGET_ROAM_SEC - 9 && timeSinceSocials >= nextSocialsInterval;
        const inOpenHero = hx > 165 && hx < 675 && hy > 74 && hy < 144;
        const canCoil = isRecording && recTime < TARGET_ROAM_SEC - 6 && timeSinceCoil >= nextCoilInterval && inOpenHero;
        if (canDive) {
          timeSinceSocials = 0;
          nextSocialsInterval = randRange(8.5, 13.0);
          startSocialsDive();
        } else if (canCoil) {
          timeSinceCoil = 0;
          nextCoilInterval = randRange(12, 18);
          startHeroCoil();
        } else {
          pickHeroTarget();
        }
      }
      desiredTargetX = targetX;
      desiredTargetY = targetY;
      targetWeave = 0.84;
    } else if (mode === 'HERO_COIL') {
      coilTimeLeft -= FIXED_DT;
      const angFromCenter = Math.atan2(hy - coilCenterY, hx - coilCenterX);
      const orbitAng = angFromCenter + coilSign * 0.88;
      desiredTargetX = coilCenterX + Math.cos(orbitAng) * coilRadius;
      desiredTargetY = coilCenterY + Math.sin(orbitAng) * coilRadius;
      desiredSpeedBase = 96;
      targetWeave = 0.56;
      wanderStrength = 0.06;
      if (coilTimeLeft <= 0) {
        mode = 'HERO_ROAM';
        pickHeroTarget();
      }
    } else if (mode === 'DIVE_TO_SOCIALS') {
      useHeroWalls = false;
      targetWeave = 0.52;
      wanderStrength = 0.05;
      desiredSpeedBase = 112;
      if (divePhase === 0) {
        desiredTargetX = doorX;
        desiredTargetY = 176;
        if (Math.hypot(doorX - hx, 176 - hy) < 42 || hy > 174) {
          divePhase = 1;
        }
      } else {
        desiredTargetX = doorX;
        desiredTargetY = 260;
        if (hy >= 244) {
          startSocialsWeave();
        }
      }
    } else if (mode === 'SOCIALS_WEAVE') {
      useHeroWalls = false;
      useSocialWalls = true;
      targetWeave = 0.44;
      wanderStrength = 0.06;
      desiredSpeedBase = Math.max(94, Math.min(124, cruiseSpeed * 0.92));
      const lookX = Math.max(SOC_SAFE.minX, Math.min(SOC_SAFE.maxX, hx + socDir * 72));
      const waveY = 260 + Math.sin(lookX * socWaveFreq + socWavePhase) * 15;
      desiredTargetX = lookX;
      desiredTargetY = Math.max(SOC_SAFE.minY + 4, Math.min(SOC_SAFE.maxY - 4, waveY));
      const reachedExit = socDir > 0 ? hx >= socExitX - 18 : hx <= socExitX + 18;
      const hitLimit = socDir > 0 ? hx >= SOC_SAFE.maxX - 12 : hx <= SOC_SAFE.minX + 12;
      if (reachedExit || hitLimit) {
        doorX = Math.max(130, Math.min(710, hx));
        for (const seam of [225.73, 373.43, 503.47, 645.02]) {
          if (Math.abs(doorX - seam) < 22) {
            doorX = seam + (doorX >= seam ? 24 : -24);
          }
        }
        mode = 'CLIMB_TO_HERO';
      }
    } else if (mode === 'CLIMB_TO_HERO') {
      useHeroWalls = false;
      targetWeave = 0.50;
      wanderStrength = 0.05;
      desiredSpeedBase = 112;
      desiredTargetX = doorX;
      desiredTargetY = 146;
      if (hy <= 166) {
        mode = 'HERO_ROAM';
        pickHeroTarget();
      }
    } else if (mode === 'HOMING_APPROACH') {
      homingTimer += FIXED_DT;
      desiredTargetX = homeApproachX;
      desiredTargetY = homeApproachY;
      desiredSpeedBase = 114;
      targetWeave = startSnap.weaveScale;
      wanderStrength = 0;
      if (Math.hypot(homeApproachX - hx, homeApproachY - hy) < 34 || homingTimer > 8) {
        mode = 'HOMING_LOCK';
      }
    } else if (mode === 'HOMING_LOCK') {
      homingTimer += FIXED_DT;
      desiredTargetX = startSnap.jointX[0];
      desiredTargetY = startSnap.jointY[0];
      desiredSpeedBase = startSnap.headSpeed;
      targetWeave = startSnap.weaveScale;
      wanderStrength = 0;
      useHeroWalls = false;
      const distHome = Math.hypot(startSnap.jointX[0] - hx, startSnap.jointY[0] - hy);
      const angErr = Math.abs(normalizeAngle(startSnap.headAngle - headAngle));
      if ((distHome < 9 && angErr < 0.35) || distHome < 5.5 || homingTimer > 12) {
        finished = true;
      }
    }

    // Steering toward target + FluidBackground turn commitment
    const dx = desiredTargetX - hx;
    const dy = desiredTargetY - hy;
    const dist = Math.hypot(dx, dy);
    const rawTargetAngle = dist > 1 ? Math.atan2(dy, dx) : headAngle;
    const rawDiff = normalizeAngle(rawTargetAngle - headAngle);

    if (Math.abs(rawDiff) < 2.4 && Math.abs(rawDiff) > 0.08) {
      turnCommitSign = rawDiff >= 0 ? 1 : -1;
    }

    // Smooth quadratic edge repulsion (Snake.js) keeping well clear of borders
    let pushX = 0;
    let pushY = 0;
    if (useHeroWalls) {
      const mX = 62;
      const mY = 40;
      if (hx - HERO_SAFE.minX < mX) pushX += edgeWeight(hx - HERO_SAFE.minX, mX);
      if (HERO_SAFE.maxX - hx < mX) pushX -= edgeWeight(HERO_SAFE.maxX - hx, mX);
      if (hy - HERO_SAFE.minY < mY) pushY += edgeWeight(hy - HERO_SAFE.minY, mY);
      if (HERO_SAFE.maxY - hy < mY) pushY -= edgeWeight(HERO_SAFE.maxY - hy, mY);
    } else if (useSocialWalls) {
      const mX = 52;
      const mY = 20;
      if (hx - SOC_SAFE.minX < mX) pushX += edgeWeight(hx - SOC_SAFE.minX, mX);
      if (SOC_SAFE.maxX - hx < mX) pushX -= edgeWeight(SOC_SAFE.maxX - hx, mX);
      if (hy - SOC_SAFE.minY < mY) pushY += edgeWeight(hy - SOC_SAFE.minY, mY);
      if (SOC_SAFE.maxY - hy < mY) pushY -= edgeWeight(SOC_SAFE.maxY - hy, mY);
    } else {
      const mX = 52;
      if (hx - HERO_SAFE.minX < mX) pushX += edgeWeight(hx - HERO_SAFE.minX, mX);
      if (HERO_SAFE.maxX - hx < mX) pushX -= edgeWeight(HERO_SAFE.maxX - hx, mX);
      if (hy < HERO_SAFE.minY + 14) pushY += edgeWeight(hy - HERO_SAFE.minY, 26);
      if (hy > SOC_SAFE.maxY - 4) pushY -= edgeWeight(SOC_SAFE.maxY - hy, 20);
    }

    let desiredHeading = rawTargetAngle;
    const wallStrength = Math.min(1, Math.hypot(pushX, pushY));
    if (wallStrength > 0.01) {
      const sx = Math.cos(desiredHeading) + pushX * 2.4;
      const sy = Math.sin(desiredHeading) + pushY * 2.4;
      desiredHeading = Math.atan2(sy, sx);
    }

    let headingDiff = normalizeAngle(desiredHeading - headAngle);
    if (Math.abs(rawDiff) >= 2.4 && wallStrength < 0.25) {
      headingDiff = turnCommitSign * Math.abs(headingDiff);
    }

    const turnAlignment = Math.max(0, Math.cos(headingDiff));
    const desiredSpeed = desiredSpeedBase * (0.72 + 0.28 * turnAlignment);
    headSpeed += (desiredSpeed - headSpeed) * (desiredSpeed > headSpeed ? ACCEL_UP_BLEND : ACCEL_DOWN_BLEND);

    // Smooth angular velocity (eliminates sudden curvature snaps!)
    const dynamicRadius = MIN_TURN_RADIUS + Math.min(30 * UNIT, headSpeed * 0.022);
    const maxTurnRate = headSpeed / dynamicRadius;
    const rawTurnRate = Math.max(-maxTurnRate, Math.min(maxTurnRate, headingDiff * 2.4 + wanderTurn * wanderStrength));
    turnVel += (rawTurnRate - turnVel) * (1 - Math.exp(-6.5 * FIXED_DT));
    headAngle = normalizeAngle(headAngle + turnVel * FIXED_DT);

    // Gently dampen weave during tight turns so the inner curve never pinches!
    const curveDamp = 1 / (1 + 0.35 * Math.abs(turnVel));
    weaveScale += (targetWeave * curveDamp - weaveScale) * (1 - Math.exp(-3.4 * FIXED_DT));

    const stepDist = headSpeed * FIXED_DT;
    let nextX = hx + Math.cos(headAngle) * stepDist;
    let nextY = hy + Math.sin(headAngle) * stepDist;

    if (useHeroWalls) {
      nextX = Math.max(HERO_SAFE.minX - 6, Math.min(HERO_SAFE.maxX + 6, nextX));
      nextY = Math.max(HERO_SAFE.minY - 6, Math.min(HERO_SAFE.maxY + 6, nextY));
    } else if (useSocialWalls) {
      nextX = Math.max(SOC_SAFE.minX - 8, Math.min(SOC_SAFE.maxX + 8, nextX));
      nextY = Math.max(SOC_SAFE.minY - 4, Math.min(SOC_SAFE.maxY + 4, nextY));
    } else {
      nextX = Math.max(HERO_SAFE.minX - 6, Math.min(HERO_SAFE.maxX + 6, nextX));
      nextY = Math.max(HERO_SAFE.minY - 6, Math.min(SOC_SAFE.maxY + 4, nextY));
    }

    jointX[0] = nextX;
    jointY[0] = nextY;

    // Follow-the-leader + liquid angular stiffness
    let prevUx = -Math.cos(headAngle);
    let prevUy = -Math.sin(headAngle);
    for (let i = 1; i < SNAKE_SEGMENTS; i++) {
      const leadX = jointX[i - 1];
      const leadY = jointY[i - 1];
      const sdx = jointX[i] - leadX;
      const sdy = jointY[i] - leadY;
      const sLen = Math.hypot(sdx, sdy) || 1;
      let ux = sdx / sLen;
      let uy = sdy / sLen;

      const dot = ux * prevUx + uy * prevUy;
      if (dot < COS_MAX_TURN) {
        const cross = prevUx * uy - prevUy * ux;
        const sign = cross >= 0 ? 1 : -1;
        ux = prevUx * COS_MAX_TURN - prevUy * SIN_MAX_TURN * sign;
        uy = prevUx * SIN_MAX_TURN * sign + prevUy * COS_MAX_TURN;
      }
      jointX[i] = leadX + ux * SNAKE_SEG_LEN;
      jointY[i] = leadY + uy * SNAKE_SEG_LEN;
      prevUx = ux;
      prevUy = uy;
    }

    // Autonomous irregular tongue flicks (Snake.js style)
    if (tongueProgress > 0) {
      tongueProgress += FIXED_DT / 0.28;
      if (tongueProgress >= 1) {
        tongueProgress = 0;
        tongueTimer = randRange(3.4, 7.0);
      }
    } else {
      tongueTimer -= FIXED_DT;
      if (tongueTimer <= 0 && recTime < TARGET_ROAM_SEC - 1) {
        tongueProgress = 0.001;
      }
    }

    if (isRecording) {
      totalArcLen += stepDist;
      recorded.push({
        t: recTime,
        cumDist: totalArcLen,
        jointX: Float64Array.from(jointX),
        jointY: Float64Array.from(jointY),
        weaveScale,
        tongueProgress,
        socialModes: activeSocialModes,
      });
      recTime += FIXED_DT;
    }
    simTime += FIXED_DT;
  }

  // Exact integer weave cycles over the full autonomous journey
  const exactCycles = Math.max(1, Math.round((totalArcLen * NOMINAL_WAVENUMBER) / (Math.PI * 2)));
  const syncedWavenumber = (exactCycles * Math.PI * 2) / totalArcLen;

  // Smoothly close residual gap between last frame and frame 0 over final 0.85s
  const f0 = recorded[0];
  const fEnd = recorded[recorded.length - 1];
  const rawErr = Math.hypot(f0.jointX[0] - fEnd.jointX[0], f0.jointY[0] - fEnd.jointY[0]);
  const blendSteps = Math.min(Math.floor(recorded.length * 0.1), Math.round(0.85 / FIXED_DT));
  for (let b = 0; b < blendSteps; b++) {
    const idx = recorded.length - blendSteps + b;
    const u = (b + 1) / blendSteps;
    const w = u * u * (3 - 2 * u);
    const fr = recorded[idx];
    for (let i = 0; i < SNAKE_SEGMENTS; i++) {
      fr.jointX[i] += (f0.jointX[i] - fEnd.jointX[i]) * w;
      fr.jointY[i] += (f0.jointY[i] - fEnd.jointY[i]) * w;
    }
    fr.weaveScale += (f0.weaveScale - fEnd.weaveScale) * w;
  }

  const loopDuration = recorded.length * FIXED_DT;
  const last = SNAKE_SEGMENTS - 1;
  let globalMinX = Infinity, globalMaxX = -Infinity, globalMinY = Infinity, globalMaxY = -Infinity;
  let selfCrossFrames = 0;
  const crossEvents = [];
  let inCross = false;

  const frames = recorded.map((rec) => {
    const gaitPhase = (rec.cumDist * syncedWavenumber) % (Math.PI * 2);
    const rawBodyX = new Float64Array(SNAKE_SEGMENTS);
    const rawBodyY = new Float64Array(SNAKE_SEGMENTS);
    for (let i = 0; i < SNAKE_SEGMENTS; i++) {
      const prev = i === 0 ? 0 : i - 1;
      const next = i === last ? last : i + 1;
      const tx = rec.jointX[prev] - rec.jointX[next];
      const ty = rec.jointY[prev] - rec.jointY[next];
      const len = Math.hypot(tx, ty) || 1;
      const offset = weaveEnvelope[i] * rec.weaveScale * Math.sin(gaitPhase - i * SNAKE_SEG_LEN * syncedWavenumber);
      rawBodyX[i] = rec.jointX[i] - (ty / len) * offset;
      rawBodyY[i] = rec.jointY[i] + (tx / len) * offset;
    }

    // Gentle 1-pass Laplacian smoothing on interior spine for C2-smooth tangents
    const bodyX = Float64Array.from(rawBodyX);
    const bodyY = Float64Array.from(rawBodyY);
    for (let i = 2; i < last - 1; i++) {
      bodyX[i] = rawBodyX[i] * 0.68 + (rawBodyX[i - 1] + rawBodyX[i + 1]) * 0.16;
      bodyY[i] = rawBodyY[i] * 0.68 + (rawBodyY[i - 1] + rawBodyY[i + 1]) * 0.16;
    }

    const headAngleNow = Math.atan2(bodyY[0] - bodyY[1], bodyX[0] - bodyX[1]);
    const leftX = new Float64Array(SNAKE_SEGMENTS);
    const leftY = new Float64Array(SNAKE_SEGMENTS);
    const rightX = new Float64Array(SNAKE_SEGMENTS);
    const rightY = new Float64Array(SNAKE_SEGMENTS);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < SNAKE_SEGMENTS; i++) {
      const rx = bodyX[i];
      const ry = bodyY[i];
      let tx, ty;
      if (i === 0) {
        tx = bodyX[0] - bodyX[1];
        ty = bodyY[0] - bodyY[1];
      } else if (i === last) {
        tx = bodyX[i - 1] - bodyX[i];
        ty = bodyY[i - 1] - bodyY[i];
      } else {
        tx = bodyX[i - 1] - bodyX[i + 1];
        ty = bodyY[i - 1] - bodyY[i + 1];
      }
      const invLen = halfWidths[i] / (Math.hypot(tx, ty) || 1);
      const nx = -ty * invLen;
      const ny = tx * invLen;
      leftX[i] = rx + nx;
      leftY[i] = ry + ny;
      rightX[i] = rx - nx;
      rightY[i] = ry - ny;
      if (rx < minX) minX = rx;
      if (rx > maxX) maxX = rx;
      if (ry < minY) minY = ry;
      if (ry > maxY) maxY = ry;
    }

    // Anti-cusp relaxation: guarantee neither left nor right edge ever folds backward on tight bends!
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 2; i < last; i++) {
        const bdx = bodyX[i] - bodyX[i - 1];
        const bdy = bodyY[i] - bodyY[i - 1];
        const bLen = Math.hypot(bdx, bdy) || 1;
        const ux = bdx / bLen, uy = bdy / bLen;
        const minStep = bLen * 0.28;

        const lDot = (leftX[i] - leftX[i - 1]) * ux + (leftY[i] - leftY[i - 1]) * uy;
        if (lDot < minStep) {
          const push = minStep - lDot;
          leftX[i] += ux * push;
          leftY[i] += uy * push;
        }
        const rDot = (rightX[i] - rightX[i - 1]) * ux + (rightY[i] - rightY[i - 1]) * uy;
        if (rDot < minStep) {
          const push = minStep - rDot;
          rightX[i] += ux * push;
          rightY[i] += uy * push;
        }
      }
    }

    if (minX < globalMinX) globalMinX = minX;
    if (maxX > globalMaxX) globalMaxX = maxX;
    if (minY < globalMinY) globalMinY = minY;
    if (maxY > globalMaxY) globalMaxY = maxY;

    const tailDx = bodyX[last] - bodyX[last - 1];
    const tailDy = bodyY[last] - bodyY[last - 1];
    const tailScale = (4.2 * UNIT) / (Math.hypot(tailDx, tailDy) || 1);
    const tailTipX = bodyX[last] + tailDx * tailScale;
    const tailTipY = bodyY[last] + tailDy * tailScale;

    const headFx = Math.cos(headAngleNow);
    const headFy = Math.sin(headAngleNow);
    const headSnoutX = bodyX[0] + headFx * 26.6 * UNIT;
    const headSnoutY = bodyY[0] + headFy * 26.6 * UNIT;

    const pad = 14 * UNIT;
    const fr = {
      t: rec.t,
      jointX: rec.jointX,
      jointY: rec.jointY,
      bodyX,
      bodyY,
      leftX,
      leftY,
      rightX,
      rightY,
      tailTipX,
      tailTipY,
      headAngle: headAngleNow,
      tongueProgress: rec.tongueProgress,
      socialModes: rec.socialModes,
      bbox: {
        minX: Math.min(minX, headSnoutX, tailTipX) - pad,
        maxX: Math.max(maxX, headSnoutX, tailTipX) + pad,
        minY: Math.min(minY, headSnoutY, tailTipY) - pad,
        maxY: Math.max(maxY, headSnoutY, tailTipY) + pad,
      },
      sh2Shells: null,
      sh1Shells: null,
    };

    fr.sh2Shells = computePieceShadowShells(fr, halfWidths, 28, last);
    fr.sh1Shells = computePieceShadowShells(fr, halfWidths, 13, 28);
    const hasCross = Boolean(fr.sh2Shells || fr.sh1Shells);
    if (hasCross) {
      selfCrossFrames++;
      if (!inCross) {
        crossEvents.push(fr.t);
        inCross = true;
      }
    } else {
      inCross = false;
    }
    return fr;
  });

  console.log(
    `Autonomous roam (seed=${seed}): ${loopDuration.toFixed(1)}s (${frames.length} steps @ 60Hz), ` +
    `arcLen=${totalArcLen.toFixed(0)}px, weaveCycles=${exactCycles}, ` +
    `socialsVisits=${socVisits} (${visitedBtns.reduce((a, b) => a + b, 0)}/5 btns), coils=${coilCount}, ` +
    `selfCrossEvents=${crossEvents.length} (${selfCrossFrames}f), ` +
    `closureErr=${rawErr.toFixed(1)}px, bounds=[x:${globalMinX.toFixed(0)}..${globalMaxX.toFixed(0)}, y:${globalMinY.toFixed(0)}..${globalMaxY.toFixed(0)}]`
  );
  if (excursionLogs.length > 0) {
    console.log(`  Socials random over/under excursions: ${excursionLogs.join('  |  ')}`);
  }
  if (crossEvents.length > 0) {
    console.log(`  Self-crossing starts @ ${crossEvents.map((t) => t.toFixed(1) + 's').join(', ')}`);
  }

  return {
    frames,
    loopDuration,
    halfWidths,
    socVisits,
    selfCrossFrames,
    closureErr: rawErr,
    visitedCount: visitedBtns.reduce((a, b) => a + b, 0),
    usedSeed: seed,
  };
}

// ============================================================================
// 4. Pixel-Accurate Self-Crossing Shadow (Matches snake.frag / Website Canvas)
// ============================================================================
const SHADOW_SHELLS = [
  { r: 4.2 * UNIT, darkOp: 0.055, lightOp: 0.036 }, // outer penumbra (~3.3px)
  { r: 2.3 * UNIT, darkOp: 0.095, lightOp: 0.062 }, // mid (~1.8px)
  { r: 0.8 * UNIT, darkOp: 0.135, lightOp: 0.088 }, // core right at upper edge (~0.6px)
];
const MAX_SHELL_R = SHADOW_SHELLS[0].r;

function capsuleDist(px, py, ax, ay, bx, by, ra, rb) {
  const pax = px - ax, pay = py - ay;
  const bax = bx - ax, bay = by - ay;
  const denom = bax * bax + bay * bay;
  const h = denom > 1e-6 ? Math.max(0, Math.min(1, (pax * bax + pay * bay) / denom)) : 0;
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  return Math.hypot(dx, dy) - (ra + (rb - ra) * h);
}

function upperSurfaceDist(fr, halfWidths, px, py, sFloor) {
  let best = 1e6;
  if (sFloor >= 8) {
    const hx = fr.bodyX[0], hy = fr.bodyY[0];
    const hfx = Math.cos(fr.headAngle), hfy = Math.sin(fr.headAngle);
    const u = UNIT;
    const d1 = capsuleDist(
      px, py,
      hx - hfx * 2.0 * u, hy - hfy * 2.0 * u,
      hx + hfx * 8.8 * u, hy + hfy * 8.8 * u,
      5.4 * u, 8.6 * u
    );
    const d2 = capsuleDist(
      px, py,
      hx + hfx * 8.8 * u, hy + hfy * 8.8 * u,
      hx + hfx * 24.4 * u, hy + hfy * 24.4 * u,
      8.2 * u, 2.0 * u
    );
    if (d1 < best) best = d1;
    if (d2 < best) best = d2;
  }
  const iMax = sFloor - 10;
  for (let i = 1; i < iMax; i++) {
    const d = capsuleDist(
      px, py,
      fr.bodyX[i], fr.bodyY[i],
      fr.bodyX[i + 1], fr.bodyY[i + 1],
      halfWidths[i], halfWidths[i + 1]
    );
    if (d < best) best = d;
  }
  return best;
}

function sampleRibbonPoint(fr, s, side) {
  const i0 = Math.max(0, Math.min(SNAKE_SEGMENTS - 2, Math.floor(s)));
  const t = Math.max(0, Math.min(1, s - i0));
  const cx = fr.bodyX[i0] + (fr.bodyX[i0 + 1] - fr.bodyX[i0]) * t;
  const cy = fr.bodyY[i0] + (fr.bodyY[i0 + 1] - fr.bodyY[i0]) * t;
  if (side === 0) return [cx, cy];
  const ex = side < 0
    ? fr.leftX[i0] + (fr.leftX[i0 + 1] - fr.leftX[i0]) * t
    : fr.rightX[i0] + (fr.rightX[i0 + 1] - fr.rightX[i0]) * t;
  const ey = side < 0
    ? fr.leftY[i0] + (fr.leftY[i0 + 1] - fr.leftY[i0]) * t
    : fr.rightY[i0] + (fr.rightY[i0 + 1] - fr.rightY[i0]) * t;
  return [cx + (ex - cx) * 0.985, cy + (ey - cy) * 0.985];
}

function computePieceShadowShells(fr, halfWidths, jMin, jMax) {
  let nearAny = false;
  for (let j = jMin; j <= jMax; j++) {
    const d = upperSurfaceDist(fr, halfWidths, fr.bodyX[j], fr.bodyY[j], j);
    if (d <= MAX_SHELL_R + halfWidths[j] + 1.5) {
      nearAny = true;
      break;
    }
  }
  if (!nearAny) return null;

  const STEP = 0.25;
  const count = Math.round((jMax - jMin) / STEP) + 1;
  const sArr = new Float64Array(count);
  const dL = new Float64Array(count);
  const dR = new Float64Array(count);

  let minD = 1e6;
  for (let k = 0; k < count; k++) {
    const s = Math.min(jMax, jMin + k * STEP);
    sArr[k] = s;
    const sFloor = Math.floor(s);
    const [lx, ly] = sampleRibbonPoint(fr, s, -1);
    const [rx, ry] = sampleRibbonPoint(fr, s, 1);
    const dl = upperSurfaceDist(fr, halfWidths, lx, ly, sFloor);
    const dr = upperSurfaceDist(fr, halfWidths, rx, ry, sFloor);
    dL[k] = dl;
    dR[k] = dr;
    if (dl < minD) minD = dl;
    if (dr < minD) minD = dr;
  }
  if (minD > MAX_SHELL_R) return null;

  const findInterval = (dArr, r) => {
    let bestStart = -1, bestEnd = -1, bestDepth = 1e6;
    let k = 0;
    while (k < count) {
      if (dArr[k] <= r) {
        const runStart = k;
        let runMin = dArr[k];
        while (k + 1 < count && dArr[k + 1] <= r) {
          k++;
          if (dArr[k] < runMin) runMin = dArr[k];
        }
        const runEnd = k;
        if (runMin < bestDepth) {
          bestDepth = runMin;
          bestStart = runStart;
          bestEnd = runEnd;
        }
      }
      k++;
    }
    if (bestStart === -1) return null;

    let s0 = sArr[bestStart];
    if (bestStart > 0 && dArr[bestStart - 1] > r) {
      const denom = dArr[bestStart - 1] - dArr[bestStart];
      const frac = denom > 1e-6 ? (dArr[bestStart - 1] - r) / denom : 0;
      s0 = sArr[bestStart - 1] + (sArr[bestStart] - sArr[bestStart - 1]) * frac;
    }
    let s1 = sArr[bestEnd];
    if (bestEnd + 1 < count && dArr[bestEnd + 1] > r) {
      const denom = dArr[bestEnd + 1] - dArr[bestEnd];
      const frac = denom > 1e-6 ? (r - dArr[bestEnd]) / denom : 0;
      s1 = sArr[bestEnd] + (sArr[bestEnd + 1] - sArr[bestEnd]) * frac;
    }
    if (s1 - s0 < 0.08) {
      const mid = (s0 + s1) * 0.5;
      s0 = Math.max(jMin, mid - 0.05);
      s1 = Math.min(jMax, mid + 0.05);
    }
    return [s0, s1];
  };

  const N = 4;
  const shells = [];
  let anyShell = false;

  for (const sh of SHADOW_SHELLS) {
    const r = sh.r;
    const intL = findInterval(dL, r);
    const intR = findInterval(dR, r);
    if (!intL && !intR) {
      shells.push(null);
      continue;
    }
    anyShell = true;
    const poly = [];

    if (intL && intR) {
      for (let k = 0; k < N; k++) {
        const u = k / (N - 1);
        poly.push(sampleRibbonPoint(fr, intL[0] + (intL[1] - intL[0]) * u, -1));
      }
      for (let k = N - 1; k >= 0; k--) {
        const u = k / (N - 1);
        poly.push(sampleRibbonPoint(fr, intR[0] + (intR[1] - intR[0]) * u, 1));
      }
    } else {
      const hitLeft = Boolean(intL);
      const [s0, s1] = hitLeft ? intL : intR;
      const edgePts = [];
      const innerPts = [];
      for (let k = 0; k < N; k++) {
        const u = k / (N - 1);
        const s = s0 + (s1 - s0) * u;
        const pHit = sampleRibbonPoint(fr, s, hitLeft ? -1 : 1);
        const pFar = sampleRibbonPoint(fr, s, hitLeft ? 1 : -1);
        const sFloor = Math.floor(s);
        let lo = 0, hi = 1;
        for (let iter = 0; iter < 6; iter++) {
          const mid = (lo + hi) * 0.5;
          const mx = pHit[0] + (pFar[0] - pHit[0]) * mid;
          const my = pHit[1] + (pFar[1] - pHit[1]) * mid;
          if (upperSurfaceDist(fr, halfWidths, mx, my, sFloor) <= r) lo = mid;
          else hi = mid;
        }
        const f = Math.max(0.08, lo);
        edgePts.push(pHit);
        innerPts.push([pHit[0] + (pFar[0] - pHit[0]) * f, pHit[1] + (pFar[1] - pHit[1]) * f]);
      }
      if (hitLeft) {
        for (let k = 0; k < N; k++) poly.push(edgePts[k]);
        for (let k = N - 1; k >= 0; k--) poly.push(innerPts[k]);
      } else {
        for (let k = 0; k < N; k++) poly.push(innerPts[k]);
        for (let k = N - 1; k >= 0; k--) poly.push(edgePts[k]);
      }
    }
    shells.push(poly);
  }

  return anyShell ? shells : null;
}

// ============================================================================
// 5. Compact Relative SVG Path Builders (Zero-Spike Midpoint-to-Midpoint Joins!)
// ============================================================================
const r1 = (n) => {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? 0 : v;
};

function fmtNum(v) {
  return String(r1(v));
}

function numList(nums) {
  let out = '';
  for (let i = 0; i < nums.length; i++) {
    const s = fmtNum(nums[i]);
    if (i > 0 && !s.startsWith('-')) out += ' ';
    out += s;
  }
  return out;
}

function makeRelWriter() {
  let cx = 0, cy = 0;
  let d = '';
  return {
    M(x, y) {
      const rx = r1(x), ry = r1(y);
      d += `M${numList([rx, ry])}`;
      cx = rx; cy = ry;
    },
    m(x, y) {
      const rx = r1(x), ry = r1(y);
      d += `m${numList([rx - cx, ry - cy])}`;
      cx = rx; cy = ry;
    },
    l(x, y) {
      const rx = r1(x), ry = r1(y);
      d += `l${numList([rx - cx, ry - cy])}`;
      cx = rx; cy = ry;
    },
    q(x1, y1, x, y) {
      const rx1 = r1(x1), ry1 = r1(y1);
      const rx = r1(x), ry = r1(y);
      d += `q${numList([rx1 - cx, ry1 - cy, rx - cx, ry - cy])}`;
      cx = rx; cy = ry;
    },
    c(x1, y1, x2, y2, x, y) {
      const rx1 = r1(x1), ry1 = r1(y1);
      const rx2 = r1(x2), ry2 = r1(y2);
      const rx = r1(x), ry = r1(y);
      d += `c${numList([rx1 - cx, ry1 - cy, rx2 - cx, ry2 - cy, rx - cx, ry - cy])}`;
      cx = rx; cy = ry;
    },
    z(startX, startY) {
      d += 'z';
      cx = r1(startX); cy = r1(startY);
    },
    toString() {
      return d;
    },
  };
}

// Dense uniform 2-segment knots with IDENTICAL overlapping Beziers across every piece seam:
// - Piece 0 & Piece 1 share exact quadratic Bezier [mid(12,14) -> ctrl(14) -> mid(14,16)]
// - Piece 1 & Piece 2 share exact quadratic Bezier [mid(26,28) -> ctrl(28) -> mid(28,30)]
// Zero un-smoothed endcap corners can ever poke out on a tight turn!
const PIECE0_IDX = [1, 2, 4, 6, 8, 10, 12, 14, 16];
const PIECE1_IDX = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
const PIECE2_IDX = [26, 28, 30, 32, 34, 36, 38, 40, 42, 43];

function buildRibbonPath(fr, indices, isHeadEnd, hasTailCap, ox, oy) {
  const m = indices.length;
  const lx = (k) => fr.leftX[indices[k]] - ox;
  const ly = (k) => fr.leftY[indices[k]] - oy;
  const rx = (k) => fr.rightX[indices[k]] - ox;
  const ry = (k) => fr.rightY[indices[k]] - oy;

  const w = makeRelWriter();
  let sx, sy;
  if (isHeadEnd) {
    sx = lx(0); sy = ly(0);
    w.M(sx, sy);
    w.l((lx(0) + lx(1)) * 0.5, (ly(0) + ly(1)) * 0.5);
  } else {
    // Start RIGHT at midpoint(0, 1) — never emit an un-smoothed outer corner vertex!
    sx = (lx(0) + lx(1)) * 0.5;
    sy = (ly(0) + ly(1)) * 0.5;
    w.M(sx, sy);
  }

  for (let k = 1; k < m - 1; k++) {
    w.q(lx(k), ly(k), (lx(k) + lx(k + 1)) * 0.5, (ly(k) + ly(k + 1)) * 0.5);
  }

  if (hasTailCap) {
    w.q(lx(m - 1), ly(m - 1), fr.tailTipX - ox, fr.tailTipY - oy);
    w.q(rx(m - 1), ry(m - 1), (rx(m - 2) + rx(m - 1)) * 0.5, (ry(m - 2) + ry(m - 1)) * 0.5);
  } else {
    // Cross directly from midL(m-2, m-1) to midR(m-2, m-1) — zero sticking-out endcap!
    w.l((rx(m - 2) + rx(m - 1)) * 0.5, (ry(m - 2) + ry(m - 1)) * 0.5);
  }

  for (let k = m - 2; k > 0; k--) {
    w.q(rx(k), ry(k), (rx(k) + rx(k - 1)) * 0.5, (ry(k) + ry(k - 1)) * 0.5);
  }

  if (isHeadEnd) {
    w.l(rx(0), ry(0));
  }
  w.z(sx, sy);
  return w.toString();
}

// Exact Serpantinum head + inner diamond cutout (fill-rule="evenodd")
function buildHeadPath(fr, ox, oy) {
  const hx = fr.bodyX[0] - ox;
  const hy = fr.bodyY[0] - oy;
  const hfx = Math.cos(fr.headAngle);
  const hfy = Math.sin(fr.headAngle);
  const hnx = -hfy;
  const hny = hfx;
  const u = UNIT;

  const px = (f, n) => hx + hfx * f * u + hnx * n * u;
  const py = (f, n) => hy + hfy * f * u + hny * n * u;
  const l1x = fr.leftX[1] - ox, l1y = fr.leftY[1] - oy;
  const l2x = fr.leftX[2] - ox, l2y = fr.leftY[2] - oy;
  const r1x = fr.rightX[1] - ox, r1y = fr.rightY[1] - oy;
  const r2x = fr.rightX[2] - ox, r2y = fr.rightY[2] - oy;

  const w = makeRelWriter();
  const s0x = px(26.6, 0), s0y = py(26.6, 0);
  w.M(s0x, s0y);
  w.c(px(26.2, 2.4), py(26.2, 2.4), px(17.4, 7.4), py(17.4, 7.4), px(8.8, 8.8), py(8.8, 8.8));
  w.c(px(4.2, 9.0), py(4.2, 9.0), px(-1.4, 6.8), py(-1.4, 6.8), l1x, l1y);
  w.l((l1x + l2x) * 0.5, (l1y + l2y) * 0.5);
  w.l((r1x + r2x) * 0.5, (r1y + r2y) * 0.5);
  w.l(r1x, r1y);
  w.c(px(-1.4, -6.8), py(-1.4, -6.8), px(4.2, -9.0), py(4.2, -9.0), px(8.8, -8.8), py(8.8, -8.8));
  w.c(px(17.4, -7.4), py(17.4, -7.4), px(26.2, -2.4), py(26.2, -2.4), s0x, s0y);
  w.z(s0x, s0y);

  // Inner diamond cutout hole
  const h0x = px(17.6, 0), h0y = py(17.6, 0);
  w.m(h0x, h0y);
  w.q(px(13.0, 1.75), py(13.0, 1.75), px(8.8, 2.75), py(8.8, 2.75));
  w.q(px(4.8, 1.65), py(4.8, 1.65), px(0.5, 0), py(0.5, 0));
  w.q(px(4.8, -1.65), py(4.8, -1.65), px(8.8, -2.75), py(8.8, -2.75));
  w.q(px(13.0, -1.75), py(13.0, -1.75), h0x, h0y);
  w.z(h0x, h0y);
  return w.toString();
}

// Exact Serpantinum forked tongue path (constant topology)
function buildTonguePath(fr, ox, oy) {
  const hx = fr.bodyX[0] - ox;
  const hy = fr.bodyY[0] - oy;
  const hfx = Math.cos(fr.headAngle);
  const hfy = Math.sin(fr.headAngle);
  const hnx = -hfy;
  const hny = hfx;
  const u = UNIT;
  const snoutX = hx + hfx * 26.6 * u;
  const snoutY = hy + hfy * 26.6 * u;

  const p = fr.tongueProgress;
  const ext = p > 0 ? Math.sin(p * Math.PI) : 0;
  const flutter = p > 0 ? Math.sin(p * Math.PI * 4) * 1.6 * u * ext : 0;
  const tongueLen = 11.4 * u * ext;
  const baseX = snoutX - hfx * 2.0 * u;
  const baseY = snoutY - hfy * 2.0 * u;
  const forkX = snoutX + hfx * (tongueLen * 0.62) + hnx * (flutter * 0.5);
  const forkY = snoutY + hfy * (tongueLen * 0.62) + hny * (flutter * 0.5);
  const tipX = snoutX + hfx * tongueLen + hnx * flutter;
  const tipY = snoutY + hfy * tongueLen + hny * flutter;
  const spread = 3.2 * u * ext;

  const w = makeRelWriter();
  w.M(baseX, baseY);
  w.l(forkX, forkY);
  w.m(forkX, forkY);
  w.l(tipX + hnx * spread, tipY + hny * spread);
  w.m(forkX, forkY);
  w.l(tipX - hnx * spread, tipY - hny * spread);
  return w.toString();
}

// Constant 8-vertex closed polygon for a shadow shell
function buildShadowShellPath(fr, poly, fallbackIdx, ox, oy) {
  const w = makeRelWriter();
  if (!poly) {
    const cx = fr.bodyX[fallbackIdx] - ox;
    const cy = fr.bodyY[fallbackIdx] - oy;
    w.M(cx, cy);
    for (let k = 1; k < 8; k++) w.l(cx, cy);
    w.z(cx, cy);
    return w.toString();
  }
  const s0x = poly[0][0] - ox, s0y = poly[0][1] - oy;
  w.M(s0x, s0y);
  for (let k = 1; k < poly.length; k++) {
    w.l(poly[k][0] - ox, poly[k][1] - oy);
  }
  w.z(s0x, s0y);
  return w.toString();
}

// ============================================================================
// 6. High-FPS Liquid Keyframe Selection per Slice (and per over/under layer)
// ============================================================================
const fmtKT = (v) => (v === 0 ? '0' : v === 1 ? '1' : v.toFixed(5).replace(/0+$/, '').replace(/\.$/, ''));

const ERROR_SAMPLE_IDX = [0, 4, 9, 15, 21, 28, 35, 43];

function interpError(frames, iA, iB, iM) {
  const fA = frames[iA], fB = frames[iB], fM = frames[iM];
  const u = (iM - iA) / (iB - iA);
  let maxErr = 0;
  for (const s of ERROR_SAMPLE_IDX) {
    const ex = (fA.bodyX[s] + (fB.bodyX[s] - fA.bodyX[s]) * u) - fM.bodyX[s];
    const ey = (fA.bodyY[s] + (fB.bodyY[s] - fA.bodyY[s]) * u) - fM.bodyY[s];
    const d = Math.hypot(ex, ey);
    if (d > maxErr) maxErr = d;
  }
  const sAx = fA.bodyX[0] + Math.cos(fA.headAngle) * 20;
  const sAy = fA.bodyY[0] + Math.sin(fA.headAngle) * 20;
  const sBx = fB.bodyX[0] + Math.cos(fB.headAngle) * 20;
  const sBy = fB.bodyY[0] + Math.sin(fB.headAngle) * 20;
  const sMx = fM.bodyX[0] + Math.cos(fM.headAngle) * 20;
  const sMy = fM.bodyY[0] + Math.sin(fM.headAngle) * 20;
  const hd = Math.hypot((sAx + (sBx - sAx) * u) - sMx, (sAy + (sBy - sAy) * u) - sMy);
  return Math.max(maxErr, hd);
}

function buildAdaptiveBodyTrack(frames, mask, dilate = 4) {
  const n = frames.length;
  const active = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    for (let d = -dilate; d <= dilate; d++) {
      active[(i + d + n) % n] = 1;
    }
  }

  const chosen = new Set([0]);
  let i = 0;
  // 10-15 fps fluid SMIL motion (<=0.65px chord error -> zero rigid-part morphing!)
  const MIN_STEP = 4;  // 15 fps on turns
  const MAX_STEP = 6;  // 10 fps on gentle glides
  const TOL = 0.65;

  while (i < n) {
    if (!active[i]) {
      if (active[(i - 1 + n) % n] || active[(i + 1) % n]) chosen.add(i);
      i++;
      continue;
    }
    const runStart = i;
    while (i + 1 < n && active[i + 1]) i++;
    const runEnd = i;

    chosen.add(runStart);
    chosen.add(runEnd);
    let cur = runStart;
    while (cur < runEnd) {
      let next = Math.min(runEnd, cur + MAX_STEP);
      while (next - cur > MIN_STEP) {
        let worst = 0;
        for (let m = cur + 1; m < next; m++) {
          const e = interpError(frames, cur, next, m);
          if (e > worst) worst = e;
          if (worst > TOL) break;
        }
        if (worst <= TOL) break;
        next = Math.max(cur + MIN_STEP, next - 1);
      }
      chosen.add(next);
      cur = next;
    }
    i++;
  }

  const sorted = Array.from(chosen).sort((a, b) => a - b);
  return { sorted, active };
}

function buildSparseTrack(n, mask, stride) {
  const active = new Uint8Array(mask);
  const chosen = new Set([0]);
  for (let i = 0; i < n; i++) {
    if (!active[i]) {
      if (active[(i - 1 + n) % n] || active[(i + 1) % n]) chosen.add(i);
      continue;
    }
    if (i % stride === 0) chosen.add(i);
    if (!active[(i - 1 + n) % n] || !active[(i + 1) % n]) chosen.add(i);
  }
  const sorted = Array.from(chosen).sort((a, b) => a - b);
  return { sorted, active };
}

function buildTracksForMask(frames, slice, bodyMask) {
  const n = frames.length;
  if (!bodyMask.some((v) => v === 1)) return null;

  const tongueMask = new Uint8Array(n);
  const sh2Mask = new Uint8Array(n);
  const sh1Mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!bodyMask[i]) continue;
    const fr = frames[i];
    if (fr.tongueProgress > 0) {
      const hx = fr.bodyX[0], hy = fr.bodyY[0];
      if (hx >= slice.x0 - 28 && hx <= slice.x1 + 28 && hy >= slice.y0 - 28 && hy <= slice.y1 + 28) {
        tongueMask[i] = 1;
      }
    }
    if (fr.sh2Shells) sh2Mask[i] = 1;
    if (fr.sh1Shells) sh1Mask[i] = 1;
  }

  const bodyTrack = buildAdaptiveBodyTrack(frames, bodyMask, 4);
  const tongueTrack = tongueMask.some((v) => v === 1) ? buildSparseTrack(n, tongueMask, 2) : null;
  const sh2Track = sh2Mask.some((v) => v === 1) ? buildSparseTrack(n, sh2Mask, 4) : null;
  const sh1Track = sh1Mask.some((v) => v === 1) ? buildSparseTrack(n, sh1Mask, 4) : null;
  return { bodyTrack, tongueTrack, sh2Track, sh1Track };
}

function selectSliceLayers(frames, slice) {
  const n = frames.length;
  const margin = 4;

  if (slice.isHero || slice.btnIdx < 0) {
    const bodyMask = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const fr = frames[i];
      if (
        fr.bbox.maxX >= slice.x0 - margin &&
        fr.bbox.minX <= slice.x1 + margin &&
        fr.bbox.maxY >= slice.y0 - margin &&
        fr.bbox.minY <= slice.y1 + margin
      ) {
        bodyMask[i] = 1;
      }
    }
    const tracks = buildTracksForMask(frames, slice, bodyMask);
    return tracks ? { over: tracks, under: null } : null;
  }

  // Bottom social button slice: split disjoint excursions into random 'over' vs 'under' layers!
  const overMask = new Uint8Array(n);
  const underMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const fr = frames[i];
    if (
      fr.bbox.maxX >= slice.x0 - margin &&
      fr.bbox.minX <= slice.x1 + margin &&
      fr.bbox.maxY >= slice.y0 - margin &&
      fr.bbox.minY <= slice.y1 + margin
    ) {
      if (fr.socialModes[slice.btnIdx] === 'under') underMask[i] = 1;
      else overMask[i] = 1;
    }
  }
  const over = buildTracksForMask(frames, slice, overMask);
  const under = buildTracksForMask(frames, slice, underMask);
  if (!over && !under) return null;
  return { over, under };
}

// ============================================================================
// 7. Build Snake SVG Markup for a Layer + Theme
// ============================================================================
const THEMES = {
  dark: {
    fill: '#cfb4ff',
    opacity: 0.92,
    elevShadowOpacity: 0.34,
    tongueMaxOpacity: 0.85,
  },
  light: {
    fill: '#7706ff',
    opacity: 0.82,
    elevShadowOpacity: 0.18,
    tongueMaxOpacity: 0.85,
  },
};

function buildDefsBlock(slice, themeKey) {
  const th = THEMES[themeKey];
  const defsParts = [
    `<filter id="serp-elev" x="-14%" y="-14%" width="128%" height="128%">` +
    `<feDropShadow dx="0" dy="1.5" stdDeviation="1.8" flood-color="#000" flood-opacity="${th.elevShadowOpacity}"/>` +
    `</filter>`,
  ];
  if (slice.clipRect) {
    const [cx, cy, cw, ch, crx] = slice.clipRect;
    defsParts.push(`<clipPath id="serp-scard"><rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="${crx}"/></clipPath>`);
  }
  return `<!--serp-defs-start--><defs>${defsParts.join('')}</defs><!--serp-defs-end-->`;
}

function buildSnakeGroup(slice, themeKey, frames, tracks, loopDuration, markerTag = 'snake') {
  const th = THEMES[themeKey];
  const n = frames.length;
  const ox = slice.x0;
  const oy = slice.y0;
  const dur = `${loopDuration.toFixed(2)}s`;

  const makeTrack = (track) => {
    const list = track.sorted.map((idx) => ({ t: idx / n, fr: frames[idx], on: track.active[idx] === 1 }));
    list.push({ t: 1.0, fr: frames[0], on: track.active[0] === 1 });
    const kt = list.map((k) => fmtKT(k.t)).join(';');
    return { list, kt };
  };

  const animAttr = (attr, values, kt, extra = '') =>
    `<animate attributeName="${attr}" values="${values}" keyTimes="${kt}" dur="${dur}" repeatCount="indefinite"${extra}/>`;

  const body = makeTrack(tracks.bodyTrack);
  const p2Vals = body.list.map((k) => buildRibbonPath(k.fr, PIECE2_IDX, false, true, ox, oy));
  const p1Vals = body.list.map((k) => buildRibbonPath(k.fr, PIECE1_IDX, false, false, ox, oy));
  const p0Vals = body.list.map((k) => buildRibbonPath(k.fr, PIECE0_IDX, true, false, ox, oy));
  const headVals = body.list.map((k) => buildHeadPath(k.fr, ox, oy));
  const visVals = body.list.map((k) => (k.on ? '1' : '0'));

  const layerParts = [];

  const pushShadowShells = (track, shellProp, fallbackIdx) => {
    const tr = makeTrack(track);
    for (let s = 0; s < SHADOW_SHELLS.length; s++) {
      const op = themeKey === 'dark' ? SHADOW_SHELLS[s].darkOp : SHADOW_SHELLS[s].lightOp;
      const dVals = tr.list.map((k) => {
        const arr = k.on ? k.fr[shellProp] : null;
        return buildShadowShellPath(k.fr, arr ? arr[s] : null, fallbackIdx, ox, oy);
      });
      const oVals = tr.list.map((k) => {
        const arr = k.on ? k.fr[shellProp] : null;
        return arr && arr[s] ? String(op) : '0';
      });
      if (!oVals.some((v) => v !== '0')) continue;
      layerParts.push(
        `<path d="${dVals[0]}" fill="#000" opacity="${oVals[0]}">` +
        animAttr('d', dVals.join(';'), tr.kt) +
        animAttr('opacity', oVals.join(';'), tr.kt) +
        `</path>`
      );
    }
  };

  // Piece 2 (tail) + self-crossing shadow onto Piece 2
  layerParts.push(`<path d="${p2Vals[0]}" fill="${th.fill}">${animAttr('d', p2Vals.join(';'), body.kt)}</path>`);
  if (tracks.sh2Track) pushShadowShells(tracks.sh2Track, 'sh2Shells', 34);

  // Piece 1 (mid) + self-crossing shadow onto Piece 1
  layerParts.push(`<path d="${p1Vals[0]}" fill="${th.fill}">${animAttr('d', p1Vals.join(';'), body.kt)}</path>`);
  if (tracks.sh1Track) pushShadowShells(tracks.sh1Track, 'sh1Shells', 20);

  // Piece 0 (neck)
  layerParts.push(`<path d="${p0Vals[0]}" fill="${th.fill}">${animAttr('d', p0Vals.join(';'), body.kt)}</path>`);

  // Forked tongue (sparse 30fps track ONLY during active flicks)
  if (tracks.tongueTrack) {
    const tg = makeTrack(tracks.tongueTrack);
    const tVals = tg.list.map((k) => buildTonguePath(k.fr, ox, oy));
    const oVals = tg.list.map((k) => {
      if (!k.on || k.fr.tongueProgress <= 0) return '0';
      return (th.tongueMaxOpacity * Math.sin(k.fr.tongueProgress * Math.PI)).toFixed(2);
    });
    layerParts.push(
      `<path d="${tVals[0]}" fill="none" stroke="${th.fill}" stroke-width="${fmtNum(1.45 * UNIT)}" stroke-linecap="round" opacity="${oVals[0]}">` +
      animAttr('d', tVals.join(';'), tg.kt) +
      animAttr('opacity', oVals.join(';'), tg.kt) +
      `</path>`
    );
  }

  // Head with iconic inner diamond cutout (evenodd)
  layerParts.push(`<path d="${headVals[0]}" fill="${th.fill}" fill-rule="evenodd">${animAttr('d', headVals.join(';'), body.kt)}</path>`);

  const clipAttr = slice.isHero
    ? ' clip-path="url(#card)"'
    : slice.clipRect
    ? ' clip-path="url(#serp-scard)"'
    : '';

  const needsVisAnim = visVals.some((v) => v === '0');
  const visAnim = needsVisAnim
    ? `<animate attributeName="opacity" values="${visVals.join(';')}" keyTimes="${body.kt}" calcMode="discrete" dur="${dur}" repeatCount="indefinite"/>`
    : '';

  const snakeGroup =
    `<!--serp-${markerTag}-start-->` +
    `<g class="serp-snake"${clipAttr}>` +
    `<g opacity="${visVals[0]}">${visAnim}` +
    `<g opacity="${th.opacity}" filter="url(#serp-elev)">` +
    layerParts.join('') +
    `</g></g></g>` +
    `<!--serp-${markerTag}-end-->`;

  return { snakeGroup, activeKfs: body.list.filter((k) => k.on).length, totalKfs: body.list.length };
}

// ============================================================================
// 8. Inject Into Existing Expressive Profile SVGs (Idempotent!)
// ============================================================================
function stripPreviousInjection(svg) {
  let out = svg;
  out = out.replace(/<!--serp-defs-start-->[\s\S]*?<!--serp-defs-end-->/g, '');
  out = out.replace(/<!--serp-snake-start-->[\s\S]*?<!--serp-snake-end-->/g, '');
  out = out.replace(/<!--serp-snake-over-start-->[\s\S]*?<!--serp-snake-over-end-->/g, '');
  out = out.replace(/<!--serp-snake-under-start-->[\s\S]*?<!--serp-snake-under-end-->/g, '');
  out = out.replace(/<!--serp-css-start-->[\s\S]*?<!--serp-css-end-->/g, '');
  const fgMatch = out.match(/<!--serp-fg-start-->([\s\S]*?)<!--serp-fg-end-->/);
  if (fgMatch) {
    out = out.replace(/<!--serp-fg-start-->[\s\S]*?<!--serp-fg-end-->/, '');
    out = out.replace('<!--serp-fg-anchor-->', fgMatch[1]);
  }
  return out;
}

function injectHeroSVG(svg, defsBlock, snakeGroup) {
  let out = stripPreviousInjection(svg);

  const cssRule = `<!--serp-css-start-->@media (prefers-reduced-motion:reduce){.serp-snake{display:none}}<!--serp-css-end-->`;
  out = out.replace('</style>', `${cssRule}</style>`);
  out = out.replace('</style>', `</style>${defsBlock}`);

  const avaRegex = /(<clipPath id="ava">[\s\S]*?<\/clipPath><path [^>]+><\/path>|<clipPath id="ava">[\s\S]*?<\/clipPath><path [^>]+\/><g class="fade"><image [^>]+\/><\/g>)/;
  const fossRegex = /(<g class="pop"[^>]*>(?:(?!<\/g>).)*?>FOSS<\/text><\/g>)/;

  const avaMatch = out.match(avaRegex);
  const fossMatch = out.match(fossRegex);

  if (!avaMatch || !fossMatch) {
    console.warn('Warning: could not isolate Avatar or FOSS chip in hero SVG; placing snake on top.');
    return out.replace('</svg>', `${snakeGroup}</svg>`);
  }

  const avaMarkup = avaMatch[1];
  const fossMarkup = fossMatch[1];

  out = out.replace(avaMarkup, '<!--serp-fg-anchor-->');
  out = out.replace(fossMarkup, '');

  const fgBlock = `<!--serp-fg-start-->${avaMarkup}${fossMarkup}<!--serp-fg-end-->`;
  out = out.replace('</svg>', `${snakeGroup}${fgBlock}</svg>`);
  return out;
}

function injectSocialSVG(svg, defsBlock, overGroup, underGroup) {
  let out = stripPreviousInjection(svg);
  if (!overGroup && !underGroup) return out;

  const cssRule = `<!--serp-css-start-->@media (prefers-reduced-motion:reduce){.serp-snake{display:none}}<!--serp-css-end-->`;
  out = out.replace('</style>', `${cssRule}</style>`);
  out = out.replace('</style>', `</style>${defsBlock}`);

  if (underGroup) {
    const btnAnchor = '<g transform="translate(4 20)">';
    if (out.includes(btnAnchor)) {
      out = out.replace(btnAnchor, `${underGroup}${btnAnchor}`);
    } else {
      out = out.replace('</svg>', `${underGroup}</svg>`);
    }
  }
  if (overGroup) {
    out = out.replace('</svg>', `${overGroup}</svg>`);
  }
  return out;
}

// ============================================================================
// 9. Main Execution
// ============================================================================
function main() {
  let sim = null;
  if (seedArg) {
    sim = simulateAutonomousPath(SEED);
  } else {
    let best = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const cand = simulateAutonomousPath((SEED + attempt * 7919) >>> 0);
      if (cand.closureErr <= 9 && cand.socVisits >= 2 && cand.visitedCount >= 5 && cand.selfCrossFrames >= 140) {
        sim = cand;
        break;
      }
      const score = cand.visitedCount * 22 + Math.min(3, cand.socVisits) * 10 - cand.closureErr;
      const bestScore = best ? best.visitedCount * 22 + Math.min(3, best.socVisits) * 10 - best.closureErr : -1e9;
      if (score > bestScore) best = cand;
    }
    if (!sim) sim = best;
  }

  const { frames, loopDuration } = sim;
  const report = [];

  for (const slice of SLICES) {
    const layers = selectSliceLayers(frames, slice);
    for (const theme of ['dark', 'light']) {
      const fileName = `${slice.name}-${theme}.svg`;
      const filePath = path.join(ASSETS_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        console.warn(`Skipping missing asset: ${fileName}`);
        continue;
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      let updated;
      let stats = '(untouched - snake stays clear of edges)';

      if (layers) {
        const defsBlock = buildDefsBlock(slice, theme);
        if (slice.isHero) {
          const res = buildSnakeGroup(slice, theme, frames, layers.over, loopDuration, 'snake');
          updated = injectHeroSVG(raw, defsBlock, res.snakeGroup);
          const extras = [
            layers.over.tongueTrack ? 'tongue' : null,
            layers.over.sh2Track || layers.over.sh1Track ? 'self-shadow' : null,
          ].filter(Boolean).join(',');
          stats = `(${res.activeKfs}/${res.totalKfs} kfs${extras ? ' + ' + extras : ''})`;
        } else {
          const overRes = layers.over
            ? buildSnakeGroup(slice, theme, frames, layers.over, loopDuration, 'snake-over')
            : null;
          const underRes = layers.under
            ? buildSnakeGroup(slice, theme, frames, layers.under, loopDuration, 'snake-under')
            : null;
          updated = injectSocialSVG(
            raw,
            defsBlock,
            overRes ? overRes.snakeGroup : null,
            underRes ? underRes.snakeGroup : null
          );
          const parts = [];
          if (overRes) parts.push(`over:${overRes.activeKfs}kfs`);
          if (underRes) parts.push(`under:${underRes.activeKfs}kfs`);
          stats = `(${parts.join(', ')})`;
        }
      } else {
        updated = stripPreviousInjection(raw);
      }

      fs.writeFileSync(filePath, updated, 'utf8');
      if (theme === 'dark') {
        report.push(`${fileName.padEnd(20)} ${(updated.length / 1024).toFixed(1).padStart(6)} KB  ${stats}`);
      }
    }
  }

  console.log('\nGenerated dark/light SVGs:');
  for (const line of report) console.log('  ' + line);
}

main();
