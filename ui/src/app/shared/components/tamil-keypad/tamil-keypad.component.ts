import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TamilInputService } from '../../../core/services/tamil-input.service';

@Component({
  selector: 'app-tamil-keypad',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tamil-keypad.component.html',
  styleUrls: ['./tamil-keypad.component.css']
})
export class TamilKeypadComponent {
  tamilService = inject(TamilInputService);

  // Active view tab in keypad
  activeTab = signal<'all' | 'vowels' | 'consonants' | 'numbers'>('all');

  // Vowels (உயிர்)
  vowels = ['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ', 'ஃ'];

  // Combining Signs (துணைக்குறிகள்)
  vowelSigns = ['்', 'ா', 'ி', 'ீ', 'ு', 'ூ', 'ெ', 'ே', 'ை', 'ொ', 'ோ', 'ௌ'];

  // Consonants (மெய் எழுத்துக்கள்)
  consonantsRow1 = ['க', 'ங', 'ச', 'ஞ', 'ட', 'ண', 'த', 'ந', 'ப', 'ம'];
  consonantsRow2 = ['ய', 'ர', 'ல', 'வ', 'ழ', 'ள', 'ற', 'ன'];
  grantha = ['ஜ', 'ஷ', 'ஸ', 'ஹ', 'க்ஷ', 'ஸ்ரீ'];

  // Numbers & Punctuation
  numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  symbols = [',', '.', '/', '-', '#', '(', ')', '@'];

  onKeyPress(char: string): void {
    this.tamilService.insertAtCursor(char);
  }

  onBackspace(): void {
    this.tamilService.backspaceAtCursor();
  }

  onSpace(): void {
    this.tamilService.insertAtCursor(' ');
  }

  onClear(): void {
    this.tamilService.clearActiveInput();
  }

  onClose(): void {
    this.tamilService.closeKeypad();
  }

  toggleTanglish(): void {
    this.tamilService.toggleTanglish();
  }
}
