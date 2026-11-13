// ============ 常量 ============
export const COLS = 16;
export const ROWS = 9;
export const TILE = 60;
export const W = COLS * TILE; // 960
export const H = ROWS * TILE; // 540

export type TowerId = "arrow" | "cannon" | "frost" | "tesla" | "sniper" | "beacon";
export type EnemyId =
  | "grunt"
  | "runner"
  | "brute"
  | "flyer"
  | "healer"
  | "slime"
  | "mini"
  | "knight"
  | "boss1"
  | "boss2"
  | "boss3";
export type SkillId = "meteor" | "freeze" | "frenzy" | "airdrop" | "repair";
export type TargetMode = "first" | "strong" | "close";

// ============ 炮塔 ============
export interface TStats {
  dmg: number;
  range: number;
  rate: number; // 每秒攻击次数
  splash?: number;
  slow?: number; // 0-1
  slowT?: number;
  chain?: number;
  stun?: number;
  stunChance?: number;
  burn?: number; // 每秒灼烧伤害
  crit?: number; // 暴击率
  pierce?: boolean; // 无视护甲
  execute?: number; // 斩杀线
  vuln?: number; // 易伤增幅
  pulse?: boolean; // 范围脉冲
  buffDmg?: number;
  buffRate?: number;
}

export interface ModDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  cost: number;
  stats: TStats;
}

export interface TowerDef {
  id: TowerId;
  name: string;
  emoji: string;
  color: string;
  desc: string;
  cost: number;
  unlock: number; // 需要通关的关卡数
  air: boolean;
  magic: boolean;
  projSpeed: number;
  defaultMode: TargetMode;
  levels: TStats[];
  upCost: number[];
  mods: [ModDef, ModDef];
}

export const TOWERS: Record<TowerId, TowerDef> = {
  arrow: {
    id: "arrow",
    name: "箭塔",
    emoji: "🏹",
    color: "#8d6e3f",
    desc: "射速快的基础单体塔，可攻击空中单位。",
    cost: 60,
    unlock: 0,
    air: true,
    magic: false,
    projSpeed: 620,
    defaultMode: "first",
    levels: [
      { dmg: 14, range: 150, rate: 1.8 },
      { dmg: 22, range: 160, rate: 2.0 },
      { dmg: 34, range: 170, rate: 2.3 },
    ],
    upCost: [50, 90],
    mods: [
      {
        id: "gatling",
        name: "连弩",
        icon: "🎯",
        desc: "射速暴增，持续火力压制",
        cost: 200,
        stats: { dmg: 30, range: 178, rate: 5.8 },
      },
      {
        id: "pierce",
        name: "穿甲弩",
        icon: "🔱",
        desc: "无视护甲，25%几率双倍暴击",
        cost: 200,
        stats: { dmg: 95, range: 210, rate: 1.7, pierce: true, crit: 0.25 },
      },
    ],
  },
  cannon: {
    id: "cannon",
    name: "炮塔",
    emoji: "💣",
    color: "#5d6d7e",
    desc: "范围溅射伤害，只能攻击地面单位。",
    cost: 100,
    unlock: 0,
    air: false,
    magic: false,
    projSpeed: 380,
    defaultMode: "first",
    levels: [
      { dmg: 40, range: 140, rate: 0.7, splash: 55 },
      { dmg: 65, range: 150, rate: 0.75, splash: 60 },
      { dmg: 100, range: 160, rate: 0.8, splash: 68 },
    ],
    upCost: [80, 140],
    mods: [
      {
        id: "howitzer",
        name: "重型榴弹",
        icon: "💥",
        desc: "超大爆炸范围与巨额伤害",
        cost: 280,
        stats: { dmg: 230, range: 185, rate: 0.7, splash: 95 },
      },
      {
        id: "napalm",
        name: "燃烧弹",
        icon: "🔥",
        desc: "命中后点燃敌人，持续灼烧",
        cost: 280,
        stats: { dmg: 85, range: 170, rate: 1.0, splash: 70, burn: 32 },
      },
    ],
  },
  frost: {
    id: "frost",
    name: "寒冰塔",
    emoji: "❄️",
    color: "#4aa3c7",
    desc: "魔法伤害并减速敌人，无视护甲。",
    cost: 80,
    unlock: 1,
    air: true,
    magic: true,
    projSpeed: 480,
    defaultMode: "first",
    levels: [
      { dmg: 6, range: 130, rate: 1.2, slow: 0.35, slowT: 2 },
      { dmg: 10, range: 140, rate: 1.25, slow: 0.42, slowT: 2.2 },
      { dmg: 16, range: 150, rate: 1.3, slow: 0.5, slowT: 2.5 },
    ],
    upCost: [60, 100],
    mods: [
      {
        id: "glacier",
        name: "极寒冰封",
        icon: "🧊",
        desc: "20%几率冻结敌人1.2秒",
        cost: 220,
        stats: { dmg: 26, range: 165, rate: 1.4, slow: 0.55, slowT: 2.5, stun: 1.2, stunChance: 0.2 },
      },
      {
        id: "blizzard",
        name: "暴风雪",
        icon: "🌨️",
        desc: "每秒对范围内所有敌人造成伤害并减速",
        cost: 220,
        stats: { dmg: 20, range: 165, rate: 1.0, slow: 0.55, slowT: 1.5, pulse: true },
      },
    ],
  },
  tesla: {
    id: "tesla",
    name: "电磁塔",
    emoji: "⚡",
    color: "#8e5bd6",
    desc: "闪电链弹射多个敌人，魔法伤害。",
    cost: 140,
    unlock: 2,
    air: true,
    magic: true,
    projSpeed: 0,
    defaultMode: "first",
    levels: [
      { dmg: 22, range: 120, rate: 1.0, chain: 3 },
      { dmg: 34, range: 128, rate: 1.05, chain: 4 },
      { dmg: 50, range: 135, rate: 1.1, chain: 5 },
    ],
    upCost: [110, 170],
    mods: [
      {
        id: "overload",
        name: "超载线圈",
        icon: "🔋",
        desc: "闪电链弹射8个目标，射速大增",
        cost: 320,
        stats: { dmg: 62, range: 150, rate: 1.5, chain: 8 },
      },
      {
        id: "storm",
        name: "雷暴",
        icon: "🌩️",
        desc: "强力闪电并附带0.8秒眩晕",
        cost: 320,
        stats: { dmg: 120, range: 150, rate: 1.0, chain: 4, stun: 0.8, stunChance: 1 },
      },
    ],
  },
  beacon: {
    id: "beacon",
    name: "信号塔",
    emoji: "📡",
    color: "#d4a017",
    desc: "不攻击，为范围内的炮塔提供伤害与射速加成。",
    cost: 120,
    unlock: 3,
    air: true,
    magic: false,
    projSpeed: 0,
    defaultMode: "first",
    levels: [
      { dmg: 0, range: 130, rate: 0, buffDmg: 0.15, buffRate: 0 },
      { dmg: 0, range: 140, rate: 0, buffDmg: 0.25, buffRate: 0.05 },
      { dmg: 0, range: 150, rate: 0, buffDmg: 0.35, buffRate: 0.1 },
    ],
    upCost: [90, 150],
    mods: [
      {
        id: "banner",
        name: "战旗",
        icon: "🚩",
        desc: "大幅提升范围内炮塔伤害",
        cost: 300,
        stats: { dmg: 0, range: 165, rate: 0, buffDmg: 0.65, buffRate: 0.1 },
      },
      {
        id: "overclock",
        name: "超频",
        icon: "⏱️",
        desc: "大幅提升范围内炮塔射速",
        cost: 300,
        stats: { dmg: 0, range: 165, rate: 0, buffDmg: 0.25, buffRate: 0.45 },
      },
    ],
  },
  sniper: {
    id: "sniper",
    name: "狙击塔",
    emoji: "🎯",
    color: "#2e7d5b",
    desc: "超远射程，高额单体伤害，优先攻击最强敌人。",
    cost: 160,
    unlock: 4,
    air: true,
    magic: false,
    projSpeed: 0,
    defaultMode: "strong",
    levels: [
      { dmg: 110, range: 280, rate: 0.4 },
      { dmg: 180, range: 300, rate: 0.42 },
      { dmg: 280, range: 320, rate: 0.45 },
    ],
    upCost: [120, 200],
    mods: [
      {
        id: "headshot",
        name: "爆头",
        icon: "☠️",
        desc: "对生命低于20%的非首领直接处决",
        cost: 380,
        stats: { dmg: 520, range: 370, rate: 0.42, execute: 0.2 },
      },
      {
        id: "marker",
        name: "弱点标记",
        icon: "🔖",
        desc: "命中使目标5秒内受到的伤害+30%",
        cost: 380,
        stats: { dmg: 270, range: 350, rate: 0.75, vuln: 0.3 },
      },
    ],
  },
};
export const TOWER_ORDER: TowerId[] = ["arrow", "cannon", "frost", "tesla", "beacon", "sniper"];

// ============ 敌人 ============
export interface EnemyDef {
  id: EnemyId;
  name: string;
  emoji: string;
  hp: number;
  speed: number;
  armor: number;
  reward: number;
  dmg: number; // 到达基地造成的伤害
  size: number;
  flying?: boolean;
  cost: number; // 波次预算消耗
  gap: number; // 出怪间隔系数
  boss?: boolean;
  desc: string;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  grunt: { id: "grunt", name: "哥布林", emoji: "👺", hp: 60, speed: 48, armor: 0, reward: 8, dmg: 1, size: 20, cost: 1, gap: 1, desc: "最常见的杂兵" },
  runner: { id: "runner", name: "迅狼", emoji: "🐺", hp: 42, speed: 96, armor: 0, reward: 8, dmg: 1, size: 20, cost: 1, gap: 0.8, desc: "移动极快" },
  brute: { id: "brute", name: "巨犀", emoji: "🦏", hp: 230, speed: 38, armor: 5, reward: 18, dmg: 2, size: 26, cost: 3, gap: 1.6, desc: "生命高、有护甲" },
  flyer: { id: "flyer", name: "蝙蝠", emoji: "🦇", hp: 70, speed: 72, armor: 0, reward: 11, dmg: 1, size: 20, flying: true, cost: 1.5, gap: 0.9, desc: "飞行单位，直线飞向基地" },
  healer: { id: "healer", name: "巫医", emoji: "🧙", hp: 95, speed: 44, armor: 0, reward: 20, dmg: 1, size: 21, cost: 2.5, gap: 1.8, desc: "持续治疗周围敌人" },
  slime: { id: "slime", name: "分裂史莱姆", emoji: "🦠", hp: 130, speed: 42, armor: 0, reward: 14, dmg: 1, size: 23, cost: 2, gap: 1.3, desc: "死亡后分裂成两只小史莱姆" },
  mini: { id: "mini", name: "小史莱姆", emoji: "🟢", hp: 40, speed: 62, armor: 0, reward: 3, dmg: 1, size: 14, cost: 0.5, gap: 0.5, desc: "分裂产物" },
  knight: { id: "knight", name: "机甲骑士", emoji: "🤖", hp: 380, speed: 36, armor: 12, reward: 28, dmg: 3, size: 25, cost: 4, gap: 2, desc: "重装甲，魔法伤害更有效" },
  boss1: { id: "boss1", name: "烈焰巨龙", emoji: "🐲", hp: 1900, speed: 30, armor: 6, reward: 150, dmg: 10, size: 38, cost: 40, gap: 1, boss: true, desc: "首领：高血量" },
  boss2: { id: "boss2", name: "深渊恶魔", emoji: "👿", hp: 3800, speed: 30, armor: 10, reward: 250, dmg: 12, size: 40, cost: 60, gap: 1, boss: true, desc: "首领：自我回复" },
  boss3: { id: "boss3", name: "魔王", emoji: "👹", hp: 6500, speed: 28, armor: 14, reward: 400, dmg: 20, size: 44, cost: 80, gap: 1, boss: true, desc: "首领：持续召唤小怪" },
};

// ============ 关卡 ============
export type Theme = "grass" | "desert" | "snow" | "lava" | "night";
export interface ThemeDef {
  a: string;
  b: string;
  path: string;
  edge: string;
  deco: string[];
  sky: string;
}
export const THEMES: Record<Theme, ThemeDef> = {
  grass: { a: "#5b9a42", b: "#53903b", path: "#d2b27a", edge: "#8a6b3c", deco: ["🌳", "🌲", "🪨"], sky: "#2d5a27" },
  desert: { a: "#dcb871", b: "#d3ae66", path: "#a77b45", edge: "#6e4d26", deco: ["🌵", "🪨", "🌴"], sky: "#8a6a2e" },
  snow: { a: "#e1edf5", b: "#d6e5f0", path: "#8ea8bc", edge: "#5b7489", deco: ["🌲", "⛄", "🪨"], sky: "#5f7f98" },
  lava: { a: "#40302f", b: "#382a29", path: "#a2461f", edge: "#521f0c", deco: ["🪨", "🌋", "💀"], sky: "#2a1717" },
  night: { a: "#243456", b: "#202f4f", path: "#5a6b91", edge: "#2f3b57", deco: ["🍄", "🌲", "🪦"], sky: "#141c33" },
};

type Pt = [number, number];
export interface LevelDef {
  id: number;
  name: string;
  desc: string;
  theme: Theme;
  paths: Pt[][];
  gold: number;
  waves: number;
  hpMul: number;
  pool: [EnemyId, number, number?][]; // [类型, 出现波次, 权重]
  boss?: EnemyId;
  reward: number;
  seed: number;
  endless?: boolean;
}

export const LEVELS: LevelDef[] = [
  {
    id: 0, name: "翠绿草原", desc: "王国边境的宁静草原，哥布林们入侵了！",
    theme: "grass", gold: 230, waves: 8, hpMul: 0.85, reward: 30, seed: 11,
    paths: [[[-1, 1], [12, 1], [12, 4], [3, 4], [3, 7], [16, 7]]],
    pool: [["grunt", 0], ["runner", 3]],
  },
  {
    id: 1, name: "蜿蜒小径", desc: "狭窄的山间小道，巨犀开始出没。",
    theme: "grass", gold: 260, waves: 10, hpMul: 0.95, reward: 40, seed: 23,
    paths: [[[-1, 7], [2, 7], [2, 2], [7, 2], [7, 6], [12, 6], [12, 2], [16, 2]]],
    pool: [["grunt", 0], ["runner", 0], ["brute", 4]],
  },
  {
    id: 2, name: "双岔路口", desc: "敌人从两条道路同时进攻，空中也出现了威胁。",
    theme: "grass", gold: 300, waves: 10, hpMul: 1.0, reward: 50, seed: 37,
    paths: [
      [[-1, 1], [6, 1], [6, 4], [16, 4]],
      [[-1, 7], [10, 7], [10, 4], [16, 4]],
    ],
    pool: [["grunt", 0], ["runner", 0], ["flyer", 2], ["brute", 5]],
  },
  {
    id: 3, name: "荒漠回廊", desc: "炎热沙漠中的长蛇阵，巫医会为敌人疗伤，巨龙将至。",
    theme: "desert", gold: 330, waves: 12, hpMul: 1.1, reward: 60, seed: 41, boss: "boss1",
    paths: [[[-1, 4], [3, 4], [3, 1], [6, 1], [6, 7], [9, 7], [9, 1], [12, 1], [12, 7], [16, 7]]],
    pool: [["grunt", 0], ["runner", 0], ["brute", 2], ["flyer", 3], ["healer", 5]],
  },
  {
    id: 4, name: "冰封峡谷", desc: "极寒之地，分裂史莱姆与机甲骑士结伴而来。",
    theme: "snow", gold: 360, waves: 12, hpMul: 1.2, reward: 70, seed: 53, boss: "boss1",
    paths: [[[-1, 1], [14, 1], [14, 4], [1, 4], [1, 7], [16, 7]]],
    pool: [["grunt", 0], ["slime", 1], ["brute", 2], ["healer", 3], ["knight", 6], ["flyer", 4]],
  },
  {
    id: 5, name: "熔岩之路", desc: "两路夹击，熔岩洞窟里潜伏着深渊恶魔。",
    theme: "lava", gold: 400, waves: 14, hpMul: 1.3, reward: 85, seed: 67, boss: "boss2",
    paths: [
      [[-1, 0], [4, 0], [4, 5], [10, 5], [10, 2], [16, 2]],
      [[-1, 8], [7, 8], [7, 5], [10, 5], [10, 2], [16, 2]],
    ],
    pool: [["runner", 0], ["brute", 1], ["slime", 2], ["flyer", 3], ["knight", 4], ["healer", 5, 2]],
  },
  {
    id: 6, name: "暗夜迷宫", desc: "月光下的蛇形迷宫，敌人数量庞大。",
    theme: "night", gold: 420, waves: 14, hpMul: 1.4, reward: 100, seed: 71, boss: "boss2",
    paths: [[[-1, 1], [2, 1], [2, 7], [5, 7], [5, 1], [8, 1], [8, 7], [11, 7], [11, 1], [14, 1], [14, 7], [16, 7]]],
    pool: [["grunt", 0, 2], ["runner", 0, 2], ["slime", 1], ["knight", 3], ["healer", 4], ["brute", 2], ["flyer", 5]],
  },
  {
    id: 7, name: "十字交锋", desc: "两股洪流汇合，守住最后的防线。",
    theme: "desert", gold: 450, waves: 15, hpMul: 1.5, reward: 115, seed: 83, boss: "boss2",
    paths: [
      [[-1, 1], [11, 1], [11, 4], [16, 4]],
      [[-1, 7], [4, 7], [4, 4], [11, 4], [16, 4]],
    ],
    pool: [["grunt", 0], ["runner", 0], ["brute", 1], ["knight", 2], ["slime", 3], ["healer", 4], ["flyer", 5]],
  },
  {
    id: 8, name: "天空要塞", desc: "空中军团来袭！需要足够的对空火力。",
    theme: "snow", gold: 480, waves: 16, hpMul: 1.6, reward: 130, seed: 97, boss: "boss3",
    paths: [[[-1, 4], [5, 4], [5, 1], [10, 1], [10, 7], [16, 7]]],
    pool: [["flyer", 0, 4], ["grunt", 0], ["knight", 3], ["healer", 4], ["brute", 2], ["slime", 5]],
  },
  {
    id: 9, name: "终焉魔王", desc: "最终决战！魔王带着他的全部军团降临。",
    theme: "lava", gold: 550, waves: 20, hpMul: 1.75, reward: 200, seed: 101, boss: "boss3",
    paths: [
      [[-1, 1], [9, 1], [9, 4], [16, 4]],
      [[-1, 7], [9, 7], [9, 4], [16, 4]],
    ],
    pool: [["grunt", 0], ["runner", 0], ["brute", 1], ["flyer", 2, 2], ["slime", 3], ["knight", 4, 2], ["healer", 5, 2]],
  },
];

export const ENDLESS: LevelDef = {
  id: 100, name: "无尽深渊", desc: "没有终点的挑战，每10波出现一位首领。坚持得越久，奖励越丰厚。",
  theme: "night", gold: 450, waves: 9999, hpMul: 1.3, reward: 0, seed: 777, endless: true,
  paths: [
    [[-1, 1], [13, 1], [13, 4], [2, 4], [2, 7], [16, 7]],
    [[-1, 8], [6, 8], [6, 6], [10, 6], [10, 3], [13, 3]],
  ],
  pool: [["grunt", 0], ["runner", 0], ["brute", 1], ["flyer", 2], ["slime", 3], ["healer", 4], ["knight", 5, 2]],
};
export const ENDLESS_UNLOCK = 5;

// ============ 波次生成 ============
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface SpawnEv {
  t: number;
  type: EnemyId;
  path: number;
}

export function waveHpMul(L: LevelDef, w: number) {
  return Math.pow(L.hpMul, 0.8) * (1 + 0.11 * w + 0.004 * w * w);
}

export function genWave(L: LevelDef, w: number): { events: SpawnEv[]; duration: number; types: EnemyId[] } {
  const r = rng(L.seed * 131 + w * 7919 + 13);
  const avail = L.pool.filter((p) => p[1] <= w);
  const budget = (5 + w * 2.4) * (1 + L.id * 0.03 * (L.endless ? 0 : 1));
  const events: SpawnEv[] = [];
  const picks: EnemyId[] = [];
  const nGroups = Math.min(avail.length, 1 + Math.floor(r() * 2) + (w > 6 ? 1 : 0));
  // 新登场的敌人优先出现
  const fresh = avail.find((p) => p[1] === w && w > 0);
  if (fresh) picks.push(fresh[0]);
  let guard = 0;
  while (picks.length < nGroups && guard++ < 40) {
    const total = avail.reduce((s, p) => s + (p[2] ?? 1), 0);
    let x = r() * total;
    let chosen = avail[0][0];
    for (const p of avail) {
      x -= p[2] ?? 1;
      if (x <= 0) {
        chosen = p[0];
        break;
      }
    }
    if (!picks.includes(chosen)) picks.push(chosen);
  }
  let t = 0;
  let counter = 0;
  const share = budget / picks.length;
  for (const type of picks) {
    const d = ENEMIES[type];
    const count = Math.max(2, Math.round(share / d.cost));
    const gap = Math.max(0.3, (1.05 - w * 0.015) * d.gap);
    for (let i = 0; i < count; i++) {
      events.push({ t, type, path: counter++ % L.paths.length });
      t += gap;
    }
    t += 1.5;
  }
  const types = [...picks];
  // 首领
  let boss: EnemyId | undefined;
  if (L.endless) {
    if ((w + 1) % 10 === 0) boss = (["boss1", "boss2", "boss3"] as EnemyId[])[Math.min(2, Math.floor(w / 10))];
  } else if (L.boss && w === L.waves - 1) boss = L.boss;
  if (boss) {
    events.push({ t: t + 1, type: boss, path: 0 });
    types.push(boss);
    t += 1;
  }
  return { events, duration: t, types };
}

// ============ 指挥官 ============
export interface CommanderDef {
  id: string;
  name: string;
  title: string;
  emoji: string;
  cost: number;
  desc: string[];
  fx: Partial<{
    towerDmg: number;
    meteorMul: number;
    freezeMul: number;
    slowMul: number;
    costMul: number;
    waveGold: number;
    airdropMul: number;
    cdMul: number;
    startGold: number;
  }>;
}
export const COMMANDERS: CommanderDef[] = [
  {
    id: "allen", name: "艾伦", title: "雷霆将军", emoji: "🎖️", cost: 0,
    desc: ["全体炮塔伤害 +6%", "陨石轰炸伤害 +40%"],
    fx: { towerDmg: 0.06, meteorMul: 1.4 },
  },
  {
    id: "liza", name: "莉莎", title: "冰霜女王", emoji: "👸", cost: 150,
    desc: ["减速效果 +25%", "绝对零度时长 +50%"],
    fx: { slowMul: 1.25, freezeMul: 1.5 },
  },
  {
    id: "tony", name: "托尼", title: "机械大师", emoji: "🧑‍🔧", cost: 300,
    desc: ["建造/升级成本 -8%", "每波额外 +20 金币", "空投金币 +50%"],
    fx: { costMul: 0.92, waveGold: 20, airdropMul: 1.5 },
  },
  {
    id: "nova", name: "诺娃", title: "星辰术士", emoji: "🧙‍♀️", cost: 500,
    desc: ["技能冷却 -20%", "初始金币 +100", "全体炮塔伤害 +4%"],
    fx: { cdMul: 0.8, startGold: 100, towerDmg: 0.04 },
  },
];

// ============ 技能 ============
export interface SkillDef {
  id: SkillId;
  name: string;
  emoji: string;
  cd: number;
  max: number;
  desc: (lv: number) => string;
}
export const SKILL_ORDER: SkillId[] = ["meteor", "freeze", "frenzy", "airdrop", "repair"];
export const meteorDmg = (lv: number) => 120 + 70 * lv;
export const freezeDur = (lv: number) => 2 + 0.5 * lv;
export const frenzyDur = (lv: number) => 6 + 1.5 * lv;
export const airdropGold = (lv: number) => 100 + 60 * lv;
export const repairHp = (lv: number) => 2 + lv;
export const SKILLS: Record<SkillId, SkillDef> = {
  meteor: { id: "meteor", name: "陨石轰炸", emoji: "☄️", cd: 28, max: 6, desc: (lv) => `点击地图任意位置，召唤陨石造成 ${meteorDmg(lv)} 范围伤害` },
  freeze: { id: "freeze", name: "绝对零度", emoji: "🥶", cd: 42, max: 6, desc: (lv) => `冻结全场敌人 ${freezeDur(lv).toFixed(1)} 秒（首领效果减半）` },
  frenzy: { id: "frenzy", name: "战争狂热", emoji: "🔥", cd: 45, max: 6, desc: (lv) => `全体炮塔射速 +35%，持续 ${frenzyDur(lv).toFixed(1)} 秒` },
  airdrop: { id: "airdrop", name: "补给空投", emoji: "📦", cd: 50, max: 6, desc: (lv) => `立即获得 ${airdropGold(lv)} 金币` },
  repair: { id: "repair", name: "紧急修复", emoji: "🔧", cd: 60, max: 6, desc: (lv) => `恢复基地 ${repairHp(lv)} 点生命` },
};
export const skillUpCost = (lv: number) => 40 * lv;

// ============ 局外养成 ============
export interface MetaDef {
  id: string;
  name: string;
  emoji: string;
  max: number;
  base: number;
  desc: (lv: number) => string;
}
export const META: MetaDef[] = [
  { id: "gold", name: "军需储备", emoji: "💰", max: 8, base: 20, desc: (l) => `初始金币 +${l * 40}` },
  { id: "hp", name: "要塞加固", emoji: "🏰", max: 8, base: 25, desc: (l) => `基地生命 +${l * 3}` },
  { id: "dmg", name: "锻造工艺", emoji: "⚔️", max: 10, base: 30, desc: (l) => `全体炮塔伤害 +${l * 5}%` },
  { id: "range", name: "瞭望塔", emoji: "🔭", max: 6, base: 30, desc: (l) => `全体炮塔射程 +${l * 3}%` },
  { id: "cost", name: "工程学", emoji: "📐", max: 8, base: 35, desc: (l) => `建造/升级成本 -${l * 3}%` },
  { id: "bounty", name: "赏金猎人", emoji: "🪙", max: 8, base: 30, desc: (l) => `击杀金币 +${l * 5}%` },
  { id: "sell", name: "回收技术", emoji: "♻️", max: 5, base: 20, desc: (l) => `出售返还 ${70 + l * 5}%` },
  { id: "cd", name: "能量核心", emoji: "🔋", max: 8, base: 35, desc: (l) => `技能冷却 -${l * 4}%` },
  { id: "crystal", name: "晶体探测", emoji: "💎", max: 5, base: 40, desc: (l) => `通关水晶奖励 +${l * 8}%` },
];
export const metaCost = (m: MetaDef, lv: number) => Math.round(m.base * (1 + 0.8 * lv));

// ============ 存档 ============
export interface Save {
  crystals: number;
  stars: Record<number, number>;
  upgrades: Record<string, number>;
  skills: Record<string, number>;
  owned: string[];
  commander: string;
  sound: boolean;
  bestEndless: number;
  kills: number;
}

export interface Mods {
  startGold: number;
  baseHp: number;
  dmgMul: number;
  rangeMul: number;
  costMul: number;
  goldMul: number;
  sellRate: number;
  cdMul: number;
  crystalMul: number;
  meteorMul: number;
  freezeMul: number;
  slowMul: number;
  waveGold: number;
  airdropMul: number;
  skills: Record<string, number>;
}

export function buildMods(s: Save): Mods {
  const u = (id: string) => s.upgrades[id] ?? 0;
  const c = COMMANDERS.find((x) => x.id === s.commander) ?? COMMANDERS[0];
  const f = c.fx;
  return {
    startGold: u("gold") * 40 + (f.startGold ?? 0),
    baseHp: 20 + u("hp") * 3,
    dmgMul: (1 + u("dmg") * 0.05) * (1 + (f.towerDmg ?? 0)),
    rangeMul: 1 + u("range") * 0.03,
    costMul: Math.max(0.4, 1 - u("cost") * 0.03) * (f.costMul ?? 1),
    goldMul: 1 + u("bounty") * 0.05,
    sellRate: 0.7 + u("sell") * 0.05,
    cdMul: Math.max(0.3, 1 - u("cd") * 0.04) * (f.cdMul ?? 1),
    crystalMul: 1 + u("crystal") * 0.08,
    meteorMul: f.meteorMul ?? 1,
    freezeMul: f.freezeMul ?? 1,
    slowMul: f.slowMul ?? 1,
    waveGold: f.waveGold ?? 0,
    airdropMul: f.airdropMul ?? 1,
    skills: { meteor: 1, freeze: 1, frenzy: 1, airdrop: 1, repair: 1, ...s.skills },
  };
}

export function clearedCount(s: Save) {
  let n = 0;
  while (n < LEVELS.length && (s.stars[n] ?? 0) > 0) n++;
  return n;
}

export const defaultSave = (): Save => ({
  crystals: 0,
  stars: {},
  upgrades: {},
  skills: { meteor: 1, freeze: 1, frenzy: 1, airdrop: 1, repair: 1 },
  owned: ["allen"],
  commander: "allen",
  sound: true,
  bestEndless: 0,
  kills: 0,
});
