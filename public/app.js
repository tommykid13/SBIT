import { MODEL_ORDER, MODEL_SUMMARY } from "./data.js";
import {
  buildShareText,
  computeResult,
  getImagePath,
  getQuizSequence,
  getThemeForType,
  groupDimensionsByModel,
  isQuizComplete,
} from "./logic.js";

const STORAGE_KEY = "sbti-personality-test-state-v1";
const SHARE_QUERY_KEY = "sbti";

const app = document.querySelector("#app");
const flash = document.querySelector("#flash");

const state = loadState(getSharedAnswersFromLocation());

if (state.phase === "result" && !isQuizComplete(state.answers)) {
  state.phase = "intro";
}

render();
bindGlobalEvents();

function loadState(sharedAnswers = null) {
  if (sharedAnswers && isQuizComplete(sharedAnswers)) {
    return {
      phase: "result",
      currentIndex: Math.max(getQuizSequence(sharedAnswers).length - 1, 0),
      answers: sharedAnswers,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    return {
      phase: parsed.phase ?? "intro",
      currentIndex: Number.isInteger(parsed.currentIndex) ? parsed.currentIndex : 0,
      answers: parsed.answers ?? {},
    };
  } catch {
    return createDefaultState();
  }
}

function createDefaultState() {
  return {
    phase: "intro",
    currentIndex: 0,
    answers: {},
  };
}

function persistState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearState() {
  state.phase = "intro";
  state.currentIndex = 0;
  state.answers = {};
  persistState();
  render();
}

function bindGlobalEvents() {
  document.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;

    if (action === "start") {
      state.answers = {};
      state.currentIndex = 0;
      state.phase = "quiz";
      persistState();
      render();
      return;
    }

    if (action === "resume") {
      state.phase = isQuizComplete(state.answers) ? "result" : "quiz";
      persistState();
      render();
      return;
    }

    if (action === "restart") {
      clearState();
      return;
    }

    if (action === "back") {
      if (state.currentIndex > 0) {
        state.currentIndex -= 1;
        state.phase = "quiz";
      } else {
        state.phase = "intro";
      }
      persistState();
      render();
      return;
    }

    if (action === "answer") {
      submitAnswer(target.dataset.questionId, Number(target.dataset.value));
      return;
    }

    if (action === "copy-result") {
      if (!isQuizComplete(state.answers)) return;
      const text = buildShareText(computeResult(state.answers));
      try {
        await navigator.clipboard.writeText(text);
        showFlash("结果摘要已复制到剪贴板。");
      } catch {
        showFlash("复制失败了，可能是浏览器权限拦截。");
      }
      return;
    }

    if (action === "share-result") {
      if (!isQuizComplete(state.answers)) return;
      await shareResult();
      return;
    }

    if (action === "download-card") {
      if (!isQuizComplete(state.answers)) return;
      await downloadResultCard();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (state.phase !== "quiz") return;
    if (!["1", "2", "3", "4"].includes(event.key)) return;

    const question = getQuizSequence(state.answers)[state.currentIndex];
    if (!question) return;

    const option = question.options[Number(event.key) - 1];
    if (!option) return;

    submitAnswer(question.id, option.value);
  });
}

function submitAnswer(questionId, value) {
  state.answers[questionId] = value;
  if (questionId === "drink_gate_q1" && value !== 3) {
    delete state.answers.drink_gate_q2;
  }

  const sequence = getQuizSequence(state.answers);
  const questionIndex = sequence.findIndex((question) => question.id === questionId);
  const nextIndex = questionIndex + 1;

  if (nextIndex >= sequence.length) {
    state.phase = "result";
    state.currentIndex = sequence.length - 1;
  } else {
    state.phase = "quiz";
    state.currentIndex = nextIndex;
  }

  persistState();
  render();
}

function render() {
  if (state.phase === "quiz") {
    renderQuiz();
  } else if (state.phase === "result" && isQuizComplete(state.answers)) {
    renderResult();
  } else {
    renderIntro();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderIntro() {
  const answeredCount = Object.keys(state.answers).length;
  const hasProgress = answeredCount > 0;
  const canViewResult = isQuizComplete(state.answers);

  app.innerHTML = `
    <section class="hero-panel">
      <div class="hero-copy">
        <p class="eyebrow">SBTI Personality Test</p>
        <h1>把你的脑回路拆成 <span>15 个维度</span> 再重新拼回去。</h1>
        <div class="hero-actions">
          <button class="btn btn-primary" data-action="start">开始测试</button>
          ${
            hasProgress
              ? `<button class="btn btn-secondary" data-action="resume">${
                  canViewResult ? "查看上次结果" : "继续上次作答"
                }</button>`
              : ""
          }
        </div>
        <div class="metric-row">
          <article class="metric-card">
            <strong>30</strong>
            <span>道核心题</span>
          </article>
          <article class="metric-card">
            <strong>15</strong>
            <span>个维度</span>
          </article>
          <article class="metric-card">
            <strong>25+</strong>
            <span>种人格结果</span>
          </article>
        </div>
      </div>
      <div class="hero-aside">
        <div class="aside-card">
          <p class="aside-label">本站特点</p>
          <ul class="plain-list">
            <li>浏览器本地算分，不走服务器</li>
            <li>支持中途暂停，下次继续</li>
            <li>自带隐藏人格与兜底机制</li>
          </ul>
        </div>
        <div class="aside-card muted">
          <p class="aside-label">说明</p>
          <p>题目与图片素材来自公开参考项目，仅供娱乐，不构成心理、求职、相亲或人生建议。</p>
        </div>
      </div>
    </section>

    <section class="model-section">
      <div class="section-heading">
        <p class="eyebrow">Five Lenses</p>
        <h2>测试会从五个模型看你。</h2>
      </div>
      <div class="model-grid">
        ${MODEL_SUMMARY.map(
          (item, index) => `
            <article class="model-card">
              <span class="model-index">0${index + 1}</span>
              <h3>${item.model}</h3>
              <p class="model-title">${item.title}</p>
              <p>${item.copy}</p>
            </article>
          `,
        ).join("")}
      </div>
    </section>

    <section class="footer-note">
      <div>
        <p class="eyebrow">Reference</p>
        <p>灵感参考：B 站 @蛆肉儿串儿 的 SBTI 测试改编版，以及 sing1ee 的公开实现。</p>
      </div>
      <button class="btn btn-ghost" data-action="restart">清空当前记录</button>
    </section>
  `;
}

function renderQuiz() {
  const sequence = getQuizSequence(state.answers);
  const question = sequence[state.currentIndex] ?? sequence[0];
  const progress = Math.round(((state.currentIndex + 1) / sequence.length) * 100);
  const isSpecial = Boolean(question.special);
  const currentValue = state.answers[question.id];
  const currentModel = !isSpecial ? getDimensionTitle(question.dim, true) : "";

  app.innerHTML = `
    <section class="quiz-shell">
      <header class="quiz-header">
        <button class="btn btn-ghost" data-action="back">返回</button>
        <div class="progress-wrap">
          <div class="progress-meta">
            <span>第 ${state.currentIndex + 1} / ${sequence.length} 题</span>
            <span>${progress}%</span>
          </div>
          <div class="progress-bar"><span style="width:${progress}%"></span></div>
        </div>
      </header>

      <article class="question-card ${isSpecial ? "special" : ""}">
        <div class="question-meta">
          <p class="eyebrow">${isSpecial ? "Special Gate" : "Question"}</p>
          <div class="meta-row">
            <span class="pill">${isSpecial ? "特殊问题" : "维度题"}</span>
            <span class="pill pill-soft">${
              isSpecial ? "隐藏人格判定" : `${question.dim} · ${getDimensionTitle(question.dim)}`
            }</span>
          </div>
        </div>

        <h2>${question.text}</h2>
        <div class="option-list">
          ${question.options
            .map(
              (option, index) => `
                <button
                  class="option-btn ${currentValue === option.value ? "active" : ""}"
                  data-action="answer"
                  data-question-id="${question.id}"
                  data-value="${option.value}"
                >
                  <span class="option-index">${index + 1}</span>
                  <span>${option.label}</span>
                </button>
              `,
            )
            .join("")}
        </div>
        <p class="key-hint">快捷键支持：按数字 ${question.options
          .map((_, index) => index + 1)
          .join(" / ")} 也可以作答。</p>
      </article>

      <aside class="quiz-side">
        <div class="aside-card">
          <p class="aside-label">五个模型</p>
          <ul class="plain-list model-list">
            ${MODEL_ORDER.map(
              (model) => `
                <li class="${model === currentModel ? "active" : ""}">
                  ${model}
                </li>
              `,
            ).join("")}
          </ul>
        </div>
        <div class="aside-card muted">
          <p class="aside-label">这份测试怎么判定结果？</p>
          <p>每个维度 2 题，每题 1-3 分。维度得分先映射到 L / M / H，再与人格模式库做距离匹配。</p>
        </div>
      </aside>
    </section>
  `;
}

function renderResult() {
  const result = computeResult(state.answers);
  const theme = getThemeForType(result.final_type.code);
  const dimensionGroups = groupDimensionsByModel(result);
  const topMatches = result.ranked.slice(0, 3);

  app.innerHTML = `
    <section
      class="result-shell"
      style="
        --theme-accent:${theme.accent};
        --theme-accent-strong:${theme.accentStrong};
        --theme-accent-soft:${theme.accentSoft};
        --theme-accent-dark:${theme.accentDark};
      "
    >
      <div class="result-hero">
        <div class="result-copy">
          <p class="eyebrow">${result.mode_kicker}</p>
          <h1>${result.final_type.code} <span>${result.final_type.cn}</span></h1>
          <p class="result-intro">${result.final_type.intro}</p>
          <p class="result-badge">${result.badge}</p>
          <p class="result-desc">${result.final_type.desc}</p>
          <p class="result-sub">${result.sub}</p>

          <div class="hero-actions">
            <button class="btn btn-primary" data-action="share-result">分享结果</button>
            <button class="btn btn-secondary" data-action="download-card">生成图片卡片</button>
            <button class="btn btn-ghost" data-action="restart">重新测试</button>
          </div>

          ${
            result.secondary_type
              ? `
                <div class="secondary-card">
                  <p class="eyebrow">常规人格备选</p>
                  <strong>${result.secondary_type.code} · ${result.secondary_type.cn}</strong>
                  <span>如果不触发饮酒隐藏人格，你最接近的是这个类型。</span>
                </div>
              `
              : ""
          }
        </div>

        <figure class="result-figure">
          <img src="${getImagePath(result.final_type.code)}" alt="${result.final_type.cn}" />
        </figure>
      </div>

      <section class="result-section">
        <div class="section-heading">
          <p class="eyebrow">Top Matches</p>
          <h2>最接近你的三种常规人格</h2>
        </div>
        <div class="match-grid">
          ${topMatches
            .map(
              (item, index) => `
                <article class="match-card ${index === 0 ? "featured" : ""}">
                  <span class="match-rank">#${index + 1}</span>
                  <h3>${item.code}</h3>
                  <p>${item.cn}</p>
                  <strong>${item.similarity}%</strong>
                  <span>精准命中 ${item.exact}/15 维</span>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="result-section">
        <div class="section-heading">
          <p class="eyebrow">Dimension Report</p>
          <h2>十五维拆解</h2>
        </div>
        <div class="dimension-groups">
          ${dimensionGroups
            .map(
              (group) => `
                <article class="dimension-group">
                  <h3>${group.model}</h3>
                  <div class="dimension-grid">
                    ${group.items
                      .map(
                        (item) => `
                          <div class="dimension-card">
                            <div class="dimension-head">
                              <strong>${item.name}</strong>
                              <span class="level-badge level-${item.level}">${item.level}</span>
                            </div>
                            <span class="score-tag">${item.score} 分</span>
                            <p>${item.explanation}</p>
                          </div>
                        `,
                      )
                      .join("")}
                  </div>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>

      <section class="footer-note">
        <div>
          <p class="eyebrow">Reminder</p>
          <p>这是娱乐向人格测试，结果更适合当作一种风格画像，而不是严肃心理测评。</p>
        </div>
        <button class="btn btn-ghost" data-action="start">再测一次</button>
      </section>
    </section>
  `;
}

function getDimensionTitle(dimensionCode, modelOnly = false) {
  const titleMap = {
    S1: { model: "自我模型", short: "自尊自信" },
    S2: { model: "自我模型", short: "自我清晰度" },
    S3: { model: "自我模型", short: "核心价值" },
    E1: { model: "情感模型", short: "依恋安全感" },
    E2: { model: "情感模型", short: "情感投入度" },
    E3: { model: "情感模型", short: "边界与依赖" },
    A1: { model: "态度模型", short: "世界观倾向" },
    A2: { model: "态度模型", short: "规则与灵活度" },
    A3: { model: "态度模型", short: "人生意义感" },
    Ac1: { model: "行动驱力模型", short: "动机导向" },
    Ac2: { model: "行动驱力模型", short: "决策风格" },
    Ac3: { model: "行动驱力模型", short: "执行模式" },
    So1: { model: "社交模型", short: "社交主动性" },
    So2: { model: "社交模型", short: "人际边界感" },
    So3: { model: "社交模型", short: "表达与真实度" },
  };

  return modelOnly ? titleMap[dimensionCode].model : titleMap[dimensionCode].short;
}

function showFlash(message) {
  flash.textContent = message;
  flash.classList.add("visible");
  window.clearTimeout(showFlash.timer);
  showFlash.timer = window.setTimeout(() => {
    flash.classList.remove("visible");
  }, 2400);
}

function getSharedAnswersFromLocation() {
  try {
    const url = new URL(window.location.href);
    const encoded = url.searchParams.get(SHARE_QUERY_KEY);
    if (!encoded) return null;

    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const binary = window.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function encodeAnswersForShare(answers) {
  const json = JSON.stringify(answers);
  const bytes = new TextEncoder().encode(json);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildShareUrl(answers) {
  const url = new URL(window.location.href);
  url.searchParams.set(SHARE_QUERY_KEY, encodeAnswersForShare(answers));
  return url.toString();
}

async function shareResult() {
  const result = computeResult(state.answers);
  const url = buildShareUrl(state.answers);
  const title = `${result.final_type.code} · ${result.final_type.cn}`;
  const text = `${title}\n${result.badge}\n${result.final_type.intro}`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      showFlash("分享面板已打开。");
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    showFlash("分享内容已复制到剪贴板。");
  } catch {
    showFlash("分享失败了，可能是浏览器权限拦截。");
  }
}

async function downloadResultCard() {
  try {
    const result = computeResult(state.answers);
    const blob = await createResultCardBlob(result, state.answers);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeCode = result.final_type.code.replace(/[^a-z0-9-]+/gi, "-");

    link.href = objectUrl;
    link.download = `sbti-${safeCode}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    showFlash("结果卡片已生成。");
  } catch {
    showFlash("图片卡片生成失败了，请稍后再试。");
  }
}

async function createResultCardBlob(result, answers) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas = document.createElement("canvas");
  const width = 1200;
  const height = 1600;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  const theme = getThemeForType(result.final_type.code);
  const image = await loadResultImage(getImagePath(result.final_type.code));

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#0f0b0d");
  background.addColorStop(0.55, "#1b1216");
  background.addColorStop(1, "#120f11");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = 0.45;
  context.fillStyle = theme.accentSoft;
  context.beginPath();
  context.arc(170, 220, 180, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(1000, 130, 210, 0, Math.PI * 2);
  context.fill();
  context.restore();

  drawRoundedRect(context, 52, 52, width - 104, height - 104, 42);
  context.fillStyle = "rgba(22, 18, 22, 0.82)";
  context.fill();
  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "#ffd8ad";
  context.font = "600 26px 'Noto Sans SC'";
  context.fillText("SBTI Personality Test", 96, 132);

  context.fillStyle = "#fff4df";
  context.font = "900 78px 'Noto Serif SC'";
  context.fillText(result.final_type.code, 96, 230);

  context.fillStyle = "#ffe1c0";
  context.font = "700 34px 'Noto Sans SC'";
  context.fillText(result.final_type.cn, 100, 278);

  context.fillStyle = theme.accentSoft;
  drawRoundedRect(context, 96, 318, 470, 66, 22);
  context.fill();
  context.fillStyle = "#fff5e4";
  context.font = "600 24px 'Noto Sans SC'";
  context.fillText(result.badge, 122, 360);

  context.fillStyle = "#fff7ea";
  context.font = "700 38px 'Noto Sans SC'";
  const introBottom = drawMultilineText(
    context,
    result.final_type.intro,
    96,
    446,
    530,
    52,
    2,
    "#fff7ea",
  );

  const descBottom = drawMultilineText(
    context,
    result.final_type.desc,
    96,
    introBottom + 28,
    530,
    34,
    5,
    "rgba(247, 239, 232, 0.82)",
    "500 24px 'Noto Sans SC'",
  );

  if (result.secondary_type) {
    context.fillStyle = "rgba(255,255,255,0.05)";
    drawRoundedRect(context, 96, descBottom + 28, 530, 108, 24);
    context.fill();
    context.fillStyle = "#ffd8ad";
    context.font = "600 22px 'Noto Sans SC'";
    context.fillText("常规人格备选", 122, descBottom + 70);
    context.fillStyle = "#fff3df";
    context.font = "700 28px 'Noto Sans SC'";
    context.fillText(
      `${result.secondary_type.code} · ${result.secondary_type.cn}`,
      122,
      descBottom + 104,
    );
  }

  const imageX = 680;
  const imageY = 112;
  const imageW = 420;
  const imageH = 520;
  drawRoundedRect(context, imageX, imageY, imageW, imageH, 36);
  context.save();
  context.clip();
  if (image) {
    context.drawImage(image, imageX, imageY, imageW, imageH);
  } else {
    const fallback = context.createLinearGradient(imageX, imageY, imageX + imageW, imageY + imageH);
    fallback.addColorStop(0, theme.accentSoft);
    fallback.addColorStop(1, "rgba(255,255,255,0.02)");
    context.fillStyle = fallback;
    context.fillRect(imageX, imageY, imageW, imageH);
  }
  context.restore();
  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.lineWidth = 2;
  drawRoundedRect(context, imageX, imageY, imageW, imageH, 36);
  context.stroke();

  context.fillStyle = "#ffd8ad";
  context.font = "600 24px 'Noto Sans SC'";
  context.fillText("十五维概览", 96, 790);

  const dimensionGroups = groupDimensionsByModel(result);
  const flatDimensions = dimensionGroups.flatMap((group) => group.items);
  const cardWidth = 310;
  const cardHeight = 122;
  const cardGapX = 22;
  const cardGapY = 18;

  flatDimensions.forEach((item, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 96 + col * (cardWidth + cardGapX);
    const y = 828 + row * (cardHeight + cardGapY);

    context.fillStyle = "rgba(255,255,255,0.05)";
    drawRoundedRect(context, x, y, cardWidth, cardHeight, 24);
    context.fill();

    context.fillStyle = "#fff4df";
    context.font = "700 22px 'Noto Sans SC'";
    context.fillText(item.code, x + 22, y + 38);

    context.fillStyle = "rgba(247, 239, 232, 0.78)";
    context.font = "500 18px 'Noto Sans SC'";
    context.fillText(item.name.replace(`${item.code} `, ""), x + 22, y + 70);

    context.fillStyle = getLevelColor(item.level);
    drawRoundedRect(context, x + 232, y + 18, 58, 42, 18);
    context.fill();

    context.fillStyle = "#1b1216";
    context.font = "700 20px 'Noto Sans SC'";
    context.fillText(`${item.level} · ${item.score}`, x + 245, y + 46);
  });

  context.fillStyle = "rgba(247, 239, 232, 0.72)";
  context.font = "500 22px 'Noto Sans SC'";
  context.fillText("分享链接", 96, 1496);
  drawMultilineText(
    context,
    buildShareUrl(answers),
    96,
    1532,
    1008,
    26,
    2,
    "rgba(247, 239, 232, 0.58)",
    "500 18px 'Noto Sans SC'",
  );

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Canvas export failed"));
      }
    }, "image/png");
  });
}

function drawMultilineText(
  context,
  text,
  x,
  y,
  maxWidth,
  lineHeight,
  maxLines,
  color,
  font = context.font,
) {
  context.save();
  context.font = font;
  context.fillStyle = color;

  const lines = wrapText(context, text, maxWidth);
  const visibleLines = maxLines ? lines.slice(0, maxLines) : lines;

  visibleLines.forEach((line, index) => {
    const isLast = maxLines && index === maxLines - 1 && lines.length > maxLines;
    const output = isLast ? `${line.slice(0, Math.max(line.length - 1, 1))}…` : line;
    context.fillText(output, x, y + index * lineHeight);
  });

  context.restore();
  return y + visibleLines.length * lineHeight;
}

function wrapText(context, text, maxWidth) {
  const lines = [];
  let currentLine = "";

  for (const character of text) {
    const testLine = currentLine + character;
    if (context.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = character;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function getLevelColor(level) {
  if (level === "L") return "rgba(134, 199, 255, 0.95)";
  if (level === "M") return "rgba(255, 214, 128, 0.95)";
  return "rgba(255, 145, 112, 0.95)";
}

function loadResultImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
