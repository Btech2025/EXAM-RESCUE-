/**
 * Client-Side Authentication & Session Manager for Exam Rescue.
 * Provides real registration, login, logout, password hashing, and user-scoped data persistence.
 */

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  university?: string;
  course?: string;
  dailyHours?: number;
  onboardingCompleted: boolean;
  createdAt: string;
}

interface StoredUserAccount extends UserProfile {
  passwordHash: string;
}

const USERS_STORAGE_KEY = "exam-rescue:users";
const SESSION_STORAGE_KEY = "exam-rescue:session";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "_exam_rescue_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getStoredUsers(): StoredUserAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredUsers(users: StoredUserAccount[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // Storage quota or private mode
  }
}

export function getCurrentUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(user: UserProfile | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent("exam-rescue:auth-changed", { detail: { user } }));
  } catch {
    // Ignore
  }
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  if (!cleanName) {
    return { success: false, error: "Please enter your name." };
  }
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (!password || password.length < 6) {
    return { success: false, error: "Password must be at least 6 characters long." };
  }

  const users = getStoredUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    return { success: false, error: "An account with this email already exists. Please log in." };
  }

  const passwordHash = await hashPassword(password);
  const newUser: StoredUserAccount = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    name: cleanName,
    email: cleanEmail,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
    passwordHash,
  };

  users.push(newUser);
  saveStoredUsers(users);

  const { passwordHash: _hash, ...userProfile } = newUser;
  saveSession(userProfile);

  return { success: true, user: userProfile };
}

export async function logIn(
  email: string,
  password: string,
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { success: false, error: "Please enter your email and password." };
  }

  const users = getStoredUsers();
  const user = users.find((u) => u.email === cleanEmail);

  if (!user) {
    return { success: false, error: "No account found with this email. Please sign up." };
  }

  const hash = await hashPassword(password);
  if (user.passwordHash !== hash) {
    return { success: false, error: "Incorrect password. Please try again." };
  }

  const { passwordHash: _hash, ...userProfile } = user;
  saveSession(userProfile);

  return { success: true, user: userProfile };
}

export function logOut(): void {
  saveSession(null);
}

export function updateUserProfile(updates: Partial<UserProfile>): UserProfile | null {
  const current = getCurrentUser();
  if (!current) return null;

  const updated: UserProfile = { ...current, ...updates };
  saveSession(updated);

  const users = getStoredUsers();
  const index = users.findIndex((u) => u.id === current.id);
  if (index !== -1) {
    users[index] = { ...users[index]!, ...updates };
    saveStoredUsers(users);
  }

  return updated;
}

/**
 * Demo login option for quickly exploring the app with pre-filled sample data
 */
export function logInAsDemo(): UserProfile {
  const demoUser: UserProfile = {
    id: "demo_student_account",
    name: "Aarchi",
    email: "demo@examrescue.app",
    university: "Tech University",
    course: "Computer Science",
    dailyHours: 3,
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
  };

  saveSession(demoUser);
  return demoUser;
}
