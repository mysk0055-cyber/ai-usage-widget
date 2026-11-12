// AI 使用量ウィジェット（Scriptable / 中サイズ）
// GPT・Claude・Grok の週間リミット残りと、GPT・Claude の5時間枠の残りを表示する
const DATA_URL = "https://raw.githubusercontent.com/mysk0055-cyber/ai-usage-widget/main/usage.json";

const BG = new Color("#101014");
const WHITE = Color.white();
const SUB = new Color("#ffffff", 0.6);
const LOW = new Color("#ff5c5c");
const TRACK = new Color("#ffffff", 0.12);
const BAR_W = 300;
const BAR_H = 5;

const SERVICES = [
  { key: "gpt", name: "GPT", color: "#10a37f" },
  { key: "claude", name: "Claude", color: "#d97757" },
  { key: "grok", name: "Grok", color: "#e7e9ea" },
];

async function loadData() {
  try {
    const req = new Request(DATA_URL + "?t=" + Date.now());
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    if (!data || typeof data !== "object") return null;
    return data;
  } catch (e) {
    return null;
  }
}

function num(v) {
  return typeof v === "number" && isFinite(v) ? Math.max(0, Math.min(100, v)) : null;
}

// リセットまでの残り時間（週間は日、1日を切ったら時間、5時間枠は時間・分）
function untilText(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const ms = t - Date.now();
  if (ms <= 0) return "リセット済み";
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  if (d >= 1) return `あと${d}日`;
  if (h >= 1) return `あと${h}時間`;
  return `あと${min}分`;
}

function barImage(pct, color) {
  const ctx = new DrawContext();
  ctx.size = new Size(BAR_W, BAR_H);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const track = new Path();
  track.addRoundedRect(new Rect(0, 0, BAR_W, BAR_H), BAR_H / 2, BAR_H / 2);
  ctx.addPath(track);
  ctx.setFillColor(TRACK);
  ctx.fillPath();
  if (pct != null && pct > 0) {
    const w = Math.max(BAR_H, (BAR_W * pct) / 100);
    const fill = new Path();
    fill.addRoundedRect(new Rect(0, 0, w, BAR_H), BAR_H / 2, BAR_H / 2);
    ctx.addPath(fill);
    ctx.setFillColor(new Color(color));
    ctx.fillPath();
  }
  return ctx.getImage();
}

function addText(stack, str, font, color) {
  const t = stack.addText(str);
  t.font = font;
  t.textColor = color;
  t.lineLimit = 1;
  return t;
}

function addRow(w, svc, d) {
  d = d || {};
  const weekly = num(d.weekly_left_pct);
  const fiveH = num(d.five_hour_left_pct != null ? d.five_hour_left_pct : d.session_left_pct);
  const fiveHReset = d.five_hour_resets_at || d.session_resets_at;

  const line = w.addStack();
  line.layoutHorizontally();
  line.centerAlignContent();

  const nameStack = line.addStack();
  nameStack.size = new Size(52, 0);
  addText(nameStack, svc.name, Font.semiboldSystemFont(13), WHITE);

  if (weekly == null) {
    addText(line, d.note || "—", Font.systemFont(12), WHITE);
  } else {
    addText(line, `${weekly}%`, Font.boldSystemFont(15), weekly <= 20 ? LOW : WHITE);
    const r = untilText(d.resets_at);
    if (r) {
      line.addSpacer(6);
      addText(line, r === "リセット済み" ? r : `${r}でリセット`, Font.systemFont(11), WHITE);
    }
  }

  line.addSpacer();

  if (fiveH != null) {
    addText(line, "5h ", Font.systemFont(11), SUB);
    addText(line, `${fiveH}%`, Font.boldSystemFont(12), fiveH <= 20 ? LOW : WHITE);
    const r5 = untilText(fiveHReset);
    if (r5) addText(line, ` · ${r5}`, Font.systemFont(11), SUB);
  }

  w.addSpacer(3);
  const img = w.addImage(barImage(weekly, svc.color));
  img.imageSize = new Size(BAR_W, BAR_H);
}

async function createWidget() {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(12, 14, 10, 14);
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

  const data = await loadData();
  if (!data) {
    w.addSpacer();
    const t = addText(w, "データ取得失敗", Font.boldSystemFont(15), WHITE);
    t.centerAlignText();
    w.addSpacer();
    return w;
  }

  SERVICES.forEach((svc, i) => {
    if (i > 0) w.addSpacer(7);
    addRow(w, svc, data[svc.key]);
  });

  w.addSpacer();
  const foot = addText(w, `更新 ${data.updated_at || "—"}`, Font.systemFont(9), SUB);
  foot.rightAlignText();
  return w;
}

const widget = await createWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
