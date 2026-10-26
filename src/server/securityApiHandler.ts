import type { IncomingMessage, ServerResponse } from "node:http";
import {
  evaluateRegistrationAttempt,
  createSecurityChallenge,
  verifySecurityChallenge,
  issuePhoneCode,
  verifyPhoneCode,
  createRegistrationPermit,
  finalizeAccountRegistration,
  getAccountSecurityStatus,
  getSecurityAuditLog,
  getSecurityRegistrySummary,
  banAccountCluster,
  canonicalizeEmail,
  type IdentitySignals,
} from "./registrationSecurity";

function parseJsonBody<T = any>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        // 1MB max body size guard
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: any) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(data));
}

export async function handleSecurityMiddleware(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (!pathname.startsWith("/api/security")) {
    return false;
  }

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.end();
    return true;
  }

  // Extract client IP reliably from server headers
  const forwarded = req.headers["x-forwarded-for"];
  const clientIp = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket.remoteAddress || "127.0.0.1";
  const userAgent = (req.headers["user-agent"] as string) || "Unknown User Agent";
  const acceptLanguage = (req.headers["accept-language"] as string) || "en";

  try {
    // 1. Evaluate Registration Attempt (Pre-check)
    if (pathname === "/api/security/pre-register-check" && req.method === "POST") {
      const body = await parseJsonBody(req);
      const signals: IdentitySignals = {
        ip: clientIp,
        userAgent,
        acceptLanguage,
        deviceFingerprintHash: body.deviceFingerprintHash,
        clientEntropy: body.clientEntropy || {},
        email: body.email || "",
        handle: body.handle || "",
        phone: body.phone || undefined,
      };

      const result = evaluateRegistrationAttempt(signals);
      sendJson(res, 200, result);
      return true;
    }

    // 2. Fetch fresh CAPTCHA challenge
    if (pathname === "/api/security/captcha/challenge" && req.method === "GET") {
      const email = url.searchParams.get("email") || "";
      const deviceHash = url.searchParams.get("deviceHash") || "browser-client";
      const challenge = createSecurityChallenge(email, deviceHash);
      sendJson(res, 200, {
        token: challenge.token,
        question: challenge.puzzleQuestion,
        options: challenge.puzzleOptions,
        expiresAt: challenge.expiresAt,
      });
      return true;
    }

    // 3. Verify CAPTCHA challenge solution
    if (pathname === "/api/security/captcha/verify" && req.method === "POST") {
      const body = await parseJsonBody(req);
      const { token, answer } = body;
      const verification = verifySecurityChallenge(token, answer);
      if (!verification.success) {
        sendJson(res, 400, verification);
      } else {
        sendJson(res, 200, verification);
      }
      return true;
    }

    // 4. Send phone verification SMS code
    if (pathname === "/api/security/phone/send-code" && req.method === "POST") {
      const body = await parseJsonBody(req);
      const result = issuePhoneCode(body.phone, body.email);
      if (!result.success) {
        sendJson(res, 400, result);
      } else {
        sendJson(res, 200, result);
      }
      return true;
    }

    // 5. Verify phone SMS code
    if (pathname === "/api/security/phone/verify-code" && req.method === "POST") {
      const body = await parseJsonBody(req);
      const result = verifyPhoneCode(body.phone, body.code);
      if (!result.success) {
        sendJson(res, 400, result);
      } else {
        sendJson(res, 200, result);
      }
      return true;
    }

    // 6. Issue Registration Permit Token once required challenges are satisfied
    if (pathname === "/api/security/issue-permit" && req.method === "POST") {
      const body = await parseJsonBody(req);
      const { email, deviceHash, riskTier, riskScore, featureLimits } = body;

      const { canonical } = canonicalizeEmail(email);
      const permitToken = createRegistrationPermit({
        riskScore: Number(riskScore) || 45,
        riskTier: riskTier || "medium",
        featureLimits: featureLimits || "standard",
        canonicalEmail: canonical,
        deviceHash: deviceHash || "device-hash",
      });

      sendJson(res, 200, { success: true, permitToken });
      return true;
    }

    // 7. Finalize Account Registration
    if (pathname === "/api/security/finalize-registration" && req.method === "POST") {
      const body = await parseJsonBody(req);
      const result = finalizeAccountRegistration({
        permitToken: body.permitToken,
        accountId: body.accountId,
        email: body.email,
        handle: body.handle,
        phone: body.phone,
        ip: clientIp,
        userAgent,
      });

      if (!result.success) {
        sendJson(res, 403, result);
      } else {
        sendJson(res, 200, result);
      }
      return true;
    }

    // 8. Query Account Security Standing
    if (pathname === "/api/security/account-status" && req.method === "GET") {
      const identifier = url.searchParams.get("id") || url.searchParams.get("email") || "";
      const profile = getAccountSecurityStatus(identifier);
      sendJson(res, 200, { profile });
      return true;
    }

    // 9. Query Security Audit Log
    if (pathname === "/api/security/audit-log" && req.method === "GET") {
      const logs = getSecurityAuditLog();
      sendJson(res, 200, { logs: logs.slice(0, 50) });
      return true;
    }

    // 10. Summary Metrics
    if (pathname === "/api/security/cluster-summary" && req.method === "GET") {
      const summary = getSecurityRegistrySummary();
      sendJson(res, 200, summary);
      return true;
    }

    // 11. Admin Action: Ban cluster / identifier
    if (pathname === "/api/security/ban-cluster" && req.method === "POST") {
      const body = await parseJsonBody(req);
      const result = banAccountCluster(body.identifier, body.reason || "Suspension enforcement");
      sendJson(res, 200, result);
      return true;
    }

    sendJson(res, 404, { error: "Unknown security route" });
    return true;
  } catch (err: any) {
    console.error("Security middleware error:", err);
    sendJson(res, 500, { error: err.message || "Internal security error" });
    return true;
  }
}
