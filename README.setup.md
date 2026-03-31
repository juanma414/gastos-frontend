# Gastos Frontend (Angular PWA)

Frontend mobile-first para carga diaria y reportes.

## Stack sugerido
- Angular standalone
- Angular Service Worker (PWA)
- IndexedDB (Dexie o localforage)
- Despliegue en Netlify (free)

## Requisitos
- Node.js 20+
- pnpm 10+

## Crear proyecto Angular (cuando tengas Node)
1. Instalar Angular CLI:
   - `pnpm dlx @angular/cli@latest new gastos-frontend --standalone --routing --style=scss`
2. Entrar al proyecto:
   - `cd gastos-frontend`
3. Agregar PWA:
   - `pnpm ng add @angular/pwa`
4. Instalar cliente HTTP y libreria offline:
   - `pnpm add dexie`

## Variables de entorno
Definir `apiUrl` apuntando al backend desplegado (Render):
- `https://tu-backend.onrender.com`

## Pantallas MVP
- Carga diaria de gastos
- Reportes con filtros (fecha, categoria, subcategoria, persona, lugar)
- Catalogos basicos (opcional en primera version)

## Flujo offline
- Guardar gasto en IndexedDB con estado `pending`
- Mostrar al usuario inmediatamente
- Al volver internet, sincronizar contra `POST /expenses` o `POST /expenses/bulk-sync`
