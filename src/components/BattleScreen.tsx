import { useEffect, useMemo, useRef, useState } from "react";
import { Battle, type Snapshot } from "../game/engine";
import {
  ENEMIES,
  H,
  LEVELS,
  SKILLS,
  SKILL_ORDER,
  TOWERS,
  TOWER_ORDER,
  W,
  buildMods,
  clearedCount,
  type LevelDef,
  type Save,
  type SkillId,
  type TowerId,
} from "../game/data";
import { sfx } from "../game/audio";
import { cn } from "../utils/cn";

export interface BattleResult {
  won: boolean;
  stars: number;
  crystals: number;
  wave: number;
  kills: number;
  newBest: boolean;
}

export function calcResult(b: Battle, level: LevelDef, save: Save): BattleResult {
  const m = buildMods(save);
  if (level.endless) {
    const wave = Math.max(0, b.wave - (b.state === "lost" ? 1 : 0));
    const crystals = Math.round(wave * (3 + wave * 0.15) * m.crystalMul);
    return { won: false, stars: 0, crystals, wave, kills: b.kills, newBest: wave > save.bestEndless };
  }
  if (b.state === "won") {
    const ratio = b.hp / b.maxHp;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.5 ? 2 : 1;
    const prev = save.stars[level.id] ?? 0;
    const base = level.reward * (prev > 0 ? 0.5 : 1) + Math.max(0, stars - prev) * 15;
    return { won: true, stars, crystals: Math.round(base * m.crystalMul), wave: b.wave, kills: b.kills, newBest: stars > prev };
  }
  const crystals = Math.round(Math.max(0, b.wave - 1) * 2 * m.crystalMul);
  return { won: false, stars: 0, crystals, wave: b.wave, kills: b.kills, newBest: false };
}

interface Props {
  level: LevelDef;
  save: Save;
  onComplete: (r: BattleResult) => void;
  onExit: () => void;
  onRetry: () => void;
  onNext: (() => void) | null;
}

export default function BattleScreen({ level, save, onComplete, onExit, onRetry, onNext }: Props) {
  const unlocked = useMemo(() => {
    const c = clearedCount(save);
    return TOWER_ORDER.filter((t) => TOWERS[t].unlock <= c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const eng = useMemo(() => new Battle(level, buildMods(save), unlocked), []); // eslint-disable-line react-hooks/exhaustive-deps
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 640, h: 360 });
  const [snap, setSnap] = useState<Snapshot>(() => eng.snapshot());
  const [result, setResult] = useState<BattleResult | null>(null);
  const [menu, setMenu] = useState(false);
  const doneRef = useRef(false);

  // 尺寸自适应（16:9 contain）
  useEffect(() => {
    const el = wrapRef.current!;
    const fit = () => {
      const r = el.getBoundingClientRect();
      let w = r.width;
      let h = (w * H) / W;
      if (h > r.height) {
        h = r.height;
        w = (h * W) / H;
      }
      setSize({ w: Math.floor(w), h: Math.floor(h) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 主循环
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      eng.update(dt);
      const cv = cvRef.current;
      if (cv) {
        const g = cv.getContext("2d");
        if (g) {
          g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
          g.clearRect(0, 0, W, H);
          eng.render(g);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = setInterval(() => {
      const s = eng.snapshot();
      setSnap(s);
      if ((s.state === "won" || s.state === "lost" || s.state === "ended") && !doneRef.current) {
        doneRef.current = true;
        const r = calcResult(eng, level, save);
        setTimeout(() => {
          setResult(r);
          onComplete(r);
        }, 600);
      }
    }, 100);
    const vis = () => {
      if (document.hidden && eng.state !== "won" && eng.state !== "lost") {
        eng.paused = true;
        setMenu(true);
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [eng]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => setSnap(eng.snapshot());

  // 键盘
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        eng.placing = null;
        eng.sel = null;
        eng.aiming = null;
      } else if (e.key === " ") {
        e.preventDefault();
        togglePause();
      } else if (e.key.toLowerCase() === "n") {
        eng.startWave();
      } else if (/^[1-6]$/.test(e.key)) {
        const id = TOWER_ORDER[Number(e.key) - 1];
        if (id && unlocked.includes(id)) pickTower(id);
      } else if (e.key.toLowerCase() === "q") castSkill("meteor");
      else if (e.key.toLowerCase() === "w") castSkill("freeze");
      else if (e.key.toLowerCase() === "e") castSkill("frenzy");
      else if (e.key.toLowerCase() === "r") castSkill("airdrop");
      else if (e.key.toLowerCase() === "t") castSkill("repair");
      refresh();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line

  const toWorld = (e: React.PointerEvent) => {
    const r = cvRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const togglePause = () => {
    eng.paused = !eng.paused;
    setMenu(eng.paused);
    refresh();
  };

  const pickTower = (id: TowerId) => {
    if (eng.placing === id) eng.placing = null;
    else {
      eng.placing = id;
      eng.sel = null;
      eng.aiming = null;
    }
    sfx("click");
    refresh();
  };

  const castSkill = (id: SkillId) => {
    if (id === "meteor") {
      if (eng.skillCd.meteor > 0) {
        sfx("error");
        return;
      }
      eng.aiming = eng.aiming === "meteor" ? null : "meteor";
      eng.placing = null;
      sfx("click");
    } else eng.castSkill(id);
    refresh();
  };

  const cycleSpeed = () => {
    eng.speed = eng.speed >= 3 ? 1 : eng.speed + 1;
    sfx("click");
    refresh();
  };

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const sel = snap.sel;
  const hpPct = (snap.hp / snap.maxHp) * 100;

  return (
    <div className="fixed inset-0 flex bg-[#0b1220] text-white select-none touch-none">
      {/* 画布区 */}
      <div ref={wrapRef} className="relative flex-1 min-w-0 flex items-center justify-center">
        <div className="relative" style={{ width: size.w, height: size.h }}>
          <canvas
            ref={cvRef}
            width={Math.floor(size.w * dpr)}
            height={Math.floor(size.h * dpr)}
            style={{ width: size.w, height: size.h, cursor: snap.aiming ? "crosshair" : snap.placing ? "copy" : "default" }}
            className="block rounded-md shadow-2xl"
            onPointerMove={(e) => {
              const p = toWorld(e);
              eng.pointerMove(p.x, p.y);
            }}
            onPointerLeave={() => eng.pointerLeave()}
            onPointerDown={(e) => {
              const p = toWorld(e);
              eng.pointerDown(p.x, p.y);
              refresh();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              eng.placing = null;
              eng.sel = null;
              eng.aiming = null;
              refresh();
            }}
          />
          {/* HUD */}
          <div className="absolute top-1 left-1 flex items-center gap-1 sm:gap-2 pointer-events-none">
            <Chip>
              <span>❤️</span>
              <span className="font-bold tabular-nums">{snap.hp}</span>
              <div className="hidden sm:block w-14 h-1.5 bg-black/50 rounded overflow-hidden">
                <div className="h-full bg-rose-500" style={{ width: `${hpPct}%` }} />
              </div>
            </Chip>
            <Chip>
              <span>💰</span>
              <span className="font-bold tabular-nums text-amber-300">{snap.gold}</span>
            </Chip>
            <Chip>
              <span>🌊</span>
              <span className="font-bold tabular-nums">
                {snap.wave}
                {snap.endless ? "" : `/${snap.totalWaves}`}
              </span>
            </Chip>
            {snap.frenzyT > 0 && (
              <Chip>
                <span>🔥</span>
                <span className="text-orange-300 tabular-nums">{snap.frenzyT.toFixed(0)}s</span>
              </Chip>
            )}
          </div>
          <div className="absolute top-1 right-1 flex gap-1">
            <HudBtn onClick={cycleSpeed}>{snap.speed}x</HudBtn>
            <HudBtn onClick={togglePause}>{snap.paused ? "▶" : "⏸"}</HudBtn>
          </div>
          {(snap.placing || snap.aiming) && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 pointer-events-none">
              <Chip>
                {snap.aiming ? "☄️ 点击地图选择轰炸位置" : `点击空地建造${TOWERS[snap.placing!].name}（右键/Esc取消）`}
              </Chip>
            </div>
          )}
          {snap.state === "prep" && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
              <div className="bg-black/60 rounded-lg px-3 py-1 text-xs sm:text-sm text-amber-200 animate-pulse">
                先布置炮塔，然后点击右侧「开始战斗」
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右侧面板 */}
      <div className="w-[clamp(150px,23vw,240px)] shrink-0 flex flex-col gap-1 p-1 sm:p-2 bg-gradient-to-b from-[#1b2740] to-[#101826] border-l border-white/10">
        {/* 出战 */}
        <div className="rounded-lg bg-black/30 p-1.5">
          <button
            onClick={() => {
              eng.startWave();
              refresh();
            }}
            disabled={snap.state === "won" || snap.state === "lost" || snap.state === "ended" || (!snap.endless && snap.wave >= snap.totalWaves)}
            className="w-full rounded-md bg-gradient-to-b from-emerald-400 to-emerald-600 disabled:from-slate-600 disabled:to-slate-700 disabled:opacity-60 py-1 text-xs sm:text-sm font-bold shadow active:scale-95 transition"
          >
            {snap.state === "prep"
              ? "⚔️ 开始战斗"
              : snap.wave >= snap.totalWaves && !snap.endless
                ? "最终波进行中"
                : `⏩ 下一波${snap.nextTimer > 0 ? ` (${Math.ceil(snap.nextTimer)}s)` : ""}`}
          </button>
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs text-slate-300">
            <span className="shrink-0">下波:</span>
            <div className="flex gap-0.5 flex-wrap">
              {snap.nextTypes.length === 0 ? (
                <span className="text-slate-500">—</span>
              ) : (
                snap.nextTypes.map((t) => (
                  <span key={t} title={ENEMIES[t].name} className="text-sm sm:text-base leading-none">
                    {ENEMIES[t].emoji}
                  </span>
                ))
              )}
            </div>
            <span className="ml-auto shrink-0 text-slate-400">余{snap.enemiesLeft}</span>
          </div>
        </div>

        {/* 建造 / 详情 */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-black/30 p-1.5">
          {sel ? (
            <div className="text-xs">
              <div className="flex items-center gap-1">
                <span className="text-xl">{sel.emoji}</span>
                <div className="leading-tight">
                  <div className="font-bold">{sel.name}</div>
                  <div className="text-amber-300 text-[11px]">{sel.lvLabel}</div>
                </div>
                <button
                  className="ml-auto w-6 h-6 rounded bg-white/10 hover:bg-white/20"
                  onClick={() => {
                    eng.sel = null;
                    refresh();
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="mt-1 space-y-0.5 text-[11px] text-slate-200">
                {sel.lines.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
              <div className="mt-1.5 space-y-1">
                {sel.up && (
                  <ActBtn
                    ok={sel.up.ok}
                    onClick={() => {
                      eng.upgrade(eng.sel!);
                      refresh();
                    }}
                  >
                    ⬆️ {sel.up.label} <b>💰{sel.up.cost}</b>
                  </ActBtn>
                )}
                {sel.mods &&
                  sel.mods.map((m, i) => (
                    <ActBtn
                      key={m.name}
                      ok={m.ok}
                      gold
                      onClick={() => {
                        eng.chooseMod(eng.sel!, i);
                        refresh();
                      }}
                    >
                      <div className="flex justify-between">
                        <span>
                          {m.icon} 改造·{m.name}
                        </span>
                        <b>💰{m.cost}</b>
                      </div>
                      <div className="text-[10px] opacity-80 font-normal text-left">{m.desc}</div>
                    </ActBtn>
                  ))}
                {!sel.up && !sel.mods && <div className="text-center text-[11px] text-emerald-300">已满级改造</div>}
                {sel.canMode && (
                  <button
                    className="w-full rounded bg-slate-600/70 hover:bg-slate-500 py-0.5"
                    onClick={() => {
                      eng.cycleMode(eng.sel!);
                      refresh();
                    }}
                  >
                    🎯 目标：{sel.mode === "first" ? "领先" : sel.mode === "strong" ? "最强" : "最近"}
                  </button>
                )}
                <button
                  className="w-full rounded bg-rose-700/80 hover:bg-rose-600 py-0.5"
                  onClick={() => {
                    eng.sell(eng.sel!);
                    refresh();
                  }}
                >
                  💸 出售 +{sel.sell}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[10px] text-slate-400 mb-1">选择炮塔后点击空地建造</div>
              <div className="grid grid-cols-2 gap-1">
                {TOWER_ORDER.map((id, idx) => {
                  const d = TOWERS[id];
                  const open = unlocked.includes(id);
                  const c = eng.cost(d.cost);
                  const active = snap.placing === id;
                  return (
                    <button
                      key={id}
                      disabled={!open}
                      onClick={() => pickTower(id)}
                      title={d.desc}
                      className={cn(
                        "relative rounded-md border px-1 py-0.5 text-center transition active:scale-95",
                        open ? "bg-white/10 hover:bg-white/20 border-white/10" : "bg-black/40 border-transparent opacity-60",
                        active && "ring-2 ring-amber-300 bg-amber-300/20",
                        open && snap.gold < c && "opacity-70"
                      )}
                    >
                      <span className="absolute left-0.5 top-0 text-[9px] text-slate-400">{idx + 1}</span>
                      <div className="text-lg sm:text-xl leading-none">{open ? d.emoji : "🔒"}</div>
                      <div className="text-[10px] leading-tight">{d.name}</div>
                      <div className={cn("text-[10px] font-bold", snap.gold >= c ? "text-amber-300" : "text-rose-400")}>
                        {open ? `💰${c}` : `通${d.unlock}关`}
                      </div>
                    </button>
                  );
                })}
              </div>
              {snap.placing && (
                <div className="mt-1 text-[10px] text-slate-300 leading-snug">{TOWERS[snap.placing].desc}</div>
              )}
            </div>
          )}
        </div>

        {/* 技能 */}
        <div className="rounded-lg bg-black/30 p-1">
          <div className="flex gap-1 justify-between">
            {SKILL_ORDER.map((id) => {
              const cd = snap.skillCd[id] ?? 0;
              const mx = snap.skillMax[id] || 1;
              const ready = cd <= 0;
              return (
                <button
                  key={id}
                  onClick={() => castSkill(id)}
                  title={`${SKILLS[id].name}：${SKILLS[id].desc(save.skills[id] ?? 1)}`}
                  className={cn(
                    "relative flex-1 aspect-square max-w-[44px] rounded-md overflow-hidden border text-base sm:text-xl",
                    ready ? "bg-indigo-500/40 border-indigo-300/60 active:scale-90" : "bg-slate-800 border-white/10",
                    snap.aiming === id && "ring-2 ring-rose-400"
                  )}
                >
                  <span className={ready ? "" : "opacity-40"}>{SKILLS[id].emoji}</span>
                  {!ready && (
                    <>
                      <div className="absolute inset-x-0 bottom-0 bg-black/50" style={{ height: `${(cd / mx) * 100}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs font-bold">
                        {Math.ceil(cd)}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 暂停菜单 */}
      {menu && !result && (
        <Overlay>
          <h2 className="text-xl font-bold mb-3">⏸ 游戏暂停</h2>
          <div className="flex flex-col gap-2 w-44">
            <Big
              onClick={() => {
                eng.paused = false;
                setMenu(false);
                refresh();
              }}
            >
              ▶ 继续
            </Big>
            <Big onClick={onRetry}>🔄 重新开始</Big>
            {snap.endless && snap.wave > 1 && (
              <Big
                onClick={() => {
                  eng.paused = false;
                  setMenu(false);
                  eng.retreat();
                }}
              >
                🏳️ 结算撤退
              </Big>
            )}
            <Big danger onClick={onExit}>
              🚪 退出关卡
            </Big>
          </div>
        </Overlay>
      )}

      {/* 结算 */}
      {result && (
        <Overlay>
          <div className="text-4xl mb-1">{level.endless ? "🏳️" : result.won ? "🎉" : "💀"}</div>
          <h2 className="text-2xl font-extrabold mb-1">
            {level.endless ? `坚持了 ${result.wave} 波` : result.won ? "胜利！" : "防线失守"}
          </h2>
          {result.won && (
            <div className="text-3xl mb-1 tracking-widest">
              {[1, 2, 3].map((i) => (
                <span key={i} className={i <= result.stars ? "" : "grayscale opacity-30"}>
                  ⭐
                </span>
              ))}
            </div>
          )}
          <div className="text-sm text-slate-200 mb-1">
            击杀 {result.kills} · 波数 {result.wave}
            {level.endless && result.newBest && <span className="text-amber-300"> · 新纪录！</span>}
          </div>
          <div className="text-lg font-bold text-cyan-300 mb-3">💎 +{result.crystals} 水晶</div>
          <div className="flex gap-2 flex-wrap justify-center">
            <Big onClick={onExit}>🗺️ 返回</Big>
            <Big onClick={onRetry}>🔄 重玩</Big>
            {result.won && onNext && <Big primary onClick={onNext}>➡️ 下一关</Big>}
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-black/55 backdrop-blur px-2 py-0.5 text-[11px] sm:text-sm">{children}</div>
  );
}
function HudBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-w-8 h-7 sm:h-8 px-2 rounded-full bg-black/55 backdrop-blur text-xs sm:text-sm font-bold hover:bg-black/70 active:scale-90"
    >
      {children}
    </button>
  );
}
function ActBtn({ children, ok, onClick, gold }: { children: React.ReactNode; ok: boolean; onClick: () => void; gold?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded px-1.5 py-1 text-[11px] font-semibold active:scale-95 transition",
        ok
          ? gold
            ? "bg-gradient-to-b from-amber-400 to-orange-600 text-black"
            : "bg-gradient-to-b from-sky-400 to-blue-600"
          : "bg-slate-700 text-slate-400"
      )}
    >
      {children}
    </button>
  );
}
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center text-center p-2">
      {children}
    </div>
  );
}
function Big({ children, onClick, primary, danger }: { children: React.ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-4 py-2 font-bold text-sm shadow active:scale-95 transition",
        primary ? "bg-gradient-to-b from-emerald-400 to-emerald-600" : danger ? "bg-rose-700 hover:bg-rose-600" : "bg-slate-600 hover:bg-slate-500"
      )}
    >
      {children}
    </button>
  );
}

export { LEVELS };
