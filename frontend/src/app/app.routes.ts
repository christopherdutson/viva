import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home.component';
import { ExamComponent } from './pages/exam.component';
import { ResultsComponent } from './pages/results.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'exam', component: ExamComponent },
  { path: 'results', component: ResultsComponent },
  { path: '**', redirectTo: '' },
];
