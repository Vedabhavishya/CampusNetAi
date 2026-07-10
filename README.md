# CampusNet AI - AI-Powered Campus Network Controller

CampusNet AI is a high-fidelity, enterprise-grade AI-powered Campus Network Controller inspired by Juniper Mist, Cisco Meraki, and Aruba Central. 

It is a complete Network Management Platform capable of managing, configuring, monitoring, and analyzing Firewalls, Core Switches, Access Switches, and Wireless Access Points, VLANs, DHCP Pools, and Connected Clients.

---

## Technical Stack

### Frontend
- **React + TypeScript + Vite**
- **Tailwind CSS v4** (Blue/Cyan modern dark/light SaaS theme)
- **React Router** for declarative navigation
- **React Flow** (via `@xyflow/react`) for the interactive topology map
- **Recharts** for bandwidth, internet usage, and client OS distributions
- **Framer Motion** for premium animations

### Backend
- **FastAPI**
- **SQLAlchemy** (with PostgreSQL adapter and local SQLite database fallback)
- **Local Rule-Based AI Engine** mapping natural language queries to database telemetry
- **JWT Authorization** supporting role-based access control (RBAC)

---

## Project Structure

```
/campusnet-ai
├── backend/
│   ├── app/
│   │   ├── api/             # API Router (auth, devices, clients, vlans, AI)
│   │   ├── core/            # Config, security, DB session, database seeder
│   │   ├── models/          # SQLAlchemy database models
│   │   ├── schemas/         # Pydantic schemas for request/response validation
│   │   ├── services/        # AI engine logic, modular device collectors
│   │   └── main.py          # FastAPI application entry point
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/      # Button, Card, Table, Modal, Drawer, Tabs
│   │   ├── contexts/        # AuthContext, ThemeContext
│   │   ├── layouts/         # DashboardLayout shell
│   │   ├── pages/           # Pages (Dashboard, Inventory, managers, AI, topology, etc.)
│   │   ├── services/        # Stateful Mock & API client integration (api.ts)
│   │   ├── types/           # TS definitions (index.ts)
│   │   ├── App.tsx          # Router layout
│   │   └── index.css        # Tailwind CSS v4 variables & glassmorphism utilities
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```

---

## Getting Started

### 1. Run the Backend (FastAPI)
Navigate to the `backend` directory, install requirements, and run the dev server:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
- The backend API will start at [http://localhost:8000](http://localhost:8000).
- Automatic interactive documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).
- *By default, the database falls back to a local SQLite database (`campusnet.db`) for zero-configuration startup. To use PostgreSQL, edit the `DATABASE_URL` parameter in the `.env` file.*

### 2. Run the Frontend (React + Vite)
Navigate to the `frontend` directory, install packages, and run the Vite dev server:
```bash
cd frontend
npm install
npm run dev
```
- Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Role-Based Access Control (RBAC) Testing

CampusNet AI implements JWT Role-Based Access Control. To make testing extremely easy, we built a **Quick Switch RBAC Role** widget directly inside the user profile dropdown on the top-right of the dashboard:

1. **Super Admin** or **Network Administrator**:
   - Access: Full write/edit access.
   - Permissions: Can onboard/delete hardware, push radio frequency policies, create SSIDs, bind static DHCP reservations, quarantine clients, and enroll new operators.
2. **Network Engineer**:
   - Access: Write access to configs, read access to user roster.
   - Permissions: Can modify ports/radios and apply AI fixes, but cannot enroll or delete operator accounts.
3. **Read Only User**:
   - Access: View/Audit access.
   - Permissions: All save/update buttons, onboarding modals, delete icons, and quarantine actions are dynamically disabled or hidden.

---

## AI Center Capabilities

Ask the CampusNet AI console natural language queries such as:
- *"Are there any offline devices?"* (Fetches offline hardware details from DB)
- *"Show me client John's MacBook location"* (Inspects active wireless AP link stats)
- *"List active network warnings"* (Queries unresolved warning logs)
- *"Optimize RF configurations"* (Generates radio channel modifications)
