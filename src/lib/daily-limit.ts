const STORAGE_KEY = "ourcoloring_limit";
const FREE_LIMIT = 3;
const EMAIL_LIMIT = 10;

interface LimitData {
  date: string;
  count: number;
  email: string | null;
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getData(): LimitData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored)
      return { date: getToday(), count: 0, email: null };

    const data = JSON.parse(stored) as LimitData;

    // Reset count if new day (local midnight)
    if (data.date !== getToday()) {
      data.date = getToday();
      data.count = 0;
      saveData(data);
    }

    return data;
  } catch {
    return { date: getToday(), count: 0, email: null };
  }
}

function saveData(data: LimitData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function canConvert(): boolean {
  const data = getData();
  const limit = data.email ? EMAIL_LIMIT : FREE_LIMIT;
  return data.count < limit;
}

export function incrementCount(): void {
  const data = getData();
  data.count++;
  saveData(data);
}

export function getRemainingCount(): {
  remaining: number;
  total: number;
} {
  const data = getData();
  const limit = data.email ? EMAIL_LIMIT : FREE_LIMIT;
  return {
    remaining: Math.max(0, limit - data.count),
    total: limit,
  };
}

export function isEmailRegistered(): boolean {
  return getData().email !== null;
}

export function setEmail(email: string): void {
  const data = getData();
  data.email = email;
  saveData(data);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
