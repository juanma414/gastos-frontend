import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, AuthUser, Category, UserRole } from './api.service';

type Tab = 'carga' | 'reportes' | 'catalogos' | 'perfil';

type NamedCatalogItem = {
  id: string;
  name: string;
  isActive: boolean;
};

type Subcategory = {
  id: string;
  name: string;
  isActive: boolean;
};

type ExpenseRecord = {
  id: string;
  expenseDate: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
  place: string;
  person: string;
  note: string;
};

const CATALOGS_STORAGE_KEY = 'gastos_catalogos_v1';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);

  protected readonly title = signal('Registro de Gastos');
  protected readonly activeTab = signal<Tab>('carga');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly currentUser = signal<AuthUser | null>(null);
  protected readonly users = signal<AuthUser[]>([]);

  protected readonly categories = signal<Category[]>([
    {
      id: 'supermercado',
      name: 'Supermercado',
      isActive: true,
      subcategories: [
        { id: 'comida', name: 'Comida', isActive: true },
        { id: 'bebida', name: 'Bebida', isActive: true },
        { id: 'limpieza', name: 'Limpieza', isActive: true },
        { id: 'otros-super', name: 'Otros', isActive: true }
      ]
    },
    {
      id: 'auto',
      name: 'Auto',
      isActive: true,
      subcategories: [
        { id: 'nafta', name: 'Nafta', isActive: true },
        { id: 'lavado', name: 'Lavado', isActive: true },
        { id: 'mantenimiento', name: 'Mantenimiento', isActive: true },
        { id: 'estacionamiento', name: 'Estacionamiento', isActive: true },
        { id: 'otros-auto', name: 'Otros', isActive: true }
      ]
    }
  ]);

  protected readonly people = signal<NamedCatalogItem[]>([
    { id: 'juan', name: 'Juan', isActive: true },
    { id: 'pareja', name: 'Pareja', isActive: true }
  ]);

  protected readonly places = signal<NamedCatalogItem[]>([
    { id: 'supermercado', name: 'Supermercado', isActive: true },
    { id: 'estacion-servicio', name: 'Estacion de servicio', isActive: true },
    { id: 'farmacia', name: 'Farmacia', isActive: true },
    { id: 'otro', name: 'Otro', isActive: true }
  ]);

  protected readonly expenses = signal<ExpenseRecord[]>([]);

  protected readonly catalogForm = this.fb.group({
    personName: [''],
    placeName: [''],
    categoryName: [''],
    subcategoryCategoryId: [''],
    subcategoryName: ['']
  });

  protected readonly expenseForm = this.fb.group({
    expenseDate: [this.todayIso(), [Validators.required]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    categoryId: ['', [Validators.required]],
    subcategoryId: ['', [Validators.required]],
    place: ['', [Validators.required]],
    person: ['', [Validators.required]],
    note: ['']
  });

  protected readonly reportForm = this.fb.group({
    from: [this.firstDayOfMonthIso()],
    to: [this.todayIso()],
    categoryId: [''],
    subcategoryId: [''],
    person: [''],
    place: ['']
  });

  protected readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected readonly userForm = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['MEMBER' as UserRole, [Validators.required]]
  });

  protected readonly passwordForm = this.fb.group({
    currentPassword: ['', [Validators.required, Validators.minLength(6)]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor() {
    this.ensureFormDefaults();

    this.expenseForm.controls.categoryId.valueChanges.subscribe((categoryId) => {
      const options = this.getSubcategoriesByCategoryId(categoryId ?? '');
      this.expenseForm.patchValue({ subcategoryId: options[0]?.id ?? '' }, { emitEvent: false });
    });

    this.reportForm.controls.categoryId.valueChanges.subscribe((categoryId) => {
      const options = categoryId ? this.getSubcategoriesByCategoryId(categoryId) : [];
      this.reportForm.patchValue({ subcategoryId: '' }, { emitEvent: false });
      if (options.length === 0) {
        this.reportForm.patchValue({ subcategoryId: '' }, { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    if (!this.api.hasToken()) {
      return;
    }

    this.api.me().subscribe({
      next: (user) => {
        this.currentUser.set(user);
        this.loadData();
        if (user.role === 'ADMIN') {
          this.loadUsers();
        }
      },
      error: () => {
        this.api.clearToken();
        this.currentUser.set(null);
      }
    });
  }

  protected get isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  protected get isAdmin(): boolean {
    return this.currentUser()?.role === 'ADMIN';
  }

  protected login(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const value = this.loginForm.getRawValue();
    if (!value.email || !value.password) return;

    this.errorMessage.set('');
    this.isLoading.set(true);

    this.api.login(value.email, value.password).subscribe({
      next: (response) => {
        this.api.setToken(response.token);
        this.currentUser.set(response.user);
        this.loginForm.patchValue({ password: '' });
        this.loadData();
        if (response.user.role === 'ADMIN') {
          this.loadUsers();
        }
      },
      error: () => {
        this.errorMessage.set('Email o contraseña inválidos');
        this.isLoading.set(false);
      }
    });
  }

  protected logout(): void {
    this.api.clearToken();
    this.currentUser.set(null);
    this.users.set([]);
    this.expenses.set([]);
    this.errorMessage.set('');
    this.passwordForm.reset();
    this.activeTab.set('carga');
  }

  protected openProfile(): void {
    this.activeTab.set('perfil');
  }

  protected changeMyPassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const value = this.passwordForm.getRawValue();
    if (!value.currentPassword || !value.newPassword || !value.confirmPassword) return;

    if (value.newPassword !== value.confirmPassword) {
      this.errorMessage.set('La nueva contraseña y su confirmación no coinciden');
      return;
    }

    this.api.changePassword(value.currentPassword, value.newPassword).subscribe({
      next: () => {
        this.errorMessage.set('');
        this.passwordForm.reset();
        window.alert('Contraseña actualizada correctamente');
      },
      error: () => {
        this.errorMessage.set('No se pudo actualizar la contraseña. Revisá tu contraseña actual.');
      }
    });
  }

  private loadUsers(): void {
    this.api.getUsers().subscribe({
      next: (users) => this.users.set(users),
      error: () => this.errorMessage.set('No se pudieron cargar los usuarios')
    });
  }

  protected createUser(): void {
    if (!this.isAdmin) return;
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const value = this.userForm.getRawValue();
    if (!value.name || !value.email || !value.password || !value.role) return;

    this.api.createUser({
      name: value.name.trim(),
      email: value.email.trim().toLowerCase(),
      password: value.password,
      role: value.role
    }).subscribe({
      next: (user) => {
        this.users.update((current) => [...current, user]);
        this.userForm.patchValue({ name: '', email: '', password: '', role: 'MEMBER' });
      },
      error: () => this.errorMessage.set('No se pudo crear el usuario')
    });
  }

  protected deactivateUser(id: string): void {
    if (!this.isAdmin) return;
    const user = this.users().find((item) => item.id === id);
    if (!this.confirmDeactivation('usuario', user?.name)) return;

    this.api.deactivateUser(id).subscribe({
      next: (updated) => {
        this.users.update((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      },
      error: () => this.errorMessage.set('No se pudo desactivar el usuario')
    });
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    // Load categories first (needed for subcategories)
    this.api.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(
          categories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            isActive: cat.isActive,
            subcategories: cat.subcategories || []
          }))
        );
        this.ensureFormDefaults();
      },
      error: (err) => {
        console.error('Error loading categories:', err);
        this.errorMessage.set('Error cargando categorías');
        this.loadCatalogsFromStorage();
      }
    });

    // Load people
    this.api.getPeople().subscribe({
      next: (people) => {
        this.people.set(people.map((p) => ({ id: p.id, name: p.name, isActive: p.isActive })));
        this.ensureFormDefaults();
      },
      error: (err) => {
        console.error('Error loading people:', err);
        this.loadCatalogsFromStorage();
      }
    });

    // Load places
    this.api.getPlaces().subscribe({
      next: (places) => {
        this.places.set(places.map((p) => ({ id: p.id, name: p.name, isActive: p.isActive })));
        this.ensureFormDefaults();
      },
      error: (err) => {
        console.error('Error loading places:', err);
        this.loadCatalogsFromStorage();
      }
    });

    // Load expenses
    this.api.getExpenses().subscribe({
      next: (expenses) => {
        this.expenses.set(
          expenses.map((exp) => {
            const person = this.people().find((p) => p.id === exp.personId);
            const place = this.places().find((p) => p.id === exp.placeId);
            return {
              id: exp.id,
              expenseDate: exp.expenseDate,
              amount: exp.amount,
              categoryId: exp.categoryId,
              categoryName: this.categories().find((c) => c.id === exp.categoryId)?.name ?? 'Unknown',
              subcategoryId: exp.subcategoryId,
              subcategoryName: this.categories()
                .find((c) => c.id === exp.categoryId)
                ?.subcategories.find((s) => s.id === exp.subcategoryId)?.name ?? 'Unknown',
              place: place?.name ?? 'Unknown',
              person: person?.name ?? 'Unknown',
              note: exp.note ?? ''
            };
          })
        );
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading expenses:', err);
        this.isLoading.set(false);
      }
    });
  }

  protected setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  protected saveExpense(): void {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const value = this.expenseForm.getRawValue();
    const category = this.categories().find((item) => item.id === value.categoryId && item.isActive);
    const subcategory = category?.subcategories.find((item) => item.id === value.subcategoryId);

    if (!category || !subcategory || !value.amount || !value.expenseDate || !value.person || !value.place) {
      return;
    }

    this.api
      .createExpense({
        expenseDate: value.expenseDate,
        amount: Number(value.amount),
        categoryId: category.id,
        subcategoryId: subcategory.id,
        personId: value.person,
        placeId: value.place,
        note: value.note ?? ''
      })
      .subscribe({
        next: (expense) => {
          const person = this.people().find((item) => item.id === expense.personId);
          const place = this.places().find((item) => item.id === expense.placeId);

          const newExpense: ExpenseRecord = {
            id: expense.id,
            expenseDate: expense.expenseDate,
            amount: expense.amount,
            categoryId: expense.categoryId,
            categoryName: category.name,
            subcategoryId: expense.subcategoryId,
            subcategoryName: subcategory.name,
            place: place?.name ?? 'Unknown',
            person: person?.name ?? 'Unknown',
            note: expense.note ?? ''
          };

          this.expenses.update((current) => [newExpense, ...current]);

          this.expenseForm.patchValue({
            amount: null,
            note: ''
          });
        },
        error: (err) => {
          console.error('Error saving expense:', err);
          this.errorMessage.set('Error al guardar el gasto');
        }
      });
  }

  protected get filteredExpenses(): ExpenseRecord[] {
    const filters = this.reportForm.getRawValue();
    return this.expenses().filter((expense) => {
      if (filters.from && expense.expenseDate < filters.from) return false;
      if (filters.to && expense.expenseDate > filters.to) return false;
      if (filters.categoryId && expense.categoryId !== filters.categoryId) return false;
      if (filters.subcategoryId && expense.subcategoryId !== filters.subcategoryId) return false;
      if (filters.person && expense.person !== filters.person) return false;
      if (filters.place && expense.place !== filters.place) return false;
      return true;
    });
  }

  protected get reportTotal(): number {
    return this.filteredExpenses.reduce((acc, item) => acc + item.amount, 0);
  }

  protected get totalsByPerson(): Array<{ person: string; total: number }> {
    const map = new Map<string, number>();
    for (const expense of this.filteredExpenses) {
      map.set(expense.person, (map.get(expense.person) ?? 0) + expense.amount);
    }
    return Array.from(map.entries()).map(([person, total]) => ({ person, total }));
  }

  protected get activePeople(): NamedCatalogItem[] {
    return this.people().filter((item) => item.isActive).sort((a, b) => a.name.localeCompare(b.name));
  }

  protected get activePlaces(): NamedCatalogItem[] {
    return this.places().filter((item) => item.isActive).sort((a, b) => a.name.localeCompare(b.name));
  }

  protected get activeCategories(): Category[] {
    return this.categories().filter((item) => item.isActive).sort((a, b) => a.name.localeCompare(b.name));
  }

  protected get reportSubcategoryOptions(): Subcategory[] {
    const categoryId = this.reportForm.controls.categoryId.value ?? '';
    if (!categoryId) return [];
    return this.getSubcategoriesByCategoryId(categoryId);
  }

  protected addPerson(): void {
    const name = this.catalogForm.controls.personName.value?.trim();
    if (!name) return;
    if (this.people().some((item) => item.name.toLowerCase() === name.toLowerCase() && item.isActive)) return;

    this.api.createPerson(name).subscribe({
      next: (person) => {
        this.people.update((current) => [...current, { id: person.id, name: person.name, isActive: person.isActive }]);
        this.catalogForm.patchValue({ personName: '' });
        this.ensureFormDefaults();
      },
      error: (err) => {
        console.error('Error adding person:', err);
        this.errorMessage.set('Error al agregar persona');
      }
    });
  }

  protected deactivatePerson(id: string): void {
    const person = this.people().find((item) => item.id === id);
    if (!this.confirmDeactivation('persona', person?.name)) return;

    this.api.deactivatePerson(id).subscribe({
      next: () => {
        this.people.update((current) => current.map((item) => (item.id === id ? { ...item, isActive: false } : item)));
        this.ensureFormDefaults();
      },
      error: (err) => {
        console.error('Error deactivating person:', err);
        this.errorMessage.set('Error al desactivar persona');
      }
    });
  }

  protected addPlace(): void {
    const name = this.catalogForm.controls.placeName.value?.trim();
    if (!name) return;
    if (this.places().some((item) => item.name.toLowerCase() === name.toLowerCase() && item.isActive)) return;

    this.api.createPlace(name).subscribe({
      next: (place) => {
        this.places.update((current) => [...current, { id: place.id, name: place.name, isActive: place.isActive }]);
        this.catalogForm.patchValue({ placeName: '' });
        this.ensureFormDefaults();
      },
      error: (err) => {
        console.error('Error adding place:', err);
        this.errorMessage.set('Error al agregar lugar');
      }
    });
  }

  protected deactivatePlace(id: string): void {
    const place = this.places().find((item) => item.id === id);
    if (!this.confirmDeactivation('lugar', place?.name)) return;

    this.api.deactivatePlace(id).subscribe({
      next: () => {
        this.places.update((current) => current.map((item) => (item.id === id ? { ...item, isActive: false } : item)));
        this.ensureFormDefaults();
      },
      error: (err) => {
        console.error('Error deactivating place:', err);
        this.errorMessage.set('Error al desactivar lugar');
      }
    });
  }

  protected addCategory(): void {
    const name = this.catalogForm.controls.categoryName.value?.trim();
    if (!name) return;
    if (this.categories().some((item) => item.name.toLowerCase() === name.toLowerCase() && item.isActive)) return;

    this.api.createCategory(name).subscribe({
      next: (category) => {
        this.categories.update((current) => [
          ...current,
          {
            id: category.id,
            name: category.name,
            isActive: category.isActive,
            subcategories: category.subcategories || []
          }
        ]);
        this.catalogForm.patchValue({ categoryName: '' });
        this.ensureFormDefaults();
      },
      error: (err) => {
        console.error('Error adding category:', err);
        this.errorMessage.set('Error al agregar categoría');
      }
    });
  }

  protected deactivateCategory(id: string): void {
    const category = this.categories().find((item) => item.id === id);
    if (!this.confirmDeactivation('categoría', category?.name)) return;

    this.api.deactivateCategory(id).subscribe({
      next: () => {
        this.categories.update((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  isActive: false,
                  subcategories: item.subcategories.map((sub) => ({ ...sub, isActive: false }))
                }
              : item
          )
        );
        this.ensureFormDefaults();
      },
      error: (err) => {
        console.error('Error deactivating category:', err);
        this.errorMessage.set('Error al desactivar categoría');
      }
    });
  }

  protected addSubcategory(): void {
    const categoryId = this.catalogForm.controls.subcategoryCategoryId.value?.trim();
    const name = this.catalogForm.controls.subcategoryName.value?.trim();
    if (!categoryId || !name) return;

    this.api.createSubcategory(categoryId, name).subscribe({
      next: (subcategory) => {
        this.categories.update((current) =>
          current.map((item) => {
            if (item.id !== categoryId) return item;
            return {
              ...item,
              subcategories: [...item.subcategories, { id: subcategory.id, name: subcategory.name, isActive: subcategory.isActive }]
            };
          })
        );
        this.catalogForm.patchValue({ subcategoryName: '' });
        this.ensureFormDefaults();
      },
      error: (err) => {
        console.error('Error adding subcategory:', err);
        this.errorMessage.set('Error al agregar subcategoría');
      }
    });
  }

  protected deactivateSubcategory(categoryId: string, subcategoryId: string): void {
    const category = this.categories().find((item) => item.id === categoryId);
    const subcategory = category?.subcategories.find((item) => item.id === subcategoryId);
    if (!this.confirmDeactivation('subcategoría', subcategory?.name)) return;

    this.api.deactivateSubcategory(subcategoryId).subscribe({
      next: () => {
        this.categories.update((current) =>
          current.map((item) => {
            if (item.id !== categoryId) return item;
            return {
              ...item,
              subcategories: item.subcategories.map((sub) =>
                sub.id === subcategoryId ? { ...sub, isActive: false } : sub
              )
            };
          })
        );
        this.ensureFormDefaults();
      },
      error: (err) => {
        console.error('Error deactivating subcategory:', err);
        this.errorMessage.set('Error al desactivar subcategoría');
      }
    });
  }

  private persistExpenses(): void {
    // API is now responsible for persistence
    // This method is kept for backward compatibility if needed
  }

  private confirmDeactivation(entity: string, name?: string): boolean {
    const label = name ? ` \"${name}\"` : '';
    return window.confirm(`¿Seguro que querés desactivar ${entity}${label}?`);
  }

  protected getSubcategoriesByCategoryId(categoryId: string): Subcategory[] {
    return (
      this.categories()
        .find((item) => item.id === categoryId && item.isActive)
        ?.subcategories.filter((sub) => sub.isActive) ?? []
    );
  }

  private ensureFormDefaults(): void {
    const firstCategory = this.activeCategories[0];
    const selectedCategoryId = this.expenseForm.controls.categoryId.value ?? '';
    const expenseCategoryId =
      selectedCategoryId && this.activeCategories.some((cat) => cat.id === selectedCategoryId)
        ? selectedCategoryId
        : firstCategory?.id ?? '';

    const expenseSubcategories = this.getSubcategoriesByCategoryId(expenseCategoryId);
    const selectedSubcategoryId = this.expenseForm.controls.subcategoryId.value ?? '';
    const expenseSubcategoryId =
      selectedSubcategoryId && expenseSubcategories.some((sub) => sub.id === selectedSubcategoryId)
        ? selectedSubcategoryId
        : expenseSubcategories[0]?.id ?? '';

    const selectedPersonId = this.expenseForm.controls.person.value ?? '';
    const personIdValue =
      selectedPersonId && this.activePeople.some((person) => person.id === selectedPersonId)
        ? selectedPersonId
        : this.activePeople[0]?.id ?? '';

    const selectedPlaceId = this.expenseForm.controls.place.value ?? '';
    const placeIdValue =
      selectedPlaceId && this.activePlaces.some((place) => place.id === selectedPlaceId)
        ? selectedPlaceId
        : this.activePlaces[0]?.id ?? '';

    this.expenseForm.patchValue(
      {
        categoryId: expenseCategoryId,
        subcategoryId: expenseSubcategoryId,
        person: personIdValue,
        place: placeIdValue
      },
      { emitEvent: false }
    );

    const selectedReportCategoryId = this.reportForm.controls.categoryId.value ?? '';
    if (selectedReportCategoryId && !this.activeCategories.some((cat) => cat.id === selectedReportCategoryId)) {
      this.reportForm.patchValue({ categoryId: '', subcategoryId: '' }, { emitEvent: false });
    }

    const selectedSubCategoryForCreate = this.catalogForm.controls.subcategoryCategoryId.value ?? '';
    if (!selectedSubCategoryForCreate || !this.activeCategories.some((cat) => cat.id === selectedSubCategoryForCreate)) {
      this.catalogForm.patchValue({ subcategoryCategoryId: firstCategory?.id ?? '' }, { emitEvent: false });
    }
  }

  // Backup method for loading from localStorage (fallback if API is unavailable)
  private loadCatalogsFromStorage(): void {
    const raw = localStorage.getItem(CATALOGS_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as {
        people: NamedCatalogItem[];
        places: NamedCatalogItem[];
        categories: Category[];
      };

      if (Array.isArray(parsed.people)) this.people.set(parsed.people);
      if (Array.isArray(parsed.places)) this.places.set(parsed.places);
      if (Array.isArray(parsed.categories)) this.categories.set(parsed.categories);
    } catch {
      return;
    }
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private firstDayOfMonthIso(): string {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().slice(0, 10);
  }
}
