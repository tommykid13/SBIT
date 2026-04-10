import {
  DIMENSION_META,
  DIMENSION_ORDER,
  DIM_EXPLANATIONS,
  DRUNK_TRIGGER_QUESTION_ID,
  IMAGE_MAP,
  NORMAL_TYPES,
  QUESTIONS,
  SPECIAL_QUESTIONS,
  TYPE_LIBRARY,
} from "./data.js";

export function sumToLevel(score) {
  if (score <= 3) return "L";
  if (score === 4) return "M";
  return "H";
}

export function levelToNumber(level) {
  return { L: 1, M: 2, H: 3 }[level];
}

export function parsePattern(pattern) {
  return pattern.replaceAll("-", "").split("");
}

export function getQuizSequence(answers = {}) {
  const sequence = [...QUESTIONS, SPECIAL_QUESTIONS[0]];
  if (answers.drink_gate_q1 === 3) {
    sequence.push(SPECIAL_QUESTIONS[1]);
  }
  return sequence;
}

export function isQuizComplete(answers = {}) {
  return getQuizSequence(answers).every((question) => question.id in answers);
}

export function getImagePath(typeCode) {
  return IMAGE_MAP[typeCode] ?? IMAGE_MAP.HHHH;
}

export function getThemeForType(typeCode) {
  const seed = [...typeCode].reduce((total, char) => total + char.charCodeAt(0), 0);
  const hue = seed % 360;
  return {
    accent: `hsl(${hue} 74% 56%)`,
    accentStrong: `hsl(${hue} 78% 48%)`,
    accentSoft: `hsl(${hue} 92% 64% / 0.18)`,
    accentDark: `hsl(${hue} 40% 18%)`,
  };
}

export function computeRankings(answers) {
  const rawScores = Object.fromEntries(
    Object.keys(DIMENSION_META).map((dimension) => [dimension, 0]),
  );

  for (const question of QUESTIONS) {
    if (question.id in answers) {
      rawScores[question.dim] += Number(answers[question.id]);
    }
  }

  const levels = Object.fromEntries(
    Object.entries(rawScores).map(([dimension, score]) => [dimension, sumToLevel(score)]),
  );

  const userVector = DIMENSION_ORDER.map((dimension) => levelToNumber(levels[dimension]));

  const ranked = NORMAL_TYPES.map((typeInfo) => {
    const vector = parsePattern(typeInfo.pattern).map(levelToNumber);

    let distance = 0;
    let exact = 0;

    vector.forEach((value, index) => {
      const diff = Math.abs(userVector[index] - value);
      distance += diff;
      if (diff === 0) {
        exact += 1;
      }
    });

    const similarity = Math.max(0, Math.round((1 - distance / 30) * 100));
    const typeData = TYPE_LIBRARY[typeInfo.code];

    return {
      code: typeInfo.code,
      cn: typeData.cn,
      distance,
      exact,
      similarity,
    };
  }).sort((left, right) => {
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }
    return right.similarity - left.similarity;
  });

  return {
    rawScores,
    levels,
    ranked,
  };
}

export function computeResult(answers) {
  const { rawScores, levels, ranked } = computeRankings(answers);
  const bestNormal = ranked[0];
  const drunkTriggered = answers[DRUNK_TRIGGER_QUESTION_ID] === 2;

  let finalType;
  let modeKicker;
  let badge;
  let sub;
  let special = false;
  let secondaryType = null;
  let bestNormalPublic = bestNormal;

  if (drunkTriggered) {
    finalType = TYPE_LIBRARY.DRUNK;
    modeKicker = "隐藏人格已激活";
    badge = "匹配度 100% · 酒精异常因子已接管";
    sub = "乙醇亲和性过强，系统已直接跳过常规人格审判。";
    special = true;
    secondaryType = bestNormal;
    bestNormalPublic = null;
  } else if (bestNormal.similarity < 60) {
    finalType = TYPE_LIBRARY.HHHH;
    modeKicker = "系统强制兜底";
    badge = `标准人格库最高匹配仅 ${bestNormal.similarity}%`;
    sub = "标准人格库对你的脑回路集体罢工了。";
    special = true;
  } else {
    finalType = TYPE_LIBRARY[bestNormal.code];
    modeKicker = "你的主类型";
    badge = `匹配度 ${bestNormal.similarity}% · 精准命中 ${bestNormal.exact}/15 维`;
    sub = "维度命中度较高，当前结果可视为你的第一人格画像。";
  }

  return {
    final_type: finalType,
    mode_kicker: modeKicker,
    badge,
    sub,
    special,
    levels,
    raw_scores: rawScores,
    best_normal: bestNormalPublic,
    nearest_normal: bestNormal,
    secondary_type: secondaryType,
    ranked,
    image_path: getImagePath(finalType.code),
  };
}

export function buildDimensionCards(result) {
  return DIMENSION_ORDER.map((dimension) => ({
    code: dimension,
    name: DIMENSION_META[dimension].name,
    model: DIMENSION_META[dimension].model,
    level: result.levels[dimension],
    score: result.raw_scores[dimension],
    explanation: DIM_EXPLANATIONS[dimension][result.levels[dimension]],
  }));
}

export function groupDimensionsByModel(result) {
  const grouped = new Map();

  for (const item of buildDimensionCards(result)) {
    if (!grouped.has(item.model)) {
      grouped.set(item.model, []);
    }
    grouped.get(item.model).push(item);
  }

  return [...grouped.entries()].map(([model, items]) => ({ model, items }));
}

export function buildShareText(result) {
  const lines = [
    "我的 SBTI 测试结果",
    `${result.final_type.code} · ${result.final_type.cn}`,
    result.badge,
    result.final_type.intro,
    "",
    "十五维概览",
  ];

  for (const dimension of DIMENSION_ORDER) {
    lines.push(
      `${DIMENSION_META[dimension].name}: ${result.levels[dimension]} (${result.raw_scores[dimension]} 分)`,
    );
  }

  return lines.join("\n");
}
