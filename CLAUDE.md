# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This git repository is rooted at the home directory (`~/`) and tracks a full-stack web application project located at `~/Developer/Project/`, along with a senior project (SAVE) and resume PDF. The main application code lives in:

- `~/Developer/Project/backend/` — Spring Boot (Java) REST API
- `~/Developer/Project/frontend/` — React (JavaScript) SPA

## Backend (Spring Boot)

**Build & Run:**
```bash
cd ~/Developer/Project/backend
./mvnw spring-boot:run       # Run the application
./mvnw package               # Build JAR
./mvnw test                  # Run tests
```

**Configuration:** `src/main/resources/application.properties`
- Requires a MySQL database named `obss` running on `localhost:3306`
- Default credentials: root/utku (local dev only)
- JWT secret and expiration configured here

**Architecture:**
- Spring Boot 2.1.8 with Spring Security + JWT authentication
- MySQL via Spring Data JPA (Hibernate, `ddl-auto=update`)
- Lombok used throughout models
- Package root: `com.example.backend`
  - `controllers/` — REST controllers (`/api/...` prefix)
  - `models/` — JPA entities (User, MentorApplication, Mentorship, Phase)
  - `repository/` — Spring Data JPA repositories
  - `security/` — JWT filter chain, `WebSecurityConfig`, `UserDetailsServiceImpl`
  - `payload/request|response/` — request/response DTOs
  - `dto/` — additional DTOs

**Auth flow:** Login → JWT issued → `AuthTokenFilter` validates JWT on each request via `Authorization: Bearer <token>` header.

**Key API endpoints:**
- `POST /api/auth/signin`, `POST /api/auth/signup`
- `GET|POST|PUT|DELETE /api/applications/...` — mentor applications
- `GET|POST|PUT|DELETE /api/mentorships/...` — mentorships
- `/api/phases/...` — phases within mentorships

## Frontend (React)

**Run & Build:**
```bash
cd ~/Developer/Project/frontend
npm start        # Dev server on port 8081 (set in .env)
npm run build    # Production build
npm test         # Run tests
```

**Architecture:**
- React 16 class components with React Router v5
- Bootstrap 4 for styling
- Axios for HTTP requests (via `src/services/`)
- JWT stored in localStorage; `auth-header.js` attaches it to requests
- Role-based UI: admin board visible only to `ROLE_ADMIN` users
- `src/services/auth.service.js` — login/logout/register, localStorage management
- `src/services/user.service.js` — API calls for board content
- `src/components/` — page-level components (login, register, profile, boards)
- `src/common/EventBus.js` — pub/sub for logout events across components
