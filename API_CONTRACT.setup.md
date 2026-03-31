# Contrato API (MVP)

Base URL: `/`

## GET /health
Respuesta:
```json
{ "ok": true, "service": "gastos-backend" }
```

## GET /categories
Respuesta:
```json
[
  {
    "id": "uuid",
    "name": "Supermercado",
    "sortOrder": 1,
    "subcategories": [
      { "id": "uuid", "name": "Comida", "categoryId": "uuid", "sortOrder": 1 }
    ]
  }
]
```

## POST /expenses
Body:
```json
{
  "expenseDate": "2026-03-31",
  "amount": 12000,
  "categoryId": "uuid",
  "subcategoryId": "uuid",
  "placeId": "uuid",
  "personId": "uuid",
  "note": "Compra semanal"
}
```

Regla:
- Si se envia `subcategoryId`, debe pertenecer a `categoryId`.

## GET /expenses
Query params opcionales:
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `categoryId`
- `subcategoryId`
- `personId`
- `placeId`
