/**
 * Flick Campus Multi-Tenant Storage & Academic Registry Service
 * Secure Password-Protected Auth for Students and Lecturers
 * 3 Colleges: CBAS, CHMS, CHAS across 6 levels: 100L to 600L
 * Slide Bank with real-time reading, downloading, and 30.00 GB Quota Tracker
 */

import { supabase } from "@/integrations/supabase/client";
import {
  CAMPUS_STORAGE_TOTAL_BYTES,
  TEACHER_VERIFICATION_KEY,
  type AcademicLevel,
  type AcademicProfile,
  type CampusCollege,
  type CampusCourse,
  type CampusStorageQuota,
  type CampusTimetableSlot,
  type LiveBridgeEvent,
  type SlideBankDeck,
  type ClassSlide,
} from "./types";

const ACADEMIC_PROFILE_KEY = "flick_campus_academic_profile";
const ACADEMIC_USERS_CREDENTIALS_KEY = "flick_campus_users_credentials";
const CAMPUS_COURSES_KEY = "flick_campus_courses_store";
const CAMPUS_TIMETABLE_KEY = "flick_campus_timetable_store";
const CAMPUS_STORAGE_METRICS_KEY = "flick_campus_storage_metrics";
const CAMPUS_LIVE_BRIDGES_KEY = "flick_campus_live_bridges";
const CAMPUS_SLIDE_BANK_KEY = "flick_campus_slide_bank";

interface StoredCredential {
  id: string;
  role: "student" | "lecturer";
  fullName: string;
  email?: string;
  matricNo?: string;
  staffId?: string;
  college: CampusCollege;
  department: string;
  level?: AcademicLevel;
  coursesTaught?: string[];
  passwordHash: string;
  registeredAt: string;
}

export class CampusStorageService {
  /**
   * Hashes password with SHA-256 for secure anywhere-login verification
   */
  public static async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "_FLICK_CAMPUS_SECURE_SALT_2026");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Retrieves all registered academic credentials
   */
  private static getStoredCredentials(): StoredCredential[] {
    try {
      const raw = localStorage.getItem(ACADEMIC_USERS_CREDENTIALS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Secure Academic Registration with Password
   */
  public static async registerAcademicUser(params: {
    role: "student" | "lecturer";
    fullName: string;
    email?: string;
    matricNo?: string;
    staffId?: string;
    college: CampusCollege;
    department: string;
    level?: AcademicLevel;
    coursesTaught?: string[];
    password: string;
    teacherKey?: string;
    userId?: string;
  }): Promise<{ success: boolean; profile?: AcademicProfile; error?: string }> {
    if (!params.password || params.password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    if (!params.college) {
      return { success: false, error: "Please select your College (CBAS, CHMS, or CHAS)." };
    }

    // Role-specific verification
    if (params.role === "lecturer") {
      if (params.teacherKey?.trim() !== TEACHER_VERIFICATION_KEY) {
        return {
          success: false,
          error: "Access Denied: Invalid Teacher Verification Code. Only verified faculty members holding the instructor key (A1B2C3D4E5) may register as lecturers.",
        };
      }
      if (!params.staffId?.trim()) {
        return { success: false, error: "Staff ID or faculty email is required." };
      }
    } else {
      if (!params.matricNo?.trim()) {
        return { success: false, error: "Matriculation number is required for students." };
      }
      if (!params.level) {
        return { success: false, error: "Please select your academic level (100L - 600L)." };
      }
    }

    const credentials = this.getStoredCredentials();
    const cleanMatric = params.matricNo?.trim().toUpperCase();
    const cleanStaff = params.staffId?.trim().toUpperCase();

    // Check duplicate
    if (params.role === "student" && credentials.some((c) => c.matricNo === cleanMatric)) {
      return { success: false, error: `Student with matric number "${cleanMatric}" is already registered. Please log in.` };
    }
    if (params.role === "lecturer" && credentials.some((c) => c.staffId === cleanStaff)) {
      return { success: false, error: `Lecturer with Staff ID "${cleanStaff}" is already registered. Please log in.` };
    }

    const passwordHash = await this.hashPassword(params.password);
    const userId = `acad_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const newCredential: StoredCredential = {
      id: userId,
      role: params.role,
      fullName: params.fullName.trim(),
      email: params.email?.trim().toLowerCase(),
      matricNo: cleanMatric,
      staffId: cleanStaff,
      college: params.college,
      department: params.department.trim(),
      level: params.role === "student" ? params.level : undefined,
      coursesTaught: params.coursesTaught || [],
      passwordHash,
      registeredAt: new Date().toISOString(),
    };

    credentials.push(newCredential);
    localStorage.setItem(ACADEMIC_USERS_CREDENTIALS_KEY, JSON.stringify(credentials));

    const profile: AcademicProfile = {
      id: userId,
      userId: params.userId,
      role: params.role,
      fullName: newCredential.fullName,
      email: newCredential.email,
      matricNo: newCredential.matricNo,
      staffId: newCredential.staffId,
      college: newCredential.college,
      department: newCredential.department,
      level: newCredential.level,
      coursesTaught: newCredential.coursesTaught,
      teacherVerified: params.role === "lecturer",
      registeredAt: newCredential.registeredAt,
    };

    localStorage.setItem(ACADEMIC_PROFILE_KEY, JSON.stringify(profile));

    // Also persist to Supabase if table exists
    try {
      await supabase.from("campus_academic_users").upsert({
        id: userId,
        user_id: params.userId,
        role: profile.role,
        full_name: profile.fullName,
        matric_no: profile.matricNo,
        staff_id: profile.staffId,
        department: profile.department,
        academic_level: profile.level,
        courses_taught: profile.coursesTaught,
        teacher_verified: profile.teacherVerified,
      });
    } catch {}

    window.dispatchEvent(new CustomEvent("flick:academic-profile-changed", { detail: profile }));
    return { success: true, profile };
  }

  /**
   * Secure Academic Login with Password & College Check
   */
  public static async loginAcademicUser(params: {
    role: "student" | "lecturer";
    identifier: string; // Matric No for student, Staff ID for lecturer
    password: string;
    college: CampusCollege;
    teacherKey?: string;
  }): Promise<{ success: boolean; profile?: AcademicProfile; error?: string }> {
    const cleanId = params.identifier.trim().toUpperCase();

    if (!cleanId) {
      return { success: false, error: params.role === "student" ? "Please enter your Matric Number." : "Please enter your Staff ID." };
    }
    if (!params.password) {
      return { success: false, error: "Please enter your password." };
    }

    if (params.role === "lecturer") {
      if (params.teacherKey?.trim() !== TEACHER_VERIFICATION_KEY) {
        return {
          success: false,
          error: "Access Denied: Invalid Teacher Security Key. Only verified instructors holding (A1B2C3D4E5) may log in as faculty.",
        };
      }
    }

    const credentials = this.getStoredCredentials();
    const enteredHash = await this.hashPassword(params.password);

    const userRecord = credentials.find((c) => {
      if (c.role !== params.role) return false;
      const idMatch = c.role === "student" ? c.matricNo === cleanId : c.staffId === cleanId;
      return idMatch;
    });

    if (!userRecord) {
      return {
        success: false,
        error: `No ${params.role} account found matching "${cleanId}". Please register first.`,
      };
    }

    // Verify College match so CBAS, CHMS, CHAS are never mixed up
    if (userRecord.college !== params.college) {
      return {
        success: false,
        error: `College mismatch: This account is registered under ${userRecord.college}, but you selected ${params.college}. Please select your correct College.`,
      };
    }

    if (userRecord.passwordHash !== enteredHash) {
      return { success: false, error: "Authentication failed: Incorrect password. Please try again." };
    }

    const profile: AcademicProfile = {
      id: userRecord.id,
      role: userRecord.role,
      fullName: userRecord.fullName,
      matricNo: userRecord.matricNo,
      staffId: userRecord.staffId,
      college: userRecord.college,
      department: userRecord.department,
      level: userRecord.level,
      coursesTaught: userRecord.coursesTaught,
      teacherVerified: userRecord.role === "lecturer",
      registeredAt: userRecord.registeredAt,
    };

    localStorage.setItem(ACADEMIC_PROFILE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new CustomEvent("flick:academic-profile-changed", { detail: profile }));
    return { success: true, profile };
  }

  /**
   * Sends password reset email using Supabase Auth
   */
  public static async sendPasswordResetEmail(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { success: false, message: "Please provide a valid email address." };
    }

    try {
      const redirectUrl = `${window.location.origin}/auth?type=recovery`;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        return { success: false, message: error.message };
      }

      return {
        success: true,
        message: `Password reset email dispatched to ${cleanEmail}. Check your inbox for the reset link.`,
      };
    } catch (err) {
      return {
        success: false,
        message: (err as Error).message || "Failed to dispatch password reset email.",
      };
    }
  }

  /**
   * Reads active logged-in Academic Profile
   */
  public static getAcademicProfile(): AcademicProfile | null {
    try {
      const raw = localStorage.getItem(ACADEMIC_PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Logs out from Flick Campus Academic Portal
   */
  public static logoutAcademicProfile(): void {
    localStorage.removeItem(ACADEMIC_PROFILE_KEY);
    window.dispatchEvent(new CustomEvent("flick:academic-profile-changed", { detail: null }));
  }

  /**
   * 30GB Multi-Tenant Storage Quota metrics
   */
  public static getStorageQuota(): CampusStorageQuota {
    try {
      const raw = localStorage.getItem(CAMPUS_STORAGE_METRICS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const free = Math.max(0, CAMPUS_STORAGE_TOTAL_BYTES - parsed.usedBytes);
        return {
          totalBytes: CAMPUS_STORAGE_TOTAL_BYTES,
          usedBytes: parsed.usedBytes || 0,
          freeBytes: free,
          percentUsed: (parsed.usedBytes / CAMPUS_STORAGE_TOTAL_BYTES) * 100,
          slidesCount: parsed.slidesCount || 0,
          tenantCode: "FLICK-CAMPUS-ZONE",
        };
      }
    } catch {}

    return {
      totalBytes: CAMPUS_STORAGE_TOTAL_BYTES,
      usedBytes: 0,
      freeBytes: CAMPUS_STORAGE_TOTAL_BYTES,
      percentUsed: 0,
      slidesCount: 0,
      tenantCode: "FLICK-CAMPUS-ZONE",
    };
  }

  /**
   * Records newly uploaded lecture slides against the 30GB quota
   */
  public static trackSlideStorage(bytesUploaded: number, slideCount: number): boolean {
    const current = this.getStorageQuota();
    if (current.usedBytes + bytesUploaded > CAMPUS_STORAGE_TOTAL_BYTES) {
      return false;
    }

    const updated = {
      usedBytes: current.usedBytes + bytesUploaded,
      slidesCount: current.slidesCount + slideCount,
    };
    localStorage.setItem(CAMPUS_STORAGE_METRICS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("flick:campus-storage-updated", { detail: updated }));
    return true;
  }

  /**
   * Slide Bank Repository: Fetch slides filtered by College and Level
   */
  public static getSlideBank(
    college?: CampusCollege,
    level?: AcademicLevel,
    search?: string
  ): SlideBankDeck[] {
    try {
      const raw = localStorage.getItem(CAMPUS_SLIDE_BANK_KEY);
      let list: SlideBankDeck[] = raw ? JSON.parse(raw) : [];

      // Seed foundational deck bank across CBAS, CHMS, CHAS if empty
      if (list.length === 0) {
        list = this.seedInitialSlideBank();
        localStorage.setItem(CAMPUS_SLIDE_BANK_KEY, JSON.stringify(list));
      }

      return list.filter((deck) => {
        if (college && deck.college !== college) return false;
        if (level && deck.level !== level) return false;
        if (search) {
          const q = search.toLowerCase();
          const match =
            deck.courseCode.toLowerCase().includes(q) ||
            deck.courseTitle.toLowerCase().includes(q) ||
            deck.deckTitle.toLowerCase().includes(q) ||
            deck.department.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      });
    } catch {
      return [];
    }
  }

  /**
   * Adds a newly uploaded deck to the Slide Bank
   */
  public static addDeckToSlideBank(deck: Omit<SlideBankDeck, "id" | "uploadedAt">): SlideBankDeck {
    const list = this.getSlideBank();
    const newDeck: SlideBankDeck = {
      ...deck,
      id: `deck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      uploadedAt: new Date().toISOString(),
    };
    list.unshift(newDeck);
    localStorage.setItem(CAMPUS_SLIDE_BANK_KEY, JSON.stringify(list));

    // Track against 30GB quota
    this.trackSlideStorage(newDeck.fileSizeBytes, newDeck.totalPages);

    window.dispatchEvent(new CustomEvent("flick:campus-slide-bank-updated", { detail: list }));
    return newDeck;
  }

  /**
   * Initial Foundation Slide Bank across all 3 Colleges and 6 Levels
   */
  private static seedInitialSlideBank(): SlideBankDeck[] {
    const decks: SlideBankDeck[] = [
      // CBAS (100L - 600L)
      {
        id: "deck_cbas_101",
        college: "CBAS",
        level: 100,
        department: "Computer Science",
        courseCode: "CSC 101",
        courseTitle: "Introduction to Computer Science & Algorithms",
        deckTitle: "Lecture 1: Computational Thinking & Flowcharts",
        totalPages: 4,
        fileSizeBytes: 2450000,
        uploadedBy: "Prof. S. O. Falana",
        uploadedAt: "2026-10-15T09:00:00Z",
        downloadable: true,
        slides: [
          { id: "s1", pageNumber: 1, title: "Computational Thinking", imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1280&q=80" },
          { id: "s2", pageNumber: 2, title: "Decomposition & Abstraction", imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1280&q=80" },
          { id: "s3", pageNumber: 3, title: "Pattern Recognition", imageUrl: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1280&q=80" },
          { id: "s4", pageNumber: 4, title: "Algorithm Flow & Execution", imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1280&q=80" },
        ],
      },
      {
        id: "deck_cbas_201",
        college: "CBAS",
        level: 200,
        department: "Computer Science",
        courseCode: "CSC 201",
        courseTitle: "Data Structures & Linear Organization",
        deckTitle: "Stack & Queue Implementations in Memory",
        totalPages: 3,
        fileSizeBytes: 3120000,
        uploadedBy: "Dr. Catherine Stone",
        uploadedAt: "2026-10-20T11:30:00Z",
        downloadable: true,
        slides: [
          { id: "s5", pageNumber: 1, title: "Stack: LIFO Dynamics", imageUrl: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1280&q=80" },
          { id: "s6", pageNumber: 2, title: "Queue: FIFO & Circular Buffers", imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1280&q=80" },
          { id: "s7", pageNumber: 3, title: "Pointer Manipulation & Memory", imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1280&q=80" },
        ],
      },
      {
        id: "deck_cbas_301",
        college: "CBAS",
        level: 300,
        department: "Software Engineering",
        courseCode: "SEN 301",
        courseTitle: "Operating Systems & Concurrency",
        deckTitle: "Process Scheduling & Deadlock Prevention",
        totalPages: 3,
        fileSizeBytes: 3890000,
        uploadedBy: "Dr. A. E. Okoye",
        uploadedAt: "2026-10-22T14:00:00Z",
        downloadable: true,
        slides: [
          { id: "s8", pageNumber: 1, title: "Concurrency & Race Conditions", imageUrl: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1280&q=80" },
          { id: "s9", pageNumber: 2, title: "Semaphores & Mutex Locks", imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1280&q=80" },
          { id: "s10", pageNumber: 3, title: "Banker's Algorithm & Resource Graphs", imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1280&q=80" },
        ],
      },
      {
        id: "deck_cbas_401",
        college: "CBAS",
        level: 400,
        department: "Cyber Security",
        courseCode: "CYB 401",
        courseTitle: "Cryptography & Network Security",
        deckTitle: "Public Key Infrastructure (RSA & Elliptic Curves)",
        totalPages: 3,
        fileSizeBytes: 4200000,
        uploadedBy: "Prof. Kenneth Okon",
        uploadedAt: "2026-10-25T10:15:00Z",
        downloadable: true,
        slides: [
          { id: "s11", pageNumber: 1, title: "Asymmetric Encryption Principles", imageUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1280&q=80" },
          { id: "s12", pageNumber: 2, title: "Diffie-Hellman Key Exchange", imageUrl: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1280&q=80" },
          { id: "s13", pageNumber: 3, title: "Zero-Knowledge Proofs", imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1280&q=80" },
        ],
      },

      // CHMS (100L - 600L)
      {
        id: "deck_chms_101",
        college: "CHMS",
        level: 100,
        department: "Economics",
        courseCode: "ECO 101",
        courseTitle: "Principles of Microeconomics",
        deckTitle: "Elasticity of Demand & Supply Equilibrium",
        totalPages: 3,
        fileSizeBytes: 2100000,
        uploadedBy: "Dr. B. K. Alabi",
        uploadedAt: "2026-10-18T08:30:00Z",
        downloadable: true,
        slides: [
          { id: "s14", pageNumber: 1, title: "Market Equilibrium Curves", imageUrl: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1280&q=80" },
          { id: "s15", pageNumber: 2, title: "Cross-Price Elasticity", imageUrl: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1280&q=80" },
          { id: "s16", pageNumber: 3, title: "Consumer Surplus & Deadweight Loss", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1280&q=80" },
        ],
      },
      {
        id: "deck_chms_301",
        college: "CHMS",
        level: 300,
        department: "Accounting",
        courseCode: "ACC 301",
        courseTitle: "Advanced Financial Accounting & Reporting",
        deckTitle: "IFRS Group Consolidation & Goodwill Impairment",
        totalPages: 3,
        fileSizeBytes: 3300000,
        uploadedBy: "Prof. E. T. Danladi",
        uploadedAt: "2026-10-24T12:00:00Z",
        downloadable: true,
        slides: [
          { id: "s17", pageNumber: 1, title: "IFRS 10 Consolidated Statements", imageUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1280&q=80" },
          { id: "s18", pageNumber: 2, title: "Non-Controlling Interest (NCI)", imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1280&q=80" },
          { id: "s19", pageNumber: 3, title: "Foreign Currency Translation", imageUrl: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1280&q=80" },
        ],
      },

      // CHAS (100L - 600L)
      {
        id: "deck_chas_201",
        college: "CHAS",
        level: 200,
        department: "Human Anatomy",
        courseCode: "ANA 201",
        courseTitle: "Gross Anatomy of the Upper Limb",
        deckTitle: "Brachial Plexus & Neurovascular Bundles",
        totalPages: 3,
        fileSizeBytes: 4100000,
        uploadedBy: "Dr. M. I. Adeleke",
        uploadedAt: "2026-10-19T10:00:00Z",
        downloadable: true,
        slides: [
          { id: "s20", pageNumber: 1, title: "Brachial Plexus: Roots to Cords", imageUrl: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=1280&q=80" },
          { id: "s21", pageNumber: 2, title: "Radial, Median & Ulnar Paths", imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1280&q=80" },
          { id: "s22", pageNumber: 3, title: "Axillary Artery Branches", imageUrl: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1280&q=80" },
        ],
      },
      {
        id: "deck_chas_501",
        college: "CHAS",
        level: 500,
        department: "Medicine & Surgery",
        courseCode: "MED 501",
        courseTitle: "Clinical Pharmacology & Therapeutics",
        deckTitle: "Cardiovascular Drug Mechanisms & Renin Pathway",
        totalPages: 3,
        fileSizeBytes: 4800000,
        uploadedBy: "Prof. O. G. Briggs",
        uploadedAt: "2026-10-26T09:30:00Z",
        downloadable: true,
        slides: [
          { id: "s23", pageNumber: 1, title: "ACE Inhibitors vs ARBs", imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1280&q=80" },
          { id: "s24", pageNumber: 2, title: "Beta-Blocker Receptor Selectivity", imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1280&q=80" },
          { id: "s25", pageNumber: 3, title: "Antiarrhythmic Class I-IV Dynamics", imageUrl: "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=1280&q=80" },
        ],
      },
      {
        id: "deck_chas_601",
        college: "CHAS",
        level: 600,
        department: "Medicine & Surgery",
        courseCode: "SUR 601",
        courseTitle: "Advanced Surgical Principles & Trauma Management",
        deckTitle: "ATLS Primary Survey & Hemorrhagic Shock Protocol",
        totalPages: 3,
        fileSizeBytes: 5200000,
        uploadedBy: "Chief Consultant Dr. Adeyemi",
        uploadedAt: "2026-10-28T07:45:00Z",
        downloadable: true,
        slides: [
          { id: "s26", pageNumber: 1, title: "Airway with C-Spine Control", imageUrl: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1280&q=80" },
          { id: "s27", pageNumber: 2, title: "Circulation & Damage Control Resuscitation", imageUrl: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1280&q=80" },
          { id: "s28", pageNumber: 3, title: "FAST Ultrasound & Triage Prioritization", imageUrl: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1280&q=80" },
        ],
      },
    ];

    return decks;
  }

  /**
   * Timetable Registry (Organized across levels 100 to 600)
   */
  public static getTimetable(
    college?: CampusCollege,
    level?: AcademicLevel,
    day?: string
  ): CampusTimetableSlot[] {
    try {
      const raw = localStorage.getItem(CAMPUS_TIMETABLE_KEY);
      const list: CampusTimetableSlot[] = raw ? JSON.parse(raw) : [];
      return list.filter((slot) => {
        if (college && slot.college !== college) return false;
        if (level && slot.level !== level) return false;
        if (day && slot.dayOfWeek.toLowerCase() !== day.toLowerCase()) return false;
        return true;
      });
    } catch {
      return [];
    }
  }

  public static addTimetableSlot(
    slot: Omit<CampusTimetableSlot, "id" | "isInSession">
  ): CampusTimetableSlot {
    const list = this.getTimetable();
    const newSlot: CampusTimetableSlot = {
      ...slot,
      id: `tt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      isInSession: false,
    };
    list.push(newSlot);
    localStorage.setItem(CAMPUS_TIMETABLE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("flick:campus-timetable-updated", { detail: list }));
    return newSlot;
  }

  /**
   * Live Bridge Signals across Flick
   */
  public static setLiveBridge(event: LiveBridgeEvent): void {
    try {
      const raw = localStorage.getItem(CAMPUS_LIVE_BRIDGES_KEY);
      const map: Record<string, LiveBridgeEvent> = raw ? JSON.parse(raw) : {};
      map[event.roomId] = event;
      localStorage.setItem(CAMPUS_LIVE_BRIDGES_KEY, JSON.stringify(map));
      window.dispatchEvent(new CustomEvent("flick:lecture-live-bridge", { detail: event }));
    } catch {}
  }

  public static removeLiveBridge(roomId: string): void {
    try {
      const raw = localStorage.getItem(CAMPUS_LIVE_BRIDGES_KEY);
      if (raw) {
        const map: Record<string, LiveBridgeEvent> = JSON.parse(raw);
        delete map[roomId];
        localStorage.setItem(CAMPUS_LIVE_BRIDGES_KEY, JSON.stringify(map));
        window.dispatchEvent(new CustomEvent("flick:lecture-live-bridge", { detail: null }));
      }
    } catch {}
  }

  public static getActiveLiveBridges(): LiveBridgeEvent[] {
    try {
      const raw = localStorage.getItem(CAMPUS_LIVE_BRIDGES_KEY);
      if (!raw) return [];
      const map: Record<string, LiveBridgeEvent> = JSON.parse(raw);
      return Object.values(map);
    } catch {
      return [];
    }
  }

  public static formatBytes(bytes: number): string {
    if (bytes === 0) return "0.00 MB";
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }
}
