import { computeResult } from "../public/logic.js";

function buildAnswers(fillValue, drinkValue = 1) {
  const answers = {};
  for (let index = 1; index <= 30; index += 1) {
    answers[`q${index}`] = fillValue;
  }
  answers.drink_gate_q1 = drinkValue;
  return answers;
}

const scenarios = [
  {
    name: "all_low",
    answers: buildAnswers(1, 1),
    expected: {
      final: "IMSB",
      badge: "匹配度 83% · 精准命中 10/15 维",
      secondary: null,
    },
  },
  {
    name: "all_high",
    answers: buildAnswers(3, 4),
    expected: {
      final: "CTRL",
      badge: "匹配度 87% · 精准命中 11/15 维",
      secondary: null,
    },
  },
  {
    name: "all_mid",
    answers: buildAnswers(2, 2),
    expected: {
      final: "OJBK",
      badge: "匹配度 83% · 精准命中 10/15 维",
      secondary: null,
    },
  },
  {
    name: "drunk_override",
    answers: {
      ...buildAnswers(2, 3),
      drink_gate_q2: 2,
    },
    expected: {
      final: "DRUNK",
      badge: "匹配度 100% · 酒精异常因子已接管",
      secondary: "OJBK",
    },
  },
  {
    name: "hhhh_fallback",
    answers: {
      q1: 1,
      q2: 1,
      q3: 1,
      q4: 1,
      q5: 2,
      q6: 1,
      q7: 1,
      q8: 1,
      q9: 1,
      q10: 2,
      q11: 3,
      q12: 3,
      q13: 3,
      q14: 3,
      q15: 1,
      q16: 1,
      q17: 2,
      q18: 3,
      q19: 3,
      q20: 2,
      q21: 3,
      q22: 3,
      q23: 3,
      q24: 1,
      q25: 2,
      q26: 3,
      q27: 1,
      q28: 1,
      q29: 1,
      q30: 1,
      drink_gate_q1: 1,
    },
    expected: {
      final: "HHHH",
      badge: "标准人格库最高匹配仅 57%",
      secondary: null,
    },
  },
];

for (const scenario of scenarios) {
  const result = computeResult(scenario.answers);
  const actual = {
    final: result.final_type.code,
    badge: result.badge,
    secondary: result.secondary_type?.code ?? null,
  };

  if (
    actual.final !== scenario.expected.final ||
    actual.badge !== scenario.expected.badge ||
    actual.secondary !== scenario.expected.secondary
  ) {
    throw new Error(
      `${scenario.name} failed.\nExpected: ${JSON.stringify(
        scenario.expected,
      )}\nActual: ${JSON.stringify(actual)}`,
    );
  }
}

console.log("SBTI logic verification passed.");
