// ─── Seeded random generator ────────────────────────────────────────────────
function seedRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223 >>> 0;
    return s / 0xffffffff;
  };
}

// ─── Generate realistic daily attendance ────────────────────────────────────
export function generateAttendance(empId, year, month) {
  const rand = seedRand(parseInt(empId) * 100 + month + year);
  const daysInMonth = new Date(year, month, 0).getDate();
  const records = [];
  const toMins = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const fromMins = (mins) => {
    const h = Math.floor((mins % (24 * 60)) / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    // Weekend policy: only Sunday is a weekend (Saturday is a working day)
    if (dow === 0) {
      records.push({ day: d, status: 'weekend' });
      continue;
    }
    const r = rand();
    if (r < 0.05) {
      records.push({ day: d, status: 'absent' });
      continue;
    }
    const inH  = 9 + Math.floor(rand() * 1.5);
    const inM  = Math.floor(rand() * 58);
    const wrkH = 7 + Math.floor(rand() * 3);
    const wrkM = Math.floor(rand() * 58);
    const idle = Math.floor(rand() * 90);
    const outH = (inH + wrkH) % 24;
    const outM = (inM + wrkM) % 60;
    const pad  = (n) => String(n).padStart(2, '0');
    records.push({
      day:     d,
      status:  'present',
      inTime:  `${pad(inH)}:${pad(inM)}`,
      outTime: `${pad(outH)}:${pad(outM)}`,
      work:    `${pad(wrkH)}:${pad(wrkM)}`,
      idle:    `${pad(Math.floor(idle / 60))}:${pad(idle % 60)}`,
      logoutForLunch: fromMins(toMins(`${pad(inH)}:${pad(inM)}`) + 240),
      loginFromLunch: fromMins(toMins(`${pad(inH)}:${pad(inM)}`) + 285),
      logout: `${pad(outH)}:${pad(outM)}`,
    });
  }
  return records;
}

// ─── Raw employees from Excel ────────────────────────────────────────────────
const RAW = [
  { id: '1', name: 'RaghavendraGShetty', dept: 'MGMT' },
  { id: '2', name: 'Shivaraya_Pai', dept: 'RDL' },
  { id: '3', name: 'Ganapathi_Aithal_K.P', dept: 'MGMT' },
  { id: '4', name: 'Kanwal_Karkera', dept: 'MGMT' },
  { id: '5', name: 'Sunith_Sathyaveera', dept: 'RDL' },
  { id: '6', name: 'Ashwath', dept: 'RDL' },
  { id: '7', name: 'Vishwanatha_Achari', dept: 'RDL' },
  { id: '8', name: 'Santhosha_Shetty', dept: 'RDL' },
  { id: '9', name: 'Acharya_Dattatreya', dept: 'RDL' },
  { id: '10', name: 'RaoSamithBhaskar', dept: 'RDL' },
  { id: '11', name: 'karthik_Bhat', dept: 'RDL' },
  { id: '12', name: 'Rashmi_Naik_P', dept: 'RDL' },
  { id: '13', name: 'Sowmya_M', dept: 'RDL' },
  { id: '14', name: 'Preethi', dept: 'RDL' },
  { id: '15', name: 'Divya', dept: 'RDL' },
  { id: '16', name: 'Sandeep_Pai', dept: 'MGMT' },
  { id: '17', name: 'Ramachandra_Shrinivas_&', dept: 'RDL' },
  { id: '18', name: 'Ashwitha', dept: 'RDL' },
  { id: '19', name: 'Sachin_Manda', dept: 'RDL' },
  { id: '20', name: 'keerthi_A_U', dept: 'RDL' },
  { id: '21', name: 'Gaurav_Duth_Baliga', dept: 'RDL' },
  { id: '22', name: 'Sathyavathi_S_S', dept: 'RDL' },
  { id: '23', name: 'Mangala_Nayak', dept: 'RDL' },
  { id: '24', name: 'Vikhitha_Shetty', dept: 'RDL' },
  { id: '25', name: 'Chaithra', dept: 'RDL' },
  { id: '26', name: 'Surendra,P,R', dept: 'RDL' },
  { id: '27', name: 'Chithra', dept: 'RDL' },
  { id: '28', name: 'Rakshith_B_N', dept: 'RDL' },
  { id: '29', name: 'Shivasagar_T_J', dept: 'RDL' },
  { id: '30', name: 'B_Amratha_Baliga', dept: 'RDL' },
  { id: '31', name: 'Nafeesa_Afeefa_B', dept: 'RDL' },
  { id: '32', name: 'K_Roshan_Achari', dept: 'RDL' },
  { id: '33', name: 'Savitha', dept: 'RDL' },
  { id: '34', name: 'Shruthi', dept: 'RDL' },
  { id: '35', name: 'Vaishak', dept: 'RDL' },
  { id: '36', name: 'Pavan_H_G', dept: 'RDL' },
  { id: '37', name: 'Joswin', dept: 'RDL' },
  { id: '38', name: 'Shwetha', dept: 'RDL' },
  { id: '39', name: 'Meghana', dept: 'RDL' },
  { id: '40', name: 'Pranesh', dept: 'RDL' },
  { id: '41', name: 'Sachin_Kunder', dept: 'RDL' },
  { id: '42', name: 'Vikhyath_U_Alva', dept: 'RDL' },
  { id: '43', name: 'Suhas_S', dept: 'RDL' },
  { id: '44', name: 'Dhanya_N_Shetty', dept: 'RDL' },
  { id: '45', name: 'Deekshith', dept: 'RDL' },
  { id: '46', name: 'Amruthavarshini_M_R', dept: 'RDL' },
  { id: '47', name: 'Latheesh', dept: 'RDL' },
  { id: '48', name: 'Shifa_Sheik', dept: 'RDL' },
  { id: '49', name: 'Rashni', dept: 'RDL' },
  { id: '50', name: 'Rajesh_Bhat', dept: 'RDL' },
  { id: '51', name: 'Ranjith_Hegade_L', dept: 'RDL' },
  { id: '52', name: 'Chethan_Kumar', dept: 'RDL' },
  { id: '53', name: 'Akhil_Sharma', dept: 'RDL' },
  { id: '54', name: 'Admin', dept: 'RDL' },
  { id: '55', name: 'Subhash', dept: 'RDL' },
  { id: '56', name: 'PRAMOD', dept: 'RDL' },
  { id: '57', name: 'PRAJNA', dept: 'RDL' },
  { id: '58', name: 'ABHISHEK', dept: 'RDL' },
  { id: '59', name: 'ANAND', dept: 'RDL' },
  { id: '60', name: 'SANTOSHSALIAN', dept: 'RDL' },
  { id: '61', name: 'SURAJ_SHET', dept: 'RDL' },
  { id: '62', name: 'SUNIL', dept: 'RDL' },
  { id: '63', name: 'RANJITH_K', dept: 'RDL' },
  { id: '64', name: 'PRAJWAL', dept: 'RDL' },
  { id: '65', name: 'SUNEEL_BHAT', dept: 'RDL' },
  { id: '66', name: 'Suraj', dept: 'RDL' },
  { id: '67', name: 'Shashank', dept: 'RDL' },
  { id: '68', name: 'SHUBHA', dept: 'RDL' },
  { id: '69', name: 'SANJEETH', dept: 'RDL' },
  { id: '70', name: 'RASHMITHA', dept: 'RDL' },
  { id: '71', name: 'TUSHAR', dept: 'RDL' },
  { id: '72', name: 'VAISHAK_K', dept: 'RDL' },
  { id: '73', name: 'PUNEETHRAJ', dept: 'RDL' },
  { id: '74', name: 'SHAHIDH', dept: 'RDL' },
  { id: '75', name: 'THERESA', dept: 'RDL' },
  { id: '76', name: 'SOWNDARYA', dept: 'RDL' },
  { id: '77', name: 'DEEKSHITH_ACHARY', dept: 'RDL' },
  { id: '78', name: 'VINAYA', dept: 'RDL' },
  { id: '79', name: 'AJITH', dept: 'RDL' },
  { id: '80', name: 'Pratham_Suvarna', dept: 'RDL' },
  { id: '81', name: 'CHIRAG', dept: 'RDL' },
  { id: '82', name: 'DEEKSHITH_K', dept: 'RDL' },
  { id: '83', name: 'KIRTHIRAJ_DEVADIGA', dept: 'RDL' },
  { id: '84', name: 'VISHNU_V_U', dept: 'RDL' },
  { id: '85', name: 'RAJAT_SHETTY', dept: 'RDL' },
  { id: '86', name: 'ABIKSHA_SHETTY', dept: 'RDL' },
  { id: '87', name: 'CLARANCE_DSOUZA', dept: 'RDL' },
  { id: '88', name: 'ANUSHREE_V', dept: 'RDL' },
  { id: '89', name: 'SHIFALI_J', dept: 'RDL' },
  { id: '90', name: 'SUSHANTH_D', dept: 'RDL' },
  { id: '91', name: 'HRISHIKESH', dept: 'RDL' },
  { id: '92', name: 'SHREYANK', dept: 'RDL' },
  { id: '93', name: 'ADEEB', dept: 'RDL' },
  { id: '94', name: 'SHASHANK', dept: 'RDL' },
  { id: '95', name: 'SNEHA_RAI', dept: 'RDL' },
  { id: '96', name: 'DAKSHATH', dept: 'RDL' },
  { id: '97', name: 'Sharan_Rai', dept: 'RDL' },
  { id: '98', name: 'Saxen_Dcruz', dept: 'RDL' },
  { id: '99', name: 'Punith_R', dept: 'RDL' },
  { id: '100', name: 'Vignesh', dept: 'RDL' },
  { id: '101', name: 'PawanM', dept: 'RDL' },
];

export const EMPLOYEES = RAW.map((e) => ({
  ...e,
  displayName: formatEmployeeName(e.name),
  section: e.dept === 'MGMT' ? 'Administration'
         : e.dept === 'IT'   ? 'Development'
         : 'Lab Operations',
  attendance: {
    '2025-11': generateAttendance(e.id, 2025, 11),
    '2025-12': generateAttendance(e.id, 2025, 12),
  },
}));

function formatEmployeeName(name) {
  if (!name) return '';
  const spaced = String(name)
    .trim()
    .replace(/[_.,]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!spaced) return '';
  return spaced
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export const DEPARTMENTS = [
  { id: 1, name: 'MGMT',    description: 'Management and Administration'      },
  { id: 2, name: 'RDL',     description: 'Research and Development Lab'       },
  { id: 3, name: 'IT',      description: 'Information Technology and Systems' },
  { id: 4, name: 'HR',      description: 'Human Resources and Talent Acquisition' },
];

export const SECTIONS_DEFAULT = [
  { id: 1, name: 'Development',    department: 'IT',   description: 'Software Development Team' },
  { id: 2, name: 'Recruitment',    department: 'HR',   description: 'Talent Acquisition'        },
  { id: 3, name: 'Lab Operations', department: 'RDL',  description: 'Lab Workflows'              },
  { id: 4, name: 'Administration', department: 'MGMT', description: 'Admin Support'              },
  { id: 5, name: 'Support',        department: 'IT',   description: 'Technical Support'          },
];

export const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

// National holidays for India
export const NATIONAL_HOLIDAYS = {
  '2025-01-26': 'Republic Day',
  '2025-02-26': 'Maha Shivaratri',
  '2025-03-14': 'Holi',
  '2025-03-31': 'Id-ul-Fitr',
  '2025-04-10': 'Mahavir Jayanti',
  '2025-04-18': 'Good Friday',
  '2025-05-12': 'Buddha Purnima',
  '2025-06-07': 'Id-ul-Zuha (Bakrid)',
  '2025-07-06': 'Muharram',
  '2025-08-15': 'Independence Day',
  '2025-08-16': 'Janmashtami',
  '2025-09-05': 'Milad-un-Nabi',
  '2025-10-02': 'Gandhi Jayanti / Dussehra',
  '2025-10-20': 'Diwali',
  '2025-11-05': "Guru Nanak's Birthday",
  '2025-12-25': 'Christmas',
  '2026-01-26': 'Republic Day',
  '2026-03-04': 'Holi',
  '2026-03-21': 'Id-ul-Fitr',
  '2026-03-26': 'Ram Navami',
  '2026-03-31': 'Mahavir Jayanti',
  '2026-04-03': 'Good Friday',
  '2026-05-01': 'Buddha Purnima',
  '2026-05-27': 'Id-ul-Zuha (Bakrid)',
  '2026-06-26': 'Muharram',
  '2026-08-15': 'Independence Day',
  '2026-08-26': 'Milad-un-Nabi',
  '2026-09-04': 'Janmashtami',
  '2026-10-02': 'Gandhi Jayanti',
  '2026-10-20': 'Dussehra',
  '2026-11-08': 'Diwali',
  '2026-11-24': "Guru Nanak's Birthday",
  '2026-12-25': 'Christmas',
  '2027-01-26': 'Republic Day',
  '2027-03-06': 'Maha Shivaratri',
  '2027-03-10': 'Id-ul-Fitr (Tentative)',
  '2027-03-22': 'Holi',
  '2027-03-26': 'Good Friday',
  '2027-04-15': 'Ram Navami',
  '2027-05-17': 'Id-ul-Zuha (Bakrid) (Tentative)',
  '2027-06-16': 'Muharram (Tentative)',
  '2027-08-15': 'Independence Day',
  '2027-08-25': 'Janmashtami',
  '2027-10-02': 'Gandhi Jayanti',
  '2027-10-09': 'Dussehra',
  '2027-10-29': 'Diwali',
  '2027-12-25': 'Christmas',
};

export function getMonthStats(employee, monthKey) {
  const recs = employee.attendance[monthKey] || [];
  return {
    present: recs.filter(r => r.status === 'present').length,
    absent:  recs.filter(r => r.status === 'absent').length,
    total:   recs.filter(r => r.status !== 'weekend').length,
  };
}
