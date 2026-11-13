import {
  COLS,
  ROWS,
  TILE,
  W,
  H,
  TOWERS,
  ENEMIES,
  THEMES,
  SKILLS,
  genWave,
  waveHpMul,
  meteorDmg,
  freezeDur,
  frenzyDur,
  airdropGold,
  repairHp,
  type LevelDef,
  type Mods,
  type TowerId,
  type EnemyId,
  type SkillId,
  type TStats,
  type TargetMode,
} from "./data";
import { sfx } from "./audio";

interface PathInfo {
  pts: { x: number; y: number }[];
  cum: number[];
  len: number;
}

export interface Enemy {
  id: number;
  type: EnemyId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  armor: number;
  size: number;
  flying: boolean;
  boss: boolean;
  path: PathInfo;
  dist: number;
  slowAmt: number;
  slowT: number;
  stunT: number;
  burnT: number;
  burnDps: number;
  vulnT: number;
  vulnAmt: number;
  flash: number;
  reward: number;
  dmg: number;
  dead: boolean;
  reached: boolean;
  hpMul: number;
  wave: number;
  healT: number;
  summonT: number;
  pathIdx: number;
}

export interface Tower {
  id: number;
  type: TowerId;
  col: number;
  row: number;
  x: number;
  y: number;
  lvl: number; // 0..2
  mod: number; // -1 / 0 / 1
  spent: number;
  cd: number;
  angle: number;
  kick: number;
  mode: TargetMode;
  buffDmg: number;
  buffRate: number;
}

interface Proj {
  x: number;
  y: number;
  tx: number;
  ty: number;
  target: Enemy;
  speed: number;
  dmg: number;
  kind: TowerId;
  s: TStats;
  magic: boolean;
  color: string;
}

type Fx =
  | { k: "text"; x: number; y: number; txt: string; col: string; t: number; life: number; big?: boolean }
  | { k: "ring"; x: number; y: number; r: number; maxR: number; col: string; t: number; life: number }
  | { k: "line"; x1: number; y1: number; x2: number; y2: number; col: string; t: number; life: number; w: number }
  | { k: "spark"; x: number; y: number; vx: number; vy: number; col: string; t: number; life: number };

interface SpawnQ {
  at: number;
  type: EnemyId;
  path: number;
  hpMul: number;
  wave: number;
}

export type BattleState = "prep" | "run" | "won" | "lost" | "ended";

export interface TowerInfo {
  id: number;
  name: string;
  emoji: string;
  color: string;
  lvLabel: string;
  lines: string[];
  up: { label: string; cost: number; ok: boolean } | null;
  mods: { name: string; icon: string; desc: string; cost: number; ok: boolean }[] | null;
  sell: number;
  mode: TargetMode;
  canMode: boolean;
}

export interface Snapshot {
  gold: number;
  hp: number;
  maxHp: number;
  wave: number;
  totalWaves: number;
  state: BattleState;
  speed: number;
  paused: boolean;
  nextTimer: number;
  enemiesLeft: number;
  skillCd: Record<string, number>;
  skillMax: Record<string, number>;
  frenzyT: number;
  placing: TowerId | null;
  aiming: SkillId | null;
  sel: TowerInfo | null;
  nextTypes: EnemyId[];
  kills: number;
  endless: boolean;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function mkPath(pts: { x: number; y: number }[]): PathInfo {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { pts, cum, len: cum[cum.length - 1] };
}

function posAt(p: PathInfo, d: number) {
  if (d <= 0) return p.pts[0];
  if (d >= p.len) return p.pts[p.pts.length - 1];
  let i = 1;
  while (i < p.cum.length - 1 && p.cum[i] < d) i++;
  const a = p.pts[i - 1];
  const b = p.pts[i];
  const seg = p.cum[i] - p.cum[i - 1] || 1;
  const t = (d - p.cum[i - 1]) / seg;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export class Battle {
  level: LevelDef;
  mods: Mods;
  unlocked: TowerId[];
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  projs: Proj[] = [];
  fx: Fx[] = [];
  meteors: { x: number; y: number; t: number; delay: number; dmg: number }[] = [];
  gold: number;
  hp: number;
  maxHp: number;
  wave = 0;
  time = 0;
  speed = 1;
  paused = false;
  state: BattleState = "prep";
  spawnQ: SpawnQ[] = [];
  nextTimer = 0;
  kills = 0;
  skillCd: Record<string, number> = {};
  frenzyT = 0;
  sel: Tower | null = null;
  placing: TowerId | null = null;
  aiming: SkillId | null = null;
  hover: { x: number; y: number } | null = null;
  shake = 0;
  uid = 1;
  paths: PathInfo[] = [];
  flyPaths: PathInfo[] = [];
  pathTile: boolean[][] = [];
  blocked: boolean[][] = [];
  decor: { x: number; y: number; e: string; s: number }[] = [];
  bg: HTMLCanvasElement | null = null;
  nextCache: { wave: number; types: EnemyId[] } = { wave: -1, types: [] };
  towerAt: (Tower | null)[][] = [];
  leaked = 0;

  constructor(level: LevelDef, mods: Mods, unlocked: TowerId[]) {
    this.level = level;
    this.mods = mods;
    this.unlocked = unlocked;
    this.gold = level.gold + mods.startGold;
    this.maxHp = mods.baseHp;
    this.hp = this.maxHp;
    for (const id of Object.keys(SKILLS) as SkillId[]) this.skillCd[id] = SKILLS[id].cd * mods.cdMul * 0.4;
    this.buildMap();
  }

  // ---------- 地图 ----------
  buildMap() {
    const L = this.level;
    this.pathTile = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    this.blocked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    this.towerAt = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    for (const wp of L.paths) {
      const pts = wp.map(([c, r]) => ({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE }));
      this.paths.push(mkPath(pts));
      this.flyPaths.push(mkPath([pts[0], pts[pts.length - 1]]));
      for (let i = 1; i < wp.length; i++) {
        const [c0, r0] = wp[i - 1];
        const [c1, r1] = wp[i];
        const dc = Math.sign(c1 - c0);
        const dr = Math.sign(r1 - r0);
        let c = c0;
        let r = r0;
        for (;;) {
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS) this.pathTile[r][c] = true;
          if (c === c1 && r === r1) break;
          c += dc;
          r += dr;
        }
      }
    }
    // 装饰（同时阻挡建造）
    let s = L.seed * 977 + 5;
    const rr = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    const th = THEMES[L.theme];
    let n = 0;
    let guard = 0;
    while (n < 11 && guard++ < 300) {
      const c = Math.floor(rr() * COLS);
      const r = Math.floor(rr() * ROWS);
      if (this.pathTile[r][c] || this.blocked[r][c]) continue;
      this.blocked[r][c] = true;
      this.decor.push({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE, e: th.deco[Math.floor(rr() * th.deco.length)], s: 34 + rr() * 12 });
      n++;
    }
  }

  buildBg() {
    const cv = document.createElement("canvas");
    const k = 2;
    cv.width = W * k;
    cv.height = H * k;
    const g = cv.getContext("2d")!;
    g.scale(k, k);
    const th = THEMES[this.level.theme];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        g.fillStyle = (r + c) % 2 === 0 ? th.a : th.b;
        g.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
    const strokePaths = (w: number, col: string, dash: number[] = []) => {
      g.lineWidth = w;
      g.strokeStyle = col;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.setLineDash(dash);
      for (const p of this.paths) {
        g.beginPath();
        p.pts.forEach((pt, i) => (i ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y)));
        g.stroke();
      }
    };
    strokePaths(TILE - 4, th.edge);
    strokePaths(TILE - 12, th.path);
    strokePaths(3, "rgba(255,255,255,0.18)", [10, 14]);
    g.setLineDash([]);
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const d of this.decor) {
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.beginPath();
      g.ellipse(d.x, d.y + d.s * 0.35, d.s * 0.4, d.s * 0.16, 0, 0, Math.PI * 2);
      g.fill();
      g.font = `${d.s}px serif`;
      g.fillText(d.e, d.x, d.y);
    }
    this.bg = cv;
  }

  // ---------- 工具 ----------
  cost(c: number) {
    return Math.round(c * this.mods.costMul);
  }

  canBuild(col: number, row: number) {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return false;
    return !this.pathTile[row][col] && !this.blocked[row][col] && !this.towerAt[row][col];
  }

  text(x: number, y: number, txt: string, col = "#fff", big = false) {
    if (this.fx.length > 220) return;
    this.fx.push({ k: "text", x, y, txt, col, t: 0, life: big ? 1.2 : 0.8, big });
  }
  ring(x: number, y: number, maxR: number, col: string, life = 0.4) {
    this.fx.push({ k: "ring", x, y, r: 0, maxR, col, t: 0, life });
  }
  sparks(x: number, y: number, col: string, n = 6) {
    if (this.fx.length > 260) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(40, 140);
      this.fx.push({ k: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, col, t: 0, life: rnd(0.25, 0.5) });
    }
  }

  stats(t: Tower) {
    const def = TOWERS[t.type];
    const base: TStats = t.mod >= 0 ? def.mods[t.mod].stats : def.levels[t.lvl];
    return {
      ...base,
      dmg: base.dmg * this.mods.dmgMul * (1 + t.buffDmg),
      range: base.range * this.mods.rangeMul,
      rate: base.rate * (1 + t.buffRate) * (this.frenzyT > 0 ? 1.35 : 1),
    } as TStats;
  }

  // ---------- 操作 ----------
  build(type: TowerId, col: number, row: number) {
    const def = TOWERS[type];
    if (!this.canBuild(col, row)) return false;
    const c = this.cost(def.cost);
    if (this.gold < c) {
      this.text((col + 0.5) * TILE, row * TILE, "金币不足", "#ff6b6b");
      sfx("error");
      return false;
    }
    this.gold -= c;
    const t: Tower = {
      id: this.uid++, type, col, row, x: (col + 0.5) * TILE, y: (row + 0.5) * TILE,
      lvl: 0, mod: -1, spent: c, cd: 0.2, angle: -Math.PI / 2, kick: 0, mode: def.defaultMode, buffDmg: 0, buffRate: 0,
    };
    this.towers.push(t);
    this.towerAt[row][col] = t;
    this.ring(t.x, t.y, 34, "#ffffff", 0.35);
    sfx("build");
    return true;
  }

  upgrade(t: Tower) {
    const def = TOWERS[t.type];
    if (t.mod >= 0 || t.lvl >= 2) return false;
    const c = this.cost(def.upCost[t.lvl]);
    if (this.gold < c) {
      this.text(t.x, t.y - 30, "金币不足", "#ff6b6b");
      sfx("error");
      return false;
    }
    this.gold -= c;
    t.spent += c;
    t.lvl++;
    this.ring(t.x, t.y, 44, "#ffd54f", 0.45);
    sfx("upgrade");
    return true;
  }

  chooseMod(t: Tower, i: number) {
    const def = TOWERS[t.type];
    if (t.mod >= 0 || t.lvl < 2) return false;
    const m = def.mods[i];
    const c = this.cost(m.cost);
    if (this.gold < c) {
      this.text(t.x, t.y - 30, "金币不足", "#ff6b6b");
      sfx("error");
      return false;
    }
    this.gold -= c;
    t.spent += c;
    t.mod = i;
    this.ring(t.x, t.y, 60, "#ff9800", 0.6);
    this.sparks(t.x, t.y, "#ffd54f", 14);
    this.text(t.x, t.y - 30, `改造：${m.name}`, "#ffd54f", true);
    sfx("upgrade");
    return true;
  }

  sell(t: Tower) {
    const v = Math.floor(t.spent * this.mods.sellRate);
    this.gold += v;
    this.towers = this.towers.filter((x) => x !== t);
    this.towerAt[t.row][t.col] = null;
    this.text(t.x, t.y - 20, `+${v}`, "#ffd54f");
    if (this.sel === t) this.sel = null;
    sfx("sell");
  }

  cycleMode(t: Tower) {
    const order: TargetMode[] = ["first", "strong", "close"];
    t.mode = order[(order.indexOf(t.mode) + 1) % order.length];
    sfx("click");
  }

  startWave() {
    if (this.state === "won" || this.state === "lost" || this.state === "ended") return;
    if (this.wave >= this.level.waves) return;
    const L = this.level;
    const g = genWave(L, this.wave);
    const hpMul = waveHpMul(L, this.wave);
    for (const ev of g.events) {
      this.spawnQ.push({ at: this.time + 0.3 + ev.t, type: ev.type, path: ev.path, hpMul, wave: this.wave });
    }
    this.spawnQ.sort((a, b) => a.at - b.at);
    if (this.wave > 0 && this.nextTimer > 0) {
      const bonus = Math.floor(this.nextTimer * 0.8);
      if (bonus > 0) {
        this.gold += bonus;
        this.text(W / 2, 60, `提前开战 +${bonus} 金币`, "#ffd54f", true);
      }
    }
    this.wave++;
    if (this.mods.waveGold) this.gold += this.mods.waveGold;
    this.nextTimer = this.wave < L.waves ? g.duration + 12 : 0;
    this.state = "run";
    this.text(W / 2, H / 2 - 40, `第 ${this.wave} 波`, "#ffffff", true);
    sfx("wave");
  }

  retreat() {
    if (this.state === "run" || this.state === "prep") this.state = "ended";
  }

  castSkill(id: SkillId, x?: number, y?: number) {
    if (this.state !== "run" && this.state !== "prep") return false;
    if (this.skillCd[id] > 0) {
      sfx("error");
      return false;
    }
    const lv = this.mods.skills[id] ?? 1;
    const cd = SKILLS[id].cd * this.mods.cdMul;
    switch (id) {
      case "meteor": {
        if (x === undefined || y === undefined) return false;
        this.meteors.push({ x, y, t: 0, delay: 0.9, dmg: meteorDmg(lv) * this.mods.meteorMul });
        sfx("skill");
        break;
      }
      case "freeze": {
        const d = freezeDur(lv) * this.mods.freezeMul;
        for (const e of this.enemies) e.stunT = Math.max(e.stunT, e.boss ? d * 0.5 : d);
        this.ring(W / 2, H / 2, 700, "#8fe3ff", 0.8);
        this.text(W / 2, H / 2, "绝对零度！", "#8fe3ff", true);
        sfx("skill");
        break;
      }
      case "frenzy": {
        this.frenzyT = frenzyDur(lv);
        this.text(W / 2, H / 2, "战争狂热！", "#ff9a3c", true);
        for (const t of this.towers) this.ring(t.x, t.y, 36, "#ff9a3c", 0.5);
        sfx("skill");
        break;
      }
      case "airdrop": {
        const g = Math.round(airdropGold(lv) * this.mods.airdropMul);
        this.gold += g;
        this.text(W / 2, H / 2, `补给空投 +${g}`, "#ffd54f", true);
        sfx("upgrade");
        break;
      }
      case "repair": {
        const n = repairHp(lv);
        this.hp = Math.min(this.maxHp, this.hp + n);
        this.text(W - 80, H / 2, `基地 +${n}`, "#7CFC9a", true);
        this.ring(W - 40, H / 2, 90, "#7CFC9a", 0.6);
        sfx("upgrade");
        break;
      }
    }
    this.skillCd[id] = cd;
    this.aiming = null;
    return true;
  }

  // ---------- 输入 ----------
  pointerMove(x: number, y: number) {
    this.hover = { x, y };
  }
  pointerLeave() {
    this.hover = null;
  }
  pointerDown(x: number, y: number) {
    this.hover = { x, y };
    if (this.state === "won" || this.state === "lost" || this.state === "ended") return;
    if (this.aiming === "meteor") {
      this.castSkill("meteor", x, y);
      return;
    }
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return;
    const tw = this.towerAt[row][col];
    if (tw) {
      this.sel = tw;
      this.placing = null;
      sfx("click");
      return;
    }
    if (this.placing) {
      if (this.canBuild(col, row)) this.build(this.placing, col, row);
      else {
        sfx("error");
      }
      return;
    }
    this.sel = null;
  }

  // ---------- 更新 ----------
  update(realDt: number) {
    if (this.paused || this.state === "won" || this.state === "lost" || this.state === "ended") {
      this.updateFx(realDt);
      return;
    }
    let dt = Math.min(realDt, 0.05) * this.speed;
    while (dt > 0) {
      const step = Math.min(dt, 1 / 30);
      this.step(step);
      dt -= step;
    }
    this.updateFx(realDt);
  }

  updateFx(dt: number) {
    for (const f of this.fx) {
      f.t += dt;
      if (f.k === "ring") f.r = f.maxR * Math.min(1, f.t / f.life);
      else if (f.k === "spark") {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      } else if (f.k === "text") f.y -= 28 * dt;
    }
    this.fx = this.fx.filter((f) => f.t < f.life);
    this.shake = Math.max(0, this.shake - dt * 18);
  }

  step(dt: number) {
    this.time += dt;
    for (const id of Object.keys(this.skillCd)) this.skillCd[id] = Math.max(0, this.skillCd[id] - dt);
    if (this.frenzyT > 0) this.frenzyT = Math.max(0, this.frenzyT - dt);

    // 自动下一波
    if (this.state === "run" && this.nextTimer > 0) {
      this.nextTimer -= dt;
      if (this.nextTimer <= 0) {
        this.nextTimer = 0;
        this.startWave();
      }
    }
    // 出怪
    while (this.spawnQ.length && this.spawnQ[0].at <= this.time) {
      const q = this.spawnQ.shift()!;
      this.spawn(q.type, q.path, q.hpMul, q.wave, 0);
    }
    // 信号塔加成
    for (const t of this.towers) {
      t.buffDmg = 0;
      t.buffRate = 0;
    }
    for (const b of this.towers) {
      if (b.type !== "beacon") continue;
      const s = this.stats(b);
      for (const t of this.towers) {
        if (t === b || t.type === "beacon") continue;
        if (Math.hypot(t.x - b.x, t.y - b.y) <= s.range) {
          t.buffDmg = Math.max(t.buffDmg, s.buffDmg ?? 0);
          t.buffRate = Math.max(t.buffRate, s.buffRate ?? 0);
        }
      }
    }
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjs(dt);
    this.updateMeteors(dt);

    // 结算清理
    this.enemies = this.enemies.filter((e) => !e.dead && !e.reached);
    if (this.hp <= 0 && this.state !== "lost") {
      this.hp = 0;
      this.state = "lost";
      sfx("lose");
    } else if (
      this.state === "run" &&
      !this.level.endless &&
      this.wave >= this.level.waves &&
      this.spawnQ.length === 0 &&
      this.enemies.length === 0
    ) {
      this.state = "won";
      sfx("win");
    }
  }

  spawn(type: EnemyId, pathIdx: number, hpMul: number, wave: number, dist: number) {
    const d = ENEMIES[type];
    const path = d.flying ? this.flyPaths[pathIdx] : this.paths[pathIdx];
    const p = posAt(path, dist);
    const hp = d.hp * hpMul;
    this.enemies.push({
      id: this.uid++, type, x: p.x, y: p.y, hp, maxHp: hp, speed: d.speed, armor: d.armor * (1 + wave * 0.02),
      size: d.size, flying: !!d.flying, boss: !!d.boss, path, dist, slowAmt: 0, slowT: 0, stunT: 0, burnT: 0,
      burnDps: 0, vulnT: 0, vulnAmt: 0, flash: 0, reward: d.reward * (1 + 0.03 * wave), dmg: d.dmg, dead: false,
      reached: false, hpMul, wave, healT: 0, summonT: 4, pathIdx,
    });
  }

  updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= dt;
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) e.slowAmt = 0;
      }
      if (e.vulnT > 0) e.vulnT -= dt;
      if (e.burnT > 0) {
        e.burnT -= dt;
        this.hurt(e, e.burnDps * dt, "true", false, false);
        if (e.dead) continue;
      }
      // 特殊能力
      if (e.type === "healer") {
        e.healT += dt;
        if (e.healT >= 1) {
          e.healT = 0;
          let any = false;
          for (const o of this.enemies) {
            if (o.dead || o.hp >= o.maxHp) continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) <= 100) {
              o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.07);
              any = true;
            }
          }
          if (any) this.ring(e.x, e.y, 100, "rgba(120,255,160,0.8)", 0.5);
        }
      } else if (e.type === "boss2") {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.012 * dt);
      } else if (e.type === "boss3") {
        e.summonT -= dt;
        if (e.summonT <= 0) {
          e.summonT = 6;
          for (let i = 0; i < 2; i++) this.spawn("grunt", e.pathIdx, e.hpMul * 0.6, e.wave, Math.max(0, e.dist - 20 - i * 25));
          this.ring(e.x, e.y, 70, "#c04bff", 0.5);
        }
      }
      if (e.stunT > 0) {
        e.stunT -= dt;
        continue;
      }
      const spd = e.speed * (1 - e.slowAmt);
      e.dist += spd * dt;
      if (e.dist >= e.path.len) {
        e.reached = true;
        this.hp -= e.dmg;
        this.leaked += e.dmg;
        this.shake = 6;
        this.text(W - 60, e.y, `-${e.dmg}`, "#ff5252", true);
        sfx("leak");
        continue;
      }
      const p = posAt(e.path, e.dist);
      e.x = p.x;
      e.y = p.y;
    }
  }

  applySlow(e: Enemy, amt: number, t: number) {
    const a = Math.min(0.85, amt * this.mods.slowMul);
    if (e.boss) {
      e.slowAmt = Math.max(e.slowAmt, a * 0.6);
    } else e.slowAmt = Math.max(e.slowAmt, a);
    e.slowT = Math.max(e.slowT, t);
  }

  hurt(e: Enemy, dmg: number, kind: "phys" | "magic" | "true", pierce = false, showText = false, col = "#fff") {
    if (e.dead) return;
    let d = dmg;
    if (kind === "phys" && !pierce) d = Math.max(dmg * 0.25, dmg - e.armor);
    if (e.vulnT > 0) d *= 1 + e.vulnAmt;
    e.hp -= d;
    if (kind !== "true") e.flash = 0.08;
    if (showText) this.text(e.x, e.y - e.size, `${Math.round(d)}`, col, true);
    if (e.hp <= 0) this.kill(e);
  }

  kill(e: Enemy) {
    e.dead = true;
    const g = Math.round(e.reward * this.mods.goldMul);
    this.gold += g;
    this.kills++;
    this.text(e.x, e.y - e.size * 0.6, `+${g}`, "#ffd54f");
    this.sparks(e.x, e.y, e.boss ? "#ff7043" : "#ffffff", e.boss ? 24 : 6);
    if (e.boss) {
      this.ring(e.x, e.y, 120, "#ff7043", 0.6);
      this.shake = 10;
      sfx("boom");
    } else sfx("kill");
    if (e.type === "slime") {
      for (let i = 0; i < 2; i++) this.spawn("mini", e.pathIdx, e.hpMul, e.wave, Math.max(0, e.dist - i * 14));
    }
  }

  inRange(t: Tower, s: TStats, e: Enemy) {
    return Math.hypot(e.x - t.x, e.y - t.y) <= s.range + e.size * 0.4;
  }

  findTarget(t: Tower, s: TStats) {
    const def = TOWERS[t.type];
    let best: Enemy | null = null;
    let score = -Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.flying && !def.air) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d > s.range + e.size * 0.4) continue;
      let sc: number;
      if (t.mode === "first") sc = e.dist / (e.path.len || 1);
      else if (t.mode === "strong") sc = e.hp + (e.boss ? 1e6 : 0);
      else sc = -d;
      if (sc > score) {
        score = sc;
        best = e;
      }
    }
    return best;
  }

  updateTowers(dt: number) {
    for (const t of this.towers) {
      if (t.type === "beacon") continue;
      const s = this.stats(t);
      t.cd -= dt;
      if (t.kick > 0) t.kick = Math.max(0, t.kick - dt * 40);
      const target = this.findTarget(t, s);
      if (target) t.angle = Math.atan2(target.y - t.y, target.x - t.x);
      if (t.cd <= 0) {
        if (target) {
          this.fire(t, s, target);
          t.cd += 1 / s.rate;
          if (t.cd < 0) t.cd = 0;
        } else t.cd = 0;
      }
    }
  }

  fire(t: Tower, s: TStats, target: Enemy) {
    const def = TOWERS[t.type];
    t.kick = 4;
    switch (t.type) {
      case "arrow":
      case "cannon":
      case "frost": {
        if (t.type === "frost" && s.pulse) {
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (Math.hypot(e.x - t.x, e.y - t.y) <= s.range + e.size * 0.3) {
              this.hurt(e, s.dmg, "magic");
              this.applySlow(e, s.slow ?? 0, s.slowT ?? 1);
            }
          }
          this.ring(t.x, t.y, s.range, "rgba(150,230,255,0.9)", 0.5);
          sfx("frost");
          return;
        }
        this.projs.push({
          x: t.x + Math.cos(t.angle) * 18, y: t.y + Math.sin(t.angle) * 18, tx: target.x, ty: target.y, target,
          speed: def.projSpeed, dmg: s.dmg, kind: t.type, s, magic: def.magic,
          color: t.type === "arrow" ? "#f5e6b0" : t.type === "cannon" ? "#222" : "#aeeaff",
        });
        sfx(t.type);
        break;
      }
      case "tesla": {
        const hit = new Set<Enemy>();
        let cur: Enemy | null = target;
        let px = t.x;
        let py = t.y - 6;
        let dmg = s.dmg;
        const n = s.chain ?? 3;
        for (let i = 0; i < n && cur; i++) {
          hit.add(cur);
          this.fx.push({ k: "line", x1: px, y1: py, x2: cur.x, y2: cur.y, col: "#d9b3ff", t: 0, life: 0.18, w: 3 });
          this.hurt(cur, dmg, "magic");
          if (s.stun && Math.random() < (s.stunChance ?? 1)) cur.stunT = Math.max(cur.stunT, cur.boss ? s.stun * 0.4 : s.stun);
          this.sparks(cur.x, cur.y, "#e0c4ff", 3);
          px = cur.x;
          py = cur.y;
          dmg *= 0.86;
          let next: Enemy | null = null;
          let bd = 95;
          for (const e of this.enemies) {
            if (e.dead || hit.has(e)) continue;
            const d = Math.hypot(e.x - px, e.y - py);
            if (d < bd) {
              bd = d;
              next = e;
            }
          }
          cur = next;
        }
        sfx("tesla");
        break;
      }
      case "sniper": {
        this.fx.push({ k: "line", x1: t.x, y1: t.y, x2: target.x, y2: target.y, col: "#fff59d", t: 0, life: 0.15, w: 2 });
        let dmg = s.dmg;
        let txt = false;
        if (s.execute && !target.boss && target.hp / target.maxHp <= s.execute) {
          dmg = target.hp + 1;
          this.text(target.x, target.y - target.size - 6, "处决!", "#ff5252", true);
        } else txt = true;
        this.hurt(target, dmg, "phys", !!s.pierce, txt, "#fff59d");
        if (s.vuln) {
          target.vulnT = 5;
          target.vulnAmt = s.vuln;
          this.ring(target.x, target.y, 24, "#ff80ab", 0.4);
        }
        this.sparks(target.x, target.y, "#fff59d", 5);
        sfx("sniper");
        break;
      }
    }
  }

  updateProjs(dt: number) {
    for (const p of this.projs) {
      if (!p.target.dead) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const mv = p.speed * dt;
      if (d <= mv + 4) {
        this.impact(p);
        p.speed = -1;
      } else {
        p.x += (dx / d) * mv;
        p.y += (dy / d) * mv;
      }
    }
    this.projs = this.projs.filter((p) => p.speed >= 0);
  }

  impact(p: Proj) {
    const s = p.s;
    if (p.kind === "arrow") {
      if (p.target.dead) return;
      let dmg = p.dmg;
      let crit = false;
      if (s.crit && Math.random() < s.crit) {
        dmg *= 2;
        crit = true;
      }
      this.hurt(p.target, dmg, "phys", !!s.pierce, crit, "#ffcc80");
      this.sparks(p.tx, p.ty, "#ffe0a0", 3);
    } else if (p.kind === "cannon") {
      const R = s.splash ?? 55;
      for (const e of this.enemies) {
        if (e.dead || e.flying) continue;
        const d = Math.hypot(e.x - p.tx, e.y - p.ty);
        if (d <= R + e.size * 0.3) {
          this.hurt(e, p.dmg * (1 - 0.4 * Math.min(1, d / R)), "phys");
          if (s.burn) {
            e.burnT = 4;
            e.burnDps = s.burn * this.mods.dmgMul * (1 + 0);
          }
        }
      }
      this.ring(p.tx, p.ty, R, s.burn ? "#ff7a1a" : "#ffb74d", 0.35);
      this.sparks(p.tx, p.ty, s.burn ? "#ff7a1a" : "#ffcc80", 8);
      sfx("boom");
    } else if (p.kind === "frost") {
      if (p.target.dead) return;
      this.hurt(p.target, p.dmg, "magic");
      this.applySlow(p.target, s.slow ?? 0, s.slowT ?? 2);
      if (s.stun && Math.random() < (s.stunChance ?? 0)) {
        p.target.stunT = Math.max(p.target.stunT, p.target.boss ? s.stun * 0.4 : s.stun);
        this.ring(p.tx, p.ty, 26, "#cfefff", 0.4);
      }
      this.sparks(p.tx, p.ty, "#bdeeff", 3);
    }
  }

  updateMeteors(dt: number) {
    for (const m of this.meteors) {
      m.t += dt;
      if (m.t >= m.delay && m.dmg > 0) {
        const R = 100;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - m.x, e.y - m.y) <= R + e.size * 0.3) {
            this.hurt(e, m.dmg, "true", false, false);
            e.burnT = Math.max(e.burnT, 3);
            e.burnDps = Math.max(e.burnDps, m.dmg * 0.05);
          }
        }
        this.ring(m.x, m.y, R, "#ff7043", 0.5);
        this.ring(m.x, m.y, R * 0.6, "#ffd54f", 0.35);
        this.sparks(m.x, m.y, "#ffab40", 22);
        this.text(m.x, m.y - 20, `${Math.round(m.dmg)}`, "#ffab40", true);
        this.shake = 12;
        sfx("meteor");
        m.dmg = 0;
      }
    }
    this.meteors = this.meteors.filter((m) => m.dmg > 0);
  }

  // ---------- UI 数据 ----------
  towerInfo(t: Tower): TowerInfo {
    const def = TOWERS[t.type];
    const s = this.stats(t);
    const lines: string[] = [];
    if (t.type === "beacon") {
      lines.push(`伤害加成 +${Math.round((s.buffDmg ?? 0) * 100)}%`);
      lines.push(`射速加成 +${Math.round((s.buffRate ?? 0) * 100)}%`);
      lines.push(`范围 ${Math.round(s.range)}`);
    } else {
      lines.push(`伤害 ${Math.round(s.dmg)}${s.chain ? ` ×${s.chain}链` : ""}${s.splash ? `  溅射${s.splash}` : ""}`);
      lines.push(`射速 ${s.rate.toFixed(1)}/秒  射程 ${Math.round(s.range)}`);
      if (s.slow) lines.push(`减速 ${Math.round(Math.min(0.85, s.slow * this.mods.slowMul) * 100)}%`);
      if (s.burn) lines.push(`灼烧 ${Math.round(s.burn * this.mods.dmgMul)}/秒`);
      if (s.pierce) lines.push("无视护甲");
      if (s.crit) lines.push(`暴击 ${Math.round(s.crit * 100)}%`);
      if (s.stun) lines.push(`眩晕 ${s.stun}s (${Math.round((s.stunChance ?? 1) * 100)}%)`);
      if (s.execute) lines.push(`处决 <${Math.round(s.execute * 100)}%生命`);
      if (s.vuln) lines.push(`易伤 +${Math.round(s.vuln * 100)}%`);
      if (t.buffDmg > 0 || t.buffRate > 0) lines.push(`增益 伤害+${Math.round(t.buffDmg * 100)}% 射速+${Math.round(t.buffRate * 100)}%`);
    }
    let up: TowerInfo["up"] = null;
    let mods: TowerInfo["mods"] = null;
    if (t.mod < 0 && t.lvl < 2) {
      const c = this.cost(def.upCost[t.lvl]);
      up = { label: `升级 Lv.${t.lvl + 2}`, cost: c, ok: this.gold >= c };
    } else if (t.mod < 0) {
      mods = def.mods.map((m) => ({ name: m.name, icon: m.icon, desc: m.desc, cost: this.cost(m.cost), ok: this.gold >= this.cost(m.cost) }));
    }
    return {
      id: t.id,
      name: def.name,
      emoji: def.emoji,
      color: def.color,
      lvLabel: t.mod >= 0 ? `改造·${def.mods[t.mod].name}` : `Lv.${t.lvl + 1}`,
      lines,
      up,
      mods,
      sell: Math.floor(t.spent * this.mods.sellRate),
      mode: t.mode,
      canMode: t.type !== "beacon" && t.type !== "frost" || (t.type === "frost" && !s.pulse),
    };
  }

  snapshot(): Snapshot {
    if (this.nextCache.wave !== this.wave && this.wave < this.level.waves) {
      this.nextCache = { wave: this.wave, types: genWave(this.level, this.wave).types };
    }
    const skillMax: Record<string, number> = {};
    for (const id of Object.keys(SKILLS) as SkillId[]) skillMax[id] = SKILLS[id].cd * this.mods.cdMul;
    return {
      gold: Math.floor(this.gold),
      hp: this.hp,
      maxHp: this.maxHp,
      wave: this.wave,
      totalWaves: this.level.waves,
      state: this.state,
      speed: this.speed,
      paused: this.paused,
      nextTimer: this.nextTimer,
      enemiesLeft: this.enemies.length + this.spawnQ.length,
      skillCd: { ...this.skillCd },
      skillMax,
      frenzyT: this.frenzyT,
      placing: this.placing,
      aiming: this.aiming,
      sel: this.sel ? this.towerInfo(this.sel) : null,
      nextTypes: this.wave < this.level.waves ? this.nextCache.types : [],
      kills: this.kills,
      endless: !!this.level.endless,
    };
  }

  // ---------- 绘制 ----------
  render(g: CanvasRenderingContext2D) {
    if (!this.bg) this.buildBg();
    g.save();
    if (this.shake > 0) g.translate(rnd(-this.shake, this.shake) * 0.5, rnd(-this.shake, this.shake) * 0.5);
    g.drawImage(this.bg!, 0, 0, W, H);

    // 基地
    const ends = new Set<string>();
    for (const p of this.paths) {
      const e = p.pts[p.pts.length - 1];
      const key = `${Math.round(e.x)},${Math.round(e.y)}`;
      if (ends.has(key)) continue;
      ends.add(key);
      const bx = Math.min(W - 30, e.x);
      const by = Math.min(H - 30, Math.max(30, e.y));
      g.font = "46px serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("🏰", bx, by);
    }
    // 出口提示
    for (const p of this.paths) {
      const s0 = p.pts[0];
      const x = Math.max(14, Math.min(W - 14, s0.x));
      const y = Math.max(14, Math.min(H - 14, s0.y));
      g.fillStyle = "rgba(255,70,70," + (0.45 + 0.3 * Math.sin(this.time * 4)) + ")";
      g.beginPath();
      g.arc(x, y, 12, 0, Math.PI * 2);
      g.fill();
    }

    // 范围圈
    const showRange = (t: Tower) => {
      const s = this.stats(t);
      g.beginPath();
      g.arc(t.x, t.y, s.range, 0, Math.PI * 2);
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.fill();
      g.strokeStyle = "rgba(255,255,255,0.7)";
      g.lineWidth = 2;
      g.stroke();
    };
    if (this.sel) showRange(this.sel);

    // 塔
    for (const t of this.towers) this.drawTower(g, t);

    // 地面敌人 → 飞行敌人
    for (const e of this.enemies) if (!e.flying) this.drawEnemy(g, e);
    for (const e of this.enemies) if (e.flying) this.drawEnemy(g, e);

    // 弹道
    for (const p of this.projs) {
      if (p.kind === "cannon") {
        g.fillStyle = "#1c1c1c";
        g.beginPath();
        g.arc(p.x, p.y, 6, 0, Math.PI * 2);
        g.fill();
      } else if (p.kind === "frost") {
        g.fillStyle = "#c7f1ff";
        g.beginPath();
        g.arc(p.x, p.y, 5, 0, Math.PI * 2);
        g.fill();
      } else {
        const a = Math.atan2(p.ty - p.y, p.tx - p.x);
        g.strokeStyle = p.color;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(p.x - Math.cos(a) * 9, p.y - Math.sin(a) * 9);
        g.lineTo(p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 4);
        g.stroke();
      }
    }

    // 陨石
    for (const m of this.meteors) {
      const k = Math.min(1, m.t / m.delay);
      g.beginPath();
      g.arc(m.x, m.y, 100, 0, Math.PI * 2);
      g.fillStyle = `rgba(255,60,30,${0.1 + 0.2 * k})`;
      g.fill();
      g.strokeStyle = "rgba(255,80,40,0.9)";
      g.lineWidth = 2;
      g.setLineDash([8, 6]);
      g.stroke();
      g.setLineDash([]);
      g.font = "48px serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("☄️", m.x - (1 - k) * 220, m.y - (1 - k) * 420);
    }

    // 特效
    for (const f of this.fx) {
      const a = 1 - f.t / f.life;
      if (f.k === "ring") {
        g.globalAlpha = Math.max(0, a);
        g.strokeStyle = f.col;
        g.lineWidth = 4 * a + 1;
        g.beginPath();
        g.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      } else if (f.k === "line") {
        g.globalAlpha = Math.max(0, a);
        g.strokeStyle = f.col;
        g.lineWidth = f.w;
        g.shadowColor = f.col;
        g.shadowBlur = 8;
        g.beginPath();
        g.moveTo(f.x1, f.y1);
        const mx = (f.x1 + f.x2) / 2 + rnd(-8, 8);
        const my = (f.y1 + f.y2) / 2 + rnd(-8, 8);
        g.lineTo(mx, my);
        g.lineTo(f.x2, f.y2);
        g.stroke();
        g.shadowBlur = 0;
        g.globalAlpha = 1;
      } else if (f.k === "spark") {
        g.globalAlpha = Math.max(0, a);
        g.fillStyle = f.col;
        g.fillRect(f.x - 2, f.y - 2, 4, 4);
        g.globalAlpha = 1;
      }
    }
    // 悬停预览
    if (this.hover) {
      const col = Math.floor(this.hover.x / TILE);
      const row = Math.floor(this.hover.y / TILE);
      if (this.aiming === "meteor") {
        g.beginPath();
        g.arc(this.hover.x, this.hover.y, 100, 0, Math.PI * 2);
        g.strokeStyle = "rgba(255,90,60,0.95)";
        g.fillStyle = "rgba(255,90,60,0.18)";
        g.lineWidth = 3;
        g.fill();
        g.stroke();
      } else if (this.placing && col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        const ok = this.canBuild(col, row);
        const def = TOWERS[this.placing];
        const cx = (col + 0.5) * TILE;
        const cy = (row + 0.5) * TILE;
        g.fillStyle = ok ? "rgba(120,255,150,0.35)" : "rgba(255,80,80,0.35)";
        g.fillRect(col * TILE, row * TILE, TILE, TILE);
        const r = def.levels[0].range * this.mods.rangeMul;
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fillStyle = "rgba(255,255,255,0.1)";
        g.fill();
        g.strokeStyle = ok ? "rgba(255,255,255,0.7)" : "rgba(255,120,120,0.7)";
        g.lineWidth = 2;
        g.stroke();
        g.font = "30px serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.globalAlpha = 0.85;
        g.fillText(def.emoji, cx, cy);
        g.globalAlpha = 1;
      }
    }
    for (const f of this.fx) {
      if (f.k !== "text") continue;
      const a = 1 - f.t / f.life;
      g.globalAlpha = Math.max(0, Math.min(1, a * 1.6));
      g.font = `bold ${f.big ? 22 : 14}px system-ui, sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 4;
      g.strokeStyle = "rgba(0,0,0,0.75)";
      g.strokeText(f.txt, f.x, f.y);
      g.fillStyle = f.col;
      g.fillText(f.txt, f.x, f.y);
      g.globalAlpha = 1;
    }
    // 狂热着色
    if (this.frenzyT > 0) {
      g.fillStyle = "rgba(255,120,30,0.06)";
      g.fillRect(0, 0, W, H);
    }
    g.restore();
  }

  drawEnemy(g: CanvasRenderingContext2D, e: Enemy) {
    const bob = Math.sin(this.time * 9 + e.id) * 1.5;
    const y = e.y + bob - (e.flying ? 14 : 0);
    // 阴影
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(e.x, e.y + e.size * 0.6, e.size * 0.6, e.size * 0.25, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    if (e.flash > 0) g.filter = "brightness(2.2)";
    g.font = `${e.size * 1.6}px serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(ENEMIES[e.type].emoji, e.x, y);
    g.restore();
    if (e.stunT > 0 || e.slowAmt > 0) {
      g.beginPath();
      g.arc(e.x, y, e.size * 0.85, 0, Math.PI * 2);
      g.fillStyle = e.stunT > 0 ? "rgba(160,230,255,0.45)" : "rgba(120,200,255,0.25)";
      g.fill();
    }
    if (e.burnT > 0) {
      g.font = "14px serif";
      g.fillText("🔥", e.x + e.size * 0.5, y - e.size * 0.5);
    }
    if (e.vulnT > 0) {
      g.font = "12px serif";
      g.fillText("🎯", e.x - e.size * 0.6, y - e.size * 0.5);
    }
    if (e.hp < e.maxHp || e.boss) {
      const w = e.boss ? 56 : 30;
      const bx = e.x - w / 2;
      const by = y - e.size - 6;
      g.fillStyle = "rgba(0,0,0,0.6)";
      g.fillRect(bx - 1, by - 1, w + 2, 6);
      const r = Math.max(0, e.hp / e.maxHp);
      g.fillStyle = r > 0.5 ? "#4caf50" : r > 0.25 ? "#ffc107" : "#f44336";
      g.fillRect(bx, by, w * r, 4);
    }
  }

  drawTower(g: CanvasRenderingContext2D, t: Tower) {
    const def = TOWERS[t.type];
    const { x, y } = t;
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(x, y + 22, 24, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2b2f36";
    g.beginPath();
    g.arc(x, y, 25, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = def.color;
    g.beginPath();
    g.arc(x, y, 20, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.15)";
    g.beginPath();
    g.arc(x - 5, y - 6, 10, 0, Math.PI * 2);
    g.fill();

    g.save();
    g.translate(x, y);
    const k = t.kick;
    switch (t.type) {
      case "arrow":
        g.rotate(t.angle);
        g.fillStyle = "#f4e1b0";
        g.fillRect(-k, -3, 24, 6);
        g.fillStyle = "#6d4c24";
        g.beginPath();
        g.arc(0, 0, 9, 0, Math.PI * 2);
        g.fill();
        break;
      case "cannon":
        g.rotate(t.angle);
        g.fillStyle = "#1f2a35";
        g.fillRect(-k, -7, 28, 14);
        g.fillStyle = "#34495e";
        g.beginPath();
        g.arc(0, 0, 11, 0, Math.PI * 2);
        g.fill();
        break;
      case "sniper":
        g.rotate(t.angle);
        g.fillStyle = "#16241d";
        g.fillRect(-k, -2.5, 36, 5);
        g.fillStyle = "#2e7d5b";
        g.beginPath();
        g.arc(0, 0, 9, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#9be7c4";
        g.fillRect(6, -6, 8, 3);
        break;
      case "frost": {
        g.rotate(this.time * 0.8);
        g.fillStyle = "#e1f7ff";
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const r = i % 2 ? 7 : 14;
          g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
        break;
      }
      case "tesla": {
        const p = 0.5 + 0.5 * Math.sin(this.time * 8);
        g.fillStyle = "#2a1647";
        g.beginPath();
        g.arc(0, 0, 11, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = `rgba(224,196,255,${0.6 + 0.4 * p})`;
        g.beginPath();
        g.arc(0, 0, 6 + p * 2, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case "beacon": {
        const p = (this.time * 0.8) % 1;
        g.strokeStyle = `rgba(255,224,102,${1 - p})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(0, -8, 6 + p * 16, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = "#3b2f05";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(0, 12);
        g.lineTo(0, -8);
        g.stroke();
        g.fillStyle = "#ffe066";
        g.beginPath();
        g.arc(0, -9, 5, 0, Math.PI * 2);
        g.fill();
        break;
      }
    }
    g.restore();
    // 等级标识
    if (t.mod >= 0) {
      g.font = "14px serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("⭐", x, y + 19);
    } else {
      g.fillStyle = "#ffd54f";
      for (let i = 0; i <= t.lvl; i++) {
        g.beginPath();
        g.arc(x - t.lvl * 4 + i * 8, y + 19, 2.6, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (this.sel === t) {
      g.strokeStyle = "#fff";
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.strokeRect(t.col * TILE + 2, t.row * TILE + 2, TILE - 4, TILE - 4);
      g.setLineDash([]);
    }
  }
}
