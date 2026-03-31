import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

type Tab = 'carga' | 'reportes' | 'catalogos';

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

type Category = {
  id: string;
  name: string;
  isActive: boolean;
  subcategories: Subcategory[];
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

const STORAGE_KEY = 'gastos_local_v1';
const CATALOGS_STORAGE_KEY = 'gastos_catalogos_v1';

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly fb = inject(FormBuilder);

  protected readonly title = signal('Registro de Gastos');
  protected readonly activeTab = signal<Tab>('carga');

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
    this.loadCatalogsFromStorage();

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as ExpenseRecord[];
        this.expenses.set(parsed);
      } catch {
        this.expenses.set([]);
      }
    }

    this.ensureFormDefaults();
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

    const next: ExpenseRecord = {
      id: crypto.randomUUID(),
      expenseDate: value.expenseDate,
      amount: Number(value.amount),
      categoryId: category.id,
      categoryName: category.name,
      subcategoryId: subcategory.id,
      subcategoryName: subcategory.name,
      place: value.place,
      person: value.person,
      note: value.note ?? ''
    };

    this.expenses.update((current) => [next, ...current]);
    this.persistExpenses();

    this.expenseForm.patchValue({
      amount: null,
      note: ''
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

    this.people.update((current) => [...current, { id: crypto.randomUUID(), name, isActive: true }]);
    this.catalogForm.patchValue({ personName: '' });
    this.persistCatalogs();
    this.ensureFormDefaults();
  }

  protected deactivatePerson(id: string): void {
    this.people.update((current) => current.map((item) => (item.id === id ? { ...item, isActive: false } : item)));
    this.persistCatalogs();
    this.ensureFormDefaults();
  }

  protected addPlace(): void {
    const name = this.catalogForm.controls.placeName.value?.trim();
    if (!name) return;
    if (this.places().some((item) => item.name.toLowerCase() === name.toLowerCase() && item.isActive)) return;

    this.places.update((current) => [...current, { id: crypto.randomUUID(), name, isActive: true }]);
    this.catalogForm.patchValue({ placeName: '' });
    this.persistCatalogs();
    this.ensureFormDefaults();
  }

  protected deactivatePlace(id: string): void {
    this.places.update((current) => current.map((item) => (item.id === id ? { ...item, isActive: false } : item)));
    this.persistCatalogs();
    this.ensureFormDefaults();
  }

  protected addCategory(): void {
    const name = this.catalogForm.controls.categoryName.value?.trim();
    if (!name) return;
    if (this.categories().some((item) => item.name.toLowerCase() === name.toLowerCase() && item.isActive)) return;

    this.categories.update((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name,
        isActive: true,
        subcategories: []
      }
    ]);
    this.catalogForm.patchValue({ categoryName: '' });
    this.persistCatalogs();
    this.ensureFormDefaults();
  }

  protected deactivateCategory(id: string): void {
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
    this.persistCatalogs();
    this.ensureFormDefaults();
  }

  protected addSubcategory(): void {
    const categoryId = this.catalogForm.controls.subcategoryCategoryId.value?.trim();
    const name = this.catalogForm.controls.subcategoryName.value?.trim();
    if (!categoryId || !name) return;

    this.categories.update((current) =>
      current.map((item) => {
        if (item.id !== categoryId) return item;

        const alreadyExists = item.subcategories.some(
          (sub) => sub.name.toLowerCase() === name.toLowerCase() && sub.isActive
        );

        if (alreadyExists) return item;

        return {
          ...item,
          subcategories: [...item.subcategories, { id: crypto.randomUUID(), name, isActive: true }]
        };
      })
    );

    this.catalogForm.patchValue({ subcategoryName: '' });
    this.persistCatalogs();
    this.ensureFormDefaults();
  }

  protected deactivateSubcategory(categoryId: string, subcategoryId: string): void {
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
    this.persistCatalogs();
    this.ensureFormDefaults();
  }

  private persistExpenses(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.expenses()));
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

    const selectedPerson = this.expenseForm.controls.person.value ?? '';
    const personValue =
      selectedPerson && this.activePeople.some((person) => person.name === selectedPerson)
        ? selectedPerson
        : this.activePeople[0]?.name ?? '';

    const selectedPlace = this.expenseForm.controls.place.value ?? '';
    const placeValue =
      selectedPlace && this.activePlaces.some((place) => place.name === selectedPlace)
        ? selectedPlace
        : this.activePlaces[0]?.name ?? '';

    this.expenseForm.patchValue(
      {
        categoryId: expenseCategoryId,
        subcategoryId: expenseSubcategoryId,
        person: personValue,
        place: placeValue
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

  private persistCatalogs(): void {
    const payload = {
      people: this.people(),
      places: this.places(),
      categories: this.categories()
    };
    localStorage.setItem(CATALOGS_STORAGE_KEY, JSON.stringify(payload));
  }

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
