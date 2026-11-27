/**
 * Lantern hint: show which choice is correct. For judges and first-time
 * players who don't know the course answers.
 */
import { sfx } from '../audio/sfx';

export function hintButtonHtml(): string {
  return `<button class="hint-btn" data-hint type="button" aria-label="Hint: show the correct answer">Hint <span class="dd-kbd">H</span></button>`;
}

/**
 * Wire hint behavior to a question card. Returns cleanup function.
 * @param root The card container element
 * @param correctIndex The index of the correct answer (0-3)
 */
export function wireHint(root: HTMLElement, correctIndex: number): () => void {
  const hintBtn = root.querySelector<HTMLButtonElement>('[data-hint]');
  if (!hintBtn) return () => {};

  const reveal = () => {
    // Ignore if any choice is already disabled (answered)
    const choices = root.querySelectorAll<HTMLButtonElement>('.choice');
    const anyAnswered = Array.from(choices).some((c) => c.disabled);
    if (anyAnswered) return;

    const correctChoice = root.querySelector<HTMLButtonElement>(`.choice[data-i="${correctIndex}"]`);
    if (!correctChoice) return;

    correctChoice.classList.add('hinted');
    hintBtn.disabled = true;
    sfx('hover');
    correctChoice.focus();
  };

  const onClick = () => reveal();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      e.stopPropagation();
      reveal();
    }
  };

  hintBtn.addEventListener('click', onClick);
  window.addEventListener('keydown', onKey, true);

  return () => {
    hintBtn.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKey, true);
  };
}
