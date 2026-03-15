import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <div class="card">
      <h2>Ready to start?</h2>
      <p>Walk through the three exam questions and record your answers (recording support comes next).</p>

      <div class="button-group">
        <button class="primary" [routerLink]="['/exam']">Start Exam</button>
        <button class="secondary" [routerLink]="['/results']">View Past Results</button>
      </div>
    </div>
  `,
})
export class HomeComponent {}
