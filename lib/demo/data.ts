/**
 * Deterministic FICTIONAL demo candidates. None of these people exist; names are random
 * combinations and photos are generated cartoon placeholders ("demo:avatar-N").
 */
import Papa from "papaparse";

const FIRST = ["Aarav", "Vivaan", "Aditya", "Ananya", "Diya", "Ishaan", "Kavya", "Arjun", "Meera", "Rohan", "Saanvi", "Kabir", "Tara", "Reyansh", "Aisha", "Vihaan", "Myra", "Advik", "Riya", "Neel", "Zara", "Dhruv", "Anika", "Yash", "Prisha", "Arnav", "Siya", "Krish", "Navya", "Shaurya"];
const LAST = ["Sharma", "Verma", "Gupta", "Iyer", "Nair", "Reddy", "Patel", "Singh", "Chopra", "Mehta", "Bose", "Das", "Kulkarni", "Joshi", "Malhotra", "Kapoor", "Saxena", "Bhat", "Menon", "Rao"];
const FATHER = ["Rajesh", "Sanjay", "Anil", "Vikram", "Suresh", "Manoj", "Deepak", "Rakesh", "Amit", "Pradeep", "Harish", "Naveen"];
const CLASSES = ["7th (Foundation)", "8th (Foundation)", "9th (Foundation)", "10th (JEE)", "10th (NEET)", "11th (JEE)", "11th (NEET)"];
const CATS = ["General", "OBC", "SC", "ST", "EWS"];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface DemoRow {
  [k: string]: string;
}

export function demoRows(count: number, seed = 42): DemoRow[] {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const rows: DemoRow[] = [];
  for (let i = 1; i <= count; i++) {
    const first = pick(FIRST);
    const last = pick(LAST);
    const cls = pick(CLASSES);
    const code = cls.startsWith("1") ? (cls.includes("JEE") ? "J" : "N") : "F";
    const grade = cls.slice(0, cls.indexOf("th"));
    const y = 2016 - Number(grade) + Math.floor(r() * 2);
    const m = 1 + Math.floor(r() * 12);
    const d = 1 + Math.floor(r() * 28);
    const morning = i % 2 === 1;
    rows.push({
      "Student Name": `${first} ${last}`,
      "Father Name": `${pick(FATHER)} ${last}`,
      "Roll No": `SAT26${String(i).padStart(4, "0")}`,
      "Application ID": `APP-2026-${String(10000 + i * 7)}`,
      DOB: `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`,
      Gender: i % 2 === 0 ? "F" : "M",
      Category: pick(CATS),
      Class: cls,
      "SATHII Key": `SAT26-${grade}${code}-${String(1000 + i)}`,
      Exam: "SATHII Scholarship Examination 2026",
      "Exam Date": "15-11-2026",
      "Exam Time": morning ? "10:00 AM – 12:00 PM" : "02:00 PM – 04:00 PM",
      "Reporting Time": morning ? "09:15 AM" : "01:15 PM",
      Shift: morning ? "Morning" : "Afternoon",
      Centre: "S-CUBUS CAREER PVT. LTD. SECTOR- 12, DWARKA, DELHI",
      "Centre Address": "3rd Floor, Plot No. 46, Block No. B, Sector 12, Dwarka, Delhi 110078",
      Photo: `demo:avatar-${i % 24}`,
    });
  }
  return rows;
}

/** Demo rows with a few deliberate problems to exercise validation. */
export function demoRowsWithErrors(count: number): DemoRow[] {
  const rows = demoRows(count);
  if (rows.length >= 3) {
    rows[1] = { ...rows[1], "Student Name": "" }; // missing required name
    rows[2] = { ...rows[2], DOB: "31-02-2011" }; // impossible date
    rows.push({ ...rows[0], "Application ID": "APP-2026-DUP" }); // duplicate roll number
  }
  return rows;
}

export function toCsvText(rows: DemoRow[]): string {
  return Papa.unparse(rows);
}
