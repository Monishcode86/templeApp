import { Component, Input, Output, EventEmitter, computed, signal, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.css']
})
export class PaginationComponent implements OnInit, OnChanges {
  @Input() total = 0;
  @Input() page = 1;
  @Input() limit = 10;
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50];

  @Output() pageChange = new EventEmitter<number>();
  @Output() limitChange = new EventEmitter<number>();

  totalSignal = signal<number>(0);
  pageSignal = signal<number>(1);
  limitSignal = signal<number>(10);

  ngOnInit(): void {
    this.totalSignal.set(this.total);
    this.pageSignal.set(this.page);
    this.limitSignal.set(this.limit);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['total']) this.totalSignal.set(this.total);
    if (changes['page']) this.pageSignal.set(this.page);
    if (changes['limit']) this.limitSignal.set(this.limit);
  }

  totalPages = computed(() => {
    const t = this.totalSignal();
    const l = this.limitSignal();
    return Math.max(1, Math.ceil(t / l));
  });

  startItem = computed(() => {
    if (this.totalSignal() === 0) return 0;
    return (this.pageSignal() - 1) * this.limitSignal() + 1;
  });

  endItem = computed(() => {
    return Math.min(this.pageSignal() * this.limitSignal(), this.totalSignal());
  });

  // Calculate pages with ellipses for large page counts
  visiblePages = computed(() => {
    const total = this.totalPages();
    const current = this.pageSignal();
    const delta = 1; // pages around current
    const range: (number | string)[] = [];

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      } else if (range[range.length - 1] !== '...') {
        range.push('...');
      }
    }

    return range;
  });

  onPageSelect(newPage: number | string): void {
    if (typeof newPage !== 'number' || newPage === this.pageSignal()) return;
    if (newPage >= 1 && newPage <= this.totalPages()) {
      this.pageChange.emit(newPage);
    }
  }

  onLimitSelect(val: Event | number | string): void {
    let newLimit: number;
    if (val && typeof val === 'object' && 'target' in val) {
      newLimit = Number((val.target as HTMLSelectElement).value);
    } else {
      newLimit = Number(val);
    }

    if (newLimit && newLimit !== this.limitSignal()) {
      this.limitSignal.set(newLimit);
      this.limitChange.emit(newLimit);
    }
  }

  prev(): void {
    if (this.pageSignal() > 1) {
      this.onPageSelect(this.pageSignal() - 1);
    }
  }

  next(): void {
    if (this.pageSignal() < this.totalPages()) {
      this.onPageSelect(this.pageSignal() + 1);
    }
  }
}
