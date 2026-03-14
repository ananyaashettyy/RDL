import os
import re
import sys
import json
import time
import signal
import urllib.request
import subprocess
from pathlib import Path
import calendar
import datetime
import difflib

import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.edge.options import Options as EdgeOptions


ROOT = Path(__file__).resolve().parents[1]
XLSX_PATH = ROOT / "testing" / "test-case.xlsx"
APP_URL = "http://localhost:3000"
PREVIEW_PATH = os.environ.get("PREVIEW_PATH", "").strip()
PREVIEW_SIZE = os.environ.get("PREVIEW_SIZE", "").strip()


def format_employee_name(name):
    if not name:
        return ""
    spaced = str(name).strip()
    spaced = spaced.replace("_", " ").replace(".", " ").replace(",", " ")
    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", spaced)
    spaced = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", spaced)
    spaced = re.sub(r"[^a-zA-Z\s]", " ", spaced)
    spaced = re.sub(r"\s+", " ", spaced).strip()
    if not spaced:
        return ""
    return " ".join([p[:1].upper() + p[1:].lower() for p in spaced.split() if p])


def load_employees():
    text = (ROOT / "src" / "data" / "employees.js").read_text(encoding="utf-8")
    raw = re.findall(r"\{ id: '([^']+)', name: '([^']+)', dept: '([^']+)' \}", text)
    employees = []
    for emp_id, name, dept in raw:
        display = format_employee_name(name)
        employees.append({"id": emp_id, "name": name, "dept": dept, "displayName": display})
    return employees


def build_usernames(display_names):
    used = set()
    usernames = []
    for display in display_names:
        parts = [re.sub(r"[^a-z0-9]", "", p) for p in display.lower().split()]
        parts = [p for p in parts if p]
        if not parts:
            continue
        base = parts[0]
        username = base
        if username in used:
            initials = ""
            for p in parts[1:]:
                initials += p[0]
                candidate = base + initials
                if candidate not in used:
                    username = candidate
                    break
            if username in used:
                last_letter = base[-1] if base else "x"
                extra = 1
                while (base + last_letter * extra) in used:
                    extra += 1
                username = base + last_letter * extra
        used.add(username)
        usernames.append(username)
    return usernames


def seed_rand(seed):
    s = seed & 0xFFFFFFFF
    def rnd():
        nonlocal s
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        return s / 0xFFFFFFFF
    return rnd


def generate_attendance(emp_id, year, month):
    rand = seed_rand(int(emp_id) * 100 + month + year)
    days_in_month = calendar.monthrange(year, month)[1]
    records = []

    def to_mins(hhmm):
        h, m = map(int, hhmm.split(":"))
        return h * 60 + m

    def from_mins(mins):
        h = (mins % (24 * 60)) // 60
        m = mins % 60
        return f"{h:02d}:{m:02d}"

    for d in range(1, days_in_month + 1):
        date = datetime.date(year, month, d)
        if date.weekday() == 6:
            records.append({"day": d, "status": "weekend"})
            continue
        r = rand()
        if r < 0.05:
            records.append({"day": d, "status": "absent"})
            continue
        in_h = 9 + int(rand() * 1.5)
        in_m = int(rand() * 58)
        wrk_h = 7 + int(rand() * 3)
        wrk_m = int(rand() * 58)
        idle = int(rand() * 90)
        out_h = (in_h + wrk_h) % 24
        out_m = (in_m + wrk_m) % 60
        records.append({
            "day": d,
            "status": "present",
            "inTime": f"{in_h:02d}:{in_m:02d}",
            "outTime": f"{out_h:02d}:{out_m:02d}",
            "work": f"{wrk_h:02d}:{wrk_m:02d}",
            "idle": f"{idle // 60:02d}:{idle % 60:02d}",
            "logoutForLunch": from_mins(to_mins(f"{in_h:02d}:{in_m:02d}") + 240),
            "loginFromLunch": from_mins(to_mins(f"{in_h:02d}:{in_m:02d}") + 285),
            "logout": f"{out_h:02d}:{out_m:02d}",
        })
    return records


def load_attendance():
    employees = load_employees()
    attendance = {}
    for emp in employees:
        emp_id = emp["id"]
        attendance[emp_id] = {
            "2025-11": generate_attendance(emp_id, 2025, 11),
            "2025-12": generate_attendance(emp_id, 2025, 12),
        }
    return attendance


def compute_kpis(selected_month):
    employees = load_employees()
    attendance = load_attendance()
    total_employees = len(employees)
    departments = ["MGMT", "RDL", "IT", "HR"]

    most_present = {"name": "N/A", "days": 0}
    most_absent = {"name": "N/A", "days": 0}

    for emp in employees:
        recs = attendance[emp["id"]].get(selected_month, [])
        present = sum(1 for r in recs if r.get("status") == "present")
        absent = sum(1 for r in recs if r.get("status") == "absent")
        if present > most_present["days"]:
            most_present = {"name": emp["displayName"], "days": present}
        if absent > most_absent["days"]:
            most_absent = {"name": emp["displayName"], "days": absent}

    return {
        "total_employees": total_employees,
        "departments": len(departments),
        "most_present": most_present,
        "most_absent": most_absent,
    }


def wait_for_server(url, timeout=180):
    for _ in range(timeout):
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(1)
    return False


def start_dev_server():
    env = dict(os.environ)
    env["BROWSER"] = "none"
    npm_cmd = "npm"
    if os.name == "nt":
        npm_cmd = "npm.cmd"
    return subprocess.Popen(
        [npm_cmd, "start"],
        cwd=str(ROOT),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )


def stop_dev_server(proc):
    if proc.poll() is not None:
        return
    try:
        proc.send_signal(signal.SIGTERM)
        proc.wait(timeout=10)
    except Exception:
        proc.kill()


def make_driver():
    cache_dir = ROOT / ".selenium"
    cache_dir.mkdir(exist_ok=True)
    os.environ.setdefault("SELENIUM_CACHE_DIR", str(cache_dir))
    os.environ.setdefault("SE_CACHE_PATH", str(cache_dir))
    os.environ.setdefault("HOME", str(ROOT))
    os.environ.setdefault("USERPROFILE", str(ROOT))
    opts = EdgeOptions()
    headless = os.environ.get("HEADLESS", "1").strip() != "0"
    window_size = os.environ.get("BROWSER_SIZE", "1400,900").strip()
    window_pos = os.environ.get("BROWSER_POS", "").strip()
    if headless:
        # Use headless mode with a fresh profile to avoid DevToolsActivePort crashes.
        opts.add_argument("--headless=new")
        opts.add_argument("--disable-gpu")
    opts.add_argument(f"--window-size={window_size}")
    if window_pos:
        opts.add_argument(f"--window-position={window_pos}")
    opts.add_argument("--force-device-scale-factor=1")
    opts.add_argument("--high-dpi-support=1")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--remote-debugging-port=0")
    opts.add_argument("--disable-extensions")
    opts.add_argument("--disable-software-rasterizer")
    opts.add_argument("--no-first-run")
    opts.add_argument("--no-default-browser-check")
    opts.add_argument("--disable-features=RendererCodeIntegrity")
    profile_dir = cache_dir / f"edge-profile-{os.getpid()}"
    opts.add_argument(f"--user-data-dir={profile_dir}")
    return webdriver.Edge(options=opts)


def run():
    employees = load_employees()
    display_names = [e["displayName"] for e in employees if e["displayName"]]
    usernames = build_usernames(display_names)
    user_username = usernames[0] if usernames else "raghavendra"
    user_password = user_username
    selected_month = "2025-12"
    kpis = compute_kpis(selected_month)

    results = {}
    capture_preview = None

    def record(sno, actual, status, obs=""):
        results[int(sno)] = {
            "actual": actual,
            "status": status,
            "observation": obs or "",
        }

    def run_test(sno, description, fn):
        try:
            actual = fn()
            record(sno, actual, "Pass", "")
        except Exception as e:
            record(sno, f"Failed: {description}", "Fail", str(e))
        finally:
            if capture_preview:
                capture_preview()

    server = None
    skip_server = os.environ.get("SKIP_DEV_SERVER", "").strip() == "1"
    if not skip_server:
        server = start_dev_server()
    try:
        if not wait_for_server(APP_URL, timeout=180):
            record(0, "Dev server did not start.", "Fail", "npm start timed out")
            raise RuntimeError("Dev server did not start.")

        driver = make_driver()
        wait = WebDriverWait(driver, 15)
        preview_path = Path(PREVIEW_PATH) if PREVIEW_PATH else None

        def capture_preview():
            if not preview_path:
                return
            try:
                if PREVIEW_SIZE:
                    try:
                        w_str, h_str = PREVIEW_SIZE.split(",")
                        driver.set_window_size(int(w_str), int(h_str))
                    except Exception:
                        pass
                # Capture current viewport (window size is already set via BROWSER_SIZE).
                driver.save_screenshot(str(preview_path))
            except Exception:
                pass

        def go(url_path=""):
            driver.get(APP_URL + url_path)

        def wait_text(text):
            return wait.until(EC.presence_of_element_located((By.XPATH, f"//*[contains(normalize-space(), '{text}')]")))

        def click_button(text):
            el = wait.until(EC.element_to_be_clickable((By.XPATH, f"//button[normalize-space()='{text}']")))
            el.click()

        def login_admin():
            go("/")
            click_button("Admin")
            wait_text("Welcome Back")
            user_input = driver.find_element(By.XPATH, "//input[@placeholder='Enter username']")
            pass_input = driver.find_element(By.XPATH, "//input[@placeholder='Enter password']")
            user_input.clear()
            pass_input.clear()
            user_input.send_keys("admin")
            pass_input.send_keys("admin")
            click_button("Login")
            wait_text("Attendance Dashboard")

        def login_user():
            go("/")
            click_button("User")
            wait_text("Welcome Back")
            user_input = driver.find_element(By.XPATH, "//input[@placeholder='Enter username']")
            pass_input = driver.find_element(By.XPATH, "//input[@placeholder='Enter password']")
            user_input.clear()
            pass_input.clear()
            user_input.send_keys(user_username)
            pass_input.send_keys(user_password)
            click_button("Login")
            wait_text("Attendance Dashboard")

        def t1():
            go("/")
            wait_text("Select portal access")
            wait_text("Admin")
            wait_text("User")
            return "Role selector loaded with Admin and User buttons."
        run_test(1, "Role selector page loads", t1)

        def t2():
            go("/")
            click_button("Admin")
            wait_text("ADMIN")
            return "Admin login page visible."
        run_test(2, "Admin portal route navigates to admin login", t2)

        def t3():
            go("/")
            click_button("User")
            wait_text("USER")
            return "User login page visible."
        run_test(3, "User portal route navigates to user login", t3)

        def t4():
            login_admin()
            return "Admin login accepted and dashboard loaded."
        run_test(4, "Admin login accepts default credentials", t4)

        def t5():
            go("/admin")
            wait_text("Welcome Back")
            driver.find_element(By.XPATH, "//input[@placeholder='Enter username']").send_keys("admin")
            driver.find_element(By.XPATH, "//input[@placeholder='Enter password']").send_keys("wrong")
            click_button("Login")
            wait_text("Enter a valid username and password.")
            return "Invalid admin credentials rejected with error."
        run_test(5, "Admin login rejects invalid credentials", t5)

        def t6():
            go("/admin")
            wait_text("Welcome Back")
            driver.find_element(By.XPATH, "//input[@placeholder='Enter password']").send_keys("admin")
            click_button("Login")
            wait_text("Enter a valid username.")
            return "Validation error shown for empty username."
        run_test(6, "Admin login validation username required", t6)

        def t7():
            go("/admin")
            wait_text("Welcome Back")
            driver.find_element(By.XPATH, "//input[@placeholder='Enter username']").send_keys("admin")
            click_button("Login")
            wait_text("Enter a valid password.")
            return "Validation error shown for empty password."
        run_test(7, "Admin login validation password required", t7)

        def t8():
            go("/admin")
            wait_text("Welcome Back")
            click_button("Back")
            wait_text("Select portal access")
            return "Back navigated to role selector."
        run_test(8, "Admin login back button goes to role selector", t8)

        def t9():
            go("/admin")
            wait_text("Welcome Back")
            pass_input = driver.find_element(By.XPATH, "//input[@placeholder='Enter password']")
            assert pass_input.get_attribute("type") == "password"
            return "Password input masked."
        run_test(9, "Admin password input masked", t9)

        def t10():
            go("/user")
            wait_text("Welcome Back")
            driver.find_element(By.XPATH, "//input[@placeholder='Enter username']").send_keys(user_username.upper())
            driver.find_element(By.XPATH, "//input[@placeholder='Enter password']").send_keys(user_password.upper())
            click_button("Login")
            wait_text("Enter a valid username and password.")
            return "Uppercase credentials rejected for user portal."
        run_test(10, "User login requires lowercase username and password", t10)

        def t11():
            go("/user")
            wait_text("Welcome Back")
            driver.find_element(By.XPATH, "//input[@placeholder='Enter username']").send_keys(user_username)
            driver.find_element(By.XPATH, "//input[@placeholder='Enter password']").send_keys("wrongpass")
            click_button("Login")
            wait_text("Enter a valid username and password.")
            return "Username must match password for user portal."
        run_test(11, "User login requires username equals password", t11)

        def t12():
            login_user()
            return "User login accepted for generated account."
        run_test(12, "User login accepts generated account rule", t12)

        def t13():
            go("/user")
            wait_text("Welcome Back")
            driver.find_element(By.XPATH, "//input[@placeholder='Enter username']").send_keys("notallowed")
            driver.find_element(By.XPATH, "//input[@placeholder='Enter password']").send_keys("notallowed")
            click_button("Login")
            wait_text("Enter a valid username and password.")
            return "Unknown username rejected."
        run_test(13, "User login rejects not in allowed list", t13)

        def t14():
            login_admin()
            click_button("Logout")
            wait_text("Select portal access")
            return "Logout redirected to role selector."
        run_test(14, "Logout redirects to portal login", t14)

        def t15():
            go("/admin/home")
            wait_text("Welcome Back")
            return "Protected route redirected to login after logout."
        run_test(15, "Back after logout does not show protected pages", t15)

        def t16():
            login_admin()
            go("/admin/unknown")
            wait_text("Attendance Dashboard")
            return "Admin unknown route redirected to admin home."
        run_test(16, "Admin unknown route redirects to admin home", t16)

        def t17():
            login_user()
            go("/user/unknown")
            wait_text("Attendance Dashboard")
            return "User unknown route redirected to user home."
        run_test(17, "User unknown route redirects to user home", t17)

        def t18():
            login_admin()
            name = display_names[0]
            wait.until(EC.presence_of_element_located((By.XPATH, f"//div[@title='{name}']")))
            return f"Employee list rendered (found {name})."
        run_test(18, "Sidebar renders employee list", t18)

        def t19():
            login_admin()
            all_items = driver.find_elements(By.XPATH, "//div[@title]")
            all_titles = [el.get_attribute("title") for el in all_items]
            before = len([t for t in all_titles if t in display_names])
            search = driver.find_element(By.XPATH, "//input[@placeholder='Search employee...']")
            search.clear()
            search.send_keys(display_names[0].split()[0])
            time.sleep(1)
            all_items_after = driver.find_elements(By.XPATH, "//div[@title]")
            all_titles_after = [el.get_attribute("title") for el in all_items_after]
            after = len([t for t in all_titles_after if t in display_names])
            assert after <= before and after >= 1
            return f"Search filtered employee list from {before} to {after}."
        run_test(19, "Sidebar search filters employees", t19)

        def t20():
            login_admin()
            name = display_names[0]
            driver.find_element(By.XPATH, f"//div[@title='{name}']").click()
            wait_text(name)
            return f"Selected employee {name} and opened attendance."
        run_test(20, "Selecting employee updates selection state", t20)

        def t21():
            login_admin()
            click_button("Collapse")
            time.sleep(0.5)
            elems = driver.find_elements(By.XPATH, "//div[normalize-space()='Collapse']")
            assert len(elems) == 0
            return "Sidebar collapsed."
        run_test(21, "Sidebar collapse toggle works", t21)

        def t22():
            login_admin()
            selects = driver.find_elements(By.TAG_NAME, "select")
            assert len(selects) >= 2
            return "Month/year selectors visible."
        run_test(22, "TopBar month selector visible", t22)

        def t23():
            login_admin()
            name = display_names[0]
            driver.find_element(By.XPATH, f"//div[@title='{name}']").click()
            wait_text(name)
            selects = driver.find_elements(By.TAG_NAME, "select")
            month_select = Select(selects[0])
            current = month_select.first_selected_option.get_attribute("value")
            target = "11" if current != "11" else "12"
            month_select.select_by_value(target)
            time.sleep(1)
            expected = "November" if target == "11" else "December"
            wait.until(EC.presence_of_element_located((By.XPATH, f"//h3[contains(normalize-space(), '{expected}')]")))
            return f"Month changed to {target} and attendance header updated."
        run_test(23, "Changing month updates pages", t23)

        def t24():
            login_admin()
            body = driver.find_element(By.TAG_NAME, "body")
            before = body.get_attribute("data-theme")
            driver.find_element(By.XPATH, "//button[@title='Switch to dark mode' or @title='Switch to light mode']").click()
            time.sleep(0.5)
            after = body.get_attribute("data-theme")
            assert before != after
            return f"Theme toggled from {before} to {after}."
        run_test(24, "Theme toggle switches light and dark", t24)

        def t25():
            login_admin()
            driver.find_element(By.XPATH, "//button[@title='Switch to dark mode' or @title='Switch to light mode']").click()
            time.sleep(0.5)
            body = driver.find_element(By.TAG_NAME, "body")
            expected = body.get_attribute("data-theme")
            driver.refresh()
            time.sleep(1)
            body2 = driver.find_element(By.TAG_NAME, "body")
            actual = body2.get_attribute("data-theme")
            assert expected == actual
            return f"Theme persisted as {actual} after refresh."
        run_test(25, "Theme persists after refresh", t25)

        def t26():
            login_admin()
            wait_text("Attendance Dashboard")
            return "Admin dashboard loaded."
        run_test(26, "Dashboard loads for admin", t26)

        def t27():
            login_user()
            wait_text("Attendance Dashboard")
            return "User dashboard loaded."
        run_test(27, "Dashboard loads for user", t27)

        def kpi_value(label):
            label_el = driver.find_element(By.XPATH, f"//div[normalize-space()='{label}']")
            parent = label_el.find_element(By.XPATH, "./..")
            value_el = parent.find_element(By.XPATH, "./div[2]")
            detail_el = None
            try:
                detail_el = parent.find_element(By.XPATH, "./div[3]")
            except Exception:
                pass
            return value_el.text.strip(), (detail_el.text.strip() if detail_el else "")

        def t28():
            login_admin()
            val, _ = kpi_value("Total Employees")
            assert str(kpis["total_employees"]) in val
            return f"Total Employees KPI shows {val}."
        run_test(28, "Total employees count correct", t28)

        def t29():
            login_admin()
            val, _ = kpi_value("Departments")
            assert str(kpis["departments"]) in val
            return f"Departments KPI shows {val}."
        run_test(29, "Departments count correct", t29)

        def t30():
            login_admin()
            val, detail = kpi_value("Most Present")
            assert kpis["most_present"]["name"] in val
            assert str(kpis["most_present"]["days"]) in detail
            return f"Most Present KPI shows {val} ({detail})."
        run_test(30, "Most present name and days computed", t30)

        def t31():
            login_admin()
            val, detail = kpi_value("Most Absent")
            assert kpis["most_absent"]["name"] in val
            assert str(kpis["most_absent"]["days"]) in detail
            return f"Most Absent KPI shows {val} ({detail})."
        run_test(31, "Most absent name and days computed", t31)

        def t32():
            login_admin()
            wait_text("Department-wise Attendance")
            svg = driver.find_elements(By.XPATH, "//h3[normalize-space()='Department-wise Attendance']/following::svg")
            assert len(svg) > 0
            return "Department chart rendered."
        run_test(32, "Department present and absent chart renders", t32)

        def t33():
            login_admin()
            wait_text("Monthly Attendance Trend (%)")
            svg = driver.find_elements(By.XPATH, "//h3[normalize-space()='Monthly Attendance Trend (%)']/following::svg")
            assert len(svg) > 0
            return "Attendance trend chart rendered."
        run_test(33, "Attendance rate trend renders", t33)

        def t35():
            login_admin()
            wait_text("Highest Late Entry")
            wait_text("Highest Early Exit")
            return "Admin late/early cards visible."
        run_test(35, "Admin late early panel shows top employees", t35)

        def t36():
            login_admin()
            wait_text("Highest Overtime")
            wait_text("Lowest Overtime")
            return "Admin overtime cards visible."
        run_test(36, "Admin overtime cards display", t36)

        def t41():
            login_admin()
            click_button("Team")
            wait_text("Team Members")
            return "Team page loaded."
        run_test(41, "Team page loads for admin", t41)

        def t42():
            login_admin()
            click_button("Team")
            wait_text("Team Members")
            grid = driver.find_element(By.XPATH, "//div[contains(@style,'grid-template-columns')]")
            before = len(grid.find_elements(By.XPATH, "./div"))
            click_button("MGMT")
            time.sleep(1)
            after = len(driver.find_elements(By.XPATH, "//span[normalize-space()='MGMT']"))
            assert after <= before and after > 0
            return f"Team filter reduced cards from {before} to {after}."
        run_test(42, "Department filter buttons work", t42)

        def t43():
            login_admin()
            click_button("Team")
            wait_text("Team Members")
            grid = driver.find_element(By.XPATH, "//div[contains(@style,'grid-template-columns')]")
            card = grid.find_elements(By.XPATH, "./div")[0]
            card.click()
            wait_text("Calendar View")
            return "Team card navigated to attendance page."
        run_test(43, "Team card click navigates to attendance page", t43)

        def t44():
            login_admin()
            click_button("Team")
            wait_text("Team Members")
            bars = driver.find_elements(By.XPATH, "//div[contains(@style,'width:') and contains(@style,'%')]")
            assert len(bars) > 0
            return "Attendance progress bar rendered."
        run_test(44, "Attendance rate progress bar renders", t44)

        def t45():
            login_admin()
            go("/admin/attendance")
            wait_text("Select an employee from the sidebar.")
            return "Attendance page prompts for employee selection."
        run_test(45, "Attendance page requires selected employee", t45)

        def t46():
            login_admin()
            name = display_names[0]
            driver.find_element(By.XPATH, f"//div[@title='{name}']").click()
            wait_text("Calendar View")
            wait_text("Sun")
            wait_text("Mon")
            return "Calendar grid rendered with weekday headers."
        run_test(46, "Calendar grid renders for month", t46)

        def t47():
            login_admin()
            name = display_names[0]
            driver.find_element(By.XPATH, f"//div[@title='{name}']").click()
            wait_text("Calendar View")
            day_cells = driver.find_elements(By.XPATH, "//div[starts-with(@title, 'Status:')]")
            assert len(day_cells) > 0
            return "Day cells have status tooltips."
        run_test(47, "Day cells show status by color and tooltip", t47)

        def t60():
            login_admin()
            driver.find_element(By.XPATH, "//button[@title='Notifications']").click()
            wait_text("Leave Notifications")
            return "Notifications panel opened."
        run_test(60, "Notifications icon opens panel", t60)

        def t68():
            login_admin()
            go("/admin/report")
            wait_text("Select an employee.")
            return "Report page prompts for employee selection."
        run_test(68, "Report page requires selected employee", t68)

        driver.quit()
    finally:
        if server is not None:
            stop_dev_server(server)

    df = pd.read_excel(XLSX_PATH, sheet_name="Test Cases")
    for col in ["Actual result", "Status(Pass/Fail)", "Observation"]:
        if col in df.columns:
            df[col] = df[col].astype("object")

    def normalize_text(value):
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return ""
        text = str(value).strip().lower()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    def is_match(expected, actual):
        norm_expected = normalize_text(expected)
        norm_actual = normalize_text(actual)
        if not norm_expected and not norm_actual:
            return True
        if norm_expected == norm_actual:
            return True
        if norm_expected and norm_actual:
            if norm_expected in norm_actual or norm_actual in norm_expected:
                return True
            ratio = difflib.SequenceMatcher(None, norm_expected, norm_actual).ratio()
            if ratio >= 0.65:
                return True
            exp_tokens = set(norm_expected.split())
            act_tokens = set(norm_actual.split())
            if exp_tokens and act_tokens:
                overlap = len(exp_tokens & act_tokens) / max(1, len(exp_tokens))
                if overlap >= 0.5:
                    return True
        return False

    for idx, row in df.iterrows():
        sno = int(row["S.NO"]) if not pd.isna(row["S.NO"]) else None
        if sno in results:
            expected = row.get("Expected result", "")
            actual = results[sno]["actual"]
            df.at[idx, "Actual result"] = actual

            if results[sno]["status"] == "Fail":
                df.at[idx, "Status(Pass/Fail)"] = "Fail"
                obs = results[sno]["observation"]
                if not obs:
                    obs = f"Expected: {expected} | Actual: {actual}"
                df.at[idx, "Observation"] = obs
            else:
                if is_match(expected, actual):
                    df.at[idx, "Status(Pass/Fail)"] = "Pass"
                    df.at[idx, "Observation"] = ""
                else:
                    df.at[idx, "Status(Pass/Fail)"] = "Fail"
                    df.at[idx, "Observation"] = f"Expected: {expected} | Actual: {actual}"
        else:
            df.at[idx, "Actual result"] = "Not automated in selenium run."
            df.at[idx, "Status(Pass/Fail)"] = "Skip"
            df.at[idx, "Observation"] = "Requires manual or extended automation."

    with pd.ExcelWriter(XLSX_PATH, engine="openpyxl", mode="w") as writer:
        df.to_excel(writer, sheet_name="Test Cases", index=False)

    summary_path = ROOT / "testing" / "selenium-summary.json"
    summary_path.write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(str(exc))
        sys.exit(1)
