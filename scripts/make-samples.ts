// Writes the downloadable sample CSVs into public/samples (all data FICTIONAL).
import fs from "node:fs";
import path from "node:path";
import { demoRows, demoRowsWithErrors, toCsvText } from "../src/lib/demo/data";

const dir = path.resolve("public/samples");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "sample-candidates-10.csv"), toCsvText(demoRows(10)));
fs.writeFileSync(path.join(dir, "demo-candidates-100.csv"), toCsvText(demoRows(100)));
fs.writeFileSync(path.join(dir, "sample-with-errors.csv"), toCsvText(demoRowsWithErrors(12)));
const template = [
  "Student Name,Father Name,Roll No,Application ID,DOB,Gender,Category,Exam,Exam Date,Exam Time,Reporting Time,Centre,Centre Address,Photo",
  "Firstname Lastname,Father Name,ROLL0001,APP-0001,15-08-2010,F,General,Your Exam Name,15-11-2026,10:00 AM – 12:00 PM,09:15 AM,Centre Name,Full centre address,photo_ROLL0001.jpg",
].join("\n");
fs.writeFileSync(path.join(dir, "blank-template.csv"), template + "\n");
console.log("samples written to", dir);
