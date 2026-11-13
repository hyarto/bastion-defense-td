import { useState } from "react";
import {
  COMMANDERS,
  ENDLESS,
  ENDLESS_UNLOCK,
  ENEMIES,
  LEVELS,
  META,
  SKILLS,
  SKILL_ORDER,
  THEMES,
  TOWERS,
  TOWER_ORDER,
  clearedCount,
  metaCost,
  skillUpCost,
  type LevelDef,
  type Save,
} from "../game/data";
import { sfx } from "../game/audio";
import { cn } from "../utils/cn";

const panel = "rounded-xl bg-white/5 border border-white/10 backdrop-blur";

export function Screen({ children, title, onBack, right }: { children: React.ReactNode; title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-[#0f1b33] via-[#14213d] to-[#1c1233] text-white">
      <div className="flex items-center gap-2 px-3 py-1.5 sm:py-2 border-b border-white/10 bg-black/20 pt-[max(0.375rem,env(safe-area-inset-top))]">
        <button
          onClick={() => {
            sfx("click");
            onBack();
          }}
          className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1 text-sm active:scale-95"
        >
          ← 返回
        </button>
        <h1 className="text-base sm:text-xl font-extrabold tracking-wide">{title}</h1>
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">{children}</div>
    </div>
  );
}

export const Crystals = ({ n }: { n: number }) => (
  <div className="rounded-full bg-cyan-500/20 border border-cyan-300/40 px-3 py-0.5 text-sm font-bold text-cyan-200">💎 {n}</div>
);

// ================= 标题 =================
export function TitleScreen({
  save,
  online,
  canInstall,
  onInstall,
  onNav,
  onToggleSound,
  onReset,
  installed,
}: {
  save: Save;
  online: boolean;
  canInstall: boolean;
  installed: boolean;
  onInstall: () => void;
  onNav: (s: "map" | "workshop") => void;
  onToggleSound: () => void;
  onReset: () => void;
}) {
  const [help, setHelp] = useState(false);
  const stars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  const fs = () => {
    const d = document as Document & { webkitFullscreenElement?: Element };
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (d.fullscreenElement || d.webkitFullscreenElement) document.exitFullscreen?.();
    else (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
  };
  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-b from-[#1b2a52] via-[#2b2058] to-[#3b1d4a] text-white flex items-center justify-center">
      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        {["🏰", "🐲", "🏹", "💣", "❄️", "⚡", "🦇", "👺", "🤖", "☄️"].map((e, i) => (
          <span
            key={i}
            className="absolute text-4xl sm:text-6xl animate-bounce"
            style={{ left: `${(i * 37) % 95}%`, top: `${(i * 53) % 85}%`, animationDuration: `${2.5 + (i % 4)}s`, animationDelay: `${i * 0.3}s` }}
          >
            {e}
          </span>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

      <div className="relative z-10 flex items-center gap-8 px-4 max-w-4xl w-full justify-center">
        <div className="text-center">
          <div className="text-5xl sm:text-7xl drop-shadow-lg">🏰</div>
          <h1 className="mt-1 text-3xl sm:text-5xl font-black tracking-widest bg-gradient-to-b from-amber-200 to-orange-500 bg-clip-text text-transparent drop-shadow">
            王国守卫战
          </h1>
          <div className="text-xs sm:text-sm tracking-[0.4em] text-slate-300 mt-1">BASTION DEFENSE</div>
          <div className="mt-3 flex gap-2 justify-center text-xs">
            <span className="rounded-full bg-black/30 px-3 py-1">💎 {save.crystals}</span>
            <span className="rounded-full bg-black/30 px-3 py-1">⭐ {stars}/{LEVELS.length * 3}</span>
            <span className={cn("rounded-full px-3 py-1", online ? "bg-emerald-600/40" : "bg-amber-600/50")}>
              {online ? "🟢 在线" : "📴 离线模式"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 w-44 sm:w-56">
          <Menu primary onClick={() => onNav("map")}>
            ⚔️ 开始战斗
          </Menu>
          <Menu onClick={() => onNav("workshop")}>🛠️ 训练营 · 养成</Menu>
          <div className="flex gap-2">
            <Menu small onClick={() => setHelp(true)}>
              📖 玩法
            </Menu>
            <Menu small onClick={onToggleSound}>
              {save.sound ? "🔊 音效" : "🔇 静音"}
            </Menu>
            <Menu small onClick={fs}>
              ⛶
            </Menu>
          </div>
          {canInstall && !installed && (
            <Menu onClick={onInstall}>📲 安装到设备</Menu>
          )}
          <button
            className="text-[10px] text-slate-400 hover:text-rose-300 underline"
            onClick={() => {
              if (confirm("确定要清除所有存档吗？此操作无法撤销。")) onReset();
            }}
          >
            重置存档
          </button>
        </div>
      </div>

      {help && <Help onClose={() => setHelp(false)} />}
    </div>
  );
}

function Menu({ children, onClick, primary, small }: { children: React.ReactNode; onClick: () => void; primary?: boolean; small?: boolean }) {
  return (
    <button
      onClick={() => {
        sfx("click");
        onClick();
      }}
      className={cn(
        "rounded-xl font-bold shadow-lg active:scale-95 transition border",
        small ? "flex-1 py-1.5 text-xs" : "py-2 sm:py-3 text-sm sm:text-lg",
        primary
          ? "bg-gradient-to-b from-amber-400 to-orange-600 border-amber-200/50 text-black"
          : "bg-white/10 hover:bg-white/20 border-white/20"
      )}
    >
      {children}
    </button>
  );
}

function Help({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 bg-black/70 flex items-center justify-center p-3" onClick={onClose}>
      <div className={cn(panel, "max-w-2xl w-full max-h-full overflow-auto p-4 text-sm bg-[#16213a]")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center mb-2">
          <h2 className="text-lg font-bold">📖 玩法说明</h2>
          <button className="ml-auto rounded bg-white/10 px-2" onClick={onClose}>
            ✕
          </button>
        </div>
        <ul className="space-y-1.5 text-slate-200 leading-relaxed list-disc pl-5">
          <li>在右侧选择炮塔，点击地图空地建造；点击已建炮塔可 <b>升级 / 出售 / 切换目标优先级</b>。</li>
          <li>炮塔升到 Lv.3 后可进行 <b>改造</b>，每种炮塔有两条不同的终极分支，选择后不可更改。</li>
          <li>底部 5 个 <b>指挥官技能</b>：陨石轰炸(点选位置)、绝对零度、战争狂热、补给空投、紧急修复，均有冷却。</li>
          <li>提前呼叫下一波可获得额外金币；基地剩余生命越多，通关星级越高(最高 3 星)。</li>
          <li>战斗获得的 💎 水晶可在 <b>训练营</b> 永久强化：科技、指挥官、技能等级。</li>
          <li>飞行单位无视道路，炮塔无法攻击空中；魔法伤害(寒冰/电磁)无视护甲；巫医会治疗，史莱姆会分裂。</li>
          <li>快捷键：1-6 选塔，Q/W/E/R/T 释放技能，N 下一波，空格暂停，Esc 取消。</li>
          <li>本游戏为 PWA：可「安装到主屏幕」，安装后完全离线可玩，进度保存在本机。</li>
        </ul>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-xs">
          {TOWER_ORDER.map((id) => (
            <div key={id} className="rounded-lg bg-white/5 p-1.5">
              <b>
                {TOWERS[id].emoji} {TOWERS[id].name}
              </b>
              <div className="text-slate-400">{TOWERS[id].desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ================= 关卡地图 =================
function Thumb({ level }: { level: LevelDef }) {
  const th = THEMES[level.theme];
  return (
    <svg viewBox="0 0 16 9" className="w-full rounded-md" style={{ background: th.a }}>
      {level.paths.map((p, i) => (
        <g key={i}>
          <polyline points={p.map(([c, r]) => `${c + 0.5},${r + 0.5}`).join(" ")} fill="none" stroke={th.edge} strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={p.map(([c, r]) => `${c + 0.5},${r + 0.5}`).join(" ")} fill="none" stroke={th.path} strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

export function MapScreen({
  save,
  onBack,
  onStart,
  onPickCommander,
}: {
  save: Save;
  onBack: () => void;
  onStart: (l: LevelDef) => void;
  onPickCommander: (id: string) => void;
}) {
  const cleared = clearedCount(save);
  const [sel, setSel] = useState<LevelDef | null>(null);
  const all = [...LEVELS, ENDLESS];
  const isOpen = (l: LevelDef) => (l.endless ? cleared >= ENDLESS_UNLOCK : l.id <= cleared);

  return (
    <Screen title="🗺️ 选择关卡" onBack={onBack} right={<Crystals n={save.crystals} />}>
      <div className="h-full flex items-center">
        <div className="flex gap-3 px-2 py-2 overflow-x-auto w-full snap-x items-stretch">
          {all.map((l, idx) => {
            const open = isOpen(l);
            const st = save.stars[l.id] ?? 0;
            return (
              <button
                key={l.id}
                disabled={!open}
                onClick={() => {
                  sfx("click");
                  setSel(l);
                }}
                className={cn(
                  panel,
                  "snap-center shrink-0 w-40 sm:w-52 p-2 text-left relative transition active:scale-95",
                  open ? "hover:bg-white/10 hover:border-amber-300/60" : "opacity-50",
                  open && !l.endless && st === 0 && l.id === cleared && "ring-2 ring-amber-300 animate-pulse"
                )}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
                  <span>{l.endless ? "∞ 特殊" : `第 ${idx + 1} 关`}</span>
                  {!l.endless && <span className="tracking-tighter">{[1, 2, 3].map((i) => <span key={i} className={i <= st ? "" : "grayscale opacity-30"}>⭐</span>)}</span>}
                  {l.endless && <span className="text-cyan-300">最佳 {save.bestEndless} 波</span>}
                </div>
                <Thumb level={l} />
                <div className="mt-1.5 font-bold text-sm sm:text-base">{l.name}</div>
                <div className="text-[11px] text-slate-400 line-clamp-2 h-8 leading-snug">{l.desc}</div>
                {!open && (
                  <div className="absolute inset-0 rounded-xl bg-black/50 flex flex-col items-center justify-center text-2xl">
                    🔒
                    <span className="text-[11px] mt-1">{l.endless ? `通关第${ENDLESS_UNLOCK}关解锁` : "通关上一关解锁"}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {sel && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-3" onClick={() => setSel(null)}>
          <div className={cn(panel, "bg-[#16213a] w-full max-w-xl max-h-full overflow-auto p-3 sm:p-4")} onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-3">
              <div className="w-1/3 shrink-0">
                <Thumb level={sel} />
                <div className="text-center text-xs mt-1 text-slate-300">{sel.endless ? "无限波次" : `${sel.waves} 波`} · {sel.paths.length} 条路径</div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-extrabold">{sel.name}</h2>
                <p className="text-xs text-slate-300 mb-1.5">{sel.desc}</p>
                <div className="text-xs text-slate-400 mb-1">敌人情报：</div>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {[...new Set([...sel.pool.map((p) => p[0]), ...(sel.boss ? [sel.boss] : [])])].map((t) => (
                    <span key={t} title={ENEMIES[t].desc} className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                      {ENEMIES[t].emoji} {ENEMIES[t].name}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-slate-400 mb-1">出战指挥官：</div>
                <div className="flex gap-1 flex-wrap">
                  {COMMANDERS.filter((c) => save.owned.includes(c.id)).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        sfx("click");
                        onPickCommander(c.id);
                      }}
                      className={cn("rounded-lg px-2 py-1 text-xs border", save.commander === c.id ? "bg-amber-400/30 border-amber-300" : "bg-white/5 border-white/10")}
                    >
                      {c.emoji} {c.name}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {COMMANDERS.find((c) => c.id === save.commander)?.desc.join(" · ")}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <button className="rounded-lg bg-white/10 px-4 py-2 text-sm" onClick={() => setSel(null)}>
                取消
              </button>
              <button
                className="rounded-lg bg-gradient-to-b from-amber-400 to-orange-600 text-black font-bold px-6 py-2 text-sm active:scale-95"
                onClick={() => {
                  sfx("wave");
                  onStart(sel);
                }}
              >
                ⚔️ 出征
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

// ================= 训练营 =================
export function Workshop({
  save,
  onBack,
  onBuyMeta,
  onBuyCommander,
  onPickCommander,
  onUpSkill,
}: {
  save: Save;
  onBack: () => void;
  onBuyMeta: (id: string) => void;
  onBuyCommander: (id: string) => void;
  onPickCommander: (id: string) => void;
  onUpSkill: (id: string) => void;
}) {
  const [tab, setTab] = useState<"tech" | "cmd" | "skill">("tech");
  const tabs: [typeof tab, string][] = [
    ["tech", "🔬 科技研发"],
    ["cmd", "🎖️ 指挥官"],
    ["skill", "✨ 技能强化"],
  ];
  return (
    <Screen title="🛠️ 训练营" onBack={onBack} right={<Crystals n={save.crystals} />}>
      <div className="flex gap-1 p-2 sticky top-0 z-10 bg-[#14213d]/90 backdrop-blur">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              sfx("click");
              setTab(k);
            }}
            className={cn("rounded-lg px-3 py-1 text-xs sm:text-sm font-bold border", tab === k ? "bg-amber-400 text-black border-amber-200" : "bg-white/5 border-white/10")}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "tech" && (
        <div className="p-2 grid grid-cols-2 lg:grid-cols-3 gap-2">
          {META.map((m) => {
            const lv = save.upgrades[m.id] ?? 0;
            const maxed = lv >= m.max;
            const c = metaCost(m, lv);
            const ok = save.crystals >= c;
            return (
              <div key={m.id} className={cn(panel, "p-2 flex gap-2 items-center")}>
                <div className="text-3xl">{m.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">
                    {m.name} <span className="text-xs text-amber-300">Lv.{lv}/{m.max}</span>
                  </div>
                  <div className="flex gap-0.5 my-0.5">
                    {Array.from({ length: m.max }).map((_, i) => (
                      <div key={i} className={cn("h-1.5 flex-1 rounded", i < lv ? "bg-amber-400" : "bg-white/15")} />
                    ))}
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {m.desc(lv)}
                    {!maxed && <span className="text-emerald-300"> → {m.desc(lv + 1)}</span>}
                  </div>
                </div>
                <BuyBtn disabled={maxed || !ok} onClick={() => onBuyMeta(m.id)}>
                  {maxed ? "MAX" : `💎${c}`}
                </BuyBtn>
              </div>
            );
          })}
        </div>
      )}

      {tab === "cmd" && (
        <div className="p-2 grid grid-cols-2 gap-2">
          {COMMANDERS.map((c) => {
            const owned = save.owned.includes(c.id);
            const active = save.commander === c.id;
            return (
              <div key={c.id} className={cn(panel, "p-2 flex gap-2 items-center", active && "border-amber-300 bg-amber-300/10")}>
                <div className="text-4xl">{c.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">
                    {c.name} <span className="text-xs text-slate-400">{c.title}</span>
                  </div>
                  <ul className="text-[11px] text-slate-300 list-disc pl-4">
                    {c.desc.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
                {owned ? (
                  <BuyBtn disabled={active} onClick={() => onPickCommander(c.id)}>
                    {active ? "出战中" : "出战"}
                  </BuyBtn>
                ) : (
                  <BuyBtn disabled={save.crystals < c.cost} onClick={() => onBuyCommander(c.id)}>
                    💎{c.cost}
                  </BuyBtn>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "skill" && (
        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SKILL_ORDER.map((id) => {
            const s = SKILLS[id];
            const lv = save.skills[id] ?? 1;
            const maxed = lv >= s.max;
            const c = skillUpCost(lv);
            return (
              <div key={id} className={cn(panel, "p-2 flex gap-2 items-center")}>
                <div className="text-3xl">{s.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">
                    {s.name} <span className="text-xs text-amber-300">Lv.{lv}/{s.max}</span>
                    <span className="text-[10px] text-slate-400"> · 冷却{s.cd}s</span>
                  </div>
                  <div className="text-[11px] text-slate-300">{s.desc(lv)}</div>
                  {!maxed && <div className="text-[11px] text-emerald-300">→ {s.desc(lv + 1)}</div>}
                </div>
                <BuyBtn disabled={maxed || save.crystals < c} onClick={() => onUpSkill(id)}>
                  {maxed ? "MAX" : `💎${c}`}
                </BuyBtn>
              </div>
            );
          })}
        </div>
      )}
    </Screen>
  );
}

function BuyBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold active:scale-95 transition",
        disabled ? "bg-slate-700 text-slate-400" : "bg-gradient-to-b from-cyan-400 to-blue-600 text-white shadow"
      )}
    >
      {children}
    </button>
  );
}
