const STORAGE_KEY = "ourcoloring_limit";
const DAILY_LIMIT = 3;

interface LimitData {
  date: string;
  count: number;
  email: string | null;
  unlimited: boolean;
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getData(): LimitData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored)
      return { date: getToday(), count: 0, email: null, unlimited: false };

    const data = JSON.parse(stored) as LimitData;

    // Reset count if new day (local midnight)
    if (data.date !== getToday()) {
      data.date = getToday();
      data.count = 0;
      saveData(data);
    }

    return data;
  } catch {
    return { date: getToday(), count: 0, email: null, unlimited: false };
  }
}

function saveData(data: LimitData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function canConvert(): boolean {
  const data = getData();
  return data.unlimited || data.count < DAILY_LIMIT;
}

export function incrementCount(): void {
  const data = getData();
  data.count++;
  saveData(data);
}

export function getRemainingCount(): {
  remaining: number;
  total: number;
  unlimited: boolean;
} {
  const data = getData();
  return {
    remaining: Math.max(0, DAILY_LIMIT - data.count),
    total: DAILY_LIMIT,
    unlimited: data.unlimited,
  };
}

export function setEmail(email: string): void {
  const data = getData();
  data.email = email;
  data.unlimited = true;
  saveData(data);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
