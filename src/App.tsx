import { useCallback, useEffect, useState } from "react";
import BattleScreen, { type BattleResult } from "./components/BattleScreen";
import { MapScreen, TitleScreen, Workshop } from "./components/MenuScreens";
import { COMMANDERS, ENDLESS, LEVELS, META, defaultSave, metaCost, skillUpCost, SKILLS, type LevelDef, type Save, type SkillId } from "./game/data";
import { loadSave, writeSave } from "./game/save";
import { setSound, sfx } from "./game/audio";

type Screen = "title" | "map" | "workshop" | "battle";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
}

export default function App() {
  const [save, setSave] = useState<Save>(() => loadSave());
  const [screen, setScreen] = useState<Screen>("title");
  const [level, setLevel] = useState<LevelDef | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia?.("(display-mode: standalone)").matches ?? false);

  useEffect(() => {
    writeSave(save);
    setSound(save.sound);
  }, [save]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const bip = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
    };
    const inst = () => {
      setInstalled(true);
      setInstallEvt(null);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener("beforeinstallprompt", bip);
    window.addEventListener("appinstalled", inst);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener("beforeinstallprompt", bip);
      window.removeEventListener("appinstalled", inst);
    };
  }, []);

  const update = useCallback((fn: (s: Save) => Save) => setSave((s) => fn(s)), []);

  const onComplete = (r: BattleResult) => {
    update((s) => {
      const next: Save = { ...s, crystals: s.crystals + r.crystals, kills: s.kills + r.kills, stars: { ...s.stars } };
      if (level?.endless) next.bestEndless = Math.max(s.bestEndless, r.wave);
      else if (r.won && level) next.stars[level.id] = Math.max(s.stars[level.id] ?? 0, r.stars);
      return next;
    });
  };

  const nextLevel = level && !level.endless && level.id + 1 < LEVELS.length ? LEVELS[level.id + 1] : null;

  return (
    <>
      {screen === "title" && (
        <TitleScreen
          save={save}
          online={online}
          canInstall={!!installEvt}
          installed={installed}
          onInstall={() => {
            installEvt?.prompt();
          }}
          onNav={(s) => setScreen(s)}
          onToggleSound={() => update((s) => ({ ...s, sound: !s.sound }))}
          onReset={() => {
            setSave(defaultSave());
          }}
        />
      )}
      {screen === "map" && (
        <MapScreen
          save={save}
          onBack={() => setScreen("title")}
          onPickCommander={(id) => update((s) => ({ ...s, commander: id }))}
          onStart={(l) => {
            setLevel(l);
            setAttempt((a) => a + 1);
            setScreen("battle");
          }}
        />
      )}
      {screen === "workshop" && (
        <Workshop
          save={save}
          onBack={() => setScreen("title")}
          onBuyMeta={(id) =>
            update((s) => {
              const m = META.find((x) => x.id === id)!;
              const lv = s.upgrades[id] ?? 0;
              const c = metaCost(m, lv);
              if (lv >= m.max || s.crystals < c) return s;
              sfx("upgrade");
              return { ...s, crystals: s.crystals - c, upgrades: { ...s.upgrades, [id]: lv + 1 } };
            })
          }
          onBuyCommander={(id) =>
            update((s) => {
              const c = COMMANDERS.find((x) => x.id === id)!;
              if (s.owned.includes(id) || s.crystals < c.cost) return s;
              sfx("upgrade");
              return { ...s, crystals: s.crystals - c.cost, owned: [...s.owned, id], commander: id };
            })
          }
          onPickCommander={(id) => update((s) => ({ ...s, commander: id }))}
          onUpSkill={(id) =>
            update((s) => {
              const sk = SKILLS[id as SkillId];
              const lv = s.skills[id] ?? 1;
              const c = skillUpCost(lv);
              if (lv >= sk.max || s.crystals < c) return s;
              sfx("upgrade");
              return { ...s, crystals: s.crystals - c, skills: { ...s.skills, [id]: lv + 1 } };
            })
          }
        />
      )}
      {screen === "battle" && level && (
        <BattleScreen
          key={`${level.id}-${attempt}`}
          level={level}
          save={save}
          onComplete={onComplete}
          onExit={() => setScreen("map")}
          onRetry={() => setAttempt((a) => a + 1)}
          onNext={
            nextLevel
              ? () => {
                  setLevel(nextLevel);
                  setAttempt((a) => a + 1);
                }
              : null
          }
        />
      )}

      {/* 竖屏提示 */}
      <div className="portrait-warn fixed inset-0 z-[100] hidden flex-col items-center justify-center bg-[#0b1220] text-white text-center p-6">
        <div className="text-6xl rotate-phone">📱</div>
        <div className="mt-4 text-xl font-bold">请将设备横屏</div>
        <div className="mt-1 text-sm text-slate-400">本游戏为横屏塔防，旋转后即可继续游玩</div>
      </div>
      {/* 保持引用，避免 tree-shake 警告 */}
      <span className="hidden">{ENDLESS.id}</span>
    </>
  );
}
