import { Injectable, signal } from '@angular/core';

export type InputMode = 'english' | 'tamil' | 'tanglish';

@Injectable({
  providedIn: 'root'
})
export class TamilInputService {
  // Current input mode: 'english' | 'tamil' | 'tanglish'
  inputMode = signal<InputMode>('english');

  // Keypad Visibility state
  isKeypadVisible = signal<boolean>(false);

  // Tanglish Phonetic Typing enabled (active only in tanglish mode)
  isTanglishEnabled = signal<boolean>(false);

  // Reference to the currently active input / textarea
  activeInput = signal<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Common Tanglish dictionary mappings for ultra-accurate results
  private readonly DICTIONARY: Record<string, string> = {
    'vanakkam': 'வணக்கம்',
    'chennai': 'சென்னை',
    'kovai': 'கோவை',
    'coimbatore': 'கோயம்புத்தூர்',
    'salem': 'சேலம்',
    'madurai': 'மதுரை',
    'erode': 'ஈரோடு',
    'trichy': 'திருச்சிராப்பள்ளி',
    'tiruppur': 'திருப்பூர்',
    'vellore': 'வேலூர்',
    'tamil': 'தமிழ்',
    'thamizh': 'தமிழ்',
    'tamilnadu': 'தமிழ்நாடு',
    'amma': 'அம்மா',
    'appa': 'அப்பா',
    'anna': 'அண்ணா',
    'annanagar': 'அண்ணா நகர்',
    'nagar': 'நகர்',
    'theru': 'தெரு',
    'street': 'ஸ்ட்ரீட்',
    'road': 'ரோடு',
    'veethi': 'வீதி',
    'kovil': 'கோவில்',
    'koyil': 'கோயில்',
    'alayam': 'ஆலயம்',
    'murugan': 'முருகன்',
    'perumal': 'பெருமாள்',
    'shiva': 'சிவா',
    'siva': 'சிவா',
    'vinayagar': 'விநாயகர்',
    'ganesh': 'கணேஷ்',
    'krishna': 'கிருஷ்ணா',
    'ram': 'ராம்',
    'raja': 'ராஜா',
    'kumar': 'குமார்',
    'sri': 'ஸ்ரீ',
    'shree': 'ஸ்ரீ',
    'annamalai': 'அண்ணாமலை',
    'gandhi': 'காந்தி',
    'kamraj': 'காமராஜ்',
    'nehru': 'நேரு',
    'bharath': 'பாரத்',
    'india': 'இந்தியா',
    'nanri': 'நன்றி',
    'nalam': 'நலம்',
    'illam': 'இல்லம்',
    'bhavan': 'பவன்',
    'vilas': 'விலாஸ்',
    'complex': 'காம்ப்ளக்ஸ்',
    'apartment': 'அபார்ட்மெண்ட்',
    'flat': 'பிளாட்',
    'house': 'வீடு'
  };

  private readonly INDEPENDENT_VOWELS: [string, string][] = [
    ['shree', 'ஸ்ரீ'], ['sri', 'ஸ்ரீ'],
    ['aa', 'ஆ'], ['a', 'அ'], ['ii', 'ஈ'], ['ee', 'ஈ'], ['i', 'இ'],
    ['uu', 'ஊ'], ['oo', 'ஊ'], ['u', 'உ'], ['ae', 'ஏ'], ['ai', 'ஐ'],
    ['au', 'ஔ'], ['ow', 'ஔ'], ['e', 'எ'], ['E', 'ஏ'], ['o', 'ஒ'], ['O', 'ஓ'], ['q', 'ஃ']
  ];

  private readonly VOWEL_SIGNS: [string, string][] = [
    ['aa', '\u0BBE'], ['a', ''], ['ii', '\u0BC0'], ['ee', '\u0BC0'], ['i', '\u0BBF'],
    ['uu', '\u0BC2'], ['oo', '\u0BC2'], ['u', '\u0BC1'], ['ae', '\u0BC7'], ['ai', '\u0BC8'],
    ['au', '\u0BCC'], ['ow', '\u0BCC'], ['e', '\u0BC6'], ['E', '\u0BC7'], ['o', '\u0BCA'], ['O', '\u0BCB']
  ];

  private readonly CONSONANTS: [string, string, boolean][] = [
    ['shree', 'ஸ்ரீ', false], ['sri', 'ஸ்ரீ', false], ['ksh', 'க்ஷ', true],
    ['thth', 'த்த', true], ['chch', 'ச்ச', true], ['kk', 'க்க', true], ['pp', 'ப்ப', true],
    ['tt', 'ட்ட', true], ['mm', 'ம்ம', true], ['nn', 'ன்ன', true], ['NN', 'ண்ண', true],
    ['ndh', 'ந்த', true], ['nth', 'ந்த', true], ['ng', 'ங', true], ['nj', 'ஞ', true], ['gn', 'ஞ', true],
    ['zh', 'ழ', true], ['th', 'த', true], ['dh', 'த', true], ['sh', 'ஷ', true], ['ch', 'ச', true],
    ['k', 'க', true], ['g', 'க', true], ['s', 'ச', true], ['c', 'ச', true],
    ['t', 'ட', true], ['d', 'ட', true], ['N', 'ண', true], ['w', 'வ', true],
    ['p', 'ப', true], ['b', 'ப', true], ['m', 'ம', true], ['y', 'ய', true],
    ['r', 'ர', true], ['l', 'ல', true], ['v', 'வ', true], ['L', 'ள', true],
    ['R', 'ற', true], ['n', 'ந', true], ['j', 'ஜ', true], ['S', 'ஸ', true], ['h', 'ஹ', true]
  ];

  registerActiveInput(target: EventTarget | null): void {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      this.activeInput.set(target);
    }
  }

  /**
   * Set the current input mode:
   * - english: normal typing only, keypad hidden, transliteration off
   * - tamil: Windows on-screen keypad visible, transliteration off
   * - tanglish: phonetic typing converted on Space bar, keypad hidden
   */
  setInputMode(mode: InputMode): void {
    this.inputMode.set(mode);
    if (mode === 'english') {
      this.isKeypadVisible.set(false);
      this.isTanglishEnabled.set(false);
    } else if (mode === 'tamil') {
      this.isKeypadVisible.set(true);
      this.isTanglishEnabled.set(false);
    } else if (mode === 'tanglish') {
      this.isKeypadVisible.set(false);
      this.isTanglishEnabled.set(true);
    }
  }

  openKeypad(): void {
    this.setInputMode('tamil');
  }

  closeKeypad(): void {
    this.isKeypadVisible.set(false);
    if (this.inputMode() === 'tamil') {
      this.inputMode.set('english');
    }
  }

  toggleKeypad(): void {
    if (this.isKeypadVisible()) {
      this.closeKeypad();
    } else {
      this.openKeypad();
    }
  }

  toggleTanglish(): void {
    if (this.isTanglishEnabled()) {
      this.setInputMode('english');
    } else {
      this.setInputMode('tanglish');
    }
  }

  /**
   * Transliterate a single Tanglish word to Tamil Unicode
   */
  transliterateWord(word: string): string {
    if (!word || !word.trim()) return word;

    const lower = word.toLowerCase();
    if (this.DICTIONARY[lower]) {
      return this.DICTIONARY[lower];
    }

    let result = '';
    let i = 0;

    while (i < word.length) {
      // Keep punctuation/numbers untouched
      if (!/[a-zA-Z]/.test(word[i])) {
        result += word[i];
        i++;
        continue;
      }

      // Check consonant sequence
      let matchedConsonant: { seq: string; char: string; canCombine: boolean } | null = null;
      for (const [seq, char, canCombine] of this.CONSONANTS) {
        if (word.slice(i).toLowerCase().startsWith(seq.toLowerCase())) {
          matchedConsonant = { seq, char, canCombine };
          break;
        }
      }

      if (matchedConsonant) {
        i += matchedConsonant.seq.length;
        if (!matchedConsonant.canCombine) {
          result += matchedConsonant.char;
          continue;
        }

        // Look ahead for matching vowel sign
        let matchedVowel: { vseq: string; vchar: string } | null = null;
        for (const [vseq, vchar] of this.VOWEL_SIGNS) {
          if (word.slice(i).toLowerCase().startsWith(vseq.toLowerCase())) {
            matchedVowel = { vseq, vchar };
            break;
          }
        }

        if (matchedVowel) {
          i += matchedVowel.vseq.length;
          result += matchedConsonant.char + matchedVowel.vchar;
        } else {
          // Pure consonant with pulli / virama
          result += matchedConsonant.char + '\u0BCD';
        }
      } else {
        // Check independent vowel
        let matchedIndep: { ivseq: string; ivchar: string } | null = null;
        for (const [ivseq, ivchar] of this.INDEPENDENT_VOWELS) {
          if (word.slice(i).toLowerCase().startsWith(ivseq.toLowerCase())) {
            matchedIndep = { ivseq, ivchar };
            break;
          }
        }

        if (matchedIndep) {
          i += matchedIndep.ivseq.length;
          result += matchedIndep.ivchar;
        } else {
          result += word[i];
          i++;
        }
      }
    }

    // Natural Tamil spelling ending rule: word-final 'ந்' becomes 'ன்'
    return result.replace(/ந்(?=[ ,.\/\\-]|$)/g, 'ன்');
  }

  /**
   * Handle Tanglish typing on Space or punctuation key
   */
  handleKeyDown(event: KeyboardEvent, callback?: (newValue: string) => void): void {
    if (!this.isTanglishEnabled()) return;

    const input = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!input) return;

    // Trigger transliteration when Space key is pressed
    if (event.key === ' ' || event.code === 'Space') {
      const cursorPos = input.selectionStart ?? input.value.length;
      const textBeforeCursor = input.value.slice(0, cursorPos);
      const textAfterCursor = input.value.slice(cursorPos);

      // Find the last word typed before cursor
      const lastWordMatch = textBeforeCursor.match(/([a-zA-Z]+)$/);
      if (lastWordMatch && lastWordMatch[1]) {
        event.preventDefault();
        const englishWord = lastWordMatch[1];
        const tamilWord = this.transliterateWord(englishWord);

        const newTextBefore = textBeforeCursor.slice(0, lastWordMatch.index) + tamilWord + ' ';
        const updatedValue = newTextBefore + textAfterCursor;

        input.value = updatedValue;
        const newPos = newTextBefore.length;
        input.setSelectionRange(newPos, newPos);

        // Dispatch input event so Angular ngModel updates immediately
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (callback) callback(updatedValue);
      }
    }
  }

  /**
   * Insert character from the Virtual Keypad directly at the cursor position
   */
  insertAtCursor(char: string, callback?: (newVal: string) => void): void {
    const input = this.activeInput();
    if (!input) return;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const val = input.value;

    const updated = val.slice(0, start) + char + val.slice(end);
    input.value = updated;
    const newPos = start + char.length;
    input.setSelectionRange(newPos, newPos);
    input.focus();

    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (callback) callback(updated);
  }

  /**
   * Delete character before the cursor position (Backspace)
   */
  backspaceAtCursor(callback?: (newVal: string) => void): void {
    const input = this.activeInput();
    if (!input) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const val = input.value;

    if (start === 0 && end === 0) return;

    let updated = '';
    let newPos = start;

    if (start !== end) {
      updated = val.slice(0, start) + val.slice(end);
      newPos = start;
    } else {
      updated = val.slice(0, start - 1) + val.slice(start);
      newPos = start - 1;
    }

    input.value = updated;
    input.setSelectionRange(newPos, newPos);
    input.focus();

    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (callback) callback(updated);
  }

  /**
   * Clear all content in the active input
   */
  clearActiveInput(callback?: (newVal: string) => void): void {
    const input = this.activeInput();
    if (!input) return;

    input.value = '';
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (callback) callback('');
  }
}
