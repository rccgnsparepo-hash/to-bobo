/**
 * Campus Service: Multi-Tenant Campus Lecture Engine
 * Handles student/lecturer authentication gate with verification passcode (A1B2C3D4E5),
 * 6 campus levels (100L - 600L), 30GB allocated lecture storage tracking,
 * and live timetable + slide reading/downloading workflows.
 */

import type {
  CampusLevel,
  CampusProfile,
  CampusCourse,
  CampusTimetableSlot,
  CampusSlideDeck,
  CampusTenantQuota,
} from "./types";
import { SpaceService } from "@/lib/space/spaceService";

// Strictly required faculty verification passcode
export const TEACHER_SECRET_KEY = "A1B2C3D4E5";

// Local storage keys for campus platform
const CAMPUS_PROFILE_KEY = "flick:campus_current_profile_v1";
const CAMPUS_PROFILES_STORE_KEY = "flick:campus_all_profiles_v1";
const CAMPUS_TIMETABLE_KEY = "flick:campus_timetable_v1";
const CAMPUS_SLIDES_KEY = "flick:campus_slides_v1";
const CAMPUS_COURSES_KEY = "flick:campus_courses_v1";

// Default standard courses across all 6 levels for quick reference
export const DEFAULT_CAMPUS_DEPARTMENTS = [
  "Computer Science & Software Eng",
  "Electrical & Electronics Engineering",
  "Mechanical & Mechatronics Eng",
  "Medicine & Surgery",
  "Pharmacy & Pharmacology",
  "Nursing Sciences",
  "Law & Jurisprudence",
  "Accounting & Finance",
  "Economics & Public Policy",
  "Biochemistry & Molecular Bio",
  "Architecture & Building Design",
  "Mass Communication & Media",
];

export class CampusService {
  /**
   * Validates if the supplied lecturer verification passcode matches A1B2C3D4E5
   */
  public static verifyTeacherPasscode(passcode: string): boolean {
    if (!passcode) return false;
    return passcode.trim().toUpperCase() === TEACHER_SECRET_KEY;
  }

  /**
   * Retrieves active campus profile for the logged in student or lecturer
   */
  public static getCurrentProfile(): CampusProfile | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(CAMPUS_PROFILE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Saves or updates active campus profile
   */
  public static saveCurrentProfile(profile: CampusProfile): void {
    try {
      localStorage.setItem(CAMPUS_PROFILE_KEY, JSON.stringify(profile));
      // Also save into directory of all profiles for tenant metrics
      const directory = this.getAllProfiles();
      const existingIdx = directory.findIndex((p) => p.userId === profile.userId);
      if (existingIdx >= 0) {
        directory[existingIdx] = profile;
      } else {
        directory.push(profile);
      }
      localStorage.setItem(CAMPUS_PROFILES_STORE_KEY, JSON.stringify(directory));
      window.dispatchEvent(new CustomEvent("flick:campus-profile-updated", { detail: profile }));
    } catch (err) {
      console.warn("Error saving campus profile:", err);
    }
  }

  /**
   * Clears campus session on logout from lecture app
   */
  public static logoutCampus(): void {
    try {
      localStorage.removeItem(CAMPUS_PROFILE_KEY);
      window.dispatchEvent(new CustomEvent("flick:campus-profile-updated", { detail: null }));
    } catch {}
  }

  /**
   * Returns all registered campus tenant profiles
   */
  public static getAllProfiles(): CampusProfile[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(CAMPUS_PROFILES_STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ==================== TIMETABLE ENGINE (100L to 600L) ====================
  /**
   * Returns timetable entries filtered by level and optional department
   */
  public static getTimetable(filterLevel?: CampusLevel, filterDept?: string): CampusTimetableSlot[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(CAMPUS_TIMETABLE_KEY);
      const list: CampusTimetableSlot[] = raw ? JSON.parse(raw) : [];

      return list.filter((slot) => {
        if (filterLevel && slot.level !== filterLevel) return false;
        if (filterDept && slot.department && slot.department !== filterDept) return false;
        return true;
      });
    } catch {
      return [];
    }
  }

  /**
   * Adds or updates a timetable slot
   */
  public static saveTimetableSlot(
    slot: Omit<CampusTimetableSlot, "id"> & { id?: string }
  ): CampusTimetableSlot {
    const raw = localStorage.getItem(CAMPUS_TIMETABLE_KEY);
    const list: CampusTimetableSlot[] = raw ? JSON.parse(raw) : [];

    const newSlot: CampusTimetableSlot = {
      ...slot,
      id: slot.id || `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };

    const existingIdx = list.findIndex((s) => s.id === newSlot.id);
    if (existingIdx >= 0) {
      list[existingIdx] = newSlot;
    } else {
      list.push(newSlot);
    }

    try {
      localStorage.setItem(CAMPUS_TIMETABLE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent("flick:campus-timetable-updated"));
    } catch {}

    return newSlot;
  }

  /**
   * Removes a timetable entry
   */
  public static deleteTimetableSlot(slotId: string): void {
    const raw = localStorage.getItem(CAMPUS_TIMETABLE_KEY);
    if (!raw) return;
    try {
      const list: CampusTimetableSlot[] = JSON.parse(raw);
      const filtered = list.filter((s) => s.id !== slotId);
      localStorage.setItem(CAMPUS_TIMETABLE_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent("flick:campus-timetable-updated"));
    } catch {}
  }

  /**
   * Seeds an official campus timetable framework across all 6 levels (100L - 600L)
   * if the campus database is currently clean and empty.
   */
  public static seedCampusScheduleTemplate(lecturerProfile?: CampusProfile): void {
    const existing = this.getTimetable();
    if (existing.length > 0) return; // Do not overwrite if entries exist

    const lecturerName = lecturerProfile?.fullName || "Prof. Department Chair";
    const lecturerId = lecturerProfile?.userId || "faculty_chair";

    const standardCurriculum: Omit<CampusTimetableSlot, "id">[] = [
      // 100 Level
      {
        courseCode: "CSC 101",
        courseTitle: "Introduction to Computer Science & Algorithms",
        level: 100,
        department: "Computer Science & Software Eng",
        day: "Monday",
        startTime: "09:00",
        endTime: "11:00",
        venue: "Lecture Theatre Alpha (LTA)",
        lecturerName,
        lecturerId,
      },
      {
        courseCode: "MTH 101",
        courseTitle: "Elementary Mathematics I (Calculus & Algebra)",
        level: 100,
        department: "Computer Science & Software Eng",
        day: "Wednesday",
        startTime: "10:00",
        endTime: "12:00",
        venue: "Faculty Hall 1",
        lecturerName: "Dr. Math Faculty",
        lecturerId: "faculty_mth",
      },
      // 200 Level
      {
        courseCode: "CSC 201",
        courseTitle: "Data Structures & Algorithm Analysis",
        level: 200,
        department: "Computer Science & Software Eng",
        day: "Tuesday",
        startTime: "11:00",
        endTime: "13:00",
        venue: "CS Computer Lab 2",
        lecturerName,
        lecturerId,
      },
      {
        courseCode: "EEE 203",
        courseTitle: "Circuit Theory & Digital Logic",
        level: 200,
        department: "Electrical & Electronics Engineering",
        day: "Thursday",
        startTime: "14:00",
        endTime: "16:00",
        venue: "Engineering Workshop B",
        lecturerName: "Engr. Electronics Lead",
        lecturerId: "faculty_eee",
      },
      // 300 Level
      {
        courseCode: "CSC 301",
        courseTitle: "Operating Systems Principles & Concurrency",
        level: 300,
        department: "Computer Science & Software Eng",
        day: "Monday",
        startTime: "12:00",
        endTime: "14:00",
        venue: "Virtual Lecture Zone & Hall 3",
        lecturerName,
        lecturerId,
      },
      {
        courseCode: "CSC 315",
        courseTitle: "Database Design, Normalization & Storage",
        level: 300,
        department: "Computer Science & Software Eng",
        day: "Thursday",
        startTime: "09:00",
        endTime: "11:00",
        venue: "Cloud Computing Suite",
        lecturerName,
        lecturerId,
      },
      // 400 Level
      {
        courseCode: "CSC 401",
        courseTitle: "Distributed Systems & Cloud Infrastructure",
        level: 400,
        department: "Computer Science & Software Eng",
        day: "Wednesday",
        startTime: "14:00",
        endTime: "16:00",
        venue: "Advanced Research Lab 1",
        lecturerName,
        lecturerId,
      },
      // 500 Level (Engineering & Professional 5-year tracks)
      {
        courseCode: "ENG 501",
        courseTitle: "Engineering Management & Professional Ethics",
        level: 500,
        department: "Mechanical & Mechatronics Eng",
        day: "Tuesday",
        startTime: "10:00",
        endTime: "12:00",
        venue: "Faculty Board Room & Virtual Stream",
        lecturerName: "Prof. Dean of Faculty",
        lecturerId: "faculty_dean",
      },
      // 600 Level (Medical / Clinical / Extended Professional tracks)
      {
        courseCode: "MED 601",
        courseTitle: "Advanced Clinical Diagnostics & Therapeutics",
        level: 600,
        department: "Medicine & Surgery",
        day: "Friday",
        startTime: "08:30",
        endTime: "11:30",
        venue: "College of Medicine Auditorium",
        lecturerName: "Prof. Chief Medical Consultant",
        lecturerId: "faculty_med",
      },
    ];

    standardCurriculum.forEach((item) => this.saveTimetableSlot(item));
  }

  // ==================== SLIDE STORE & REAL-TIME READING ====================
  /**
   * Retrieves all slide decks, optionally filtered by level and department
   */
  public static getSlideDecks(filterLevel?: CampusLevel, filterDept?: string): CampusSlideDeck[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(CAMPUS_SLIDES_KEY);
      const list: CampusSlideDeck[] = raw ? JSON.parse(raw) : [];

      return list.filter((deck) => {
        if (filterLevel && deck.level !== filterLevel) return false;
        if (filterDept && deck.department && deck.department !== filterDept) return false;
        return true;
      });
    } catch {
      return [];
    }
  }

  /**
   * Uploads and stores a verified course slide deck into the 30GB multi-tenant storage pool
   */
  public static uploadSlideDeck(
    deck: Omit<CampusSlideDeck, "id" | "createdAt" | "downloadCount">
  ): CampusSlideDeck {
    const raw = localStorage.getItem(CAMPUS_SLIDES_KEY);
    const list: CampusSlideDeck[] = raw ? JSON.parse(raw) : [];

    const newDeck: CampusSlideDeck = {
      ...deck,
      id: `deck_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      downloadCount: 0,
    };

    list.unshift(newDeck);

    try {
      localStorage.setItem(CAMPUS_SLIDES_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent("flick:campus-slides-updated"));
    } catch (e) {
      console.warn("Storage quota limit encountered:", e);
    }

    return newDeck;
  }

  /**
   * Increments download counter when a student downloads a course slide deck
   */
  public static incrementDownloadCount(deckId: string): void {
    const raw = localStorage.getItem(CAMPUS_SLIDES_KEY);
    if (!raw) return;
    try {
      const list: CampusSlideDeck[] = JSON.parse(raw);
      const target = list.find((d) => d.id === deckId);
      if (target) {
        target.downloadCount += 1;
        localStorage.setItem(CAMPUS_SLIDES_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("flick:campus-slides-updated"));
      }
    } catch {}
  }

  /**
   * Deletes a slide deck
   */
  public static deleteSlideDeck(deckId: string): void {
    const raw = localStorage.getItem(CAMPUS_SLIDES_KEY);
    if (!raw) return;
    try {
      const list: CampusSlideDeck[] = JSON.parse(raw);
      const filtered = list.filter((d) => d.id !== deckId);
      localStorage.setItem(CAMPUS_SLIDES_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent("flick:campus-slides-updated"));
    } catch {}
  }

  // ==================== 30GB MULTI-TENANT QUOTA METRICS ====================
  /**
   * Calculates storage metrics for the 30GB allocated Flick Lecture tenant
   */
  public static getTenantQuota(): CampusTenantQuota {
    const allocatedGb = 30.0;
    const slides = this.getSlideDecks();
    const timetables = this.getTimetable();
    const profiles = this.getAllProfiles();

    // Calculate simulated storage footprint based on uploaded slide decks & documents
    const slidesSizeMb = slides.reduce((acc, curr) => acc + (curr.fileSizeMb || 4.2), 0);
    // Base platform runtime cache + system indices
    const baseSystemMb = 120.0;
    const totalMb = baseSystemMb + slidesSizeMb;
    const usedGb = Math.round((totalMb / 1024) * 100) / 100;

    const students = profiles.filter((p) => p.role === "student").length;
    const lecturers = profiles.filter((p) => p.role === "lecturer").length;

    return {
      tenantName: "Flick Campus Lecture Tenant (Dedicated 30GB Zone)",
      allocatedGb,
      usedGb,
      slidesCount: slides.length,
      coursesCount: timetables.length,
      activeRoomsCount: 0,
      studentCount: students,
      lecturerCount: lecturers,
    };
  }

  // ==================== GO LIVE BRIDGE ====================
  /**
   * Bridges a Flick Class room to Flick Space Go Live feed so campus flickers can watch in real time
   */
  public static bridgeClassroomToFlickLive(params: {
    roomId: string;
    courseCode: string;
    title: string;
    lecturerId: string;
    lecturerName: string;
    lecturerAvatar?: string | null;
  }) {
    return SpaceService.createLiveSession({
      hostId: params.lecturerId,
      hostName: params.lecturerName,
      hostHandle: params.lecturerName.toLowerCase().replace(/\s+/g, "_"),
      hostAvatar: params.lecturerAvatar || undefined,
      title: `[LECTURE ${params.courseCode}] ${params.title}`,
      category: "Tech & Campus",
      isLectureClassBridge: true,
      classRoomId: params.roomId,
    } as any);
  }
}
