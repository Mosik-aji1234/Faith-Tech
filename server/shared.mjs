import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const storageDir = path.resolve(process.cwd(), "data");
const enrollmentFile = path.join(storageDir, "enrollments.json");
const learnerProfileFile = path.join(storageDir, "learner-profiles.json");
const defaultFreeVideoBucket = "faith-tech-free-videos";
const defaultPremiumVideoBucket = "faith-tech-premium-videos";

const premiumCourses = {
  "advanced-projects": {
    title: "Advanced Projects",
    amountKobo: 2500000,
    currency: "NGN",
    accessLevel: "premium",
    bucket: defaultPremiumVideoBucket,
    videoPath: "advanced-projects/lesson-1.mp4",
  },
};

const homeVideoConfig = {
  bucket: defaultFreeVideoBucket,
  videoPath: "3d-cad-modeling-lesson-2.mp4",
};

const courseMediaMap = {
  "3d-cad-modeling": {
    accessLevel: "free",
    bucket: defaultFreeVideoBucket,
    videoPath: "3d-cad-modeling-lesson-2.mp4",
  },
  assemblies: {
    accessLevel: "free",
    bucket: defaultFreeVideoBucket,
    videoPath: "assemblies/lesson-1.mp4",
  },
  "surface-modelling": {
    accessLevel: "free",
    bucket: defaultFreeVideoBucket,
    videoPath: "surface-modelling/lesson-1.mp4",
  },
  simulation: {
    accessLevel: "free",
    bucket: defaultFreeVideoBucket,
    videoPath: "simulation/lesson-1.mp4",
  },
  "technical-drawing": {
    accessLevel: "free",
    bucket: defaultFreeVideoBucket,
    videoPath: "technical-drawing/lesson-1.mp4",
  },
  "advanced-projects": {
    accessLevel: "premium",
    bucket: defaultPremiumVideoBucket,
    videoPath: "advanced-projects/lesson-1.mp4",
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
    ? {
        slug,
        title: record.title,
        amountKobo: record.amountKobo,
        currency: record.currency,
        accessLevel: record.accessLevel || "premium",
      }
    : { slug, title, accessLevel: "free" };
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

function getSupabaseApiRoot(env) {
  return (env.SUPABASE_URL || "").replace(/\/$/, "");
}

function getVideoBucketName(courseSlug, env) {
  const media = courseMediaMap[courseSlug];

  if (!media) {
    return null;
  }

  if (media.accessLevel === "premium") {
    return env.SUPABASE_PREMIUM_VIDEO_BUCKET || media.bucket;
  }

  return env.SUPABASE_FREE_VIDEO_BUCKET || media.bucket;
}

function buildPublicVideoUrl(env, bucketName, videoPath) {
  return `${getSupabaseApiRoot(env)}/storage/v1/object/public/${encodeURIComponent(bucketName)}/${videoPath}`;
}

function buildDownloadVideoUrl(env, bucketName, videoPath) {
  return `${buildPublicVideoUrl(env, bucketName, videoPath)}?download`;
}

function getLessonNumberFromName(name) {
  const match = String(name || "").match(/lesson[-_\s]*(\d+)/i) || String(name || "").match(/-(\d+)\.[a-z0-9]+$/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function getLessonTitle(courseTitle, fileName, lessonNumber) {
  const baseName = String(fileName || "").replace(/\.[^.]+$/, "");
  const readableName = baseName
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (lessonNumber) {
    return `Lesson ${lessonNumber} — ${courseTitle}`;
  }

  return readableName || courseTitle;
}

async function listStorageObjects(bucketName, prefix, env) {
  const serviceKey = getSupabaseServiceKey(env);

  if (!bucketName || !serviceKey || !env.SUPABASE_URL) {
    return [];
  }

  const response = await fetch(`${getSupabaseApiRoot(env)}/storage/v1/object/list/${encodeURIComponent(bucketName)}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefix,
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase storage list failed: ${await response.text()}`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

async function getCourseLessonRecords(courseSlug, env, origin) {
  const media = courseMediaMap[courseSlug];
  const serviceKey = getSupabaseServiceKey(env);

  if (!media || !serviceKey || !env.SUPABASE_URL) {
    return [];
  }

  const bucketName = getVideoBucketName(courseSlug, env);
  const objects = await listStorageObjects(bucketName, courseSlug, env);
  const lessonObjects = objects.filter((item) => /\.(mp4|mov|webm|m4v)$/i.test(item.name || ""));

  return lessonObjects.map((item) => {
    const lessonNumber = getLessonNumberFromName(item.name);
    const videoPath = item.name;
    const playbackUrl =
      media.accessLevel === "free"
        ? buildPublicVideoUrl(env, bucketName, videoPath)
        : null;
    const downloadUrl =
      media.accessLevel === "free"
        ? buildDownloadVideoUrl(env, bucketName, videoPath)
        : null;

    return {
      number: lessonNumber,
      title: getLessonTitle(media.title || courseSlug, item.name, lessonNumber),
      note: "Uploaded and ready to watch",
      fileName: item.name,
      playbackUrl,
      downloadUrl,
      accessLevel: media.accessLevel,
    };
  }).sort((left, right) => {
    const leftNumber = left.number || Number.MAX_SAFE_INTEGER;
    const rightNumber = right.number || Number.MAX_SAFE_INTEGER;
    return leftNumber - rightNumber || left.title.localeCompare(right.title);
  });
}

function getHomeVideoRecord(env, origin) {
  const bucket = env.SUPABASE_HOME_VIDEO_BUCKET || homeVideoConfig.bucket;
  const videoPath = env.SUPABASE_HOME_VIDEO_PATH || homeVideoConfig.videoPath;

  if (!bucket || !videoPath) {
    return null;
  }

  return {
    accessLevel: "free",
    bucket,
    videoPath,
    apiRoot: getSupabaseApiRoot(env),
    siteUrl: getSiteUrl(env, origin),
    playbackUrl: buildPublicVideoUrl(env, bucket, videoPath),
    requiresSignature: false,
  };
}

function getCourseMediaRecord(courseSlug, env, origin) {
  const media = courseMediaMap[courseSlug];

  if (!media) {
    return null;
  }

  const bucket = getVideoBucketName(courseSlug, env);

  return {
    ...media,
    bucket,
    apiRoot: getSupabaseApiRoot(env),
    siteUrl: getSiteUrl(env, origin),
    playbackUrl: media.accessLevel === "free" ? buildPublicVideoUrl(env, bucket, media.videoPath) : null,
    downloadUrl: media.accessLevel === "free" ? buildDownloadVideoUrl(env, bucket, media.videoPath) : null,
    requiresSignature: media.accessLevel === "premium",
  };
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

async function findSupabaseRecordByEmail(tableName, email, env) {
  const serviceKey = getSupabaseServiceKey(env);

  if (!env.SUPABASE_URL || !serviceKey) {
    return null;
  }

  const response = await fetch(
    `${getSupabaseApiRoot(env)}/rest/v1/${tableName}?email=eq.${encodeURIComponent(email)}&select=*`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return Array.isArray(payload) && payload.length > 0 ? payload[0] : null;
}

async function upsertSupabaseRecord(tableName, email, record, env) {
  const serviceKey = getSupabaseServiceKey(env);

  if (!env.SUPABASE_URL || !serviceKey) {
    return { provider: "disabled", record: null };
  }

  const existingRecord = await findSupabaseRecordByEmail(tableName, email, env);
  const endpoint = existingRecord?.id
    ? `${getSupabaseApiRoot(env)}/rest/v1/${tableName}?id=eq.${encodeURIComponent(existingRecord.id)}`
    : `${getSupabaseApiRoot(env)}/rest/v1/${tableName}`;
  const method = existingRecord?.id ? "PATCH" : "POST";
  const requestBody = existingRecord?.id
    ? (({ id, ...rest }) => rest)(record)
    : record;

  const response = await fetch(endpoint, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Supabase ${tableName} save failed: ${await response.text()}`);
  }

  const responsePayload = await response.json();

  return {
    provider: "supabase",
    record: Array.isArray(responsePayload) ? responsePayload[0] || null : responsePayload || null,
    existing: Boolean(existingRecord?.id),
  };
}

async function persistEnrollment(record, env) {
  if (env.SUPABASE_URL && getSupabaseServiceKey(env)) {
    return upsertSupabaseRecord("enrollments", record.email, record, env);
  }

  const items = await readJsonFile(enrollmentFile, []);
  const next = [
    record,
    ...items.filter((item) => item.email !== record.email),
  ];
  await writeJsonFile(enrollmentFile, next);

  return { provider: "local-file", existing: items.some((item) => item.email === record.email), record };
}

async function persistLearnerProfile(record, env) {
  if (env.SUPABASE_URL && getSupabaseServiceKey(env)) {
    return upsertSupabaseRecord("learner_profiles", record.email, record, env);
  }

  const items = await readJsonFile(learnerProfileFile, []);
  const next = [
    record,
    ...items.filter((item) => item.email !== record.email),
  ];
  await writeJsonFile(learnerProfileFile, next);

  return { provider: "local-file", existing: items.some((item) => item.email === record.email), record };
}

async function createSignedVideoUrl(courseSlug, env) {
  const media = courseMediaMap[courseSlug];
  const serviceKey = getSupabaseServiceKey(env);

  if (!media || !serviceKey || !env.SUPABASE_URL) {
    return null;
  }

  const bucketName = getVideoBucketName(courseSlug, env);
  const response = await fetch(
    `${getSupabaseApiRoot(env)}/storage/v1/object/sign/${encodeURIComponent(bucketName)}/${media.videoPath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase signed video URL failed: ${await response.text()}`);
  }

  const payload = await response.json();
  const signedPath = payload.signedURL || payload.signedUrl || "";

  return signedPath ? `${getSupabaseApiRoot(env)}${signedPath}` : null;
}

async function findSupabaseUserByEmail(email, env) {
  const serviceKey = getSupabaseServiceKey(env);

  if (!env.SUPABASE_URL || !serviceKey) {
    return null;
  }

  const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users?per_page=1000`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const users = Array.isArray(payload.users) ? payload.users : [];
  const lowerEmail = String(email || "").trim().toLowerCase();

  return users.find((user) => String(user.email || "").trim().toLowerCase() === lowerEmail) || null;
}

async function createSupabasePasswordUser(record, password, env) {
  if (!env.SUPABASE_URL || !getSupabaseServiceKey(env)) {
    return { provider: "disabled", userId: null };
  }

  const serviceKey = getSupabaseServiceKey(env);
  const apiRoot = env.SUPABASE_URL.replace(/\/$/, "");
  const response = await fetch(`${apiRoot}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: record.email,
      password,
      email_confirm: true,
      user_metadata: {
        name: record.name,
        course: record.course.title,
        access_level: record.accessLevel,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (errorText.includes("email_exists")) {
      const existingUser = await findSupabaseUserByEmail(record.email, env);

      if (existingUser?.id) {
        const updateResponse = await fetch(`${apiRoot}/auth/v1/admin/users/${existingUser.id}`, {
          method: "PUT",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password,
            email_confirm: true,
            user_metadata: {
              name: record.name,
              course: record.course.title,
              access_level: record.accessLevel,
            },
          }),
        });

        if (!updateResponse.ok) {
          throw new Error(`Supabase user update failed: ${await updateResponse.text()}`);
        }

        return {
          provider: "supabase",
          userId: existingUser.id,
          reused: true,
        };
      }
    }

    throw new Error(`Supabase user creation failed: ${errorText}`);
  }

  const payload = await response.json();

  return {
    provider: "supabase",
    userId: payload.id || payload.user?.id || null,
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
      subject: `Faith Tech account created for ${record.course.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Welcome to Faith Tech</h2>
          <p>Your learner profile has been created for <strong>${record.course.title}</strong>.</p>
          <p>Name: ${record.name}</p>
          <p>Email: ${record.email}</p>
          <p>Access level: <strong>${record.accessLevel}</strong></p>
          <p>You can log in with your email and password.</p>
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
    const password = String(requestBody.password || "").trim();
    const courseName = String(requestBody.course || "").trim();

    if (!name || !email || !password || !courseName) {
      return jsonResponse(400, { error: "Name, email, password, and course are required." });
    }

    if (!validateEmail(email)) {
      return jsonResponse(400, { error: "Please provide a valid email address." });
    }

    if (password.length < 8) {
      return jsonResponse(400, { error: "Password must be at least 8 characters long." });
    }

    const course = normalizeCourse(courseName);
    if (!course) {
      return jsonResponse(400, { error: "Please choose a valid course." });
    }

    const accessLevel = course.accessLevel || (course.amountKobo ? "premium" : "free");
    const status = accessLevel;

    const record = {
      id: randomUUID(),
      name,
      email,
      course,
      createdAt: new Date().toISOString(),
      status,
      accessLevel,
      source: headers["user-agent"] || "unknown",
    };

    const authUser = await createSupabasePasswordUser(record, password, env);
    const profileRecord = {
      id: randomUUID(),
      auth_user_id: authUser.userId,
      name,
      email,
      course: course.title,
      course_slug: course.slug,
      status,
      created_at: record.createdAt,
      updated_at: record.createdAt,
    };

    const profileStorage = await persistLearnerProfile(profileRecord, env);
    const storedProfileId = profileStorage.record?.id || profileRecord.id;
    const stored = await persistEnrollment(
      {
        id: record.id,
        name: record.name,
        email: record.email,
        course: record.course,
        created_at: record.createdAt,
        status: record.status,
        source: record.source,
        profile_id: storedProfileId,
        auth_user_id: authUser.userId,
      },
      env,
    );
    const emailResult = await sendConfirmationEmail(record, env);

    return jsonResponse(201, {
      message: `Learner profile created for ${course.title}. You can log in with email and password.`,
      enrollmentId: record.id,
      profileId: profileRecord.id,
      storage: stored.provider,
      profileStorage: profileStorage.provider,
      email: emailResult.provider,
      authProvider: authUser.provider,
      accessLevel,
    });
  }

  if (method === "POST" && pathname === "/api/course-media") {
    const courseSlug = slugify(requestBody.courseSlug || "");
    const course = getCourseMediaRecord(courseSlug, env, origin);

    if (!course) {
      return jsonResponse(404, { error: "That course does not have media configured yet." });
    }

    const lessons = await getCourseLessonRecords(courseSlug, env, origin);

    if (course.accessLevel === "free") {
      return jsonResponse(200, {
        ...course,
        lessons,
      });
    }

    const playbackUrl = await createSignedVideoUrl(courseSlug, env);

    return jsonResponse(200, {
      ...course,
      playbackUrl,
      lessons,
    });
  }

  if (method === "POST" && pathname === "/api/home-video") {
    const homeVideo = getHomeVideoRecord(env, origin);

    if (!homeVideo) {
      return jsonResponse(404, { error: "Homepage video is not configured yet." });
    }

    return jsonResponse(200, homeVideo);
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
