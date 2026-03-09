-- ============================================================
--  AttendIQ – MySQL Database Schema
--  Import via phpMyAdmin or: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS attendiq
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE attendiq;

-- ─── Departments ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── Sections ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(80)  NOT NULL,
  department_id INT NOT NULL,
  description   VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

-- ─── Employees ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  emp_code      VARCHAR(20) NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  department_id INT,
  section_id    INT,
  email         VARCHAR(160),
  phone         VARCHAR(20),
  join_date     DATE,
  status        ENUM('active','inactive') DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (section_id)    REFERENCES sections(id)
);

-- ─── Attendance Records ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  att_date    DATE NOT NULL,
  status      ENUM('present','absent','weekend','holiday') DEFAULT 'present',
  in_time     TIME,
  out_time    TIME,
  work_hours  DECIMAL(5,2),
  idle_hours  DECIMAL(5,2),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_emp_date (employee_id, att_date),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- ─── Seed Data ──────────────────────────────────────────────
INSERT IGNORE INTO departments (name, description) VALUES
  ('MGMT', 'Management and Administration'),
  ('RDL',  'Research and Development Lab'),
  ('IT',   'Information Technology and Systems'),
  ('HR',   'Human Resources and Talent Acquisition');

INSERT IGNORE INTO sections (name, department_id, description) VALUES
  ('Administration', 1, 'Admin Support'),
  ('Lab Operations', 2, 'Lab Workflows'),
  ('Development',    3, 'Software Development Team'),
  ('Support',        3, 'Technical Support'),
  ('Recruitment',    4, 'Talent Acquisition');

INSERT IGNORE INTO employees (emp_code, name, department_id, section_id) VALUES
  ('1',  'RaghavendraGShetty',   1, 1),
  ('3',  'Ganapathi Aithal K.P', 1, 1),
  ('4',  'Kanwal Karkera',       1, 1),
  ('16', 'Sandeep Pai',          1, 1),
  ('6',  'Ashwath',              2, 2),
  ('10', 'RaoSamithBhaskar',     2, 2),
  ('19', 'Sachin Manda',         2, 2),
  ('18', 'Ashwitha',             2, 2),
  ('24', 'Vikhitha Shetty',      2, 2),
  ('5',  'Sunith Sathyaveera',   2, 2),
  ('11', 'Karthik Bhat',         2, 2),
  ('12', 'Rashmi Naik P',        2, 2),
  ('13', 'Sowmya M',             2, 2),
  ('14', 'Preethi',              2, 2),
  ('15', 'Divya',                2, 2),
  ('40', 'Pranesh',              3, 3),
  ('41', 'Sachin Kunder',        3, 3),
  ('42', 'Vikhyath U Alva',      3, 3),
  ('43', 'Suhas S',              3, 3),
  ('52', 'Chethan Kumar',        3, 3),
  ('53', 'Akhil Sharma',         3, 3);
