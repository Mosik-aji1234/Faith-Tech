const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || "Request failed.");
  }

  return payload;
}

export function enrollLearner(data) {
  return requestJson("/enroll", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function startCourseCheckout(data) {
  return requestJson("/create-checkout-session", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function verifyCourseCheckout(data) {
  return requestJson("/verify-checkout-session", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getCourseMedia(courseSlug) {
  return requestJson("/course-media", {
    method: "POST",
    body: JSON.stringify({ courseSlug }),
  });
}

export function getHomeVideo() {
  return requestJson("/home-video", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}
