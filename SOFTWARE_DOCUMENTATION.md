# SOFTWARE DOCUMENTATION
## AI-Powered Smart Campus Network Controller (CampusNet AI)
### Comprehensive Project Report: Software & Controller Modules

---

## 1. Software Module Overview
**CampusNet AI** is a high-fidelity, enterprise-grade AI-powered Smart Campus Network Controller designed to centralize and automate the monitoring, configuration, and management of modern network infrastructures. Built to interface with enterprise hardware (specifically Juniper SRX Firewalls, EX Series Core and Access Switches, and Mist Access Points), the software acts as the administrative brain of the network.

### Principal Core Functions
1. **Unified Administration & Telemetry Aggregation**: Consolidates status monitoring, CPU/memory usage, hardware temperatures, device uptimes, and client connectivity status into a single glassmorphic dashboard.
2. **Dynamic Configuration Provisioning**: Enables administrators to change radio frequencies, configure SSID mappings, modify security zones, define firewall policies, provision VLAN subnets, and assign static DHCP leases dynamically.
3. **Automated SSH Telemetry Extraction**: Connects directly to Juniper devices using SSH (via standard JunOS command CLI queries), parses raw text responses into structured JSON payloads, and updates a real-time caching engine.
4. **Local Rule-Based AI Engine**: Maps natural language queries from operators (e.g., *"Are there any offline devices?"* or *"Trace John's Macbook"*) to structural database queries, outputting clear contextual actions and direct execution scripts.
5. **Role-Based Security Policy Enforcement**: Implements JWT-secured authentication to restrict operations by user roles (Super Admin, Network Administrator, Network Engineer, and Read-Only Auditor).

---

## 2. Frontend Technologies
The frontend interface is engineered as a modern Single Page Application (SPA) prioritizing real-time reactivity, absolute layout responsiveness, and rich aesthetics (glassmorphism design system).

*   **Core Library**: **React (v19.2.7)** with **TypeScript** for strict static type-safety across components, network schemas, and API handlers.
*   **Build Tool**: **Vite (v8.1.1)** for fast hot-module replacement (HMR) and optimized client asset compilation.
*   **Styling Engine**: **Tailwind CSS v4** featuring HSL-curated color palettes, dark/light theme switching, and custom glassmorphic styling utilities (`glass-panel` and `glass-panel-hover`).
*   **Routing**: **React Router DOM (v7.18.1)** for declarative application routing, protected routes (requires active authentication), and nested dashboard layouts.
*   **Data Fetching & State Synchronization**: **TanStack React Query (v5.101.2)** for client-side API caching, state mutation, window-refocus synchronization, and error-retry logic.
*   **Data Visualization**: **Recharts (v3.9.2)** for interactive charting of network bandwidth (RX/TX rates), historical CPU/memory trends, client operating system distribution, and SLA threshold compliance.
*   **Network Topology Mapping**: **React Flow (@xyflow/react v12.11.2)** for rendering an interactive, responsive network node canvas mapping the link paths from the SRX Firewall through spine switches to access switches and AP nodes.
*   **Micro-Animations**: **Framer Motion (v12.42.2)** to animate navigation transitions, slide-over detail drawers, warning alerts, and status widgets.
*   **Iconography**: **Lucide React (v1.23.0)** for uniform SVGs representing network hardware, clients, and alerts.

---

## 3. Backend Technologies
The backend is a high-performance RESTful API service engineered using Python, structured for clean separation of concerns and database-agnostic operations.

*   **API Framework**: **FastAPI (v0.111.0)** for high-throughput asynchronous execution, validation schemas, and automated Interactive API documentation (`/docs` using Swagger UI).
*   **Asynchronous ASGI Server**: **Uvicorn (v0.30.1)** acting as the runtime interface for FastAPI.
*   **Object-Relational Mapping (ORM)**: **SQLAlchemy (v2.0.31)** representing databases as declarative Python classes and abstraction models.
*   **Database Engine**: Default fallback is a local **SQLite** database (`campusnet.db`) for zero-configuration testing. Can be switched to an enterprise-grade **PostgreSQL** database server by defining the `DATABASE_URL` parameter in the environment variables.
*   **Security & Hashing**: **passlib (v1.7.4)** with the **bcrypt** algorithm for secure, one-way password hashing. **python-jose (v3.3.0)** for compiling, signing, and decoding JWT Access Tokens securely.
*   **Data Validation**: **Pydantic (v2.7.4)** enforcing strict validation schemas for incoming JSON requests (e.g. login packets, VLAN creation, configuration updates) and outgoing API response models.
*   **Device Automation & SSH Connections**: **Paramiko (v4.1.3)** for spawning SSH sessions to execute commands sequentially on Juniper Junos OS devices, measuring connection latency, and capturing raw terminal buffers.

### API Request Flow Diagram
```
[Client App] --> (JSON Request) --> [FastAPI Router]
                                         |
                                         v
                            [Pydantic Request Schema]
                                         |
                       (Authorized Check via JWT Dependency)
                                         |
                                         v
                              [Service Layer / ORM]
                             /                     \
                            v                       v
               [SQLAlchemy Model Session]    [SSH Collector Daemon]
                            |                       |
               [PostgreSQL / SQLite DB]      [Juniper Device (Junos)]
```

---

## 4. Database Design
The relational database layout is structured to maintain network inventory, client sessions, subnets, alerts, and optimization logs.

### Entity Relationship Diagram (Text-based)
```
  +--------------+               +--------------+
  |    USERS     |               |  DHCP_LEASES |
  +--------------+               +--------------+
  | PK: id       |               | PK: id       |
  | username     |               | ip_address   |
  | email        |          +--->| mac_address  |
  | role         |          |    | client_name  |
  | is_active    |          |    | lease_time   |
  +--------------+          |    | FK: vlan_id  |
                            |    +--------------+
  +--------------+          |
  |   DEVICES    |          |    +--------------+
  +--------------+          |    |    VLANS     |
  | PK: id       |<-----+   |    +--------------+
  | name         |      |   +----| PK: id       |
  | type         |      |        | name         |
  | ip_address   |      |        | subnet       |
  | mac_address  |      |        | dhcp_range   |
  | status       |      |        | dns_servers  |
  | model        |      |        | leases_count |
  | version      |      |        +--------------+
  | uptime       |      |
  | health_score |      |        +--------------+
  | config (JSON)|      |        |    ALERTS    |
  +--------------+      |        +--------------+
                        |        | PK: id       |
  +--------------+      |        | severity     |
  |   CLIENTS    |      |        | message      |
  +--------------+      |        | timestamp    |
  | PK: id       |      +--------| FK: device_id|
  | name         |      |        | device_name  |
  | mac_address  |      |        | resolved     |
  | ip_address   |      |        | category     |
  | conn_type    |      |        +--------------+
  | status       |      |
  | FK: dev_id   |------+        +--------------+
  | dev_name     |               |   INSIGHTS   |
  | vlan_id      |               +--------------+
  | os           |               | PK: id       |
  | signal/band  |               | category     |
  +--------------+               | title        |
                                 | description  |
                                 | impact       |
                                 | status       |
                                 | timestamp    |
                                 | action       |
                                 +--------------+
```

### Table Schemas and Attributes

#### 1. Users Table (`users`)
Holds operational credentials and roles.
*   `id` (String, Primary Key): Unique uuid prefix (`usr-x`).
*   `username` (String, Unique, Index): Unique system login username.
*   `email` (String, Unique, Index): Registered administrator email.
*   `hashed_password` (String): Secure bcrypt-hashed password string.
*   `role` (String): Permissions clearance (`Super Admin`, `Network Administrator`, `Network Engineer`).
*   `is_active` (Boolean): Operational state.

#### 2. Devices Table (`devices`)
Inventory and configurations of switches, firewalls, and APs.
*   `id` (String, Primary Key): Unique device ID identifier (`dev-x`).
*   `name` (String, Unique, Index): Logical device name.
*   `type` (String): Classification (`firewall`, `core_switch`, `access_switch`, `access_point`).
*   `ip_address` (String): Management IPv4 Address.
*   `mac_address` (String, Unique): Physical hardware MAC address.
*   `status` (String): Current heartbeat state (`online`, `offline`, `warning`).
*   `model` (String): Hardware description model (e.g. `Juniper SRX300`, `Juniper EX4400-24T`).
*   `version` (String): Active Junos OS version code.
*   `uptime` (String): Duration since last boot.
*   `health_score` (Integer): Dynamic percentage score based on telemetry constraints.
*   `cpu_usage` (Integer): Routing Engine CPU loading.
*   `memory_usage` (Integer): Operational RAM utilization percentage.
*   `clients_count` (Integer): Number of active connection sessions bound.
*   `config` (JSON): Mapped dynamic settings (interfaces speed/PoE state, active SSIDs, DNS, routing).

#### 3. Clients Table (`clients`)
Contains endpoints and wireless stations active on the network.
*   `id` (String, Primary Key): Session ID (`cli-x`).
*   `name` (String): Client hostname.
*   `mac_address` (String, Unique): Network interface card MAC address.
*   `ip_address` (String): Active DHCP lease IP address.
*   `connection_type` (String): Medium type (`wired`, `wireless`).
*   `status` (String): Activity status (`active`, `inactive` [quarantined]).
*   `rx_rate` (Float): Current Download Rate in Mbps.
*   `tx_rate` (Float): Current Upload Rate in Mbps.
*   `signal_strength` (Integer, Nullable): RSSI metric in dBm (for wireless nodes).
*   `connected_to_device_id` (String): ID of the switch or AP the client is linked to.
*   `connected_to_device_name` (String): Device hostname client is connected to.
*   `vlan_id` (Integer): Assigned VLAN index tag.
*   `os` (String): Detected operating system (e.g. `macOS Sonoma`, `Windows 11 Enterprise`, `Embedded Linux`).
*   `band` (String, Nullable): RF range band (`2.4GHz`, `5GHz`).

#### 4. VLANs Table (`vlans`)
Subnet configurations.
*   `id` (Integer, Primary Key): VLAN Tag Identifier (e.g. `10`, `20`, `30`, `40`).
*   `name` (String): Subnet identification tag.
*   `subnet` (String): IPv4 CIDR allocation (e.g. `10.10.10.0/24`).
*   `dhcp_range` (String): Allocation pool boundaries.
*   `dns_servers` (JSON): Dynamic DNS configurations.
*   `active_leases_count` (Integer): Current reservation counter.

#### 5. DHCP Leases Table (`dhcp_leases`)
Active IP allocations mapping to client physical MACs.
*   `id` (String, Primary Key): Lease identifier (`lease-x`).
*   `ip_address` (String, Unique): Mapped IPv4 address.
*   `mac_address` (String, Unique): Client hardware identifier.
*   `client_name` (String): Destination identifier.
*   `lease_time` (String): Duration remaining.
*   `vlan_id` (Integer, Foreign Key): Map link to `vlans.id`.

#### 6. Alerts Table (`alerts`)
Network warning logs and operational syslogs.
*   `id` (String, Primary Key): Event identifier (`alert-x`).
*   `severity` (String): Level identifier (`info`, `warning`, `critical`).
*   `message` (String): Raw warning details text.
*   `timestamp` (String): ISO String formatting of creation time.
*   `device_id` (String, Nullable): Mapped hardware source.
*   `device_name` (String, Nullable): Hostname of source device.
*   `resolved` (Boolean): Flag indicating audit complete.
*   `category` (String): Event type (`system`, `device`, `security`, `client`).

#### 7. AI Insights Table (`insights`)
Optimization logs generated by the AI Engine.
*   `id` (String, Primary Key): Recommendation identifier (`insight-x`).
*   `category` (String): Focus area (`security`, `performance`, `optimization`, `anomaly`).
*   `title` (String): Insight headline.
*   `description` (String): Concrete diagnosis data.
*   `impact` (String): Projected performance metric improvement.
*   `status` (String): Execution state (`pending`, `applied`, `ignored`).
*   `timestamp` (String): Trigger time.
*   `suggested_action` (String): Human-readable programmatic solution description.

---

## 5. System Architecture
The application layout conforms to a decoupled Client-Server architecture pattern, enhanced with synchronous hardware collectors.

```
       +-------------------------------------------------------+
       |                     PRESENTATION LAYER                |
       |  React SPA (Vite + TS + Tailwind v4 + Recharts)       |
       +-------------------------------------------------------+
                                   |
                     JSON HTTP API | (Axios / Fetch)
                                   v
       +-------------------------------------------------------+
       |                      CONTROL LAYER                    |
       |  FastAPI Framework (JWT Routing & Role Enforcement)   |
       +-------------------------------------------------------+
              |                                         |
              v (SQLAlchemy ORM)                        v (Async Scheduler)
+----------------------------+            +----------------------------+
|        DATA STORE          |            |     COLLECTION LAYER       |
|  SQLite / PostgreSQL DB    |            |   Paramiko SSH Collectors  |
+----------------------------+            +----------------------------+
                                                        |
                                                        | JunOS CLI (Port 22)
                                                        v
                                          +----------------------------+
                                          |      PHYSICAL HARDWARE     |
                                          |  Juniper SRX, EX, AP Nodes |
                                          +----------------------------+
```

### Components Interaction Details
1.  **Client Layer (Frontend)**: Runs locally in the operator's web browser, executing React state mutations. It loads network statistics, communicates with the API endpoints, and falls back to browser-based `localStorage` state simulation if the backend is down.
2.  **API Control Layer (Backend)**: Decodes client request tokens, routes calls to appropriate services, enforces Role-Based Access Control, and serializes database objects to client-friendly JSON.
3.  **Data Store**: Houses network schemas, configuration parameters, authentication credentials, active VLAN subnets, and static leases.
4.  **Collection & Operations Layer**: Uses Paramiko-based collectors matching specific device models. In background loops, it connects to physical hardware, executes CLI telemetry queries, parses the responses, and feeds the `telemetry_cache` structure which is then queried by the API.

---

## 6. API Documentation

| Method | Endpoint | Purpose | Request Body | Response JSON | Auth Required | Minimum Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/login` | Session Authentication Token generation | `{ username, password, role }` | `{ access_token, token_type, role, username }` | No | - |
| **GET** | `/api/v1/devices` | Retrieves list of devices with real-time status and cached telemetry | None | Array of `DeviceOut` | Yes | Network Engineer |
| **GET** | `/api/v1/inventory` | Fetches hardware vendor and Junos version details | None | Array of Inventory Objects | Yes | Network Engineer |
| **PUT** | `/api/v1/devices/{device_id}` | Updates configuration attributes and pushes them to physical hardware | `{ interfaces, ssids, firmwareAutoUpdate, dnsServers }` | Updated `DeviceOut` object | Yes | Network Engineer |
| **POST** | `/api/v1/devices/onboard` | Claims and registers a new device to the network inventory database | `{ name, type, model, ipAddress, macAddress, version, status, config }` | Created `DeviceOut` object | Yes | Network Administrator |
| **DELETE**| `/api/v1/devices/{device_id}` | Decommissions and deletes a device record from network | None | `{"success": true}` | Yes | Network Administrator |
| **GET** | `/api/v1/clients` | Retrieves active client sessions roster | None | Array of `ClientOut` | Yes | Network Engineer |
| **POST** | `/api/v1/clients/{client_id}/quarantine` | Isolates a client session and blocks connection access | None | Updated `ClientOut` (status: inactive) | Yes | Network Engineer |
| **GET** | `/api/v1/vlans` | Fetches active VLAN subnet database mappings | None | Array of `VlanOut` | Yes | Network Engineer |
| **POST** | `/api/v1/vlans` | Provisions a new VLAN subnet | `{ id, name, subnet, dhcpRange, dnsServers }` | Mapped `VlanOut` object | Yes | Network Engineer |
| **DELETE**| `/api/v1/vlans/{vlan_id}` | Deletes a VLAN subnet configuration (prevents management VLAN 10 delete) | None | `{"success": true}` | Yes | Network Administrator |
| **GET** | `/api/v1/dhcp/leases` | Retrieves active DHCP leases and mappings | None | Array of `DhcpLeaseOut` | Yes | Network Engineer |
| **POST** | `/api/v1/dhcp/reservations` | Configures a static IP binding reservation for a MAC address | `{ id, ipAddress, macAddress, clientName, vlanId }` | Created `DhcpLeaseOut` object | Yes | Network Engineer |
| **GET** | `/api/v1/alerts` | Fetches active system logs and alerts | None | Array of `AlertOut` | Yes | Network Engineer |
| **POST** | `/api/v1/alerts/{alert_id}/resolve` | Resolves and archives a system log alert | None | `{"success": true}` | Yes | Network Engineer |
| **POST** | `/api/v1/ai/query` | Parses natural language query strings through rule matching | `{ prompt }` | `{ text, data }` | Yes | Network Engineer |
| **GET** | `/api/v1/ai/insights` | Fetches AI Optimization Recommendations | None | Array of `InsightOut` | Yes | Network Engineer |
| **POST** | `/api/v1/ai/insights/{insight_id}/apply` | Executes recommended action configuration changes on hardware | None | `{"success": true}` | Yes | Network Engineer |

---

## 7. Authentication & Authorization Flow
Security operations conform to OAuth2 Password Bearer guidelines with signed JSON Web Tokens.

```
[User App] ---> Login Credentials (pwd, role) ---> [API Auth Endpoint]
                                                          |
                                           Verify user role matching query
                                                          |
                                            Hash & check verify_password()
                                                          |
[User App] <--- Return JWT signed Token <--- Encode sub (username) + role
```

1.  **Registration / Seeding**: Administrators are seeded securely into the SQLite/PostgreSQL database on initialization using SHA-256 bcrypt hashing. No public user signup exists to prevent credential harvesting.
2.  **Login Verification**:
    *   The frontend posts credentials to `/api/v1/login`.
    *   The controller queries the `users` table. If the username exists, it runs `pwd_context.verify(plain, hashed)` to validate.
    *   It checks whether the user's role matches the requested role.
3.  **JWT Issuance**: On successful verification, the API issues a JWT access token encoding the username as the subject (`sub`) and signing it with the system `SECRET_KEY` using the `HS256` hashing algorithm. By default, the token expires in 480 minutes (8 hours).
4.  **Authorization & RBAC Enforcement**:
    *   For subsequent requests, the frontend sends the token in the `Authorization: Bearer <token>` header.
    *   FastAPI dependencies decode the token, check for signature validity and expiration, and retrieve the user model.
    *   `RoleChecker` dependencies verify if the user's role is authorized to perform the action.
    *   *Super Admin & Network Administrator*: Full read/write access. Can onboard/decommission hardware, modify VLANs, assign static leases, and edit interfaces.
    *   *Network Engineer*: Read access to telemetry; write access to toggle interfaces and apply RF optimizations. Cannot delete base structures like VLAN 10 or register operators.
    *   *Read Only*: Only GET endpoints are permitted. Modals, delete icons, and actions are disabled.

---

## 8. Dashboard Features
The frontend features modular pages focused on network tasks:

1.  **Operations Dashboard**: Provides a high-level view of network status. Displays overall SLA scores, active wireless/wired client distributions, and bandwidth consumption graphs (via Recharts), and critical warnings.
2.  **Device Inventory**: A list of managed hardware (firewalls, core switches, access switches, APs) displaying IP addresses, MAC addresses, Junos software versions, health status indicators, and active client loads.
3.  **Network Topology Map**: Renders an interactive canvas layout mapping device links. Relies on React Flow to draw relationships between nodes, color-coding nodes by status (green for online, red for offline, orange for warning).
4.  **Client Manager**: Table displaying active user sessions, operating system details, connection types, bandwidth footprints, and wireless RSSI. Includes a one-click **Quarantine** trigger to isolate rogue clients.
5.  **VLAN Manager**: Allows administrators to define subnets, configure IP scopes, and bind subnets to physical network profiles.
6.  **DHCP Manager**: Manages DHCP lease times, active leases, and static IP reservations.
7.  **SLA Dashboard**: Focuses on network performance indicators, tracking metrics like jitter, latency, and packet loss against set SLAs.
8.  **AI Center**: An interactive console featuring a chat input. Operators type natural language queries, and the local rule-based AI engine processes them to display telemetry and recommend optimization actions.

---

## 9. Folder Structure
The code is divided into decoupled frontend and backend components.

```
/campusnet-ai
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints.py         # REST controller route definitions
│   │   ├── core/
│   │   │   ├── config.py            # Environment configurations (JWT key, DB path)
│   │   │   ├── database.py          # SQLAlchemy base configuration
│   │   │   └── seed.py              # Default database seed scripts
│   │   ├── models/
│   │   │   └── models.py            # SQLAlchemy Database schemas
│   │   ├── schemas/
│   │   │   └── schemas.py           # Pydantic validation request/response schemas
│   │   ├── services/
│   │   │   ├── collectors/          # Junos OS SSH command execution drivers
│   │   │   │   ├── base_collector.py # Base collector abstract interface definitions
│   │   │   │   ├── ssh_manager.py   # Paramiko session execution wrapper
│   │   │   │   ├── srx_collector.py   # SRX Firewall monitoring parser
│   │   │   │   ├── ex4100_collector.py# EX Spine Switch telemetry parser
│   │   │   │   └── telemetry_cache.py # In-memory caching engine
│   │   │   ├── ai_engine.py         # Natural Language rule query compiler
│   │   │   └── interface_utils.py   # Switch physical port validation utility
│   │   └── main.py                  # API FastAPI Startup configuration
│   ├── requirements.txt             # Python backend dependencies
│   └── .env                         # Environment settings configurations
└── frontend/
    ├── src/
    │   ├── components/              # Buttons, Cards, drawer dialog widgets
    │   │   ├── Sidebar.tsx          # Navigation shell layout
    │   │   ├── DeviceDetailDrawer.tsx# Interactive slide-out showing hardware stats
    │   │   └── Header.tsx           # Top navigation bar with quick-switch RBAC widget
    │   ├── contexts/
    │   │   ├── AuthContext.tsx      # Handles JWT storage, logins and logout states
    │   │   ├── NetworkStoreContext.tsx# Main React context coordinating data state
    │   │   └── ThemeContext.tsx     # Toggles light and dark mode classes
    │   ├── layouts/
    │   │   └── DashboardLayout.tsx  # Structured view template wrapper
    │   ├── pages/                   # Frontend view components
    │   │   ├── Dashboard.tsx        # Overview system panel metrics
    │   │   ├── NetworkTopology.tsx  # React Flow canvas topography chart
    │   │   ├── ClientManager.tsx    # Roster listing users and quarantine buttons
    │   │   └── AiCenter.tsx         # Conversation interface for natural language
    │   ├── services/
    │   │   └── api.ts               # API Client (Axios/fetch layer with local storage fallbacks)
    │   ├── types/
    │   │   └── index.ts             # TypeScript entity definitions
    │   ├── App.tsx                  # Main router definitions
    │   ├── index.css                # Base stylesheet importing Tailwind v4 rules
    │   └── main.tsx                 # Client react application launcher
    ├── package.json                 # Frontend dependencies list
    ├── tsconfig.json                # TypeScript settings
    └── vite.config.ts               # Vite server configurations
```

---

## 10. Functional Modules

### 1. User & Authentication Module
Coordinates login, JWT token issuance, verification, and role enforcement. Utilizes Pydantic schemas (`LoginRequest`, `Token`) to validate inputs. The `RoleChecker` dependency restricts access based on user roles, disabling unauthorized action buttons in the UI.

### 2. Device Telemetry Module
Handles device configuration updates, decommissioning, and onboarding. Includes background SSH collectors that poll Juniper hardware. The collected telemetry (CPU/memory usage, uptime, ports state) is cached in the `telemetry_cache` and served through the `/api/v1/devices` endpoint.

### 3. Client Management Module
Displays active client sessions and bandwidth footprints. Allows administrators to isolate rogue clients with a one-click quarantine trigger. This updates the client's status in the database to `inactive` and generates a security alert in the log.

### 4. Network Configurations Module
Manages VLAN creation and subnet binding, and handles static DHCP IP address assignments. It prevents the deletion of default management structures like VLAN 10.

### 5. AI Center Module
Enables operators to query network status using natural language. The backend `local_ai_engine` parses query strings for key terms (e.g., "offline", "alerts", "optimize") and returns relevant database records along with recommended actions.

### 6. Analytics & Reports Module
Uses Recharts to plot bandwidth usage and client distributions. The Reports page compiles this data into exportable summaries of network traffic and device uptimes.

---

## 11. Workflow
This workflow outlines the sequence of operations for an administrator managing the network:

```
[Login Screen] --> Select Role & Log In --> [Dashboard Overview]
                                                   |
             +--------------------+----------------+-------------------+
             |                    |                                    |
             v                    v                                    v
     [Topology Canvas]   [Device Drawer Configuration]     [AI Console Chat]
             |                    |                                    |
     Inspect AP Links     Modify Port / VLAN Binding       Ask: "Tune RF Channels"
             |                    |                                    |
             +--------------------+----------------+-------------------+
                                  |
                                  v
                        [Trigger Configuration]
                                  |
                   Validate RBAC permissions check
                                  |
               Commit to Database & Push to Hardware via SSH
```

1.  **Authentication**: The user logs in via the login screen. They enter their credentials and select their operational role (e.g. *Network Administrator*).
2.  **Dashboard Load**: The frontend loads the main dashboard layout, fetching the latest network statistics and health scores from the backend.
3.  **Topology Assessment**: The operator checks the **Network Topology Map** to verify link status between firewalls, switches, and access points.
4.  **Hardware Configuration**: The operator selects a switch from the device list, opening the configuration drawer. They modify port-VLAN bindings or toggle interfaces.
5.  **Access Control Verification**: The API validates the user's JWT token. If their role has sufficient permissions, the changes are committed to the database and pushed to the device via SSH.
6.  **AI Center Query**: The operator queries the AI Center: *"Tune RF configurations"*. The engine returns the co-channel interference data and recommends optimization steps.

---

## 12. Sequence of Operations
This sequence describes the operations that occur when the web application is loaded in a browser:

```
[Browser Client]               [FastAPI Server]             [Database / SSH]
        |                             |                             |
  1. Load index.html                  |                             |
        |---------------------------->|                             |
  2. Parse JS & Mount App             |                             |
        |                             |                             |
  3. Validate JWT in LocalStorage     |                             |
        |---------------------------->|                             |
        |                             |-- Verify JWT signature ---->|
        |<----------------------------|                             |
  4. Fetch Telemetry (/devices)       |                             |
        |---------------------------->|                             |
        |                             |-- Fetch from cache -------->|
        |<----------------------------|                             |
  5. Render Topology Canvas           |                             |
        |                             |                             |
  6. Listen for Server-Sent Events    |                             |
        |---------------------------->|                             |
        |                             |<-- Push Telemetry Alerts ---|
```

1.  **Application Launch**: The browser loads the entry-point file (`index.html`) and parses the bundled JavaScript and CSS.
2.  **State Initialization**: React mounts the `AuthProvider` and `NetworkStoreProvider`. The store check `localStorage` for cached session tokens and credentials.
3.  **Active Token Verification**:
    *   If a token exists, the client makes an authentication check to verify the session.
    *   If no token is found, the user is redirected to the `/login` route.
4.  **Data Fetching**: The `NetworkStoreProvider` initiates API calls to fetch devices, clients, VLANs, and active alerts.
5.  **Rendering UI Elements**:
    *   Recharts parses bandwidth metrics to render traffic charts.
    *   React Flow renders the network topology map using the fetched device list.
6.  **State Sync Loop**: The application regularly polls `/api/v1/devices` to keep the UI synchronized with the latest status updates.

---

## 13. Security Features
The application implements several security controls:

1.  **Password Security**: Hashing is performed using the bcrypt algorithm inside `passlib.context`. Plaintext passwords are never stored in the database.
2.  **JWT Authentication**: API endpoints are secured using JSON Web Tokens. If a request lacks a valid token, it is rejected with a `401 Unauthorized` status.
3.  **Role-Based Access Control**: Decorators on backend routes (e.g. `allow_write`, `allow_admin`) enforce access permissions. Read-only users cannot perform modification requests.
4.  **Network Isolation (Client Quarantine)**: Rogue endpoints can be isolated with a quarantine action. This updates the client status to `inactive` in the database and triggers an alert.
5.  **Physical Interface Disabling**: Administrators can shut down specific switch ports from the dashboard, helping to isolate loops or unauthorized connections.
6.  **SQL Injection Prevention**: SQLAlchemy's ORM uses parameterized queries for database operations, protecting against SQL injection vectors.
7.  **Input Sanitization**: Pydantic schemas validate input data types and structures, discarding unrecognized fields.

---

## 14. Error Handling
The system handles errors at both the API and client level:

*   **Pydantic Schema Validation**: If an API request body does not match the expected schema, the framework returns a `422 Unprocessable Entity` status with details on the invalid fields.
*   **Database Fallback Mechanism**: If the primary PostgreSQL connection fails, the database module falls back to the local SQLite database (`campusnet_fallback.db`).
*   **SSH Connection Fault Tolerance**: If a collector cannot connect to a device via SSH (due to authentication failures or host unreachability), the system logs a critical alert and uses mock data fallbacks to keep the dashboard functional.
*   **Axios/Fetch Catch Wrappers**: The frontend API client wraps requests in try-catch blocks. If the backend is offline, the application falls back to `localStorage` state simulation to ensure continuity.
*   **User Alerts**: The UI displays warning banners and toast notifications when operations fail, providing descriptive error messages to the user.

---

## 15. Future Enhancements
Planned enhancements for the network controller include:

1.  **Juniper Mist Webhook Integration**: Integrating directly with the Juniper Mist Cloud API to receive real-time telemetry updates via Webhooks, reducing the need for polling.
2.  **LLM-Powered AI Assistant**: Replacing the rule-based parser with a Retrieval-Augmented Generation (RAG) assistant using LLM APIs to handle complex, open-ended operational queries.
3.  **Automated Configuration Rollbacks**: Implementing automated configuration rollbacks if a pushed change causes a device to lose connectivity.
4.  **VLAN Provisioning Wizards**: Adding guided configuration wizards for setting up network-wide VLANs across switches and firewalls.
5.  **Multi-Tenant Organization Management**: Extending the database schema to support multiple organizational sites and tenants.

---

## 16. Screen Views and Descriptions

### 1. User Authentication Portal (`/login`)
*   **Purpose**: Authenticates administrative operators.
*   **Description**: A clean login screen featuring input fields for username and password, a role selector dropdown, and verification alerts.
*   *Caption for Report: Figure 16.1 - Administrative Login Portal with Role-Based Access controls.*

### 2. Operations Dashboard Panel (`/operations`)
*   **Purpose**: Provides an overview of network status and health scores.
*   **Description**: Displays dynamic SLA scores, active wireless/wired client distributions, and bandwidth utilization charts.
*   *Caption for Report: Figure 16.2 - Operations Dashboard showing real-time network health metrics.*

### 3. Device Inventory Manager (`/devices`)
*   **Purpose**: Manages network devices and hardware details.
*   **Description**: A tabular list of firewalls, core switches, access switches, and APs with indicators for IP addresses, versions, and connection states.
*   *Caption for Report: Figure 16.3 - Hardware Device Inventory and Management table.*

### 4. Network Topology Interface (`/topology`)
*   **Purpose**: Renders an interactive map of device relationships.
*   **Description**: A React Flow canvas showing connected devices, with color-coded nodes indicating health status.
*   *Caption for Report: Figure 16.4 - Interactive Network Topology Map rendering device links.*

### 5. Client Session Manager (`/clients`)
*   **Purpose**: Monitors connected client endpoints.
*   **Description**: Shows a list of connected hosts, their OS types, active data rates, and includes the quarantine action button.
*   *Caption for Report: Figure 16.5 - Client Session Manager with operational quarantine controls.*

### 6. Wi-Fi SSID Profile Controller (`/wifi`)
*   **Purpose**: Configures wireless SSID profiles.
*   **Description**: A dashboard page for managing Wi-Fi networks, showing security protocols, client limits, and band selections.
*   *Caption for Report: Figure 16.6 - Wi-Fi Configuration Dashboard showing wireless SSID profiles.*

### 7. VLAN Provisioning Center (`/vlans`)
*   **Purpose**: Manages VLAN subnets and IP allocations.
*   **Description**: An interface for creating and modifying VLAN subnets, including IP range and DNS settings.
*   *Caption for Report: Figure 16.7 - VLAN Subnet Management and Configuration dashboard.*

### 8. DHCP Leases Panel (`/dhcp`)
*   **Purpose**: Tracks DHCP lease allocations.
*   **Description**: Lists active IP address leases and allows administrators to configure static IP reservations.
*   *Caption for Report: Figure 16.8 - DHCP Lease Table and Static Address Reservation manager.*

### 9. AI Operations Center (`/ai-center`)
*   **Purpose**: Interface for natural language queries.
*   **Description**: A chat console where operators can enter natural language commands to query telemetry or execute optimizations.
*   *Caption for Report: Figure 16.9 - AI Operations Center showing natural language telemetry queries.*

### 10. Security Center (`/security`)
*   **Purpose**: Displays security events and IDS logs.
*   **Description**: A security dashboard showing firewall policy hits, intrusion alerts, and quarantined client histories.
*   *Caption for Report: Figure 16.10 - Security Center dashboard showing firewall logs and intrusion alerts.*

### 11. SLA Monitor (`/sla`)
*   **Purpose**: Tracks SLA metrics.
*   **Description**: Displays charts tracking latency, jitter, and packet loss against defined service level agreements.
*   *Caption for Report: Figure 16.11 - SLA Performance Monitor tracking network latency and jitter.*

### 12. Automated Rules Manager (`/automation`)
*   **Purpose**: Configures automation triggers.
*   **Description**: A panel for defining conditional rules (e.g. sending alerts when a device goes offline).
*   *Caption for Report: Figure 16.12 - Automation Center for configuring conditional rule triggers.*

### 13. Reports Export Console (`/reports`)
*   **Purpose**: Compiles and exports network reports.
*   **Description**: An export utility for generating PDF summaries of network traffic, device uptime, and security incidents.
*   *Caption for Report: Figure 16.13 - Reports Dashboard with export options for network metrics.*

### 14. Settings Center (`/settings`)
*   **Purpose**: Configures global application settings.
*   **Description**: A panel for configuring credentials, backup options, and system parameters.
*   *Caption for Report: Figure 16.14 - System Settings configuration panel.*

---

## 17. Technologies Used

| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **React** | `19.2.7` | UI Component architecture |
| **TypeScript** | `6.0.2` | Static type safety and schema definition |
| **Tailwind CSS** | `4.3.2` | CSS layout and glassmorphism styling |
| **Vite** | `8.1.1` | Build tool and dev server configuration |
| **FastAPI** | `0.111.0` | Backend API framework |
| **SQLAlchemy** | `2.0.31` | Database Object-Relational Mapper (ORM) |
| **SQLite** | `3.x` | Fallback relational database engine |
| **Paramiko** | `4.1.3` | SSH client library for Juniper device automation |
| **python-jose** | `3.3.0` | JWT generation and signature verification |
| **passlib** | `1.7.4` | Password hashing using the bcrypt algorithm |
| **Pydantic** | `2.7.4` | Request and response data validation |
| **React Flow** | `12.11.2` | Interactive topology map canvas |
| **Recharts** | `3.9.2` | Telemetry charting and data visualization |
| **Framer Motion** | `12.42.2` | UI transition and state animations |

---

## 18. Advantages
The software controller offers several operational advantages:

1.  **Unified Control Interface**: Integrates firewall, switch, and AP management into a single administrative portal.
2.  **Secure RBAC Roles**: Implements role-based access control to restrict configuration privileges and prevent unauthorized changes.
3.  **Natural Language Queries**: The local AI engine allows operators to retrieve status data and run optimizations using simple text queries.
4.  **Local Simulation Fallback**: Incorporates a local storage state fallback that allows the interface to run even if the backend connection is lost, useful for staging and demos.
5.  **Detailed Telemetry Visualization**: Renders clear visual charts of bandwidth, clients, and SLA compliance using Recharts.
6.  **Direct SSH Integration**: Connects directly to Juniper Junos OS devices using standard commands, bypassing the need for vendor-locked cloud dashboards.

---

## 19. Limitations
1.  **Rule-Based AI Engine**: The current AI assistant uses keyword rule-matching. A full LLM integration is needed to handle more complex or conversational queries.
2.  **SSH Connection Overhead**: Establishing SSH connections for real-time polling can add network overhead and latency when managing a large number of devices.
3.  **Simulated Telemetry Fallback**: If a physical device goes offline, the dashboard falls back to simulated metrics, which may obscure real-time hardware faults if the connection is not verified.
4.  **Local Database Limits**: The default SQLite database is not suitable for large-scale production deployments; it must be manually switched to PostgreSQL.

---

## 20. Conclusion
This software implementation provides an administrative dashboard and control plane for managing campus networks. By combining a modern React frontend with a FastAPI backend and direct Junos OS SSH collectors, the platform demonstrates how network telemetry can be consolidated and managed. Features like role-based access control, the interactive topology map, and natural language query parsing show how network operations can be simplified. The architecture is modular and scalable, making it suitable for B.Tech project implementations and real-world network management scenarios.
