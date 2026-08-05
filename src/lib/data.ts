export type EquipmentStatus = "available" | "rented" | "service" | "damaged";

export type Equipment = {
  id: string;
  name: string;
  type: string;
  brand: string;
  model: string;
  serial: string;
  status: EquipmentStatus;
  purchaseDate: string;
  dailyRate: number;
  monthlyRate: number;
  notes?: string;
};

export type Customer = {
  id: string;
  name: string;
  age: number;
  gender: string;
  attender: string;
  attenderRelation: string;
  phone: string;
  whatsapp: string;
  emergency: string;
  city: string;
  address: string;
  since: string;
  rentals: number;
  totalBilled: number;
  notes?: string;
};

export type InvoiceStatus = "paid" | "pending" | "overdue" | "draft";

export type Invoice = {
  id: string;
  number: string;
  customerId: string;
  customer: string;
  equipment: string[];
  amount: number;
  paid: number;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  period: string;
};

export type Rental = {
  id: string;
  equipment: string;
  equipmentId: string;
  customer: string;
  customerId: string;
  startDate: string;
  dueDate: string;
  rate: number;
  status: "active" | "due-soon" | "overdue";
};

export const equipmentTypes = [
  "Oxygen Concentrator",
  "BiPAP Machine",
  "CPAP Machine",
  "Hospital Bed",
  "Wheelchair",
  "Patient Monitor",
  "Nebulizer",
  "Suction Machine",
];

export const equipment: Equipment[] = [
  { id: "EQ-1001", name: "Oxygen Concentrator 5L", type: "Oxygen Concentrator", brand: "Philips", model: "EverFlo 5L", serial: "PH-5L-88213", status: "rented", purchaseDate: "2023-04-12", dailyRate: 450, monthlyRate: 7500, notes: "Serviced quarterly." },
  { id: "EQ-1002", name: "Oxygen Concentrator 10L", type: "Oxygen Concentrator", brand: "Nidek", model: "Nuvo 10L", serial: "ND-10L-44127", status: "available", purchaseDate: "2023-07-02", dailyRate: 700, monthlyRate: 11000 },
  { id: "EQ-1003", name: "BiPAP ST Ventilator", type: "BiPAP Machine", brand: "ResMed", model: "Lumis 150", serial: "RM-BP-71204", status: "rented", purchaseDate: "2022-11-19", dailyRate: 600, monthlyRate: 9500 },
  { id: "EQ-1004", name: "CPAP Auto", type: "CPAP Machine", brand: "ResMed", model: "AirSense 10", serial: "RM-CP-33012", status: "available", purchaseDate: "2024-01-08", dailyRate: 350, monthlyRate: 6000 },
  { id: "EQ-1005", name: "Semi-Fowler Hospital Bed", type: "Hospital Bed", brand: "Hillrom", model: "SF-200", serial: "HR-BD-90233", status: "rented", purchaseDate: "2022-06-30", dailyRate: 300, monthlyRate: 5000 },
  { id: "EQ-1006", name: "Electric Hospital Bed", type: "Hospital Bed", brand: "Medline", model: "E-Care 3F", serial: "ML-BD-11876", status: "service", purchaseDate: "2021-09-15", dailyRate: 500, monthlyRate: 8000, notes: "Motor replacement in progress." },
  { id: "EQ-1007", name: "Foldable Wheelchair", type: "Wheelchair", brand: "Karma", model: "Rainbow 6", serial: "KM-WC-55401", status: "available", purchaseDate: "2023-02-21", dailyRate: 150, monthlyRate: 2500 },
  { id: "EQ-1008", name: "Multipara Patient Monitor", type: "Patient Monitor", brand: "Contec", model: "CMS8000", serial: "CT-PM-77219", status: "rented", purchaseDate: "2023-10-05", dailyRate: 800, monthlyRate: 13000 },
  { id: "EQ-1009", name: "Compressor Nebulizer", type: "Nebulizer", brand: "Omron", model: "NE-C801", serial: "OM-NB-20194", status: "available", purchaseDate: "2024-03-14", dailyRate: 90, monthlyRate: 1500 },
  { id: "EQ-1010", name: "Suction Machine 2L", type: "Suction Machine", brand: "Devilbiss", model: "VacuAide", serial: "DV-SM-64118", status: "damaged", purchaseDate: "2021-12-01", dailyRate: 200, monthlyRate: 3200, notes: "Awaiting condemnation approval." },
  { id: "EQ-1011", name: "Oxygen Concentrator 8L", type: "Oxygen Concentrator", brand: "Longfian", model: "JAY-8", serial: "LF-8L-30945", status: "available", purchaseDate: "2024-05-27", dailyRate: 600, monthlyRate: 9800 },
  { id: "EQ-1012", name: "BiPAP Auto", type: "BiPAP Machine", brand: "Philips", model: "DreamStation", serial: "PH-BP-50288", status: "rented", purchaseDate: "2023-08-09", dailyRate: 550, monthlyRate: 9000 },
];

export const customers: Customer[] = [
  { id: "CU-2001", name: "Ramesh Iyer", age: 68, gender: "Male", attender: "Lakshmi Iyer", attenderRelation: "Daughter", phone: "+91 98450 11223", whatsapp: "+91 98450 11223", emergency: "+91 99001 55442", city: "Bengaluru", address: "42, 7th Cross, Indiranagar, Bengaluru 560038", since: "2023-05-11", rentals: 6, totalBilled: 84500 },
  { id: "CU-2002", name: "Sabitha Nair", age: 74, gender: "Female", attender: "Arun Nair", attenderRelation: "Son", phone: "+91 90876 44219", whatsapp: "+91 90876 44219", emergency: "+91 90876 88001", city: "Kochi", address: "Sreyas, Panampilly Nagar, Kochi 682036", since: "2024-01-04", rentals: 3, totalBilled: 41200 },
  { id: "CU-2003", name: "Mohan Prakash", age: 59, gender: "Male", attender: "Deepa Prakash", attenderRelation: "Spouse", phone: "+91 99620 78120", whatsapp: "+91 99620 78120", emergency: "+91 99620 78121", city: "Chennai", address: "18/3 Bazullah Road, T Nagar, Chennai 600017", since: "2022-11-28", rentals: 9, totalBilled: 132400 },
  { id: "CU-2004", name: "Fatima Sheikh", age: 81, gender: "Female", attender: "Imran Sheikh", attenderRelation: "Grandson", phone: "+91 88790 33456", whatsapp: "+91 88790 33456", emergency: "+91 88790 33001", city: "Hyderabad", address: "Plot 22, Banjara Hills Road 12, Hyderabad 500034", since: "2024-06-19", rentals: 2, totalBilled: 26800 },
  { id: "CU-2005", name: "Joseph Fernandes", age: 66, gender: "Male", attender: "Maria Fernandes", attenderRelation: "Spouse", phone: "+91 97400 12987", whatsapp: "+91 97400 12987", emergency: "+91 97400 12988", city: "Mangaluru", address: "Sunrise Villa, Kadri Hills, Mangaluru 575002", since: "2023-09-02", rentals: 4, totalBilled: 58900 },
  { id: "CU-2006", name: "Anjali Deshpande", age: 71, gender: "Female", attender: "Nikhil Deshpande", attenderRelation: "Son", phone: "+91 91560 65321", whatsapp: "+91 91560 65321", emergency: "+91 91560 65000", city: "Pune", address: "B-704, Kalyani Nagar, Pune 411006", since: "2025-02-14", rentals: 1, totalBilled: 11500 },
];

export const invoices: Invoice[] = [
  { id: "INV-9001", number: "BCK/2026/0091", customerId: "CU-2001", customer: "Ramesh Iyer", equipment: ["Oxygen Concentrator 5L", "Semi-Fowler Hospital Bed"], amount: 12500, paid: 12500, date: "2026-07-01", dueDate: "2026-07-08", status: "paid", period: "01 Jul – 31 Jul 2026" },
  { id: "INV-9002", number: "BCK/2026/0092", customerId: "CU-2003", customer: "Mohan Prakash", equipment: ["Multipara Patient Monitor"], amount: 13000, paid: 6000, date: "2026-07-06", dueDate: "2026-07-13", status: "pending", period: "06 Jul – 05 Aug 2026" },
  { id: "INV-9003", number: "BCK/2026/0093", customerId: "CU-2002", customer: "Sabitha Nair", equipment: ["BiPAP ST Ventilator"], amount: 9500, paid: 0, date: "2026-06-18", dueDate: "2026-06-25", status: "overdue", period: "18 Jun – 17 Jul 2026" },
  { id: "INV-9004", number: "BCK/2026/0094", customerId: "CU-2005", customer: "Joseph Fernandes", equipment: ["BiPAP Auto", "Compressor Nebulizer"], amount: 10500, paid: 10500, date: "2026-07-11", dueDate: "2026-07-18", status: "paid", period: "11 Jul – 10 Aug 2026" },
  { id: "INV-9005", number: "BCK/2026/0095", customerId: "CU-2004", customer: "Fatima Sheikh", equipment: ["Foldable Wheelchair"], amount: 2500, paid: 0, date: "2026-07-22", dueDate: "2026-07-29", status: "pending", period: "22 Jul – 21 Aug 2026" },
  { id: "INV-9006", number: "BCK/2026/0096", customerId: "CU-2006", customer: "Anjali Deshpande", equipment: ["Oxygen Concentrator 8L"], amount: 9800, paid: 0, date: "2026-08-02", dueDate: "2026-08-09", status: "draft", period: "02 Aug – 01 Sep 2026" },
];

export const rentals: Rental[] = [
  { id: "RN-3001", equipment: "Oxygen Concentrator 5L", equipmentId: "EQ-1001", customer: "Ramesh Iyer", customerId: "CU-2001", startDate: "2026-07-01", dueDate: "2026-07-31", rate: 7500, status: "due-soon" },
  { id: "RN-3002", equipment: "Semi-Fowler Hospital Bed", equipmentId: "EQ-1005", customer: "Ramesh Iyer", customerId: "CU-2001", startDate: "2026-07-01", dueDate: "2026-07-31", rate: 5000, status: "due-soon" },
  { id: "RN-3003", equipment: "Multipara Patient Monitor", equipmentId: "EQ-1008", customer: "Mohan Prakash", customerId: "CU-2003", startDate: "2026-07-06", dueDate: "2026-08-05", rate: 13000, status: "active" },
  { id: "RN-3004", equipment: "BiPAP ST Ventilator", equipmentId: "EQ-1003", customer: "Sabitha Nair", customerId: "CU-2002", startDate: "2026-06-18", dueDate: "2026-07-17", rate: 9500, status: "overdue" },
  { id: "RN-3005", equipment: "BiPAP Auto", equipmentId: "EQ-1012", customer: "Joseph Fernandes", customerId: "CU-2005", startDate: "2026-07-11", dueDate: "2026-08-10", rate: 9000, status: "active" },
];

export const activity = [
  { id: 1, title: "Invoice BCK/2026/0094 marked paid", meta: "Joseph Fernandes · ₹10,500", time: "12 min ago", kind: "invoice" as const },
  { id: 2, title: "Oxygen Concentrator 8L returned", meta: "Anjali Deshpande · EQ-1011", time: "1 hr ago", kind: "return" as const },
  { id: 3, title: "New customer onboarded", meta: "Anjali Deshpande · Pune", time: "3 hrs ago", kind: "customer" as const },
  { id: 4, title: "Electric Hospital Bed sent to service", meta: "EQ-1006 · motor replacement", time: "Yesterday", kind: "service" as const },
  { id: 5, title: "Rental renewed for 30 days", meta: "Mohan Prakash · Patient Monitor", time: "2 days ago", kind: "rental" as const },
];

export const revenueSeries = [
  { month: "Feb", revenue: 182000, rentals: 21 },
  { month: "Mar", revenue: 214000, rentals: 24 },
  { month: "Apr", revenue: 196000, rentals: 22 },
  { month: "May", revenue: 248000, rentals: 28 },
  { month: "Jun", revenue: 271000, rentals: 31 },
  { month: "Jul", revenue: 312000, rentals: 35 },
];

export const categoryMix = [
  { name: "Oxygen", value: 38 },
  { name: "BiPAP / CPAP", value: 27 },
  { name: "Beds", value: 19 },
  { name: "Monitors", value: 10 },
  { name: "Others", value: 6 },
];

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const statusCount = (s: EquipmentStatus) => equipment.filter((e) => e.status === s).length;
