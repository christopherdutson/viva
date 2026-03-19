import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render a Start Exam button', async () => {
    const fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('button'));
    expect(buttons.some((b) => b.textContent?.includes('Start Exam'))).toBe(true);
  });

  it('should render a View Past Results button', async () => {
    const fixture = TestBed.createComponent(HomeComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll('button'));
    expect(buttons.some((b) => b.textContent?.includes('View Past Results'))).toBe(true);
  });
});
