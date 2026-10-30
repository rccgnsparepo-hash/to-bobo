import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type RiskTier = "low" | "medium" | "high" | "critical";

export interface IdentitySignals {
  ip: string;
  userAgent: string;
  acceptLanguage?: string;
  deviceFingerprintHash?: string;
  clientEntropy?: {
    screenResolution?: string;
    timezoneOffset?: number;
    platform?: string;
    webglVendor?: string;
    hardwareConcurrency?: number;
  };
  email: string;
  handle?: string;
  phone?: string;
}

export interface SecurityEvaluationResult {
  allowed: boolean;
  riskScore: number; // 0 - 100
  riskTier: RiskTier;
  actionRequired: "none" | "captcha" | "phone_and_captcha" | "block_or_hold";
  featureLimits: "standard" | "restricted" | "blocked";
  reasons: string[];
  signalsSummary: {
    ipVelocityCount: number;
    deviceAccountsCount: number;
    clusterSize: number;
    isDisposableEmail: boolean;
    isEmailAliased: boolean;
    phoneAssociatedCount: number;
    hasBannedAssociations: boolean;
    rapidCreationDetected: boolean;
  };
  challengeToken?: string;
  permitToken?: string;
  incidentId?: string;
}

export interface SecurityAuditRecord {
  id: string;
  timestamp: string;
  ip: string;
  email: string;
  canonicalEmail: string;
  handle?: string;
  deviceHash: string;
  riskScore: number;
  riskTier: RiskTier;
  reasons: string[];
  outcome: "permitted" | "challenged" | "restricted" | "blocked";
  userAgent: string;
}

export interface AccountSecurityProfile {
  id: string;
  email: string;
  canonicalEmail: string;
  handle: string;
  phone?: string;
  deviceHash: string;
  ip: string;
  clusterId: string;
  riskScore: number;
  riskTier: RiskTier;
  status: "active" | "restricted" | "review_hold" | "suspended";
  featureLimits: {
    maxDailyPosts: number;
    dmRateLimitPerMinute: number;
    canFollowUsers: boolean;
    verifiedBadgeAllowed: boolean;
    provisionalHoldHours: number;
  };
  createdAt: string;
  restrictionsExpireAt?: string;
}

// -------------------------------------------------------------
// In-Memory & File-Persisted Security Store
// -------------------------------------------------------------
const PERSISTENCE_FILE = path.resolve(process.cwd(), ".flick-security-registry.json");
const HMAC_SECRET = process.env.SECURITY_HMAC_SECRET || "flick_shield_sec_key_v2_99482";

interface StoredRegistry {
  ipHistory: Record<string, { timestamp: number; email: string; outcome: string }[]>;
  deviceHistory: Record<string, { accountId: string; email: string; timestamp: number }[]>;
  phoneRegistry: Record<string, { accountId: string; email: string; verifiedAt: string }[]>;
  emailRegistry: Record<string, { accountId: string; registeredAt: string; clusterId: string }>;
  accountProfiles: Record<string, AccountSecurityProfile>;
  clusters: Record<string, { accountIds: string[]; deviceHashes: string[]; ips: string[]; isBanned: boolean }>;
  bannedClusters: string[];
  bannedIdentifiers: string[]; // specific IPs, canonical emails, or phone numbers
  auditLog: SecurityAuditRecord[];
}

let registry: StoredRegistry = {
  ipHistory: {},
  deviceHistory: {},
  phoneRegistry: {},
  emailRegistry: {},
  accountProfiles: {},
  clusters: {},
  bannedClusters: [],
  bannedIdentifiers: [],
  auditLog: [],
};

// Load registry from file on startup
function loadRegistry() {
  try {
    if (fs.existsSync(PERSISTENCE_FILE)) {
      const data = fs.readFileSync(PERSISTENCE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      registry = { ...registry, ...parsed };
    }
  } catch (err) {
    console.warn("Could not load security registry from file, using fresh store:", err);
  }
}

// Save registry to file
function saveRegistry() {
  try {
    fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(registry, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to persist security registry:", err);
  }
}

loadRegistry();

// -------------------------------------------------------------
// Disposable / Burner Email Domains Blacklist
// -------------------------------------------------------------
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "tempmail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "mailinator.com",
  "yopmail.com",
  "yopmail.fr",
  "sharklasers.com",
  "trashmail.com",
  "trashmail.net",
  "dispostable.com",
  "getnada.com",
  "fakeinbox.com",
  "throwawaymail.com",
  "maildrop.cc",
  "inboxkitten.com",
  "burnermail.io",
  "nada.ltd",
  "mohmal.com",
  "crazymailing.com",
  "fakemailgenerator.com",
  "mytemp.email",
  "generator.email",
  "emailondeck.com",
  "discard.email",
  "tempr.email",
  "trash-mail.com",
  "getairmail.com",
  "dropmail.me",
  "mintemail.com",
  "mytempemail.com",
  "binkmail.com",
  "bobmail.info",
  "chacuo.net",
  "devnullmail.com",
  "fakemail.net",
  "filzmail.com",
  "harakirimail.com",
  "incognitomail.org",
  "kasmail.com",
  "mailcatch.com",
  "mailnesia.com",
  "mailnull.com",
  "meltmail.com",
  "noclickemail.com",
  "spambog.com",
  "spamevader.com",
  "spamex.com",
  "spamfree24.org",
  "spamgourmet.com",
  "trashymail.com",
]);

// -------------------------------------------------------------
// Utilities & Canonicalization
// -------------------------------------------------------------
export function canonicalizeEmail(email: string): { canonical: string; isAliased: boolean } {
  const clean = (email || "").trim().toLowerCase();
  const [localPart, domain] = clean.split("@");
  if (!localPart || !domain) return { canonical: clean, isAliased: false };

  let isAliased = false;
  let normalizedLocal = localPart;

  // Check plus-addressing (e.g. user+spam@gmail.com -> user@gmail.com)
  if (normalizedLocal.includes("+")) {
    normalizedLocal = normalizedLocal.split("+")[0];
    isAliased = true;
  }

  // Gmail and Googlemail ignore dots in the username
  if (domain === "gmail.com" || domain === "googlemail.com") {
    if (normalizedLocal.includes(".")) {
      normalizedLocal = normalizedLocal.replace(/\./g, "");
      isAliased = true;
    }
    return { canonical: `${normalizedLocal}@gmail.com`, isAliased };
  }

  return { canonical: `${normalizedLocal}@${domain}`, isAliased };
}

export function isDisposableDomain(domainOrEmail: string): boolean {
  const parts = domainOrEmail.toLowerCase().split("@");
  const domain = parts.length > 1 ? parts[1].trim() : parts[0].trim();
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  // Heuristic patterns for generic disposable domains
  if (/^(temp|dispos|burner|throwaway|trash|fake|guerrilla|minute|10min).*\.(com|org|net|xyz|top|pw|site|online)$/.test(domain)) {
    return true;
  }
  return false;
}

export function generateDeviceHash(signals: IdentitySignals): string {
  if (signals.deviceFingerprintHash && signals.deviceFingerprintHash.length > 8) {
    return signals.deviceFingerprintHash;
  }
  // Construct a deterministic, privacy-preserving device hash
  const entropy = signals.clientEntropy || {};
  const seed = [
    signals.userAgent || "unknown-ua",
    signals.acceptLanguage || "en",
    entropy.screenResolution || "1920x1080",
    entropy.timezoneOffset !== undefined ? String(entropy.timezoneOffset) : "0",
    entropy.platform || "browser",
    entropy.webglVendor || "generic",
    entropy.hardwareConcurrency || "4",
  ].join("|");

  return crypto.createHmac("sha256", HMAC_SECRET).update(seed).digest("hex").slice(0, 32);
}

// -------------------------------------------------------------
// Active Challenges & Permits In-Memory Stores
// -------------------------------------------------------------
interface ChallengeRecord {
  token: string;
  targetAnswer: string;
  type: "puzzle" | "math_proof";
  puzzleQuestion: string;
  puzzleOptions: string[];
  issuedAt: number;
  expiresAt: number;
  verified: boolean;
  email: string;
  deviceHash: string;
}

interface PhoneVerificationRecord {
  phone: string;
  code: string;
  issuedAt: number;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}

const activeChallenges = new Map<string, ChallengeRecord>();
const activePhoneCodes = new Map<string, PhoneVerificationRecord>();
const activePermits = new Map<
  string,
  {
    permitId: string;
    riskScore: number;
    riskTier: RiskTier;
    featureLimits: "standard" | "restricted" | "blocked";
    canonicalEmail: string;
    deviceHash: string;
    expiresAt: number;
    used: boolean;
  }
>();

// -------------------------------------------------------------
// IP & Network Safeguards (IPv4 & IPv6 Normalization)
// -------------------------------------------------------------
export function normalizeIp(rawIp: string): string {
  let ip = (rawIp || "127.0.0.1").trim().toLowerCase();
  // Strip IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.1 -> 192.168.1.1)
  if (ip.startsWith("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }
  // Group IPv6 addresses by /64 routing subnet to prevent evasion while avoiding ISP-wide bans
  if (ip.includes(":")) {
    const segments = ip.split(":");
    return segments.slice(0, 4).join(":") + "::/64";
  }
  return ip;
}

// Configurable Policy Engine (with documented 7-day retention)
export interface SecurityPolicyConfig {
  maxIpAttemptsPer30Min: number;
  maxIpSuccessfulPer24Hours: number;
  baseCooldownMinutes: number;
  progressiveCooldownMultiplier: number;
  retentionWindowMs: number;
}

export const SECURITY_POLICY: SecurityPolicyConfig = {
  maxIpAttemptsPer30Min: 3, // Testing baseline: max 3 attempts / 30m
  maxIpSuccessfulPer24Hours: 5, // Testing baseline: max 5 successes / 24h
  baseCooldownMinutes: 15,
  progressiveCooldownMultiplier: 2,
  retentionWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days retention policy
};

// Device Trust Records (Privacy-Conscious First-Party Continuity)
export interface DeviceTrustRecord {
  deviceHash: string;
  firstSeenAt: number;
  lastSeenAt: number;
  registeredAccounts: string[];
  failedVerificationAttempts: number;
  cooldownExpiresAt?: number;
  trustTier: "trusted" | "standard" | "suspicious" | "restricted";
}

const deviceTrustStore: Record<string, DeviceTrustRecord> = {};
const ipCooldownStore: Record<string, { blockedUntil: number; strikes: number }> = {};

export function reassessDeviceTrust(deviceHash: string, reason: string): DeviceTrustRecord {
  const record = deviceTrustStore[deviceHash] || {
    deviceHash,
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
    registeredAccounts: [],
    failedVerificationAttempts: 0,
    trustTier: "standard",
  };
  record.lastSeenAt = Date.now();
  if (reason === "account_suspended") {
    record.trustTier = "restricted";
    record.cooldownExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
  } else if (reason === "appeal_approved") {
    record.trustTier = "standard";
    record.cooldownExpiresAt = undefined;
  }
  deviceTrustStore[deviceHash] = record;
  return record;
}

// Prune expired records per retention policy
function pruneExpiredSecurityRecords() {
  const cutoff = Date.now() - SECURITY_POLICY.retentionWindowMs;
  for (const ip of Object.keys(registry.ipHistory)) {
    registry.ipHistory[ip] = registry.ipHistory[ip].filter((e) => e.timestamp > cutoff);
    if (registry.ipHistory[ip].length === 0) delete registry.ipHistory[ip];
  }
}

// -------------------------------------------------------------
// Core Multi-Layer Risk Evaluation Engine
// -------------------------------------------------------------
export function evaluateRegistrationAttempt(signals: IdentitySignals): SecurityEvaluationResult {
  pruneExpiredSecurityRecords();
  const now = Date.now();
  const rawClientIp = signals.ip || "127.0.0.1";
  const clientIp = normalizeIp(rawClientIp);
  const { canonical: canonicalEmail, isAliased } = canonicalizeEmail(signals.email);
  const emailDomain = signals.email.split("@")[1]?.toLowerCase() || "";
  const deviceHash = generateDeviceHash(signals);

  let riskScore = 5; // Baseline low risk
  const reasons: string[] = [];

  // --- Layer 1: Network Reputation & IP Velocity (Configurable Rate Limits) ---
  const ipAttempts = registry.ipHistory[clientIp] || [];
  const recent10m = ipAttempts.filter((a) => now - a.timestamp < 10 * 60 * 1000);
  const recent30m = ipAttempts.filter((a) => now - a.timestamp < 30 * 60 * 1000);
  const recent24h = ipAttempts.filter((a) => now - a.timestamp < 24 * 60 * 60 * 1000);
  const successful24h = recent24h.filter((a) => a.outcome === "success" || a.outcome === "registered");

  // Check existing IP cooldown
  const ipCooldown = ipCooldownStore[clientIp];
  if (ipCooldown && ipCooldown.blockedUntil > now) {
    const minsLeft = Math.ceil((ipCooldown.blockedUntil - now) / 60000);
    riskScore += 60;
    reasons.push(`IP in progressive cooldown (${minsLeft}m remaining) due to rapid repeated attempts`);
  }

  // 1. Max 3 attempts in 30 minutes
  if (recent30m.length >= SECURITY_POLICY.maxIpAttemptsPer30Min) {
    riskScore += 40;
    reasons.push(
      `IP rate limit: ${recent30m.length} registration attempts within 30 minutes (limit: ${SECURITY_POLICY.maxIpAttemptsPer30Min})`
    );
    // Apply progressive cooldown on repeated rate violations
    const strikes = (ipCooldown?.strikes || 0) + 1;
    const cooldownMins = SECURITY_POLICY.baseCooldownMinutes * Math.pow(SECURITY_POLICY.progressiveCooldownMultiplier, strikes - 1);
    ipCooldownStore[clientIp] = { blockedUntil: now + cooldownMins * 60000, strikes };
  }

  // 2. Max 5 successful registrations per 24 hours
  if (successful24h.length >= SECURITY_POLICY.maxIpSuccessfulPer24Hours) {
    riskScore += 45;
    reasons.push(
      `IP volume threshold: ${successful24h.length} accounts created in 24 hours (threshold: ${SECURITY_POLICY.maxIpSuccessfulPer24Hours}). Additional verification required.`
    );
  }

  // --- Layer 2: Privacy-Conscious Device Continuity ---
  const deviceRecord = deviceTrustStore[deviceHash] || {
    deviceHash,
    firstSeenAt: now,
    lastSeenAt: now,
    registeredAccounts: [],
    failedVerificationAttempts: 0,
    trustTier: "standard",
  };
  deviceRecord.lastSeenAt = now;
  deviceTrustStore[deviceHash] = deviceRecord;

  const deviceAccounts = registry.deviceHistory[deviceHash] || [];
  const recentDeviceCreations = deviceAccounts.filter((a) => now - a.timestamp < 24 * 60 * 60 * 1000);
  const deviceAccountCount = deviceAccounts.length;

  if (deviceRecord.cooldownExpiresAt && deviceRecord.cooldownExpiresAt > now) {
    riskScore += 70;
    reasons.push("Device temporarily restricted due to confirmed abuse pattern");
  }

  if (deviceAccountCount === 1) {
    riskScore += 10;
    reasons.push("Second account attempt on existing device");
  } else if (deviceAccountCount === 2) {
    riskScore += 30;
    reasons.push(`Third account attempt from this device (${deviceAccountCount} exist)`);
  } else if (deviceAccountCount >= 3) {
    const multiplier = Math.min(55, deviceAccountCount * 15);
    riskScore += multiplier;
    reasons.push(`Repeated account generation on device (${deviceAccountCount} accounts recorded)`);
  }

  // Rapid account creation on device (< 120 seconds)
  let rapidCreationDetected = false;
  if (recentDeviceCreations.length > 0) {
    const lastCreationTime = recentDeviceCreations[recentDeviceCreations.length - 1].timestamp;
    if (now - lastCreationTime < 120 * 1000) {
      rapidCreationDetected = true;
      riskScore += 40;
      reasons.push("Suspiciously rapid sequential registration (<2 mins since last account)");
    }
  }

  // --- Layer 3: Disposable / Suspicious Email Analysis ---
  const isDisposable = isDisposableDomain(emailDomain);
  if (isDisposable) {
    riskScore += 65;
    reasons.push(`Disposable/temporary email provider detected (${emailDomain})`);
  }

  if (isAliased) {
    riskScore += 20;
    reasons.push("Email plus-aliasing or dot-obfuscation pattern detected");
  }

  // Check if canonical email already has an active account
  const existingEmailRecord = registry.emailRegistry[canonicalEmail];
  if (existingEmailRecord) {
    riskScore += 45;
    reasons.push("Canonical mailbox address already associated with an existing Flick account");
  }

  // --- Layer 4: Phone Identifier Linkage & Reuse ---
  let phoneAssociatedCount = 0;
  if (signals.phone) {
    const cleanPhone = signals.phone.replace(/[^0-9+]/g, "");
    const registeredPhone = registry.phoneRegistry[cleanPhone];
    if (registeredPhone && registeredPhone.length > 0) {
      phoneAssociatedCount = registeredPhone.length;
      riskScore += 55;
      reasons.push(`Phone number is already linked to ${phoneAssociatedCount} active Flick account(s)`);
    }
  }

  // --- Layer 5: Identity Cluster & Suspension Evasion Detection ---
  // Look up if this IP, device, or canonical email belongs to a banned cluster
  let hasBannedAssociations = false;
  let clusterSize = 1;

  // Check banned identifiers list
  if (
    registry.bannedIdentifiers.includes(clientIp) ||
    registry.bannedIdentifiers.includes(canonicalEmail) ||
    (signals.phone && registry.bannedIdentifiers.includes(signals.phone))
  ) {
    hasBannedAssociations = true;
    riskScore += 90;
    reasons.push("Identifier is associated with a previously banned or suspended user record");
  }

  // Check cluster membership
  for (const [clusterId, cluster] of Object.entries(registry.clusters)) {
    const matchesDevice = cluster.deviceHashes.includes(deviceHash);
    const matchesIp = cluster.ips.includes(clientIp);
    if (matchesDevice || matchesIp) {
      clusterSize = Math.max(clusterSize, cluster.accountIds.length + 1);
      if (cluster.isBanned || registry.bannedClusters.includes(clusterId)) {
        hasBannedAssociations = true;
        riskScore = 100; // Immediate critical ceiling
        reasons.push("Identity cluster is flagged for abuse/suspension evasion");
        break;
      }
      if (cluster.accountIds.length >= 6) {
        riskScore += 40;
        reasons.push(`Large multi-account syndicate detected (${cluster.accountIds.length} accounts in cluster)`);
      }
    }
  }

  // --- Layer 6: Cap & Categorize Risk Tier ---
  riskScore = Math.min(100, Math.max(0, riskScore));

  let riskTier: RiskTier = "low";
  let actionRequired: "none" | "captcha" | "phone_and_captcha" | "block_or_hold" = "none";
  let featureLimits: "standard" | "restricted" | "blocked" = "standard";

  if (riskScore >= 85 || hasBannedAssociations || deviceAccountCount >= 5) {
    riskTier = "critical";
    actionRequired = "block_or_hold";
    featureLimits = "blocked";
  } else if (riskScore >= 60 || deviceAccountCount >= 3 || isDisposable || rapidCreationDetected) {
    riskTier = "high";
    actionRequired = "phone_and_captcha";
    featureLimits = "restricted";
  } else if (riskScore >= 35 || isAliased || deviceAccountCount >= 2 || recent10m.length >= 1) {
    riskTier = "medium";
    actionRequired = "captcha";
    featureLimits = "standard";
  } else {
    riskTier = "low";
    actionRequired = "none";
    featureLimits = "standard";
  }

  // Generate incident reference
  const incidentId = `FLK-SEC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  // If low risk, immediately mint a registration permit token
  let permitToken: string | undefined;
  if (riskTier === "low") {
    permitToken = createRegistrationPermit({
      riskScore,
      riskTier,
      featureLimits,
      canonicalEmail,
      deviceHash,
    });
  }

  // Generate interactive challenge if medium or high
  let challengeToken: string | undefined;
  if (actionRequired === "captcha" || actionRequired === "phone_and_captcha") {
    const ch = createSecurityChallenge(canonicalEmail, deviceHash);
    challengeToken = ch.token;
  }

  // Record into audit trail
  const auditRecord: SecurityAuditRecord = {
    id: incidentId,
    timestamp: new Date().toISOString(),
    ip: clientIp,
    email: signals.email,
    canonicalEmail,
    handle: signals.handle,
    deviceHash,
    riskScore,
    riskTier,
    reasons,
    outcome: riskTier === "critical" ? "blocked" : riskTier === "high" ? "restricted" : "permitted",
    userAgent: signals.userAgent || "Unknown",
  };

  registry.auditLog.unshift(auditRecord);
  if (registry.auditLog.length > 500) registry.auditLog.pop();

  // Save to persistent file
  saveRegistry();

  return {
    allowed: riskTier !== "critical",
    riskScore,
    riskTier,
    actionRequired,
    featureLimits,
    reasons,
    signalsSummary: {
      ipVelocityCount: recent24h.length,
      deviceAccountsCount: deviceAccountCount,
      clusterSize,
      isDisposableEmail: isDisposable,
      isEmailAliased: isAliased,
      phoneAssociatedCount,
      hasBannedAssociations,
      rapidCreationDetected,
    },
    challengeToken,
    permitToken,
    incidentId,
  };
}

// -------------------------------------------------------------
// Cryptographic Challenge & CAPTCHA Mechanics
// -------------------------------------------------------------
export function createSecurityChallenge(email: string, deviceHash: string) {
  const token = `ch_${crypto.randomBytes(16).toString("hex")}`;
  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000; // 5 minutes expiry

  // Interactive visual puzzle questions
  const puzzles = [
    {
      q: "Select the pattern that continues the secure sequence: [Shield, Lock, Key, Shield, Lock, ?]",
      options: ["Key", "Bell", "Phone", "Camera"],
      answer: "Key",
    },
    {
      q: "Verification proof: What is the primary purpose of Flick's multi-layered abuse prevention?",
      options: [
        "Prevent duplicate accounts & spam syndicates",
        "Delete all user profiles",
        "Block everyone on mobile",
        "Disable photo sharing",
      ],
      answer: "Prevent duplicate accounts & spam syndicates",
    },
    {
      q: "Flick Security Protocol: Identify the legitimate account credential symbol",
      options: ["Verified Emerald Tick", "Red Cross", "Broken Lock", "Skull Icon"],
      answer: "Verified Emerald Tick",
    },
    {
      q: "Algorithmic human proof: Select the sum of 14 + 19",
      options: ["33", "27", "35", "41"],
      answer: "33",
    },
  ];

  const selected = puzzles[Math.floor(Math.random() * puzzles.length)];

  const record: ChallengeRecord = {
    token,
    type: "puzzle",
    puzzleQuestion: selected.q,
    puzzleOptions: selected.options,
    targetAnswer: selected.answer,
    issuedAt: now,
    expiresAt,
    verified: false,
    email,
    deviceHash,
  };

  activeChallenges.set(token, record);
  return record;
}

export function verifySecurityChallenge(
  token: string,
  userAnswer: string
): { success: boolean; error?: string; challengeReceipt?: string } {
  const challenge = activeChallenges.get(token);
  if (!challenge) {
    return { success: false, error: "Challenge has expired or is invalid. Please request a new one." };
  }

  if (Date.now() > challenge.expiresAt) {
    activeChallenges.delete(token);
    return { success: false, error: "Challenge expired. Please refresh and try again." };
  }

  if (userAnswer.trim().toLowerCase() !== challenge.targetAnswer.trim().toLowerCase()) {
    return { success: false, error: "Incorrect solution. Please try again." };
  }

  challenge.verified = true;
  const receipt = `rcpt_${crypto.randomBytes(16).toString("hex")}`;
  return { success: true, challengeReceipt: receipt };
}

// -------------------------------------------------------------
// Phone Verification Mechanics
// -------------------------------------------------------------
export function issuePhoneCode(
  phone: string,
  email: string
): { success: boolean; error?: string; message?: string; testCode?: string } {
  const cleanPhone = phone.trim().replace(/[^0-9+]/g, "");
  if (cleanPhone.length < 8) {
    return { success: false, error: "Invalid phone number format. Please provide full international format." };
  }

  // Check if phone number is already registered
  const existing = registry.phoneRegistry[cleanPhone] || [];
  if (existing.length >= 2) {
    return {
      success: false,
      error: "This phone number has reached the maximum permitted accounts. Please use a unique number.",
    };
  }

  // Check if banned
  if (registry.bannedIdentifiers.includes(cleanPhone)) {
    return { success: false, error: "This phone number is restricted due to previous platform violations." };
  }

  // Generate 6-digit cryptographic verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes

  activePhoneCodes.set(cleanPhone, {
    phone: cleanPhone,
    code,
    issuedAt: now,
    expiresAt,
    attempts: 0,
    verified: false,
  });

  return {
    success: true,
    message: `Verification code dispatched to ${cleanPhone}.`,
    testCode: code, // Provided for instant demo and automated testing
  };
}

export function verifyPhoneCode(
  phone: string,
  code: string
): { success: boolean; error?: string; phoneReceipt?: string } {
  const cleanPhone = phone.trim().replace(/[^0-9+]/g, "");
  const record = activePhoneCodes.get(cleanPhone);

  if (!record) {
    return { success: false, error: "No pending verification code found for this phone number." };
  }

  if (Date.now() > record.expiresAt) {
    activePhoneCodes.delete(cleanPhone);
    return { success: false, error: "Verification code expired. Please request a new code." };
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    activePhoneCodes.delete(cleanPhone);
    return { success: false, error: "Too many failed attempts. Code invalidated." };
  }

  if (record.code !== code.trim()) {
    return { success: false, error: `Invalid code. ${5 - record.attempts} attempts remaining.` };
  }

  record.verified = true;
  const receipt = `ph_rcpt_${crypto.randomBytes(16).toString("hex")}`;
  return { success: true, phoneReceipt: receipt };
}

// -------------------------------------------------------------
// Authoritative Registration Permit Generation & Finalization
// -------------------------------------------------------------
export function createRegistrationPermit(params: {
  riskScore: number;
  riskTier: RiskTier;
  featureLimits: "standard" | "restricted" | "blocked";
  canonicalEmail: string;
  deviceHash: string;
}): string {
  const permitId = `pmt_${crypto.randomBytes(24).toString("hex")}`;
  const now = Date.now();
  const expiresAt = now + 15 * 60 * 1000; // 15 mins

  activePermits.set(permitId, {
    permitId,
    riskScore: params.riskScore,
    riskTier: params.riskTier,
    featureLimits: params.featureLimits,
    canonicalEmail: params.canonicalEmail,
    deviceHash: params.deviceHash,
    expiresAt,
    used: false,
  });

  // Generate tamper-proof HMAC payload
  const payload = `${permitId}:${params.canonicalEmail}:${params.riskTier}:${params.featureLimits}:${expiresAt}`;
  const sig = crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");

  return `${permitId}.${sig}`;
}

export function finalizeAccountRegistration(params: {
  permitToken: string;
  accountId: string;
  email: string;
  handle: string;
  phone?: string;
  ip: string;
  userAgent: string;
}): { success: boolean; profile?: AccountSecurityProfile; error?: string } {
  const [permitId, sig] = (params.permitToken || "").split(".");
  if (!permitId || !sig) {
    return { success: false, error: "Invalid registration permit format." };
  }

  const permit = activePermits.get(permitId);
  if (!permit) {
    return { success: false, error: "Registration permit has expired or is unrecognized." };
  }

  if (permit.used) {
    return { success: false, error: "Registration permit has already been consumed." };
  }

  if (Date.now() > permit.expiresAt) {
    activePermits.delete(permitId);
    return { success: false, error: "Registration permit has expired." };
  }

  // Verify HMAC signature
  const payload = `${permitId}:${permit.canonicalEmail}:${permit.riskTier}:${permit.featureLimits}:${permit.expiresAt}`;
  const expectedSig = crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");
  if (sig !== expectedSig) {
    return { success: false, error: "Cryptographic signature mismatch on security permit." };
  }

  permit.used = true;

  const now = new Date();
  const nowIso = now.toISOString();
  const { canonical: canonicalEmail } = canonicalizeEmail(params.email);

  // Derive or join an Identity Cluster
  let clusterId = `cluster_${crypto.randomBytes(6).toString("hex")}`;
  for (const [cId, cluster] of Object.entries(registry.clusters)) {
    if (cluster.deviceHashes.includes(permit.deviceHash) || cluster.ips.includes(params.ip)) {
      clusterId = cId;
      if (!cluster.accountIds.includes(params.accountId)) cluster.accountIds.push(params.accountId);
      if (!cluster.deviceHashes.includes(permit.deviceHash)) cluster.deviceHashes.push(permit.deviceHash);
      if (!cluster.ips.includes(params.ip)) cluster.ips.push(params.ip);
      break;
    }
  }

  if (!registry.clusters[clusterId]) {
    registry.clusters[clusterId] = {
      accountIds: [params.accountId],
      deviceHashes: [permit.deviceHash],
      ips: [params.ip],
      isBanned: false,
    };
  }

  // Calculate provisional restriction expiry (e.g. 48h restriction if high risk)
  let restrictionsExpireAt: string | undefined;
  if (permit.riskTier === "high" || permit.featureLimits === "restricted") {
    const expiryDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    restrictionsExpireAt = expiryDate.toISOString();
  }

  const profile: AccountSecurityProfile = {
    id: params.accountId,
    email: params.email,
    canonicalEmail,
    handle: params.handle,
    phone: params.phone,
    deviceHash: permit.deviceHash,
    ip: params.ip,
    clusterId,
    riskScore: permit.riskScore,
    riskTier: permit.riskTier,
    status: permit.riskTier === "high" ? "restricted" : "active",
    featureLimits: {
      maxDailyPosts: permit.riskTier === "high" ? 5 : 50,
      dmRateLimitPerMinute: permit.riskTier === "high" ? 3 : 20,
      canFollowUsers: true,
      verifiedBadgeAllowed: permit.riskTier !== "high",
      provisionalHoldHours: permit.riskTier === "high" ? 48 : 0,
    },
    createdAt: nowIso,
    restrictionsExpireAt,
  };

  // Record into registry indexes
  registry.accountProfiles[params.accountId] = profile;
  registry.accountProfiles[canonicalEmail] = profile;

  // Track in IP history
  if (!registry.ipHistory[params.ip]) registry.ipHistory[params.ip] = [];
  registry.ipHistory[params.ip].push({
    timestamp: Date.now(),
    email: params.email,
    outcome: permit.riskTier,
  });

  // Track in Device history
  if (!registry.deviceHistory[permit.deviceHash]) registry.deviceHistory[permit.deviceHash] = [];
  registry.deviceHistory[permit.deviceHash].push({
    accountId: params.accountId,
    email: params.email,
    timestamp: Date.now(),
  });

  // Track in Phone history
  if (params.phone) {
    const cleanPhone = params.phone.replace(/[^0-9+]/g, "");
    if (!registry.phoneRegistry[cleanPhone]) registry.phoneRegistry[cleanPhone] = [];
    registry.phoneRegistry[cleanPhone].push({
      accountId: params.accountId,
      email: params.email,
      verifiedAt: nowIso,
    });
  }

  // Track in Canonical Email registry
  registry.emailRegistry[canonicalEmail] = {
    accountId: params.accountId,
    registeredAt: nowIso,
    clusterId,
  };

  saveRegistry();

  return { success: true, profile };
}

// -------------------------------------------------------------
// Real-Time Account Security Standing & Audit Queries
// -------------------------------------------------------------
export function getAccountSecurityStatus(identifier: string): AccountSecurityProfile | null {
  if (!identifier) return null;
  const clean = identifier.trim();
  const { canonical } = canonicalizeEmail(clean);

  return (
    registry.accountProfiles[clean] ||
    registry.accountProfiles[canonical] ||
    Object.values(registry.accountProfiles).find(
      (p) => p.id === clean || p.handle.toLowerCase() === clean.toLowerCase()
    ) ||
    null
  );
}

export function getSecurityAuditLog(): SecurityAuditRecord[] {
  return registry.auditLog;
}

export function getSecurityRegistrySummary() {
  return {
    totalEvaluations: registry.auditLog.length,
    activeClustersCount: Object.keys(registry.clusters).length,
    bannedClustersCount: registry.bannedClusters.length,
    deviceTrackedCount: Object.keys(registry.deviceHistory).length,
    registeredPhoneCount: Object.keys(registry.phoneRegistry).length,
  };
}

export function banAccountCluster(identifier: string, reason: string): { success: boolean; affectedAccounts: string[] } {
  const profile = getAccountSecurityStatus(identifier);
  if (!profile) {
    // If not found as profile, ban identifier directly
    registry.bannedIdentifiers.push(identifier);
    saveRegistry();
    return { success: true, affectedAccounts: [identifier] };
  }

  const cluster = registry.clusters[profile.clusterId];
  if (cluster) {
    cluster.isBanned = true;
    if (!registry.bannedClusters.includes(profile.clusterId)) {
      registry.bannedClusters.push(profile.clusterId);
    }
    // Mark all accounts in cluster as suspended
    for (const accId of cluster.accountIds) {
      if (registry.accountProfiles[accId]) {
        registry.accountProfiles[accId].status = "suspended";
      }
    }
    // Add identifiers to banned list
    registry.bannedIdentifiers.push(profile.canonicalEmail);
    if (profile.phone) registry.bannedIdentifiers.push(profile.phone);
    registry.bannedIdentifiers.push(profile.ip);

    saveRegistry();
    return { success: true, affectedAccounts: cluster.accountIds };
  }

  profile.status = "suspended";
  registry.bannedIdentifiers.push(profile.canonicalEmail);
  saveRegistry();
  return { success: true, affectedAccounts: [profile.id] };
}
