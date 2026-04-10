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

const app = document.querySelector("#app");
const flash = document.querySelector("#flash");

const state = loadState();

if (state.phase === "result" && !isQuizComplete(state.answers)) {
  state.phase = "intro";
}

render();
bindGlobalEvents();

function loadState() {
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
        <p class="hero-text">
          这是一份带点抽象感的趣味人格测试。全站纯前端计算，不需要后端、不需要 Python，
          所有结果都在浏览器本地完成。
        </p>
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
            <button class="btn btn-primary" data-action="copy-result">复制结果摘要</button>
            <button class="btn btn-secondary" data-action="restart">重新测试</button>
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
