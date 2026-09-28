/* Daoyu Studio —— 书名工场 + 导语（岛屿）体检
 * 规则移植自 novel-ai-writing-system 两个 skill：
 *   skills/novel-title-daoyan-generator（四风格书名/导言模板、钩子五类）
 *   skills/female-short-fiction-daoyu（第一句四要素60分及格线、伤害三维度、自检清单）
 *
 * 命令：
 *   书名工场     —— 填核心词，按四风格模板生成书名候选，点击插入
 *   插入导语模板 —— 选风格+结构模板，把带占位符的骨架插入当前笔记
 *   导语体检     —— 对选中内容/笔记开头若干段跑规则打分，报告可插回笔记
 */
const { Plugin, Modal, Notice, PluginSettingTab, Setting, MarkdownView } = require("obsidian");

// ================= 书名模板库（四风格） =================
// 占位符：{冲突} {身份} {反派} {物品} {数字} {关系}
const TITLE_TEMPLATES = {
  fanqie: {
    label: "番茄风（8-25字）",
    items: [
      "{身份}死后，{反派}疯了",
      "第{数字}次{冲突}，我掀了桌",
      "{反派}连夜{冲突}，我笑出了声",
      "重回{数字}年，我不再{冲突}",
      "{身份}不装了，{反派}跪着求我",
      "他们说{冲突}，可我{冲突}过一次了",
      "{身份}觉醒后，全家火葬场",
    ],
  },
  zhihu: {
    label: "知乎风（4-10字）",
    items: [
      "{物品}不甜了",
      "这一次，不{冲突}",
      "{身份}的最后一盒{物品}",
      "我不{冲突}了",
      "{物品}与我",
      "第{数字}年，清账",
    ],
  },
  emotion: {
    label: "知乎情绪流（4-8字古风短词）",
    items: [
      "{物品}凉透",
      "不再侍君前",
      "{身份}断情日",
      "第{数字}年冬",
      "此生不欠",
      "{物品}未拆封",
    ],
  },
  world: {
    label: "小程序世情风（15-30字书名即梗概）",
    items: [
      "在{反派}家住{数字}年，他们却让我滚出我家",
      "我帮{反派}带了{数字}年孩子，亲孙子回来那天他们翻脸了",
      "退休金{数字}块全给{反派}，住院那天没一个人来",
      "{冲突}那晚，全家都在{反派}的饭局上",
      "把老宅让给{反派}第{数字}年，他们逼我把户口迁走",
    ],
  },
};

// ================= 导言结构模板（插入用骨架） =================
const DAOYU_TEMPLATES = {
  fanqie: {
    label: "番茄风",
    note: "一句一段≥70%，句长8-18字，100-200字；钩子偏炸（倒计时/反讽）",
    items: [
      ["A 倒叙开场式", "当第{N}次{重复行为}时，{核心冲突爆发}。\n我{关键行动}。\n「{高张力对话}」\n后来我才知道，{真相}。\n{倒计时/反讽钩子}"],
      ["B 自曝独白式", "我的{身份}，是我用{不光彩的方式}得来的。\n所有人都在觊觎我的{珍视之物}。\n而我，十分熟悉他们的手段。\n因为那是我来时的路。\n{钩子}"],
      ["C 对比反转式", "{某人}病中需要{某物}，{负心人}连夜买了来。\n待我躺在同一家医院，他却连电话都不接。\n此刻，我决定{关键行动}。\n{钩子}"],
      ["D 今生觉醒式", "上一世，{关键事件}。\n我{悲惨结局}。\n这一世，同一出戏重新开锣。\n「好，我{关键行动}。」\n{钩子}"],
    ],
  },
  zhihu: {
    label: "知乎风",
    note: "必须有记忆锚点物品；结尾必须是新选择；钩子呼应锚点物品",
    items: [
      ["A 物品符号浓缩式", "{某人}最爱吃{物品}，第一份永远让给TA。\n我偷偷{越界}，被说「{压制式回应}」。\n让着让着，连{更珍贵}也让了。\n{命运转折}。\n重来，我{不同选择}。\n{呼应锚点的钩子}"],
      ["B 炸裂设定式", "为了{动机}，我{极端的事}。\n结果{意外后果}。\n眼看藏不住了，我却发现{致命信息}。\n我{逃跑/反转}。\n{钩子}"],
      ["C 禁忌引爆式", "被{关键人物}发现{秘密}后，TA{做了某事}。\n我赌气{试探}。\n「{高张力对话}」\n他却{彻底爆发}。\n{钩子}"],
    ],
  },
  emotion: {
    label: "知乎情绪流",
    note: "数字实感+对比陈列≥3组+物品锚点；钩子用沉默/画面，有余味",
    items: [
      ["A 对比虐心式（追妻火葬场）", "{某人}{做某事}时，{对比}。\n待我{同样情境}，{差别对待}。\n{第三方}劝我{认命话}。\n可分明{真相}。\n怎么到了如今，{反问爆发}？\n{沉默式钩子}"],
      ["B 身份定位+命运浓缩式", "我是{身份}。\n{时间点}，便{处境}。\n{命运简述，用数字}。\n{关键人物}素来{态度}。\n直到{爆发事件}——\n{高密度情绪句3-5句}\n{钩子}"],
      ["C 替身/工具人觉醒式", "{关键人物}把我{当工具}。\n{处境}。\n直到我得知，{残酷真相}。\n重来，{同一情境}，我{反抗行动}。\n{钩子}"],
    ],
  },
  world: {
    label: "小程序世情风",
    note: "一件具体小事引爆+公开场合+金钱暗线+亲人沉默；钩子指向「他们还不知道」",
    items: [
      ["A 好心被辜负式", "在{亲属家}住了{时间}，{对方}突然叫我去{地点}，说{指责}。\n{账单/证据}摊在桌上。\n我看{炫耀反差}。\n虽心寒，我仍{表面顺从}。\n我暗暗开始{暗中布局}。\n他们不知道，{我的隐藏底牌}。\n{倒计时钩子}"],
      ["B 一件小事引爆式", "做{小事}时，我发现了{引爆事件}。\n{对方公开行为}，配上{证据}。\n「{抱怨内容}」刷了满屏。\n看着{关键人处境}，我突然累了。\n我{反击行动}。\n{钩子}"],
      ["C 公开羞辱式", "{对方}在群里@我，说{过分指控}。\n{羞辱言论}一句接一句。\n本该帮我的{关键人}，一声不吭。\n我当场{反击}。\n他们得寸进尺。\n我{釜底抽薪}。\n{钩子}"],
    ],
  },
};

// ================= 体检规则 =================
// 时间词（≤5字抢节奏）：命中即认为有"时间"要素
const TIME_WORDS = ["毕业", "结婚", "年夜饭", "除夕", "国庆", "五一", "暑假", "军训", "年会", "周年", "大婚", "重生", "穿越", "那年", "今天", "生日", "民国", "末世", "大旱", "雪夜", "凌晨", "深夜", "清晨", "高考", "订婚", "出嫁", "丧事", "忌日"];
// 公开化场合（地点）
const PLACE_WORDS = ["高铁", "飞机", "游轮", "雪山", "校园", "公司", "婚礼", "宴会", "教室", "食堂", "直播间", "群里", "商场", "餐厅", "医院", "车站", "机场", "广场", "办公室", "会议室", "祠堂", "朝堂", "大殿", "村口", "自驾", "露营", "聚会"];
// 身体伤害（禁止）
const HARM_BODY = ["耳光", "下跪", "推搡", "泼", "扇了", "踹", "掐", "拽头发", "打了一顿", "棍棒", "鞭"];
// 大钱（禁止，出戏）
const BIG_MONEY = /[几\d]+[千百]?[万亿][多]?|[九八六五四三二一]+[千]万/;
const SMALL_MONEY = /(?:迟到扣|罚|扣了?)\s*\d{1,4}|[一两二三四五六七八九十几]\s*[块块钱百元]/;
// AI 禁词（生成导语时也适用）
const AI_BANNED = ["猛地", "骤然", "陡然", "下意识", "一愣", "怔住", "凝滞", "凝固", "僵住", "极其", "十分", "非常", "格外", "异常", "无比", "仿佛", "似乎", "如同", "心里某个地方", "不是……而是", "不是…而是"];
// 高位/信息差提示词
const HIGH_STATUS = ["公司是", "集团", "老爷子", "总裁", "千金", "真千金", "继承人", "大小姐", "首富", "资助", "我出钱", "我养的", "我买的"];
// 结尾梗
const END_TROPES = [["重生", "重生"], ["死人", "死人文学"], ["断亲", "断亲"], ["尊重他人命运", "尊重他人命运"], ["回到这", "重生"], ["睁眼", "重生"]];

const DEFAULT_SETTINGS = { reportFolder: "导语体检" };

module.exports = class DaoyuStudio extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addRibbonIcon("studio", "Daoyu Studio", () => this.showMenu());
    this.addCommand({ id: "title-factory", name: "书名工场", callback: () => new TitleModal(this).open() });
    this.addCommand({ id: "insert-template", name: "插入导语模板", callback: () => new TemplateModal(this).open() });
    this.addCommand({ id: "check-daoyu", name: "导语体检（选中/笔记开头）", callback: () => this.checkDaoyu() });
    this.addSettingTab(new StudioSettingTab(this.app, this));
  }
  async saveSettings() { await this.saveData(this.settings); }

  showMenu() {
    const m = new Modal(this.app);
    m.contentEl.createEl("h3", { text: "Daoyu Studio" });
    const mk = (label, desc, fn) => {
      const b = m.contentEl.createEl("button", { text: label });
      b.style.cssText = "display:block; width:100%; margin-bottom:6px; padding:8px;";
      b.onclick = () => { m.close(); fn(); };
      m.contentEl.createEl("div", { text: desc, attr: { style: "font-size:11px; color:var(--text-muted); margin:-4px 0 8px;" } });
    };
    mk("🏷 书名工场", "填核心词 → 四风格模板生成书名候选", () => new TitleModal(this).open());
    mk("📄 插入导语模板", "四风格结构骨架（带占位符）插入笔记", () => new TemplateModal(this).open());
    mk("🩺 导语体检", "四要素+伤害维度+自检清单打分", () => this.checkDaoyu());
    m.open();
  }

  /** 取要体检的文本：选中内容，否则笔记前 400 字 */
  targetText() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return null;
    const sel = view.editor.getSelection();
    if (sel && sel.trim()) return { text: sel, editor: view.editor, fromSelection: true };
    const t = view.editor.getValue().replace(/^---[\s\S]*?---\n/, "").replace(/^#.*$/gm, "").trim();
    return { text: t.slice(0, 400), editor: view.editor, fromSelection: false };
  }

  checkDaoyu() {
    const t = this.targetText();
    if (!t || !t.text.trim()) { new Notice("没有可体检的内容"); return; }
    new ReportModal(this, t.text).open();
  }

  /** 体检报告落盘（可选保存） */
  async saveReport(report) {
    const f = this.settings.reportFolder;
    try { if (!this.app.vault.getAbstractFileByPath(f)) await this.app.vault.createFolder(f); } catch (e) {}
    await this.app.vault.create(`${f}/体检-${Date.now() % 100000}.md`, report + "\n");
    new Notice("报告已保存到 " + f);
  }
};

// ================= 书名工场 =================
class TitleModal extends Modal {
  constructor(plugin) { super(plugin.app); this.plugin = plugin; }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "🏷 书名工场" });
    contentEl.createEl("div", {
      text: "填入故事核心词，空白词的模板自动跳过。填得越具体，书名越能直接用。",
      attr: { style: "font-size:12px; color:var(--text-muted); margin-bottom:8px;" },
    });
    const fields = [
      ["冲突", "如：替嫁给残疾人 / 被全家逼着还债"],
      ["身份", "如：真千金 / 皇帝乳母 / 资助人"],
      ["反派", "如：未婚夫 / 继母 / 全家"],
      ["物品", "记忆锚点，如：荔枝膏 / 结婚证 / 工牌"],
      ["数字", "如：三 / 十五 / 130"],
    ];
    const inputs = {};
    for (const [key, ph] of fields) {
      const row = contentEl.createDiv();
      row.style.cssText = "display:flex; align-items:center; gap:8px; margin-bottom:6px;";
      row.createEl("label", { text: key, attr: { style: "width:40px; font-weight:600;" } });
      const input = row.createEl("input", { type: "text", placeholder: ph });
      input.style.flex = "1";
      inputs[key] = input;
    }
    const genBtn = contentEl.createEl("button", { text: "生成候选书名", cls: "mod-cta" });
    genBtn.style.cssText = "width:100%; margin-top:6px; padding:8px;";
    const result = contentEl.createDiv();
    result.style.cssText = "max-height:50vh; overflow-y:auto; margin-top:8px;";

    genBtn.onclick = () => {
      result.empty();
      const fill = (s) => s
        .replace(/\{冲突\}/g, inputs["冲突"].value.trim())
        .replace(/\{身份\}/g, inputs["身份"].value.trim())
        .replace(/\{反派\}/g, inputs["反派"].value.trim())
        .replace(/\{物品\}/g, inputs["物品"].value.trim())
        .replace(/\{数字\}/g, inputs["数字"].value.trim() || "三");
      let total = 0;
      for (const [style, lib] of Object.entries(TITLE_TEMPLATES)) {
        const list = lib.items.map(fill).filter((s) => !s.includes("{"));
        if (!list.length) continue;
        total += list.length;
        result.createEl("h5", { text: lib.label, attr: { style: "margin:10px 0 4px;" } });
        for (const t of list) {
          const item = result.createDiv(t);
          item.style.cssText = "padding:6px 8px; margin-bottom:4px; border:1px solid var(--background-modifier-border); border-radius:6px; cursor:pointer;";
          item.onclick = () => {
            this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor.replaceSelection(`《${t}》`);
            new Notice("已插入：" + t);
          };
        }
      }
      if (!total) result.createEl("div", { text: "至少填一个词。" });
    };
  }
}

// ================= 导语模板插入 =================
class TemplateModal extends Modal {
  constructor(plugin) { super(plugin.app); this.plugin = plugin; }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "📄 导语结构模板" });
    for (const [style, lib] of Object.entries(DAOYU_TEMPLATES)) {
      const sec = contentEl.createDiv();
      sec.createEl("h5", { text: lib.label, attr: { style: "margin:10px 0 2px;" } });
      sec.createEl("div", { text: lib.note, attr: { style: "font-size:11px; color:var(--text-muted); margin-bottom:6px;" } });
      for (const [name, body] of lib.items) {
        const item = sec.createDiv();
        item.style.cssText = "padding:6px 8px; margin-bottom:4px; border:1px solid var(--background-modifier-border); border-radius:6px; cursor:pointer;";
        item.createEl("div", { text: name, attr: { style: "font-weight:600;" } });
        item.createEl("div", { text: body.split("\n")[0] + " …", attr: { style: "font-size:12px; color:var(--text-muted);" } });
        item.onclick = () => {
          this.plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor.replaceSelection(body + "\n");
          new Notice("已插入模板：" + name);
          this.close();
        };
      }
    }
  }
}

// ================= 导语体检 =================
class ReportModal extends Modal {
  constructor(plugin, text) { super(plugin.app); this.plugin = plugin; this.text = text.replace(/\s+/g, " ").trim(); }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "🩺 导语体检报告" });
    const sentences = this.text.split(/[。！？\n]/).map((s) => s.trim()).filter((s) => s.length >= 4);
    const first = sentences[0] || "";
    const last = sentences[sentences.length - 1] || "";
    const findings = [];
    let score = 100;

    const add = (pass, weight, msg) => {
      if (!pass) score -= weight;
      findings.push({ pass, msg });
    };

    // --- 第一句四要素 ---
    const hasTime = TIME_WORDS.some((w) => first.includes(w)) || /[一-十两]\s*[年月日天]/.test(first.slice(0, 12));
    const hasPlace = PLACE_WORDS.some((w) => first.includes(w));
    const hasPeople = /(我|她|他|你).{0,12}(我|她|他|你)|他们|全家|众人|所有人/.test(first) && first.length >= 10;
    const hasEvent = first.length >= 10 && /[，,]|把|被|却|竟|突然|居然|提出|宣布|逼|要/.test(first);
    add(first.length > 0 && hasTime, 12, `第一句·时间：${hasTime ? "✅" : "❌ 缺时间要素（≤5字，抢节奏；时代背景也算）"}`);
    add(hasPlace, 12, `第一句·地点：${hasPlace ? "✅ 公开化场合" : "⚠️ 未检出公开化场合词——伤害要在公开场合扩散"}`);
    add(hasPeople, 12, `第一句·人物：${hasPeople ? "✅" : "❌ 需≥2人且关系里藏高位信息差"}`);
    add(hasEvent, 12, `第一句·事件：${hasEvent ? "✅" : "❌ 事件要违反常识才出情绪"}`);
    if (first) findings.push({ pass: null, msg: `第一句原文：「${first.slice(0, 40)}${first.length > 40 ? "…" : ""}」` });

    // --- 伤害维度 ---
    const hitBody = HARM_BODY.filter((w) => this.text.includes(w));
    add(hitBody.length === 0, 15, hitBody.length ? `❌ 身体伤害禁止出现：${hitBody.join("、")}` : "✅ 无身体伤害描写");
    const hitBig = this.text.match(BIG_MONEY);
    const hitSmall = this.text.match(SMALL_MONEY);
    add(!hitBig, 10, hitBig ? `❌ 大钱出戏：「${hitBig[0]}」——钱只能写小钱` : (hitSmall ? "✅ 有小钱实感" : "⚠️ 未检出金钱线（可选：小钱伤害+公开羞辱叠加）"));

    // --- 高位信息差前置 ---
    const high = HIGH_STATUS.some((w) => first.includes(w) || (sentences[1] || "").includes(w));
    add(high || true, 0, high ? "✅ 高位/信息差已前置" : "⚠️ 未检出高位信息差——若是高位打脸文，第一二句就要写出来，禁止结尾反转");

    // --- AI 禁词 ---
    const hitAI = AI_BANNED.filter((w) => this.text.includes(w));
    add(hitAI.length === 0, 10, hitAI.length ? `❌ AI高频词：${hitAI.join("、")}` : "✅ 无AI高频词");

    // --- 结尾钩子 ---
    const endTrope = END_TROPES.filter(([, n]) => last.includes(n) || last.includes("重生"));
    const tropeNames = endTrope.map(([, n]) => n);
    add(endTrope.length === 1, 8, endTrope.length === 1 ? `✅ 结尾梗：${tropeNames[0]}` : endTrope.length > 1 ? "❌ 检出多个结尾梗——一篇文只能有一个结尾钩子" : "⚠️ 结尾未检出结尾梗（重生/死人文学/断亲/尊重他人命运）");
    add(last.length >= 4, 7, last.length >= 4 ? "⚠️ 钩子建议藏一半露一半，用画面/台词，越短越狠" : "❌ 缺结尾句");

    // --- 渲染 ---
    const badge = score >= 85 ? "🟢" : score >= 70 ? "🟡" : "🔴";
    const scoreEl = contentEl.createDiv();
    scoreEl.style.cssText = "font-size:20px; font-weight:700; margin-bottom:8px;";
    scoreEl.setText(`${badge} 得分 ${Math.max(0, score)} / 100（60 分及格线，不足 60 编辑第一眼杀稿）`);

    const listEl = contentEl.createDiv();
    listEl.style.cssText = "max-height:45vh; overflow-y:auto;";
    for (const f of findings) {
      const row = listEl.createDiv();
      row.style.cssText = "padding:5px 8px; margin-bottom:4px; border-left:3px solid " +
        (f.pass === true ? "var(--text-success)" : f.pass === false ? "var(--text-error)" : "var(--text-muted)") +
        "; background:var(--background-secondary); border-radius:4px; font-size:13px;";
      row.setText((f.pass === true ? "✅ " : f.pass === false ? "❌ " : "ℹ️ ") + f.msg);
    }

    const btns = contentEl.createDiv();
    btns.style.cssText = "display:flex; gap:8px; justify-content:flex-end; margin-top:10px;";
    const save = btns.createEl("button", { text: "保存报告" });
    save.onclick = () => {
      const lines = ["# 导语体检报告", "", `- 得分：${Math.max(0, score)}/100`, "", ...findings.map((f) => `- ${f.pass === true ? "✅" : f.pass === false ? "❌" : "ℹ️"} ${f.msg}`), "", "> 规则来自 review-engine 女频导语评审 skill", ""];
      this.plugin.saveReport(lines.join("\n"));
      this.close();
    };
    const close = btns.createEl("button", { text: "关闭" });
    close.onclick = () => this.close();
  }
}

class StudioSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("体检报告保存文件夹").addText((t) =>
      t.setValue(this.plugin.settings.reportFolder).onChange(async (v) => {
        this.plugin.settings.reportFolder = v.trim() || "导语体检";
        await this.plugin.saveSettings();
      }));
  }
}
