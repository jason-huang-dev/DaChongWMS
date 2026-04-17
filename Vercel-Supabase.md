# Vercel + Supabase Hosting Setup

This README describes the exact deployment shape for this repository when using:

- `frontend/` hosted on **Vercel**
- `backend/` hosted on **Vercel**
- PostgreSQL hosted on **Supabase**

It assumes a monorepo structure like this:

```text
repo/
  frontend/
  backend/
```

In Vercel, these should be deployed as **two separate projects from the same repository**:

- Project 1: `frontend/`
- Project 2: `backend/`

---

## 1. Final architecture

```text
Browser
  -> Vercel frontend project (frontend/)
  -> HTTPS requests to Vercel backend project (backend/)
  -> Django on Vercel Python runtime
  -> Supabase Postgres
```

This means:

- the frontend is built and served by Vercel
- the backend is deployed as a Django app on Vercel's Python runtime
- the backend talks to Supabase Postgres through `DATABASE_URL`
- the frontend never connects directly to Postgres

---

## 2. What Vercel projects to create

Create **two Vercel projects** from the same Git repository.

### Frontend Vercel project

Use these project settings:

- **Root Directory:** `frontend`
- **Framework Preset:** `Vite`
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

### Backend Vercel project

Use these project settings:

- **Root Directory:** `backend`
- **Framework Preset:** `Other`
- **Install Command:** `pip install -r requirements.txt`
- **Build Command:** `sh build.sh`
- **Output Directory:** none

> This setup intentionally does **not** use Docker in production. Keep Docker only for local development if you still want it.

---

## 3. Frontend setup

The frontend should call the backend through an environment variable.

### 3.1 Required frontend env vars

Create the following files, or use the tracked examples in this repository:

- `frontend/.env.example` for local defaults
- `frontend/.env.vercel.example` for the Vercel frontend project

```env
# frontend/.env.development
VITE_API_BASE_URL=http://127.0.0.1:8000
```

```env
# frontend/.env.production
VITE_API_BASE_URL=https://YOUR-BACKEND-PROJECT.vercel.app
```

In Vercel, add this env var to the **frontend** project:

```env
VITE_API_BASE_URL=https://YOUR-BACKEND-PROJECT.vercel.app
```

If your project uses other frontend flags, keep them as needed, for example:

```env
VITE_ENABLE_TEST_SYSTEM=false
```

### 3.2 Frontend config file

In `frontend/src/lib/config.ts`, make sure the API base URL comes from Vite env vars.

```ts
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
}
```

### 3.3 Frontend local development proxy

If you want the frontend dev server to proxy `/api` to Django locally, configure `frontend/vite.config.ts` like this:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
```

### 3.4 Optional frontend Vercel SPA fallback

If your frontend uses client-side routing and direct refreshes on nested routes return `404`, add this file:

```json
// frontend/vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 4. Backend setup

The backend should be deployed as a dedicated Vercel Python project.

### 4.1 Required backend packages

Make sure `backend/requirements.txt` includes these packages:

```txt
Django
psycopg[binary]
dj-database-url
django-cors-headers
whitenoise
```

Notes:

- Use **one** Postgres driver only.
- The recommended driver for current Django is `psycopg[binary]`.
- Do not install both `psycopg[binary]` and `psycopg2-binary` unless you explicitly know why.

### 4.2 Vercel Python entrypoint

Add this file:

```python
# backend/api/index.py
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.prod')

from config.wsgi import application

app = application
```

This file exposes Django's WSGI app to Vercel.

### 4.3 Backend vercel.json

Add this file:

```json
// backend/vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ]
}
```

This sends backend requests through the `api/index.py` Django entrypoint, which is exposed at the `/api` route.

If you need to raise the function max duration, set it in the Vercel dashboard under the backend project's Functions settings instead of using a `functions` glob in `vercel.json`.

### 4.4 Python version

Add one of the following to `backend/`:

```text
# backend/.python-version
3.12
```

or define the Python version in `pyproject.toml` if your backend uses one.

### 4.5 Backend build step for static assets

Add this file so Vercel collects Django admin and other backend static files during the build:

```sh
# backend/build.sh
#!/bin/sh
set -eu

python manage.py collectstatic --noinput
```

---

## 5. Django settings layout

Use separate settings files:

```text
backend/config/settings/
  base.py
  dev.py
  prod.py
```

### 5.1 `base.py`

Use `base.py` for shared settings.

Example:

```python
# backend/config/settings/base.py
from pathlib import Path
import os
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-only-secret-key')
DEBUG = os.getenv('DJANGO_DEBUG', 'false').lower() == 'true'

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv('DJANGO_ALLOWED_HOSTS', '').split(',')
    if host.strip()
]

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv('DJANGO_CORS_ALLOWED_ORIGINS', '').split(',')
    if origin.strip()
]

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',')
    if origin.strip()
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    # your apps...
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': dj_database_url.config(
        default=os.getenv('DATABASE_URL', ''),
        conn_max_age=0,
        ssl_require=True,
    )
}

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    }
}
```

### 5.2 `dev.py`

Example:

```python
# backend/config/settings/dev.py
from .base import *

DEBUG = True

ALLOWED_HOSTS = ['127.0.0.1', 'localhost']
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
CSRF_TRUSTED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
```

### 5.3 `prod.py`

Example:

```python
# backend/config/settings/prod.py
from .base import *

DEBUG = False

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = False
```

`SECURE_SSL_REDIRECT` can stay `False` on Vercel because traffic already terminates over HTTPS at the platform edge.

---

## 6. Backend env vars

Set these in the **backend Vercel project**.

This repository includes a ready-to-copy example at `backend/.env.vercel.example`.

### 6.1 Required backend env vars

```env
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_SECRET_KEY=replace-with-a-long-random-secret
DJANGO_DEBUG=false
DATABASE_URL=postgresql://postgres.zimhwusclepfjwunwdcb:[YOUR-PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres
DJANGO_ALLOWED_HOSTS=YOUR-BACKEND-PROJECT.vercel.app
DJANGO_CORS_ALLOWED_ORIGINS=https://YOUR-FRONTEND-PROJECT.vercel.app
DJANGO_CSRF_TRUSTED_ORIGINS=https://YOUR-FRONTEND-PROJECT.vercel.app,https://YOUR-BACKEND-PROJECT.vercel.app
DJANGO_CORS_ALLOW_CREDENTIALS=true
```

### 6.2 Optional backend env vars

```env
DJANGO_TIME_ZONE=UTC
# Uncomment these if you rely on Django session cookies across origins.
# DJANGO_SESSION_COOKIE_SAMESITE=None
# DJANGO_CSRF_COOKIE_SAMESITE=None
```

If you later use a custom domain, update the values accordingly:

```env
DJANGO_ALLOWED_HOSTS=api.example.com
DJANGO_CORS_ALLOWED_ORIGINS=https://app.example.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://app.example.com,https://api.example.com
```

Important:

- `DJANGO_ALLOWED_HOSTS` contains **hostnames only**.
- `DJANGO_CORS_ALLOWED_ORIGINS` contains **full origins with scheme**.
- `DJANGO_CSRF_TRUSTED_ORIGINS` also contains **full origins with scheme**.

Examples:

- Correct host: `api.example.com`
- Correct origin: `https://app.example.com`
- Incorrect `ALLOWED_HOSTS` value: `https://api.example.com`

---

## 7. How to set up CORS correctly

Since the frontend and backend are on different Vercel domains, the browser sees them as different origins.

That means Django must allow the frontend origin explicitly.

### 7.1 What each setting does

- `CORS_ALLOWED_ORIGINS` lets the browser make cross-origin requests to the backend.
- `CSRF_TRUSTED_ORIGINS` allows Django's CSRF protection to trust unsafe requests such as `POST`, `PATCH`, `PUT`, and `DELETE` coming from the frontend origin.
- `ALLOWED_HOSTS` tells Django which hostnames it is allowed to serve.

### 7.2 Exact example

If:

- frontend URL = `https://dachongwms-frontend.vercel.app/`
- backend URL = `https://dachongwms-backend.vercel.app/`

then set:

```env
DJANGO_ALLOWED_HOSTS=dachongwms-backend.vercel.app
DJANGO_CORS_ALLOWED_ORIGINS=https://dachongwms-frontend.vercel.app
DJANGO_CSRF_TRUSTED_ORIGINS=https://dachongwms-frontend.vercel.app,https://dachongwms-backend.vercel.app
DJANGO_CORS_ALLOW_CREDENTIALS=true
```

### 7.3 If you use cookies or session auth

If your frontend uses cookie-based auth or Django session auth across origins, configure:

```env
DJANGO_CORS_ALLOW_CREDENTIALS=true
DJANGO_SESSION_COOKIE_SAMESITE=None
DJANGO_CSRF_COOKIE_SAMESITE=None
```

The repository already enforces `SESSION_COOKIE_SECURE=True` and `CSRF_COOKIE_SECURE=True` in `config.settings.prod`.

If you use token or header auth only, you can leave the SameSite values at their defaults.

---

## 8. How Supabase Postgres fits into this setup

Supabase is only the **database host** in this architecture.

It is not serving the frontend.
It is not serving the Django app.
It is only providing PostgreSQL.

The connection flow is:

```text
Frontend -> Django backend -> Supabase Postgres
```

So:

- browser requests go to the frontend and backend on Vercel
- Django reads and writes data using the Postgres connection string from Supabase
- the frontend does not use the raw Postgres connection string

---

## 9. Which Supabase connection string to use

For a Vercel-hosted Django backend, use the **Supabase session pooler** connection string from the Supabase dashboard's **Connect** panel.

Why:

- Vercel's Python runtime is serverless-style
- the session pooler still gives you pooled connections through the Supabase pooler endpoint
- this repository is configured to avoid long-lived Django connections with `conn_max_age=0`, which keeps it compatible with the pooled connection model

Use the connection string that looks like this:

```env
DATABASE_URL=postgresql://postgres.zimhwusclepfjwunwdcb:[YOUR-PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres
```

Use the password you set in Supabase in place of `[YOUR-PASSWORD]`.

---

## 10. Django + Supabase database configuration

The simplest backend database setup is:

```python
DATABASES = {
    'default': dj_database_url.config(
        default=os.getenv('DATABASE_URL', ''),
        conn_max_age=0,
        ssl_require=True,
    )
}
```

Why this shape:

- `DATABASE_URL` comes from Supabase
- `ssl_require=True` ensures SSL is used
- `conn_max_age=0` avoids keeping long-lived Django DB connections around in a serverless-style runtime

If you are on a current Django + `psycopg` stack, Django's PostgreSQL backend already disables prepared statements by default in its psycopg3 connection handling, which helps compatibility with connection poolers.

---

## 11. How to get the Supabase connection string

In Supabase:

1. Open your project
2. Click **Connect**
3. Choose the **Session pooler** connection string
4. Copy that value into the backend Vercel project's `DATABASE_URL`

Example backend env var:

```env
DATABASE_URL=postgresql://postgres.zimhwusclepfjwunwdcb:[YOUR-PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres
```

---

## 12. Running migrations

You still need Django migrations.

The cleanest approach is:

1. Deploy the backend project with all backend env vars set
2. Run migrations against the same `DATABASE_URL`
3. Then verify `/health/`, `/admin/`, and your API routes

You can run migrations from:

- your local machine using the production `DATABASE_URL`, or
- CI/CD, or
- a separate scripted deployment step

Example:

```bash
cd backend
export DJANGO_SETTINGS_MODULE=config.settings.prod
export DATABASE_URL='postgresql://postgres.zimhwusclepfjwunwdcb:[YOUR-PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres'
python manage.py migrate
```

If you want automatic migrations on deploy, add a dedicated CI step or a Vercel-compatible scripted deploy process. Do not run migrations inside normal request handling.

---

## 13. Static files and Django admin

For backend static files such as Django admin assets:

- set `STATIC_ROOT`
- keep `whitenoise`
- keep `django.contrib.staticfiles`

With this setup, Vercel can collect static files during build and serve them through its CDN.

This matters mainly for:

- Django admin
- any backend-served static assets

---

## 14. Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install -r requirements.txt
export DJANGO_SETTINGS_MODULE=config.settings.dev
python manage.py migrate
python manage.py runserver
```

Typical local URLs:

- frontend: `http://127.0.0.1:5173`
- backend: `http://127.0.0.1:8000`

---

## 15. What you no longer need for production

For this Vercel + Supabase setup, you do **not** need in production:

- a production Docker image for Django
- a production Docker image for the Vite frontend
- Nginx in front of Django
- a combined Python + Node Dockerfile

Keep Docker only if you want it for local development or local parity.

---

## 16. Recommended production checklist

### Frontend project

- [ ] Root Directory set to `frontend`
- [ ] `VITE_API_BASE_URL` points to backend Vercel URL
- [ ] Optional SPA rewrite added if needed

### Backend project

- [ ] Root Directory set to `backend`
- [ ] `api/index.py` exists
- [ ] `vercel.json` exists
- [ ] `build.sh` exists and the Vercel build command runs it
- [ ] `DJANGO_SETTINGS_MODULE=config.settings.prod`
- [ ] `DJANGO_SECRET_KEY` set
- [ ] `DATABASE_URL` set to the Supabase session pooler
- [ ] `DJANGO_ALLOWED_HOSTS` set correctly
- [ ] `DJANGO_CORS_ALLOWED_ORIGINS` set correctly
- [ ] `DJANGO_CSRF_TRUSTED_ORIGINS` set correctly
- [ ] function max duration configured in the Vercel dashboard if your requests need more than the default
- [ ] migrations applied

### Supabase

- [ ] project created
- [ ] session pooler connection string copied
- [ ] database password confirmed
- [ ] schema migrated

---

## 17. Example final values

### Frontend Vercel env vars

```env
VITE_API_BASE_URL=https://dachongwms-backend.vercel.app
VITE_ENABLE_TEST_SYSTEM=false
```

### Backend Vercel env vars

```env
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_SECRET_KEY=replace-with-a-real-secret
DJANGO_DEBUG=false
DATABASE_URL=postgresql://postgres.zimhwusclepfjwunwdcb:[YOUR-PASSWORD]@aws-1-us-east-2.pooler.supabase.com:5432/postgres
DJANGO_ALLOWED_HOSTS=dachongwms-backend.vercel.app
DJANGO_CORS_ALLOWED_ORIGINS=https://dachongwms-frontend.vercel.app
DJANGO_CSRF_TRUSTED_ORIGINS=https://dachongwms-frontend.vercel.app,https://dachongwms-backend.vercel.app
DJANGO_CORS_ALLOW_CREDENTIALS=true
DJANGO_TIME_ZONE=UTC
```

---

## 18. Summary

This deployment model is:

- **frontend on Vercel**
- **backend on Vercel**
- **database on Supabase Postgres**

The important connection rules are:

- frontend uses `VITE_API_BASE_URL`
- backend uses `DATABASE_URL`
- CORS allows the frontend origin
- CSRF trusts the frontend origin
- Supabase is the database only
- Django is the only layer that talks to Postgres
