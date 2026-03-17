import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home.component';
import { ExamComponent } from './pages/exam.component';
import { ResultsComponent } from './pages/results.component';
import { SessionDetailComponent } from './pages/session-detail.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'exam', component: ExamComponent },
  { path: 'results', component: ResultsComponent },
  { path: 'results/:id', component: SessionDetailComponent },
  { path: '**', redirectTo: '' },
];
