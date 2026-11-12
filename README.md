# PopStack

Plataforma fullstack de testing: CRUD de canciones pop en inglés.

| Capa | Destino |
| --- | --- |
| Frontend | Cloudflare Pages (`frontend/`) |
| Backend | Koyeb (`backend/`) |
| Base de datos | Firebase Firestore |
| Archivos | Cloudinary (portadas) |

Sin credenciales, el backend usa memoria + portadas inline para que puedas probar el CRUD al instante.

## Desarrollo local

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. Vite proxea `/api` al puerto `8080`.

## Conectar Firestore

1. Crea un proyecto en Firebase y habilita Firestore.
2. Genera una cuenta de servicio (IAM) y copia:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (conserva los `\n`)
3. En Firestore, colección `songs`. El backend siembra hits si está vacía.
4. Reglas de ejemplo (solo el backend con Admin SDK escribe; no expongas la service account en el frontend):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Conectar Cloudinary

Plan gratuito: Cloud name + API Key + API Secret en el backend.

```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=popstack
```

Las portadas se suben desde el formulario (multipart). Al borrar una canción también se borra la imagen.

## Deploy backend en Koyeb

1. Sube el repo a GitHub.
2. New App → GitHub → directorio `backend`.
3. Build: Dockerfile (incluido) o `npm install` + `npm start`.
4. Puerto `8080`.
5. Variables de entorno: las de `backend/.env.example` más:

```
FRONTEND_ORIGIN=https://TU-PROYECTO.pages.dev
```

Si usas un dominio custom en Pages, agrégalo separado por coma.

## Deploy frontend en Cloudflare Pages

1. New project → el mismo repo.
2. Root directory: `frontend`.
3. Build command: `npm run build`
4. Output: `dist`
5. Variable:

```
VITE_API_URL=https://TU-APP.koyeb.app
```

`public/_redirects` cubre el SPA (`/* → /index.html`).

## API

- `GET /api/health`
- `GET /api/songs`
- `GET /api/songs/:id`
- `POST /api/songs` (multipart: campos + `cover`)
- `PUT /api/songs/:id`
- `DELETE /api/songs/:id`

Campos: `title`, `artist`, `album`, `year`, `duration`, `genre`, `lyricsHook`.
# proyecto-crud-canciones
