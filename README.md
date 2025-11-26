# Invitación de boda - Rubén & Miriam

Aplicación sencilla para compartir una invitación de boda personalizada y confirmar asistencia (RSVP).

## Requisitos
- Node.js 18+

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

La aplicación se iniciará en `http://localhost:3000`.

## Producción

```bash
npm start
```

## Personalización de invitados

Edita `data/guests.json` y añade entradas como:

```json
[
  { "code": "ruben-familia", "displayName": "Familia de Rubén", "maxGuests": 4 },
  { "code": "miriam-amiga-ana", "displayName": "Ana", "maxGuests": 2 }
]
```

- `code`: el código único de invitación. Se añadirá al enlace como `?i=code`.
- `displayName`: cómo se mostrará el nombre en la invitación.
- `maxGuests`: máximo de asistentes permitidos para ese invitado.

Comparte enlaces como:

```
http://localhost:3000/?i=miriam-amiga-ana
```

Si no se incluye código, el invitado podrá introducirlo manualmente.

## Consultar RSVPs (admin)

Endpoint: `GET /api/admin/rsvps?key=TU_CLAVE`  
Configura la clave vía variable de entorno `ADMIN_KEY`. Por defecto: `cambialo-por-un-valor-seguro`.

Ejemplo:

```
http://localhost:3000/api/admin/rsvps?key=cambialo-por-un-valor-seguro
```

## Dónde se guardan las respuestas

Todas las confirmaciones se almacenan en `data/rsvps.json`. Puedes exportar/analizar ese archivo cuando lo necesites.

## Estilos y contenido

Puedes modificar los textos y estilos en:
- `public/index.html`
- `public/styles.css`
- `public/app.js`


