/**
 * Practice trial (R16): five questions for one course in a grimoire overlay.
 * Correct answers earn sparks that forge the course's tower (studying =
 * weapons). Wrong answers only show the explanation: no punishment.
 * Keyboard: 1-4 answer, Enter continue, Esc close.
 */
import { gsap } from 'gsap';
import { mountLayer } from './stage';
import { pickTrial, recordSession, readinessFor, questionsFor, SPARKS_PER_LEVEL, type Question } from '../study/model';
import { getSemester } from '../study/model';
import { prefersReducedMotion } from '../game/fx/Atmosphere';
import { sfx } from '../audio/sfx';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function openTrial(courseId: string, onClose: () => void): void {
  const course = getSemester().courses.find((c) => c.id === courseId);
  const title = course?.title ?? courseId;
  const questions: Question[] = pickTrial(courseId, 5);
  if (!questions.length) {
    onClose();
    return;
  }
  const before = readinessFor(courseId);
  const answers: { questionId: string; correct: boolean }[] = [];
  let idx = 0;
  let locked = false;
  const reduced = prefersReducedMotion();
  const prevFocus = document.activeElement as HTMLElement | null;

  const layer = mountLayer('overlay trial', `<div class="grimoire" role="dialog" aria-modal="true" aria-labelledby="trial-title"></div>`);
  const page = layer.querySelector<HTMLDivElement>('.grimoire')!;
  if (!reduced) {
    gsap.from(layer, { opacity: 0, duration: 0.25 });
    gsap.from(page, { y: 40, rotateX: 8, opacity: 0, duration: 0.5, ease: 'power3.out' });
  }

  const pips = () =>
    `<div class="pips" aria-hidden="true">${questions
      .map((_, i) => `<i class="${i < answers.length ? (answers[i].correct ? 'ok' : 'bad') : i === idx ? 'cur' : ''}"></i>`)
      .join('')}</div>`;

  const showQuestion = () => {
    locked = false;
    const q = questions[idx];
    page.innerHTML = `
      <button class="close-x" aria-label="Close trial">&times;</button>
      <div class="g-eyebrow">Trial of ${esc(title)} &middot; ${idx + 1} of ${questions.length}</div>
      <h2 id="trial-title">${esc(q.topic ?? 'Study checkpoint')}</h2>
      <p class="q">${esc(q.question)}</p>
      <div class="choices" role="group" aria-label="Answers">
        ${q.choices.map((c, i) => `<button class="choice" data-i="${i}"><span class="k">${i + 1}</span><span>${esc(c)}</span></button>`).join('')}
      </div>
      <p class="explain" aria-live="polite"></p>
      <div class="g-foot">${pips()}<span>Keys 1–4 to answer &middot; Esc to leave</span></div>`;
    page.querySelector('.close-x')!.addEventListener('click', close);
    page.querySelectorAll<HTMLButtonElement>('.choice').forEach((b) => b.addEventListener('click', () => answer(+b.dataset.i!)));
    page.querySelector<HTMLButtonElement>('.choice')?.focus();
    if (!reduced) gsap.from(page.querySelectorAll('.q, .choice'), { opacity: 0, y: 8, stagger: 0.04, duration: 0.3 });
  };

  const answer = (i: number) => {
    if (locked) return;
    const q = questions[idx];
    if (i < 0 || i >= q.choices.length) return;
    locked = true;
    const correct = i === q.correctIndex;
    answers.push({ questionId: q.id, correct });
    sfx(correct ? 'correct' : 'wrong');
    const btns = page.querySelectorAll<HTMLButtonElement>('.choice');
    btns.forEach((b) => (b.disabled = true));
    btns[q.correctIndex].classList.add('right');
    if (!correct) btns[i].classList.add('wrong');
    const ex = page.querySelector<HTMLParagraphElement>('.explain')!;
    ex.textContent = (correct ? 'Correct. ' : `Not quite: the answer is “${q.choices[q.correctIndex]}”. `) + (q.explain ?? '');
    page.querySelector('.g-foot')!.innerHTML = `${pips()}<button class="dd-btn" data-next>${idx + 1 < questions.length ? 'Next' : 'Seal the trial'}<span class="dd-kbd">Enter</span></button>`;
    const next = page.querySelector<HTMLButtonElement>('[data-next]')!;
    next.addEventListener('click', advance);
    next.focus();
    if (!reduced && correct) gsap.fromTo(btns[q.correctIndex], { scale: 1 }, { scale: 1.04, yoyo: true, repeat: 1, duration: 0.15 });
    if (!reduced && !correct) gsap.fromTo(btns[i], { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
  };

  const advance = () => {
    if (!locked) return;
    idx++;
    if (idx < questions.length) showQuestion();
    else finish();
  };

  const finish = () => {
    const gain = recordSession(courseId, answers, 'trial');
    const after = readinessFor(courseId);
    const correct = answers.filter((a) => a.correct).length;
    const missedTopics = [
      ...new Set(answers.filter((a) => !a.correct).map((a) => questions.find((q) => q.id === a.questionId)?.topic).filter(Boolean)),
    ];
    sfx(gain.levelsGained ? 'forge' : 'seal');
    page.innerHTML = `
      <button class="close-x" aria-label="Close">&times;</button>
      <div class="g-eyebrow">Trial of ${esc(title)} &middot; sealed</div>
      <div class="result-big">${correct} / ${answers.length}</div>
      <div class="result-lines">
        Readiness <b>${before}% → ${after}%</b><br/>
        ${
          gain.levelsGained
            ? `The forge roars: <b>${esc(title)} tower reaches level ${gain.level}</b>.`
            : correct
              ? `${correct} spark${correct > 1 ? 's' : ''} gathered for the ${esc(title)} forge (${SPARKS_PER_LEVEL} per level).`
              : 'No sparks this time. Every wrong answer shows you exactly what to revisit.'
        }<br/>
        ${missedTopics.length ? `Revisit: <b>${missedTopics.map((t) => esc(String(t))).join(', ')}</b>` : correct === answers.length ? 'A flawless trial.' : ''}
      </div>
      <div class="actions">
        <button class="dd-btn" data-again>Another trial<span class="dd-kbd">T</span></button>
        <button class="dd-btn secondary" data-done>Back to the War Room<span class="dd-kbd">Esc</span></button>
      </div>
      <div class="g-foot"><span>${questionsFor(courseId).length} questions in this course's grimoire</span></div>`;
    page.querySelector('.close-x')!.addEventListener('click', close);
    page.querySelector('[data-done]')!.addEventListener('click', close);
    page.querySelector('[data-again]')!.addEventListener('click', () => {
      cleanup();
      openTrial(courseId, onClose);
    });
    page.querySelector<HTMLButtonElement>('[data-done]')!.focus();
    if (!reduced) gsap.from(page.querySelector('.result-big'), { scale: 0.6, opacity: 0, duration: 0.6, ease: 'back.out(2)' });
    idx = questions.length;
    locked = true;
  };

  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (/^[1-4]$/.test(e.key) && idx < questions.length && !locked) {
      e.preventDefault();
      answer(+e.key - 1);
    } else if (e.key === 'Enter' && locked && idx < questions.length) {
      e.preventDefault();
      advance();
    } else if ((e.key === 't' || e.key === 'T') && idx >= questions.length) {
      page.querySelector<HTMLButtonElement>('[data-again]')?.click();
    }
  };
  window.addEventListener('keydown', onKey, true);

  const cleanup = () => {
    window.removeEventListener('keydown', onKey, true);
    layer.remove();
  };
  function close() {
    // Answers given before leaving early still count (and still only reward correct ones).
    if (idx < questions.length && answers.length) recordSession(courseId, answers, 'trial');
    cleanup();
    prevFocus?.focus?.();
    onClose();
  }

  showQuestion();
}
