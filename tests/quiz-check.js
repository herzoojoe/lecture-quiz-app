// 퀴즈 자동 점검: 문제 데이터 검사 + 9가지 조합(난이도 3 × 유형 3)을 끝까지 풀어 보기
// 실행: node tests/quiz-check.js   (Playwright 필요)
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const file = "file://" + path.resolve(__dirname, "..", "index.html");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(file);

  // 1) 문제 데이터 검사
  const problems = await page.evaluate(() => {
    const out = [];
    const count = {};
    QUESTIONS.forEach((q, i) => {
      const n = `${i + 1}번 문제`;
      count[q.level] = (count[q.level] || 0) + 1;
      if (!["하", "중", "상"].includes(q.level)) out.push(`${n}: level이 하/중/상이 아님`);
      if (!q.q) out.push(`${n}: 문제(q)가 비어 있음`);
      if (!Array.isArray(q.options) || q.options.length !== 4) out.push(`${n}: 보기가 4개가 아님`);
      else if (new Set(q.options).size !== 4) out.push(`${n}: 같은 보기가 중복됨`);
      if (!Array.isArray(q.answers) || q.answers.length === 0) out.push(`${n}: 단답형 정답(answers)이 없음`);
      if (!q.explain) out.push(`${n}: 해설(explain)이 비어 있음`);
    });
    ["하", "중", "상"].forEach((lv) => {
      if (!count[lv]) out.push(`난이도 ${lv} 문제가 하나도 없음`);
    });
    return { out, count };
  });
  console.log("난이도별 문제 수:", JSON.stringify(problems.count));

  // 2) 9가지 조합을 모두 정답으로 끝까지 풀기
  const results = [];
  for (const lv of ["하", "중", "상"]) {
    for (const ty of ["mc", "short", "mix"]) {
      await page.click(`#levelGroup [data-value="${lv}"]`);
      await page.click(`#typeGroup [data-value="${ty}"]`);
      await page.click("#startBtn");
      const total = await page.evaluate(() => quiz.length);
      for (let i = 0; i < total; i++) {
        const st = await page.evaluate(() => ({
          mode: quiz[current].mode,
          options: quiz[current].options,
          correct: quiz[current].item.options[0],
          answers: quiz[current].item.answers
        }));
        if (st.mode === "mc") {
          await page.locator(".option").nth(st.options.indexOf(st.correct)).click();
        } else {
          // 대체 정답(마지막 것)을 대문자로 넣어도 맞는지 확인
          await page.fill("#answerInput", st.answers[st.answers.length - 1].toUpperCase());
          await page.press("#answerInput", "Enter");
        }
        await page.click("#nextBtn");
      }
      const score = await page.evaluate(() => score);
      results.push({ lv, ty, score, total });
      if (score !== total) problems.out.push(`난이도 ${lv} · ${ty}: 정답을 넣었는데 ${total}문제 중 ${score}개만 맞음`);
      await page.click("#homeBtn");
    }
  }
  results.forEach((r) => console.log(`난이도 ${r.lv} · ${r.ty}: ${r.total}문제 중 ${r.score}개 정답`));

  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  if (sw > 390) problems.out.push(`휴대폰 화면에서 가로로 넘침 (폭 ${sw}px)`);
  errors.forEach((e) => problems.out.push(`페이지 오류: ${e}`));
  await browser.close();

  if (problems.out.length) {
    console.log("\n❌ 문제가 있습니다:");
    problems.out.forEach((p) => console.log(" - " + p));
    process.exit(1);
  }
  console.log("\n✅ 모든 점검 통과");
})();
