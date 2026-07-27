import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const storageDir = path.resolve(process.cwd(), "data");
const enrollmentFile = path.join(storageDir, "enrollments.json");
const learnerProfileFile = path.join(storageDir, "learner-profiles.json");

const premiumCourses = {
  "advanced-projects": {
    title: "Advanced Projects",
    amountKobo: 2500000,
    currency: "NGN",
  },
};

function jsonResponse(status, body) {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeCourse(value) {
  const title = String(value || "").trim();
  if (!title) {
    return null;
  }

  const slug = slugify(title);
  const record = premiumCourses[slug];

  return record
    ? { slug, title: record.title, amountKobo: record.amountKobo, currency: record.currency }
    : { slug, title };
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function getSupabaseServiceKey(env) {
  return env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function getSiteUrl(env, origin) {
  return (env.PUBLIC_SITE_URL || origin || "http://localhost:5173").replace(/\/$/, "");
}

async function readJsonFile(filePath, fallback) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function persistEnrollment(record, env) {
  const serviceKey = getSupabaseServiceKey(env);

  if (env.SUPABASE_URL && serviceKey) {
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/enrollments`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      throw new Error(`Supabase insert failed: ${await response.text()}`);
    }

    return { provider: "supabase" };
  }

  const items = await readJsonFile(enrollmentFile, []);
  items.unshift(record);
  await writeJsonFile(enrollmentFile, items);

  return { provider: "local-file" };
}

async function persistLearnerProfile(record, env) {
  const serviceKey = getSupabaseServiceKey(env);

  if (env.SUPABASE_URL && serviceKey) {
    const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/learner_profiles?on_conflict=email`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      throw new Error(`Supabase learner profile insert failed: ${await response.text()}`);
    }

    return { provider: "supabase" };
  }

  const items = await readJsonFile(learnerProfileFile, []);
  const next = [
    record,
    ...items.filter((item) => item.email !== record.email),
  ];
  await writeJsonFile(learnerProfileFile, next);

  return { provider: "local-file" };
}

async function createSupabaseMagicLink(record, env, origin) {
  if (!env.SUPABASE_URL || !getSupabaseServiceKey(env)) {
    return { provider: "disabled", actionLink: null };
  }

  const serviceKey = getSupabaseServiceKey(env);
  const siteUrl = getSiteUrl(env, origin);

  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email: record.email,
      options: {
        redirectTo: `${siteUrl}/?auth=magic-link`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase magic-link creation failed: ${await response.text()}`);
  }

  const payload = await response.json();

  return {
    provider: "supabase",
    actionLink: payload.properties?.action_link || payload.action_link || null,
    identityId: payload.properties?.identity_id || null,
  };
}

async function sendConfirmationEmail(record, env) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return { provider: "disabled" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [record.email],
      subject: `Faith Tech learner profile created for ${record.course.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Welcome to Faith Tech</h2>
          <p>Your learner profile has been created for <strong>${record.course.title}</strong>.</p>
          <p>Name: ${record.name}</p>
          <p>Email: ${record.email}</p>
          ${
            record.loginLink
              ? `<p><a href="${record.loginLink}" target="_blank" rel="noreferrer">Open your magic login link</a></p>`
              : "<p>Your magic login link will be shared once Supabase Auth is fully configured.</p>"
          }
          <p>We will follow up with the next steps soon.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend send failed: ${await response.text()}`);
  }

  return { provider: "resend" };
}

async function createPaystackCheckout(record, env, origin) {
  if (!env.PAYSTACK_SECRET_KEY) {
    return {
      provider: "not-configured",
      checkoutUrl: null,
    };
  }

  const siteUrl = env.PUBLIC_SITE_URL || origin || "http://localhost:5173";
  const reference = `faithtech_${record.course.slug}_${randomUUID().replace(/-/g, "")}`;
  const params = new URLSearchParams();
  params.set("email", record.email);
  params.set("amount", String(record.course.amountKobo || 2500000));
  params.set("reference", reference);
  params.set("callback_url", `${siteUrl}/?payment=success&course=${encodeURIComponent(record.course.slug)}`);
  params.set("metadata[courseSlug]", record.course.slug);
  params.set("metadata[courseTitle]", record.course.title);
  params.set("metadata[courseCurrency]", record.course.currency || "NGN");
  params.set("metadata[amountKobo]", String(record.course.amountKobo || 2500000));

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Paystack checkout creation failed: ${await response.text()}`);
  }

  const payload = await response.json();

  return {
    provider: "paystack",
    checkoutUrl: payload.data?.authorization_url || null,
    reference: payload.data?.reference || reference,
  };
}

async function verifyPaystackCheckout(reference, env, courseSlug) {
  if (!env.PAYSTACK_SECRET_KEY) {
    return {
      verified: false,
      provider: "not-configured",
    };
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Paystack verification failed: ${await response.text()}`);
  }

  const payload = await response.json();
  const transaction = payload.data || {};
  const expectedCourse = premiumCourses[courseSlug];
  const amountMatches = expectedCourse ? transaction.amount === expectedCourse.amountKobo : true;
  const verified = transaction.status === "success" && amountMatches;

  return {
    verified,
    provider: "paystack",
    courseSlug: transaction.metadata?.courseSlug || courseSlug,
    courseTitle: transaction.metadata?.courseTitle || expectedCourse?.title,
    email: transaction.customer?.email || transaction.metadata?.email,
    raw: payload,
  };
}

function parseJsonBody(body) {
  if (!body) {
    return {};
  }

  if (typeof body === "object") {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

export async function handleApiRequest({ method, pathname, body, headers, env, origin }) {
  const requestBody = parseJsonBody(body);

  if (method === "GET" && pathname === "/api/health") {
    return jsonResponse(200, { ok: true, service: "faith-tech-api" });
  }

  if (method === "POST" && pathname === "/api/enroll") {
    const name = String(requestBody.name || "").trim();
    const email = String(requestBody.email || "").trim();
    const courseName = String(requestBody.course || "").trim();

    if (!name || !email || !courseName) {
      return jsonResponse(400, { error: "Name, email, and course are required." });
    }

    if (!validateEmail(email)) {
      return jsonResponse(400, { error: "Please provide a valid email address." });
    }

    const course = normalizeCourse(courseName);
    if (!course) {
      return jsonResponse(400, { error: "Please choose a valid course." });
    }

    const record = {
      id: randomUUID(),
      name,
      email,
      course,
      createdAt: new Date().toISOString(),
      status: "pending",
      source: headers["user-agent"] || "unknown",
    };

    const magicLink = await createSupabaseMagicLink(record, env, origin);
    const profileRecord = {
      id: randomUUID(),
      auth_user_id: magicLink.identityId,
      name,
      email,
      course: course.title,
      course_slug: course.slug,
      status: "pending_login",
      magic_link_provider: magicLink.provider,
      created_at: record.createdAt,
      updated_at: record.createdAt,
    };

    const profileStorage = await persistLearnerProfile(profileRecord, env);
    const stored = await persistEnrollment(
      {
        ...record,
        profile_id: profileRecord.id,
        magic_link_provider: magicLink.provider,
        magic_link_sent_at: magicLink.actionLink ? new Date().toISOString() : null,
      },
      env,
    );
    const emailResult = await sendConfirmationEmail(
      {
        ...record,
        loginLink: magicLink.actionLink,
      },
      env,
    );

    return jsonResponse(201, {
      message: `Learner profile created for ${course.title}. Check your email for the magic link.`,
      enrollmentId: record.id,
      profileId: profileRecord.id,
      storage: stored.provider,
      profileStorage: profileStorage.provider,
      email: emailResult.provider,
      loginLinkProvider: magicLink.provider,
    });
  }

  if (method === "POST" && pathname === "/api/create-checkout-session") {
    const courseSlug = slugify(requestBody.courseSlug || requestBody.courseTitle || "");
    const course = premiumCourses[courseSlug];

    if (!course) {
      return jsonResponse(400, { error: "That course is not configured for payment yet." });
    }

    const record = {
      email: String(requestBody.email || "learner@example.com").trim(),
      course: { slug: courseSlug, title: course.title, amountKobo: course.amountKobo, currency: course.currency },
    };

    const checkout = await createPaystackCheckout(record, env, origin);

    return jsonResponse(200, {
      message: checkout.checkoutUrl
        ? "Checkout session created."
        : "Paystack is not configured yet.",
      provider: checkout.provider,
      checkoutUrl: checkout.checkoutUrl,
      reference: checkout.reference,
    });
  }

  if (method === "POST" && pathname === "/api/verify-checkout-session") {
    const reference = String(requestBody.reference || requestBody.sessionId || "").trim();
    const courseSlug = slugify(requestBody.courseSlug || requestBody.courseTitle || "");

    if (!reference) {
      return jsonResponse(400, { error: "A payment reference is required." });
    }

    const verification = await verifyPaystackCheckout(reference, env, courseSlug);

    return jsonResponse(200, verification);
  }

  return jsonResponse(404, { error: "Not found." });
}
