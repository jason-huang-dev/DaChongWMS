# Backend Typings

This directory contains local third-party stub files for backend libraries that
do not ship complete typing information in this repo's environment.

Rules:

- Keep these stubs focused on packages the backend actually imports.
- Prefer small, intentionally incomplete stubs over dumping broad `Any`-heavy
  copies of upstream APIs.
- Add or refine stubs only when strict checking in `backend/apps/*` or
  `backend/config/*` needs them.
- Do not put first-party shared types here. Those belong in `backend/apps/*`.

Current stubbed packages:

- `dj_database_url`
- `django_filters`
- `rest_framework`
