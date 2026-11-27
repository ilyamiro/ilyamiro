#!/usr/bin/env node
/**
 * Port of Serpantinum's snake (FluidBackground / Snake.js / snake.frag)
 * into the Expressive Profile GitHub README SVGs.
 *
 * - Runs the exact Serpantinum follow-the-leader + angular-stiffness +
 *   zero-slip sinusoidal weave kinematics at 60 Hz across the unified
 *   Hero (840x210) + Socials (840x88) coordinate space.
 * - Produces a 100% seamless loop (matching position, tangent, and gait phase).
 * - Injects pure cross-browser SMIL animations (explicit absolute M/L/Q/C/Z only)
 *   with exact head cutout (evenodd), fluttering forked tongue, self-crossing
 *   cast shadows, component elevation shadow, and native over/under weaving.
 * - Idempotent: strips any previous injection before re-injecting.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ASSETS_DIR = path.join(ROOT, 'assets');

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
  { name: 'social-l', x0: 0,      x1: 73.5,   y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, clipRect: [0, 0, 113.5, 88, 32], mode: 'over' },
  { name: 'social-1', x0: 73.5,   x1: 225.73, y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, mode: 'over' },  // Telegram: ON TOP
  { name: 'social-2', x0: 225.73, x1: 373.43, y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, mode: 'under' }, // YouTube: UNDER
  { name: 'social-3', x0: 373.43, x1: 503.47, y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, mode: 'over' },  // Reddit: ON TOP
  { name: 'social-4', x0: 503.47, x1: 645.02, y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, mode: 'under' }, // Discord: UNDER
  { name: 'social-5', x0: 645.02, x1: 766.5,  y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, mode: 'over' },  // Email: ON TOP
  { name: 'social-r', x0: 766.5,  x1: 840,    y0: SOCIAL_Y0, y1: SOCIAL_Y0+SOCIAL_H, clipRect: [-40, 0, 113.5, 88, 32], mode: 'over' },
];

// ============================================================================
// 2. Serpantinum Snake Constants (ported from FluidBackground/index.tsx & Snake.js)
// ============================================================================
const UNIT = 0.78;
const FIXED_DT = 1 / 60;
const SNAKE_SEGMENTS = 44;
const SNAKE_SEG_LEN = 6.8 * UNIT;
const MAX_TURN_PER_SEG = 0.26;
const COS_MAX_TURN = Math.cos(MAX_TURN_PER_SEG);
const SIN_MAX_TURN = Math.sin(MAX_TURN_PER_SEG);
const MIN_TURN_RADIUS = 24 * UNIT;
const ACCEL_UP_BLEND = 1 - Math.exp(-14 * FIXED_DT);
const ACCEL_DOWN_BLEND = 1 - Math.exp(-9.5 * FIXED_DT);
const WEAVE_AMPLITUDE = 8.4 * UNIT;
const NOMINAL_WAVENUMBER = (Math.PI * 2) / (200 * UNIT);
const WEAVE_NECK_SEGMENTS = 12;

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
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
// 3. Structure-Aware Closed Choreography Waypoints
// ============================================================================
// Landmarks in Hero (y: 0..210):
//   Avatar cookie12: center (281.4, 105), r=82 -> x: 199..363, y: 23..187 (BEHIND)
//   "Ilyamiro":      x: 414..634, y: 36..90 (OVER)
//   Subtitle:        x: 422..626, y: 98..120 (OVER)
//   Denmark chip:    x: 415.6..533.1, y: 134..170 (OVER)
//   FOSS chip:       x: 541.1..632.4, y: 134..170 (UNDER)
//   Flower:          (800, 16), r=74
//   Clover:          (716, 212), r=30
//   Sunny:           (813, 177), r=24
//
// Landmarks in Socials (y: 216..304, pills at y: 237..283):
//   social-l:        x: 0..73.5
//   Telegram (1):    x: 78.5..220.7  (OVER)  | seams: 73.5, 225.73
//   YouTube  (2):    x: 230.7..368.4 (UNDER) | seams: 225.73, 373.43
//   Reddit   (3):    x: 378.4..498.5 (OVER)  | seams: 373.43, 503.47
//   Discord  (4):    x: 508.5..640.0 (UNDER) | seams: 503.47, 645.02
//   Email    (5):    x: 650.0..761.5 (OVER)  | seams: 645.02, 766.5
//   social-r:        x: 766.5..840
const WAYPOINTS = [
  // --- ACT 1: Climb up Hero left, hug cookie12 Avatar & slip BEHIND its scallops ---
  { x: 124, y: 194, speed: 128, weave: 0.85 },
  { x: 162, y: 146, speed: 120, weave: 0.88 }, // Hugging lower-left curve of Avatar
  { x: 140, y:  82, speed: 118, weave: 0.92 }, // Sweeping up beside Avatar
  { x: 186, y:  42, speed: 116, weave: 0.85 }, // Curving into upper-left scallops
  { x: 256, y:  74, speed: 118, weave: 0.78 }, // Passing BEHIND Avatar portrait
  { x: 336, y:  52, speed: 112, weave: 0.85 }, // Emerging from behind top-right scallops!

  // --- ACT 2: Glide ON TOP OF "Ilyamiro", weave UNDER FOSS & ON TOP OF Denmark ---
  { x: 414, y:  34, speed: 122, weave: 0.90 },
  { x: 504, y:  62, speed: 118, weave: 0.86 }, // Gliding across "Ilyamiro"
  { x: 594, y:  92, speed: 114, weave: 0.82 }, // Threading between title & subtitle
  { x: 646, y: 124, speed: 108, weave: 0.78 },
  { x: 622, y: 154, speed: 104, weave: 0.70 }, // Slipping UNDER FOSS right edge
  { x: 552, y: 154, speed: 104, weave: 0.70 }, // Emerging into narrow gap between FOSS & Denmark
  { x: 472, y: 148, speed: 108, weave: 0.78 }, // Crawling ON TOP OF Denmark chip!
  { x: 392, y: 156, speed: 106, weave: 0.78 }, // Curving around Denmark left cap
  { x: 430, y: 188, speed: 122, weave: 0.85 }, // Gliding under Denmark & FOSS
  { x: 564, y: 189, speed: 136, weave: 0.92 },
  { x: 670, y: 168, speed: 122, weave: 0.88 },

  // --- ACT 3: Tight self-crossing loop beside Flower & Sunny (casts iconic self-shadow!) ---
  { x: 726, y: 122, speed: 108, weave: 0.78 }, // Ascending through crossing point (726, 122)
  { x: 760, y:  88, speed:  98, weave: 0.72 }, // Curving up beside flower
  { x: 744, y:  48, speed:  96, weave: 0.70 }, // Tight crest near flower petals
  { x: 702, y:  58, speed:  98, weave: 0.72 }, // Looping back down
  { x: 706, y: 100, speed: 104, weave: 0.74 },
  { x: 742, y: 138, speed: 110, weave: 0.76 }, // Crossing RIGHT OVER its own trailing body!
  { x: 758, y: 180, speed: 112, weave: 0.72 }, // Sweeping beside sunny gear
  { x: 722, y: 213, speed: 116, weave: 0.50 }, // Diving off Hero bottom into gap!

  // --- ACT 4: Socials Bar Alternating Basketweave across ALL 5 Buttons ---
  // (OVER Email -> UNDER Discord -> OVER Reddit -> UNDER YouTube -> OVER Telegram)
  { x: 746, y: 236, speed: 110, weave: 0.48 }, // Emerging above Email
  { x: 792, y: 260, speed: 100, weave: 0.46 }, // Looping around right rounded cap (social-r)
  { x: 750, y: 282, speed: 108, weave: 0.48 }, // Hugging bottom of Email
  { x: 696, y: 262, speed: 110, weave: 0.52 }, // Crawling ON TOP OF Email!
  { x: 645, y: 274, speed: 112, weave: 0.42 }, // Clean shallow crossing of seam 5|4 (bottom channel)
  { x: 576, y: 260, speed: 118, weave: 0.48 }, // Diving diagonally UNDER Discord (ilyamiro)
  { x: 503, y: 236, speed: 112, weave: 0.42 }, // Clean shallow crossing of seam 4|3 (top channel)
  { x: 438, y: 262, speed: 108, weave: 0.54 }, // Swooping ON TOP OF Reddit!
  { x: 373, y: 278, speed: 112, weave: 0.42 }, // Clean shallow crossing of seam 3|2 (bottom channel)
  { x: 300, y: 260, speed: 118, weave: 0.48 }, // Diving diagonally UNDER YouTube
  { x: 226, y: 236, speed: 112, weave: 0.42 }, // Clean shallow crossing of seam 2|1 (top channel)
  { x: 148, y: 264, speed: 108, weave: 0.54 }, // Swooping ON TOP OF Telegram!
  { x:  74, y: 274, speed: 104, weave: 0.42 }, // Clean shallow crossing of seam 1|l
  { x:  32, y: 256, speed:  96, weave: 0.46 }, // Looping smoothly inside left rounded cap (social-l)
  { x:  56, y: 228, speed: 106, weave: 0.48 }, // Sweeping along top-left rim of Socials
  { x: 112, y: 214, speed: 118, weave: 0.55 }, // Climbing seamlessly back into Hero!
];

// Centripetal Catmull-Rom spline evaluation for closed waypoint loop
function buildClosedSpline(wps, samplesPerSeg = 28) {
  const n = wps.length;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const p0 = wps[(i - 1 + n) % n];
    const p1 = wps[i];
    const p2 = wps[(i + 1) % n];
    const p3 = wps[(i + 2) % n];
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );
      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );
      const speed = p1.speed + (p2.speed - p1.speed) * t;
      const weave = (p1.weave ?? 1) + ((p2.weave ?? 1) - (p1.weave ?? 1)) * t;
      pts.push({ x, y, speed, weave });
    }
  }
  let totalLen = 0;
  const cumLen = new Float64Array(pts.length + 1);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    totalLen += Math.hypot(b.x - a.x, b.y - a.y);
    cumLen[i + 1] = totalLen;
  }
  function sampleAtDist(dist) {
    let d = ((dist % totalLen) + totalLen) % totalLen;
    let lo = 0;
    let hi = pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cumLen[mid] <= d) lo = mid;
      else hi = mid - 1;
    }
    const segLen = cumLen[lo + 1] - cumLen[lo] || 1;
    const f = (d - cumLen[lo]) / segLen;
    const a = pts[lo];
    const b = pts[(lo + 1) % pts.length];
    return {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      speed: a.speed + (b.speed - a.speed) * f,
      weave: a.weave + (b.weave - a.weave) * f,
    };
  }
  return { totalLen, sampleAtDist };
}

// ============================================================================
// 4. Physics Simulation (Two-Pass Exact Seamless Loop)
// ============================================================================
function runSimulation() {
  const spline = buildClosedSpline(WAYPOINTS, 28);

  const probeSteps = 2000;
  let estDuration = 0;
  for (let i = 0; i < probeSteps; i++) {
    const s = spline.sampleAtDist((i / probeSteps) * spline.totalLen);
    estDuration += (spline.totalLen / probeSteps) / s.speed;
  }
  const loopDuration = Math.round(estDuration * 10) / 10;
  const totalSteps = Math.round(loopDuration / FIXED_DT);

  const speedWeights = new Float64Array(totalSteps + 1);
  let weightSum = 0;
  for (let k = 0; k < totalSteps; k++) {
    const approxDist = (k / totalSteps) * spline.totalLen;
    const sp = spline.sampleAtDist(approxDist).speed;
    weightSum += sp;
    speedWeights[k + 1] = weightSum;
  }
  const carrotDistAtStep = (step) => {
    const k = ((step % totalSteps) + totalSteps) % totalSteps;
    return (speedWeights[k] / weightSum) * spline.totalLen;
  };

  function simulatePass(wavenumber) {
    const jointX = new Float64Array(SNAKE_SEGMENTS);
    const jointY = new Float64Array(SNAKE_SEGMENTS);
    const halfWidths = new Float64Array(SNAKE_SEGMENTS);
    const weaveEnvelope = new Float64Array(SNAKE_SEGMENTS);

    for (let i = 0; i < SNAKE_SEGMENTS; i++) {
      halfWidths[i] = snakeHalfWidth(i);
      const neck = Math.min(1, i / WEAVE_NECK_SEGMENTS);
      const tail = 1 - 0.4 * (i / (SNAKE_SEGMENTS - 1));
      weaveEnvelope[i] = WEAVE_AMPLITUDE * neck * neck * (3 - 2 * neck) * tail;
    }

    const pStart = spline.sampleAtDist(0);
    const pAhead = spline.sampleAtDist(12);
    let headAngle = Math.atan2(pAhead.y - pStart.y, pAhead.x - pStart.x);
    for (let i = 0; i < SNAKE_SEGMENTS; i++) {
      const p = spline.sampleAtDist(-i * SNAKE_SEG_LEN);
      jointX[i] = p.x;
      jointY[i] = p.y;
    }

    let headSpeed = pStart.speed;
    let gaitPhase = 0;
    let weaveScale = pStart.weave;

    // Expressive tongue flick moments (fractions of loopDuration):
    // 1. Emerging from behind Avatar top-right
    // 2. Crawling ON TOP OF Denmark chip
    // 3. Coming out of the self-crossing loop near Flower/Sunny
    // 4. Crawling ON TOP OF Email
    // 5. Crawling ON TOP OF Reddit
    // 6. Crawling ON TOP OF Telegram
    const tongueFlickFracs = [0.135, 0.340, 0.545, 0.680, 0.805, 0.915];
    const tongueDur = 0.30;

    const frames = [];
    let lap1TotalDist = 0;

    for (let lap = 0; lap < 2; lap++) {
      if (lap === 1) {
        gaitPhase = 0;
        lap1TotalDist = 0;
      }
      for (let step = 0; step < totalSteps; step++) {
        const baseD = carrotDistAtStep(step);
        const lookahead = 22 * UNIT;
        const target = spline.sampleAtDist(baseD + lookahead);

        const dx = target.x - jointX[0];
        const dy = target.y - jointY[0];
        const dist = Math.hypot(dx, dy);
        const desiredHeading = dist > 0.5 ? Math.atan2(dy, dx) : headAngle;
        const headingDiff = normalizeAngle(desiredHeading - headAngle);

        const turnAlignment = Math.max(0, Math.cos(headingDiff));
        const turnSlowdown = 0.58 + 0.42 * turnAlignment;
        const catchup = Math.max(0.75, Math.min(1.42, dist / lookahead));
        const desiredSpeed = target.speed * catchup * turnSlowdown;

        headSpeed += (desiredSpeed - headSpeed) * (desiredSpeed > headSpeed ? ACCEL_UP_BLEND : ACCEL_DOWN_BLEND);
        weaveScale += (target.weave - weaveScale) * (1 - Math.exp(-3.8 * FIXED_DT));

        const stepDist = headSpeed * FIXED_DT;
        if (lap === 1) lap1TotalDist += stepDist;
        gaitPhase = (gaitPhase + stepDist * wavenumber) % (Math.PI * 2);

        const dynamicRadius = MIN_TURN_RADIUS + Math.min(28 * UNIT, headSpeed * 0.018);
        const maxTurnRate = headSpeed / dynamicRadius;
        const maxStep = maxTurnRate * FIXED_DT;
        const clampedTurn = Math.max(-maxStep, Math.min(maxStep, headingDiff));
        headAngle = normalizeAngle(headAngle + clampedTurn);

        jointX[0] += Math.cos(headAngle) * stepDist;
        jointY[0] += Math.sin(headAngle) * stepDist;

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

        if (lap === 1) {
          const tSec = step * FIXED_DT;
          let tongueProgress = 0;
          for (const frac of tongueFlickFracs) {
            const tStart = frac * loopDuration;
            if (tSec >= tStart && tSec < tStart + tongueDur) {
              tongueProgress = (tSec - tStart) / tongueDur;
              break;
            }
          }

          const bodyX = new Float64Array(SNAKE_SEGMENTS);
          const bodyY = new Float64Array(SNAKE_SEGMENTS);
          const last = SNAKE_SEGMENTS - 1;
          for (let i = 0; i < SNAKE_SEGMENTS; i++) {
            const prev = i === 0 ? 0 : i - 1;
            const next = i === last ? last : i + 1;
            const tx = jointX[prev] - jointX[next];
            const ty = jointY[prev] - jointY[next];
            const len = Math.hypot(tx, ty) || 1;
            const offset = weaveEnvelope[i] * weaveScale * Math.sin(gaitPhase - i * SNAKE_SEG_LEN * wavenumber);
            bodyX[i] = jointX[i] - (ty / len) * offset;
            bodyY[i] = jointY[i] + (tx / len) * offset;
          }

          const displayHeadAngle = Math.atan2(jointY[0] - jointY[1], jointX[0] - jointX[1]);
          frames.push({
            t: tSec,
            jointX: Float64Array.from(jointX),
            jointY: Float64Array.from(jointY),
            bodyX,
            bodyY,
            headAngle: displayHeadAngle,
            tongueProgress,
          });
        }
      }
    }
    return { frames, lap1TotalDist, halfWidths };
  }

  const p1 = simulatePass(NOMINAL_WAVENUMBER);
  const exactCycles = Math.max(1, Math.round((p1.lap1TotalDist * NOMINAL_WAVENUMBER) / (Math.PI * 2)));
  const syncedWavenumber = (exactCycles * Math.PI * 2) / p1.lap1TotalDist;

  const p2 = simulatePass(syncedWavenumber);
  const frames = p2.frames;

  // Smoothly close any tiny residual over last 0.45s
  const f0 = frames[0];
  const fEnd = frames[frames.length - 1];
  const errX = f0.bodyX[0] - fEnd.bodyX[0];
  const errY = f0.bodyY[0] - fEnd.bodyY[0];
  const blendSteps = Math.round(0.45 / FIXED_DT);
  for (let b = 0; b < blendSteps; b++) {
    const idx = frames.length - blendSteps + b;
    const u = (b + 1) / blendSteps;
    const w = u * u * (3 - 2 * u);
    const fr = frames[idx];
    for (let i = 0; i < SNAKE_SEGMENTS; i++) {
      fr.bodyX[i] += (f0.bodyX[i] - fEnd.bodyX[i]) * w;
      fr.bodyY[i] += (f0.bodyY[i] - fEnd.bodyY[i]) * w;
      fr.jointX[i] += (f0.jointX[i] - fEnd.jointX[i]) * w;
      fr.jointY[i] += (f0.jointY[i] - fEnd.jointY[i]) * w;
    }
    fr.headAngle = Math.atan2(fr.jointY[0] - fr.jointY[1], fr.jointX[0] - fr.jointX[1]);
  }

  const halfWidths = p2.halfWidths;
  const last = SNAKE_SEGMENTS - 1;
  let selfCrossFrames = 0;
  let firstCrossT = -1;

  for (const fr of frames) {
    const leftX = new Float64Array(SNAKE_SEGMENTS);
    const leftY = new Float64Array(SNAKE_SEGMENTS);
    const rightX = new Float64Array(SNAKE_SEGMENTS);
    const rightY = new Float64Array(SNAKE_SEGMENTS);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < SNAKE_SEGMENTS; i++) {
      const rx = fr.bodyX[i];
      const ry = fr.bodyY[i];
      let tx, ty;
      if (i === 0) {
        tx = fr.bodyX[0] - fr.bodyX[1];
        ty = fr.bodyY[0] - fr.bodyY[1];
      } else if (i === last) {
        tx = fr.bodyX[i - 1] - fr.bodyX[i];
        ty = fr.bodyY[i - 1] - fr.bodyY[i];
      } else {
        tx = fr.bodyX[i - 1] - fr.bodyX[i + 1];
        ty = fr.bodyY[i - 1] - fr.bodyY[i + 1];
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

    const tailDx = fr.bodyX[last] - fr.bodyX[last - 1];
    const tailDy = fr.bodyY[last] - fr.bodyY[last - 1];
    const tailScale = (4.2 * UNIT) / (Math.hypot(tailDx, tailDy) || 1);
    const tailTipX = fr.bodyX[last] + tailDx * tailScale;
    const tailTipY = fr.bodyY[last] + tailDy * tailScale;

    const headFx = Math.cos(fr.headAngle);
    const headFy = Math.sin(fr.headAngle);
    const headSnoutX = fr.jointX[0] + headFx * 26.6 * UNIT;
    const headSnoutY = fr.jointY[0] + headFy * 26.6 * UNIT;

    const pad = 16 * UNIT;
    fr.bbox = {
      minX: Math.min(minX, headSnoutX, tailTipX) - pad,
      maxX: Math.max(maxX, headSnoutX, tailTipX) + pad,
      minY: Math.min(minY, headSnoutY, tailTipY) - pad,
      maxY: Math.max(maxY, headSnoutY, tailTipY) + pad,
    };
    fr.leftX = leftX;
    fr.leftY = leftY;
    fr.rightX = rightX;
    fr.rightY = rightY;
    fr.tailTipX = tailTipX;
    fr.tailTipY = tailTipY;

    // Exact Serpantinum self-crossing detection (upper i <= j - 10 or head casts onto lower j)
    const findShadowSpan = (jStart, jEnd) => {
      let lo = -1, hi = -1;
      const hMidX = fr.jointX[0] + headFx * 10 * UNIT;
      const hMidY = fr.jointY[0] + headFy * 10 * UNIT;
      for (let j = jStart; j <= jEnd; j++) {
        const jx = fr.bodyX[j];
        const jy = fr.bodyY[j];
        let shadowed = false;
        const headReach = (14.5 * UNIT) + halfWidths[j];
        if (Math.hypot(jx - hMidX, jy - hMidY) < headReach) {
          shadowed = true;
        }
        if (!shadowed) {
          const iMax = j - 10;
          for (let i = 1; i <= iMax; i++) {
            const reach = halfWidths[i] + halfWidths[j] + 5.5 * UNIT;
            const ddx = jx - fr.bodyX[i];
            const ddy = jy - fr.bodyY[i];
            if (ddx * ddx + ddy * ddy < reach * reach) {
              shadowed = true;
              break;
            }
          }
        }
        if (shadowed) {
          if (lo === -1) lo = j;
          hi = j;
        }
      }
      if (lo === -1) return null;
      return [Math.max(jStart, lo), Math.min(jEnd, hi)];
    };

    fr.shadow2 = findShadowSpan(27, last);
    fr.shadow1 = findShadowSpan(13, 28);
    if (fr.shadow2 || fr.shadow1) {
      selfCrossFrames++;
      if (firstCrossT < 0) firstCrossT = fr.t;
    }
  }

  console.log(
    `Simulated loop: ${loopDuration.toFixed(1)}s (${frames.length} steps @ 60Hz), ` +
    `arcLen=${p1.lap1TotalDist.toFixed(1)}px, weaveCycles=${exactCycles}, ` +
    `closureErr=${Math.hypot(errX, errY).toFixed(2)}px, selfCrossFrames=${selfCrossFrames}` +
    (firstCrossT >= 0 ? ` (starts @ ${firstCrossT.toFixed(2)}s)` : '')
  );
  return { frames, loopDuration, halfWidths };
}

// ============================================================================
// 5. Explicit Absolute SVG Path Builders (100% Chrome/Firefox/Safari SMIL-safe)
// ============================================================================
const fmt = (n) => {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
};

// 3 fixed overlapping pieces (23 total samples -> smooth ~10.8px spacing)
const PIECE2_IDX = [27, 29, 31, 33, 35, 38, 40, 43];
const PIECE1_IDX = [13, 15, 17, 19, 21, 23, 25, 27, 29];
const PIECE0_IDX = [1, 3, 5, 7, 9, 11, 13, 15];

function buildRibbonPath(fr, indices, hasTailCap, ox, oy) {
  const m = indices.length;
  const lx = (k) => fr.leftX[indices[k]] - ox;
  const ly = (k) => fr.leftY[indices[k]] - oy;
  const rx = (k) => fr.rightX[indices[k]] - ox;
  const ry = (k) => fr.rightY[indices[k]] - oy;

  let d = `M${fmt(lx(0))} ${fmt(ly(0))}L${fmt((lx(0) + lx(1)) * 0.5)} ${fmt((ly(0) + ly(1)) * 0.5)}`;
  for (let k = 1; k < m - 1; k++) {
    d += `Q${fmt(lx(k))} ${fmt(ly(k))} ${fmt((lx(k) + lx(k + 1)) * 0.5)} ${fmt((ly(k) + ly(k + 1)) * 0.5)}`;
  }
  if (hasTailCap) {
    const tx = fr.tailTipX - ox;
    const ty = fr.tailTipY - oy;
    d += `Q${fmt(lx(m - 1))} ${fmt(ly(m - 1))} ${fmt(tx)} ${fmt(ty)}`;
    d += `Q${fmt(rx(m - 1))} ${fmt(ry(m - 1))} ${fmt((rx(m - 2) + rx(m - 1)) * 0.5)} ${fmt((ry(m - 2) + ry(m - 1)) * 0.5)}`;
  } else {
    d += `L${fmt(lx(m - 1))} ${fmt(ly(m - 1))}L${fmt(rx(m - 1))} ${fmt(ry(m - 1))}`;
    d += `L${fmt((rx(m - 2) + rx(m - 1)) * 0.5)} ${fmt((ry(m - 2) + ry(m - 1)) * 0.5)}`;
  }
  for (let k = m - 2; k > 0; k--) {
    d += `Q${fmt(rx(k))} ${fmt(ry(k))} ${fmt((rx(k) + rx(k - 1)) * 0.5)} ${fmt((ry(k) + ry(k - 1)) * 0.5)}`;
  }
  d += `L${fmt(rx(0))} ${fmt(ry(0))}Z`;
  return d;
}

// Exact Serpantinum head + inner diamond cutout (fill-rule="evenodd")
function buildHeadPath(fr, ox, oy) {
  const hx = fr.jointX[0] - ox;
  const hy = fr.jointY[0] - oy;
  const hfx = Math.cos(fr.headAngle);
  const hfy = Math.sin(fr.headAngle);
  const hnx = -hfy;
  const hny = hfx;
  const u = UNIT;

  const pt = (f, n) => `${fmt(hx + hfx * f * u + hnx * n * u)} ${fmt(hy + hfy * f * u + hny * n * u)}`;
  const l1x = fr.leftX[1] - ox, l1y = fr.leftY[1] - oy;
  const l2x = fr.leftX[2] - ox, l2y = fr.leftY[2] - oy;
  const r1x = fr.rightX[1] - ox, r1y = fr.rightY[1] - oy;
  const r2x = fr.rightX[2] - ox, r2y = fr.rightY[2] - oy;

  let d = `M${pt(26.6, 0)}`;
  d += `C${pt(26.2, 2.4)} ${pt(17.4, 7.4)} ${pt(8.8, 8.8)}`;
  d += `C${pt(4.2, 9.0)} ${pt(-1.4, 6.8)} ${fmt(l1x)} ${fmt(l1y)}`;
  d += `L${fmt((l1x + l2x) * 0.5)} ${fmt((l1y + l2y) * 0.5)}`;
  d += `L${fmt((r1x + r2x) * 0.5)} ${fmt((r1y + r2y) * 0.5)}`;
  d += `L${fmt(r1x)} ${fmt(r1y)}`;
  d += `C${pt(-1.4, -6.8)} ${pt(4.2, -9.0)} ${pt(8.8, -8.8)}`;
  d += `C${pt(17.4, -7.4)} ${pt(26.2, -2.4)} ${pt(26.6, 0)}Z`;

  // Inner diamond cutout hole
  d += `M${pt(17.6, 0)}`;
  d += `Q${pt(13.0, 1.75)} ${pt(8.8, 2.75)}`;
  d += `Q${pt(4.8, 1.65)} ${pt(0.5, 0)}`;
  d += `Q${pt(4.8, -1.65)} ${pt(8.8, -2.75)}`;
  d += `Q${pt(13.0, -1.75)} ${pt(17.6, 0)}Z`;
  return d;
}

// Exact Serpantinum forked tongue path (constant topology)
function buildTonguePath(fr, ox, oy) {
  const hx = fr.jointX[0] - ox;
  const hy = fr.jointY[0] - oy;
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
  const t1x = tipX + hnx * spread;
  const t1y = tipY + hny * spread;
  const t2x = tipX - hnx * spread;
  const t2y = tipY - hny * spread;

  return `M${fmt(baseX)} ${fmt(baseY)}L${fmt(forkX)} ${fmt(forkY)}M${fmt(forkX)} ${fmt(forkY)}L${fmt(t1x)} ${fmt(t1y)}M${fmt(forkX)} ${fmt(forkY)}L${fmt(t2x)} ${fmt(t2y)}`;
}

// Self-crossing cast shadow patch hugging lower ribbon [jA..jB] (constant 5-pt topology)
function buildShadowPatch(fr, span, ox, oy) {
  const N = 5;
  if (!span) {
    const cx = fmt(fr.bodyX[30] - ox);
    const cy = fmt(fr.bodyY[30] - oy);
    return `M${cx} ${cy}` + `L${cx} ${cy}`.repeat(N * 2 - 1) + 'Z';
  }
  const [jA, jB] = span;
  const ptsL = [];
  const ptsR = [];
  for (let k = 0; k < N; k++) {
    const u = k / (N - 1);
    // Smoothly taper width at endpoints and keep strictly inset inside lower ribbon
    // so the Gaussian blur never bleeds onto light backgrounds
    const endTaper = 0.48 + 0.52 * Math.sin(u * Math.PI);
    const inset = 0.74 * endTaper;
    const f = jA + (jB - jA) * u;
    const i0 = Math.floor(f);
    const i1 = Math.min(SNAKE_SEGMENTS - 1, i0 + 1);
    const t = f - i0;
    const cx = fr.bodyX[i0] + (fr.bodyX[i1] - fr.bodyX[i0]) * t - ox;
    const cy = fr.bodyY[i0] + (fr.bodyY[i1] - fr.bodyY[i0]) * t - oy;
    const lx = fr.leftX[i0] + (fr.leftX[i1] - fr.leftX[i0]) * t - ox;
    const ly = fr.leftY[i0] + (fr.leftY[i1] - fr.leftY[i0]) * t - oy;
    const rx = fr.rightX[i0] + (fr.rightX[i1] - fr.rightX[i0]) * t - ox;
    const ry = fr.rightY[i0] + (fr.rightY[i1] - fr.rightY[i0]) * t - oy;
    ptsL.push([cx + (lx - cx) * inset, cy + (ly - cy) * inset]);
    ptsR.push([cx + (rx - cx) * inset, cy + (ry - cy) * inset]);
  }
  let d = `M${fmt(ptsL[0][0])} ${fmt(ptsL[0][1])}`;
  for (let k = 1; k < N; k++) d += `L${fmt(ptsL[k][0])} ${fmt(ptsL[k][1])}`;
  for (let k = N - 1; k >= 0; k--) d += `L${fmt(ptsR[k][0])} ${fmt(ptsR[k][1])}`;
  return d + 'Z';
}

// ============================================================================
// 6. Independent Sparse Keyframe Track Builders per Slice
// ============================================================================
const fmtKT = (v) => (v === 0 ? '0' : v === 1 ? '1' : v.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''));

function buildTrackIndices(n, mask, stride, dilate = 0) {
  const active = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue;
    for (let d = -dilate; d <= dilate; d++) {
      active[(i + d + n) % n] = 1;
    }
  }
  const chosen = new Set([0]);
  for (let i = 0; i < n; i++) {
    if (!active[i]) continue;
    if (i % stride === 0) chosen.add(i);
    if (!active[(i - 1 + n) % n] || !active[(i + 1) % n]) chosen.add(i);
  }
  // Also include the exact frame immediately before/after an active region so opacity transitions stay crisp
  for (let i = 0; i < n; i++) {
    if (active[i]) continue;
    if (active[(i - 1 + n) % n] || active[(i + 1) % n]) chosen.add(i);
  }
  const sorted = Array.from(chosen).sort((a, b) => a - b);
  return { sorted, active };
}

function selectSliceTracks(frames, slice) {
  const n = frames.length;
  const margin = 4;
  const bodyMask = new Uint8Array(n);
  const tongueMask = new Uint8Array(n);
  const sh2Mask = new Uint8Array(n);
  const sh1Mask = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const fr = frames[i];
    const inSlice =
      fr.bbox.maxX >= slice.x0 - margin &&
      fr.bbox.minX <= slice.x1 + margin &&
      fr.bbox.maxY >= slice.y0 - margin &&
      fr.bbox.minY <= slice.y1 + margin;
    if (!inSlice) continue;
    bodyMask[i] = 1;
    if (fr.tongueProgress > 0) {
      // Only include tongue flick if head is actually inside this slice!
      const hx = fr.jointX[0], hy = fr.jointY[0];
      if (hx >= slice.x0 - 30 && hx <= slice.x1 + 30 && hy >= slice.y0 - 30 && hy <= slice.y1 + 30) {
        tongueMask[i] = 1;
      }
    }
    if (fr.shadow2) sh2Mask[i] = 1;
    if (fr.shadow1) sh1Mask[i] = 1;
  }

  // Body & Head track: 8.5 fps (stride=7 @ 60Hz) — super smooth linear SMIL morphing, compact size
  const bodyTrack = buildTrackIndices(n, bodyMask, 7, 6);
  // Tongue track: 30 fps (stride=2) ONLY during active tongue flicks
  const hasTongue = tongueMask.some((v) => v === 1);
  const tongueTrack = hasTongue ? buildTrackIndices(n, tongueMask, 2, 0) : null;
  // Self-shadow tracks: 15 fps (stride=4) ONLY during active self-crossing
  const hasSh2 = sh2Mask.some((v) => v === 1);
  const sh2Track = hasSh2 ? buildTrackIndices(n, sh2Mask, 4, 0) : null;
  const hasSh1 = sh1Mask.some((v) => v === 1);
  const sh1Track = hasSh1 ? buildTrackIndices(n, sh1Mask, 4, 0) : null;

  return { bodyTrack, tongueTrack, sh2Track, sh1Track };
}

// ============================================================================
// 7. Build Snake SVG Markup for a Slice + Theme
// ============================================================================
const THEMES = {
  dark: {
    fill: '#cfb4ff',
    opacity: 0.92,
    elevShadowOpacity: 0.44,
    selfShadowOpacity: 0.56,
    tongueMaxOpacity: 0.85,
  },
  light: {
    fill: '#7706ff',
    opacity: 0.82,
    elevShadowOpacity: 0.22,
    selfShadowOpacity: 0.36,
    tongueMaxOpacity: 0.85,
  },
};

function buildSnakeSVGChunk(slice, themeKey, frames, tracks, loopDuration) {
  const th = THEMES[themeKey];
  const n = frames.length;
  const ox = slice.x0;
  const oy = slice.y0;
  const dur = `${loopDuration.toFixed(1)}s`;

  const makeTrack = (track) => {
    const list = track.sorted.map((idx) => ({ t: idx / n, fr: frames[idx], on: track.active[idx] === 1 }));
    list.push({ t: 1.0, fr: frames[0], on: track.active[0] === 1 });
    const kt = list.map((k) => fmtKT(k.t)).join(';');
    return { list, kt };
  };

  const animAttr = (attr, values, kt, extra = '') =>
    `<animate attributeName="${attr}" values="${values}" keyTimes="${kt}" dur="${dur}" repeatCount="indefinite"${extra}/>`;

  const body = makeTrack(tracks.bodyTrack);
  const p2Vals = body.list.map((k) => buildRibbonPath(k.fr, PIECE2_IDX, true, ox, oy));
  const p1Vals = body.list.map((k) => buildRibbonPath(k.fr, PIECE1_IDX, false, ox, oy));
  const p0Vals = body.list.map((k) => buildRibbonPath(k.fr, PIECE0_IDX, false, ox, oy));
  const headVals = body.list.map((k) => buildHeadPath(k.fr, ox, oy));
  const visVals = body.list.map((k) => (k.on ? '1' : '0'));

  const defsParts = [];
  defsParts.push(
    `<filter id="serp-elev" x="-18%" y="-18%" width="136%" height="136%">` +
    `<feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="${th.elevShadowOpacity}"/>` +
    `</filter>`
  );
  if (tracks.sh2Track || tracks.sh1Track) {
    defsParts.push(
      `<filter id="serp-self" x="-30%" y="-30%" width="160%" height="160%">` +
      `<feGaussianBlur stdDeviation="1.6"/>` +
      `</filter>`
    );
  }
  if (slice.clipRect) {
    const [cx, cy, cw, ch, crx] = slice.clipRect;
    defsParts.push(`<clipPath id="serp-scard"><rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="${crx}"/></clipPath>`);
  }

  const layerParts = [];

  // Piece 2 (tail)
  layerParts.push(`<path d="${p2Vals[0]}" fill="${th.fill}">${animAttr('d', p2Vals.join(';'), body.kt)}</path>`);

  // Self-crossing cast shadow onto Piece 2
  if (tracks.sh2Track) {
    const sh2 = makeTrack(tracks.sh2Track);
    const sVals = sh2.list.map((k) => buildShadowPatch(k.fr, k.on ? k.fr.shadow2 : null, ox, oy));
    const oVals = sh2.list.map((k) => (k.on && k.fr.shadow2 ? String(th.selfShadowOpacity) : '0'));
    layerParts.push(
      `<path d="${sVals[0]}" fill="#000" opacity="${oVals[0]}" filter="url(#serp-self)">` +
      animAttr('d', sVals.join(';'), sh2.kt) +
      animAttr('opacity', oVals.join(';'), sh2.kt) +
      `</path>`
    );
  }

  // Piece 1 (mid)
  layerParts.push(`<path d="${p1Vals[0]}" fill="${th.fill}">${animAttr('d', p1Vals.join(';'), body.kt)}</path>`);

  // Self-crossing cast shadow onto Piece 1
  if (tracks.sh1Track) {
    const sh1 = makeTrack(tracks.sh1Track);
    const sVals = sh1.list.map((k) => buildShadowPatch(k.fr, k.on ? k.fr.shadow1 : null, ox, oy));
    const oVals = sh1.list.map((k) => (k.on && k.fr.shadow1 ? String(th.selfShadowOpacity) : '0'));
    layerParts.push(
      `<path d="${sVals[0]}" fill="#000" opacity="${oVals[0]}" filter="url(#serp-self)">` +
      animAttr('d', sVals.join(';'), sh1.kt) +
      animAttr('opacity', oVals.join(';'), sh1.kt) +
      `</path>`
    );
  }

  // Piece 0 (neck)
  layerParts.push(`<path d="${p0Vals[0]}" fill="${th.fill}">${animAttr('d', p0Vals.join(';'), body.kt)}</path>`);

  // Forked tongue (own sparse 30fps track!)
  if (tracks.tongueTrack) {
    const tg = makeTrack(tracks.tongueTrack);
    const tVals = tg.list.map((k) => buildTonguePath(k.fr, ox, oy));
    const oVals = tg.list.map((k) => {
      if (!k.on || k.fr.tongueProgress <= 0) return '0';
      return (th.tongueMaxOpacity * Math.sin(k.fr.tongueProgress * Math.PI)).toFixed(2);
    });
    layerParts.push(
      `<path d="${tVals[0]}" fill="none" stroke="${th.fill}" stroke-width="${fmt(1.45 * UNIT)}" stroke-linecap="round" opacity="${oVals[0]}">` +
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
    `<!--serp-snake-start-->` +
    `<g class="serp-snake"${clipAttr}>` +
    `<g opacity="${visVals[0]}">${visAnim}` +
    `<g opacity="${th.opacity}" filter="url(#serp-elev)">` +
    layerParts.join('') +
    `</g></g></g>` +
    `<!--serp-snake-end-->`;

  const defsBlock = `<!--serp-defs-start--><defs>${defsParts.join('')}</defs><!--serp-defs-end-->`;
  return { defsBlock, snakeGroup, activeKfs: body.list.filter((k) => k.on).length, totalKfs: body.list.length };
}

// ============================================================================
// 8. Inject Into Existing Expressive Profile SVGs (Idempotent!)
// ============================================================================
function stripPreviousInjection(svg) {
  let out = svg;
  out = out.replace(/<!--serp-defs-start-->[\s\S]*?<!--serp-defs-end-->/g, '');
  out = out.replace(/<!--serp-snake-start-->[\s\S]*?<!--serp-snake-end-->/g, '');
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

function injectSocialSVG(svg, slice, defsBlock, snakeGroup) {
  let out = stripPreviousInjection(svg);

  const cssRule = `<!--serp-css-start-->@media (prefers-reduced-motion:reduce){.serp-snake{display:none}}<!--serp-css-end-->`;
  out = out.replace('</style>', `${cssRule}</style>`);
  out = out.replace('</style>', `</style>${defsBlock}`);

  if (slice.mode === 'under') {
    const btnAnchor = '<g transform="translate(4 20)">';
    if (out.includes(btnAnchor)) {
      out = out.replace(btnAnchor, `${snakeGroup}${btnAnchor}`);
      return out;
    }
  }
  return out.replace('</svg>', `${snakeGroup}</svg>`);
}

// ============================================================================
// 9. Main Execution
// ============================================================================
function main() {
  const { frames, loopDuration } = runSimulation();
  const report = [];

  for (const slice of SLICES) {
    const tracks = selectSliceTracks(frames, slice);
    for (const theme of ['dark', 'light']) {
      const fileName = `${slice.name}-${theme}.svg`;
      const filePath = path.join(ASSETS_DIR, fileName);
      if (!fs.existsSync(filePath)) {
        console.warn(`Skipping missing asset: ${fileName}`);
        continue;
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      const { defsBlock, snakeGroup, activeKfs, totalKfs } = buildSnakeSVGChunk(
        slice,
        theme,
        frames,
        tracks,
        loopDuration
      );
      const updated = slice.isHero
        ? injectHeroSVG(raw, defsBlock, snakeGroup)
        : injectSocialSVG(raw, slice, defsBlock, snakeGroup);
      fs.writeFileSync(filePath, updated, 'utf8');
      if (theme === 'dark') {
        const extras = [
          tracks.tongueTrack ? 'tongue' : null,
          tracks.sh2Track || tracks.sh1Track ? 'self-shadow' : null,
        ].filter(Boolean).join(',');
        report.push(
          `${fileName.padEnd(20)} ${(updated.length / 1024).toFixed(1).padStart(6)} KB  ` +
          `(${activeKfs}/${totalKfs} kfs${extras ? ' + ' + extras : ''})`
        );
      }
    }
  }

  console.log('\nGenerated dark/light SVGs:');
  for (const line of report) console.log('  ' + line);
}

main();
