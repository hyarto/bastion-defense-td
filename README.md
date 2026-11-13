# 🏰 王国守卫战 · Bastion Defense

一款横屏塔防 PWA 游戏（React + Vite + Tailwind + Canvas）。

## 特色
- **10 个战役关卡 + 无尽模式**：多路径、空中单位、治疗/分裂/首领等丰富敌人
- **6 种炮塔**：箭塔、炮塔、寒冰塔、电磁塔、信号塔、狙击塔
- **炮塔升级与改造**：Lv.1→Lv.3 升级，之后二选一终极改造分支（共 12 种改造）
- **指挥官技能**：陨石轰炸、绝对零度、战争狂热、补给空投、紧急修复
- **局外养成**：9 项永久科技、4 位指挥官、技能等级强化，水晶货币
- **PWA**：可安装，Service Worker 预缓存，**完全离线可玩**，存档保存在 localStorage
- 音效使用 WebAudio 合成，无外部资源依赖

## 开发
```bash
npm install
npm run dev      # 开发
npm run build    # 构建到 dist/
npm run preview  # 预览（含 Service Worker）
```

## 部署到 Vercel
仓库已包含 `vercel.json`。在 Vercel 导入该仓库即可（Framework: Vite，Build: `npm run build`，Output: `dist`）。

## 操作
鼠标/触屏：选择炮塔 → 点击空地建造；点击炮塔升级/改造/出售。
快捷键：`1-6` 选塔，`Q W E R T` 释放技能，`N` 下一波，`空格` 暂停，`Esc` 取消。
