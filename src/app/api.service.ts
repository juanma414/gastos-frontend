import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, retry, timer } from 'rxjs';

const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? '/api'
  : 'http://localhost:4000';

const AUTH_TOKEN_KEY = 'gastos_auth_token_v1';

export type UserRole = 'ADMIN' | 'MEMBER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Person {
  id: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
}

export interface Place {
  id: string;
  name: string;
  isActive: boolean;
  createdAt?: string;
}

export interface Subcategory {
  id: string;
  name: string;
  isActive: boolean;
  categoryId?: string;
  sortOrder?: number;
}

export interface Category {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder?: number;
  subcategories: Subcategory[];
}

export interface Expense {
  id: string;
  expenseDate: string;
  amount: number;
  categoryId: string;
  subcategoryId: string;
  personId: string;
  placeId: string;
  note?: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly http = inject(HttpClient);

  private withRetry<T>(request: Observable<T>): Observable<T> {
    return request.pipe(
      retry({
        count: 2,
        delay: (error, retryCount) => {
          const status = Number(error?.status ?? 0);
          if (status === 0 || status === 502 || status === 503 || status === 504) {
            return timer(1200 * retryCount);
          }
          throw error;
        }
      })
    );
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  hasToken(): boolean {
    return Boolean(this.getToken());
  }

  clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  private authOptions(params?: Record<string, string>) {
    const token = this.getToken();
    return {
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    };
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.withRetry(this.http.post<LoginResponse>(`${API_URL}/auth/login`, { email, password }));
  }

  me(): Observable<AuthUser> {
    return this.withRetry(this.http.get<AuthUser>(`${API_URL}/auth/me`, this.authOptions()));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ ok: boolean }> {
    return this.withRetry(
      this.http.post<{ ok: boolean }>(
        `${API_URL}/auth/change-password`,
        { currentPassword, newPassword },
        this.authOptions()
      )
    );
  }

  getUsers(): Observable<AuthUser[]> {
    return this.withRetry(this.http.get<AuthUser[]>(`${API_URL}/users`, this.authOptions()));
  }

  createUser(payload: { name: string; email: string; password: string; role: UserRole }): Observable<AuthUser> {
    return this.withRetry(this.http.post<AuthUser>(`${API_URL}/users`, payload, this.authOptions()));
  }

  deactivateUser(id: string): Observable<AuthUser> {
    return this.withRetry(this.http.delete<AuthUser>(`${API_URL}/users/${id}`, this.authOptions()));
  }

  getPeople(includeInactive: boolean = false): Observable<Person[]> {
    return this.withRetry(
      this.http.get<Person[]>(
        `${API_URL}/people`,
        this.authOptions({ includeInactive: includeInactive.toString() })
      )
    );
  }

  createPerson(name: string): Observable<Person> {
    return this.withRetry(this.http.post<Person>(`${API_URL}/people`, { name }, this.authOptions()));
  }

  updatePerson(id: string, name: string): Observable<Person> {
    return this.withRetry(this.http.patch<Person>(`${API_URL}/people/${id}`, { name }, this.authOptions()));
  }

  deactivatePerson(id: string): Observable<Person> {
    return this.withRetry(this.http.delete<Person>(`${API_URL}/people/${id}`, this.authOptions()));
  }

  getPlaces(includeInactive: boolean = false): Observable<Place[]> {
    return this.withRetry(
      this.http.get<Place[]>(`${API_URL}/places`, this.authOptions({ includeInactive: includeInactive.toString() }))
    );
  }

  createPlace(name: string): Observable<Place> {
    return this.withRetry(this.http.post<Place>(`${API_URL}/places`, { name }, this.authOptions()));
  }

  updatePlace(id: string, name: string): Observable<Place> {
    return this.withRetry(this.http.patch<Place>(`${API_URL}/places/${id}`, { name }, this.authOptions()));
  }

  deactivatePlace(id: string): Observable<Place> {
    return this.withRetry(this.http.delete<Place>(`${API_URL}/places/${id}`, this.authOptions()));
  }

  getCategories(includeInactive: boolean = false): Observable<Category[]> {
    return this.withRetry(
      this.http.get<Category[]>(
        `${API_URL}/categories`,
        this.authOptions({ includeInactive: includeInactive.toString() })
      )
    );
  }

  createCategory(name: string, sortOrder?: number): Observable<Category> {
    return this.withRetry(
      this.http.post<Category>(`${API_URL}/categories`, { name, sortOrder }, this.authOptions())
    );
  }

  updateCategory(id: string, name: string, sortOrder?: number): Observable<Category> {
    return this.withRetry(
      this.http.patch<Category>(`${API_URL}/categories/${id}`, { name, sortOrder }, this.authOptions())
    );
  }

  deactivateCategory(id: string): Observable<Category> {
    return this.withRetry(this.http.delete<Category>(`${API_URL}/categories/${id}`, this.authOptions()));
  }

  getSubcategories(categoryId: string, includeInactive: boolean = false): Observable<Subcategory[]> {
    return this.withRetry(
      this.http.get<Subcategory[]>(
        `${API_URL}/subcategories`,
        this.authOptions({ categoryId, includeInactive: includeInactive.toString() })
      )
    );
  }

  createSubcategory(categoryId: string, name: string, sortOrder?: number): Observable<Subcategory> {
    return this.withRetry(
      this.http.post<Subcategory>(`${API_URL}/subcategories`, { categoryId, name, sortOrder }, this.authOptions())
    );
  }

  updateSubcategory(id: string, name: string, sortOrder?: number): Observable<Subcategory> {
    return this.withRetry(
      this.http.patch<Subcategory>(`${API_URL}/subcategories/${id}`, { name, sortOrder }, this.authOptions())
    );
  }

  deactivateSubcategory(id: string): Observable<Subcategory> {
    return this.withRetry(this.http.delete<Subcategory>(`${API_URL}/subcategories/${id}`, this.authOptions()));
  }

  getExpenses(filters?: {
    from?: string;
    to?: string;
    categoryId?: string;
    subcategoryId?: string;
    personId?: string;
    placeId?: string;
  }): Observable<Expense[]> {
    const params = filters ? Object.fromEntries(Object.entries(filters).filter(([, v]) => Boolean(v))) : undefined;
    return this.withRetry(this.http.get<Expense[]>(`${API_URL}/expenses`, this.authOptions(params)));
  }

  createExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Observable<Expense> {
    return this.withRetry(this.http.post<Expense>(`${API_URL}/expenses`, expense, this.authOptions()));
  }
}
