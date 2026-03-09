# AttendIQ – Attendance Management System
> Full-stack app: React (frontend) + PHP + MySQL (XAMPP backend)

---

## 📁 Project Structure

```
attendance-system/
├── public/
│   └── index.html
├── src/
│   ├── App.js               ← Main app + React Router
│   ├── index.js
│   ├── index.css
│   ├── components/
│   │   ├── Sidebar.js
│   │   ├── TopBar.js
│   │   └── Notification.js
│   ├── data/
│   │   └── employees.js     ← Employee data + attendance generator
│   └── pages/
│       ├── Dashboard.js
│       ├── Attendance.js
│       ├── URLPage.js
│       ├── Report.js
│       ├── Masters.js
│       └── Team.js
├── backend/                 ← Copy to XAMPP htdocs
│   ├── config.php
│   ├── schema.sql
│   ├── employees.php
│   ├── attendance.php
│   ├── departments.php
│   └── sections.php
├── package.json
└── README.md
```

---

## 🚀 Setup Instructions

### Step 1 – Start XAMPP
1. Open **XAMPP Control Panel**
2. Start **Apache** and **MySQL**

### Step 2 – Import Database
1. Open **phpMyAdmin** → http://localhost/phpmyadmin
2. Click **Import** → choose `backend/schema.sql`
3. Click **Go**

### Step 3 – Deploy PHP Backend
Copy the entire `backend/` folder to:
```
C:\xampp\htdocs\attendance-api\
```
Test it: http://localhost/attendance-api/departments.php

### Step 4 – Install & Run React
Open a terminal in the `attendance-system/` folder:
```bash
npm install
npm start
```
App opens at: **http://localhost:3000**

---

## 🔌 API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/attendance-api/employees.php` | List all employees |
| GET | `/attendance-api/employees.php?id=5` | Single employee |
| POST | `/attendance-api/employees.php` | Add employee |
| PUT | `/attendance-api/employees.php?id=5` | Update employee |
| GET | `/attendance-api/attendance.php?employee_id=5&month=2025-12` | Monthly attendance |
| POST | `/attendance-api/attendance.php` | Save attendance record |
| GET | `/attendance-api/departments.php` | List departments |
| POST | `/attendance-api/departments.php` | Add department |
| DELETE | `/attendance-api/departments.php?id=2` | Remove department |
| GET | `/attendance-api/sections.php` | List sections |
| POST | `/attendance-api/sections.php` | Add section |

---

## 📦 Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | KPIs, charts, employee overview |
| Attendance | `/attendance` | Daily in/out, work hours per employee |
| URL | `/url` | App usage pie chart + table |
| Report | `/report` | Work hours bar chart + export |
| Masters | `/masters` | Department & Section CRUD |
| Team | `/team` | Employee cards with attendance rate |

---

## 🛠 Tech Stack

- **Frontend**: React 18, React Router v6, Recharts
- **Backend**: PHP 8 (XAMPP), MySQL 8
- **Styling**: Inline styles (no extra CSS framework needed)


---

## Desktop App (No npm start after install)

You can build an installable Windows app that opens this project directly (login page on launch).

### 1) Install dependencies
```bash
npm install
```

### 2) Build installer (.exe)
```bash
npm run desktop:dist
```

Installer output path:
`dist-desktop\`

After install, launch **Attendance System** from desktop/start menu. You do not need to run `npm start`.
