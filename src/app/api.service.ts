import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
  ? '/api'  // En producción, usa rutas relativas (proxy)
  : 'http://localhost:4000';  // En desarrollo, usa localhost

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

  // People endpoints
  getPeople(includeInactive: boolean = false): Observable<Person[]> {
    return this.http.get<Person[]>(`${API_URL}/people`, {
      params: { includeInactive: includeInactive.toString() }
    });
  }

  createPerson(name: string): Observable<Person> {
    return this.http.post<Person>(`${API_URL}/people`, { name });
  }

  updatePerson(id: string, name: string): Observable<Person> {
    return this.http.patch<Person>(`${API_URL}/people/${id}`, { name });
  }

  deactivatePerson(id: string): Observable<Person> {
    return this.http.delete<Person>(`${API_URL}/people/${id}`);
  }

  // Places endpoints
  getPlaces(includeInactive: boolean = false): Observable<Place[]> {
    return this.http.get<Place[]>(`${API_URL}/places`, {
      params: { includeInactive: includeInactive.toString() }
    });
  }

  createPlace(name: string): Observable<Place> {
    return this.http.post<Place>(`${API_URL}/places`, { name });
  }

  updatePlace(id: string, name: string): Observable<Place> {
    return this.http.patch<Place>(`${API_URL}/places/${id}`, { name });
  }

  deactivatePlace(id: string): Observable<Place> {
    return this.http.delete<Place>(`${API_URL}/places/${id}`);
  }

  // Categories endpoints
  getCategories(includeInactive: boolean = false): Observable<Category[]> {
    return this.http.get<Category[]>(`${API_URL}/categories`, {
      params: { includeInactive: includeInactive.toString() }
    });
  }

  createCategory(name: string, sortOrder?: number): Observable<Category> {
    return this.http.post<Category>(`${API_URL}/categories`, { name, sortOrder });
  }

  updateCategory(id: string, name: string, sortOrder?: number): Observable<Category> {
    return this.http.patch<Category>(`${API_URL}/categories/${id}`, { name, sortOrder });
  }

  deactivateCategory(id: string): Observable<Category> {
    return this.http.delete<Category>(`${API_URL}/categories/${id}`);
  }

  // Subcategories endpoints
  getSubcategories(categoryId: string, includeInactive: boolean = false): Observable<Subcategory[]> {
    return this.http.get<Subcategory[]>(`${API_URL}/subcategories`, {
      params: { categoryId, includeInactive: includeInactive.toString() }
    });
  }

  createSubcategory(categoryId: string, name: string, sortOrder?: number): Observable<Subcategory> {
    return this.http.post<Subcategory>(`${API_URL}/subcategories`, { categoryId, name, sortOrder });
  }

  updateSubcategory(id: string, name: string, sortOrder?: number): Observable<Subcategory> {
    return this.http.patch<Subcategory>(`${API_URL}/subcategories/${id}`, { name, sortOrder });
  }

  deactivateSubcategory(id: string): Observable<Subcategory> {
    return this.http.delete<Subcategory>(`${API_URL}/subcategories/${id}`);
  }

  // Expenses endpoints
  getExpenses(filters?: {
    from?: string;
    to?: string;
    categoryId?: string;
    subcategoryId?: string;
    personId?: string;
    placeId?: string;
  }): Observable<Expense[]> {
    return this.http.get<Expense[]>(`${API_URL}/expenses`, { params: filters ?? {} });
  }

  createExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Observable<Expense> {
    return this.http.post<Expense>(`${API_URL}/expenses`, expense);
  }
}
