import { useEffect, useMemo, useState } from "react";
import { enrollLearner, startCourseCheckout, verifyCourseCheckout } from "./lib/api";
import "./App.css";

const courses = [
  {
    title: "3D CAD Modeling",
    description: "Create clean parts, product concepts, and design foundations.",
    tag: "Free",
    slug: "3d-cad-modeling",
    accessLevel: "free",
    lessonCount: 3,
  },
  {
    title: "Assemblies",
    description: "Bring multiple parts together and understand how products fit.",
    tag: "Free",
    slug: "assemblies",
    accessLevel: "free",
    lessonCount: 3,
  },
  {
    title: "Surface Modelling",
    description: "Shape smooth, advanced geometry for premium design work.",
    tag: "Free",
    slug: "surface-modelling",
    accessLevel: "free",
    lessonCount: 3,
  },
  {
    title: "Simulation",
    description: "Test strength, fit, and performance before production.",
    tag: "Free",
    slug: "simulation",
    accessLevel: "free",
    lessonCount: 3,
  },
  {
    title: "Technical Drawing",
    description: "Produce detailed drawings that can move straight into manufacturing.",
    tag: "Free",
    slug: "technical-drawing",
    accessLevel: "free",
    lessonCount: 3,
  },
  {
    title: "Advanced Projects",
    description: "Work through guided projects that feel like real industry tasks.",
    tag: "Premium",
    slug: "advanced-projects",
    accessLevel: "premium",
    lessonCount: 4,
  },
];

const routeTabs = [
  { label: "Home", path: "/" },
  { label: "Dashboard", path: "/dashboard" },
  { label: "Learning Center", path: "/learning-center" },
];

const steps = [
  "Learn SolidWorks from the basics",
  "Move into intermediate modelling",
  "Unlock premium project courses later",
];

const courseOptions = courses.map((course) => course.title);
const unlockStorageKey = "faith-tech-course-unlocks";
const learnerStorageKey = "faith-tech-current-learner";

const learningModules = {
  "3d-cad-modeling": [
    "Sketch fundamentals and constraints",
    "Extrude, cut, and shape clean parts",
    "Create your first production-ready part",
  ],
  assemblies: [
    "Mate parts together correctly",
    "Understand assembly structure",
    "Build simple mechanisms",
  ],
  "surface-modelling": [
    "Blend shapes and guide curves",
    "Refine smooth surfaces for premium products",
    "Prepare export-ready geometry",
  ],
  simulation: [
    "Set up loads and fixtures",
    "Interpret stress and deformation results",
    "Improve model performance before production",
  ],
  "technical-drawing": [
    "Create front, top, and sectional views",
    "Add dimensions and annotations",
    "Prepare drawings for manufacturing handoff",
  ],
  "advanced-projects": [
    "Build a full product from concept to finish",
    "Work with advanced modeling workflows",
    "Deliver a portfolio-worthy project",
    "Apply premium course feedback loops",
  ],
};

function normalizePath(pathname) {
  const value = String(pathname || "/").trim();
  if (!value || value === "/") {
    return "/";
  }

  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

function getCurrentPath() {
  if (typeof window === "undefined") {
    return "/";
  }

  return normalizePath(window.location.pathname);
}

function getRoute(pathname) {
  const segments = normalizePath(pathname).split("/").filter(Boolean);

  if (segments.length === 0) {
    return { page: "home" };
  }

  if (segments[0] === "dashboard") {
    return { page: "dashboard" };
  }

  if (segments[0] === "learning-center") {
    if (segments.length === 1) {
      return { page: "learning-center" };
    }

    return { page: "course-detail", courseSlug: segments[1] };
  }

  return { page: "home" };
}

function getPaymentNoticeFromUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("payment") === "cancelled"
    ? "Payment was cancelled. You can try again anytime."
    : "";
}

function getPaymentStatusFromUrl() {
  if (typeof window === "undefined") {
    return "idle";
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("payment") === "cancelled" ? "error" : "idle";
}

function readUnlocks() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(unlockStorageKey) || "{}");
  } catch {
    return {};
  }
}

function saveUnlock(courseSlug, value) {
  if (typeof window === "undefined") {
    return;
  }

  const current = readUnlocks();
  const next = {
    ...current,
    [courseSlug]: value,
  };

  window.localStorage.setItem(unlockStorageKey, JSON.stringify(next));
}

function readLearner() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(window.localStorage.getItem(learnerStorageKey) || "null");
  } catch {
    return null;
  }
}

function saveLearner(learner) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(learnerStorageKey, JSON.stringify(learner));
}

function clearLearner() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(learnerStorageKey);
}

function getCourseBySlug(slug) {
  return courses.find((course) => course.slug === slug) || null;
}

function getTrackCourses(level) {
  return courses.filter((course) => course.accessLevel === level);
}

function getLessonModules(courseSlug) {
  return learningModules[courseSlug] || [];
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pathname, setPathname] = useState(() => getCurrentPath());
  const [enrollmentStatus, setEnrollmentStatus] = useState("idle");
  const [enrollmentNotice, setEnrollmentNotice] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(getPaymentStatusFromUrl);
  const [paymentNotice, setPaymentNotice] = useState(getPaymentNoticeFromUrl);
  const [unlocks, setUnlocks] = useState(() => readUnlocks());
  const [currentLearner, setCurrentLearner] = useState(() => readLearner());
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    course: "3D CAD Modeling",
  });
  const tutor = {
    name: "Engr. Ezekiel Momoh",
    role: "Aerospace Engineer | SolidWorks Tutor",
    bio:
      "Momoh helps beginners move into confident CAD thinking through hands-on lessons, model reviews, and project-based guidance.",
    whatsapp: "https://wa.me/2347017244266",
    instagram: "https://instagram.com/faithtechacademy",
    linkedin: "https://linkedin.com/in/faithtechacademy",
  };

  const route = useMemo(() => getRoute(pathname), [pathname]);
  const checkoutEmail = formData.email.trim();
  const unlockedCount = useMemo(() => Object.values(unlocks).filter(Boolean).length, [unlocks]);
  const premiumUnlocked = Boolean(unlocks["advanced-projects"] || currentLearner?.accessLevel === "premium");
  const activeLearner = currentLearner || readLearner();

  function navigate(path) {
    if (typeof window === "undefined") {
      return;
    }

    const normalized = normalizePath(path);
    window.history.pushState({}, "", normalized);
    setPathname(normalized);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateLearnerAccess(level) {
    if (!activeLearner) {
      return;
    }

    const nextLearner = {
      ...activeLearner,
      accessLevel: level,
      status: level,
    };

    setCurrentLearner(nextLearner);
    saveLearner(nextLearner);
  }

  useEffect(() => {
    const onPopState = () => setPathname(getCurrentPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    const course = params.get("course");

    if (!reference || !course) {
      return;
    }

    let active = true;

    async function confirmPayment() {
      try {
        setPaymentStatus("loading");
        const result = await verifyCourseCheckout({ reference, course });

        if (!active) {
          return;
        }

        if (result?.verified) {
          const courseSlug = result.courseSlug || result.course?.slug || course;
          saveUnlock(courseSlug, true);
          setUnlocks(readUnlocks());
          setPaymentNotice(`${result.courseTitle || course} is now unlocked.`);
          setPaymentStatus("success");

          if (courseSlug === "advanced-projects") {
            updateLearnerAccess("premium");
          }

          navigate(`/learning-center/${courseSlug}`);
        } else {
          setPaymentNotice("Payment verification is still pending. Check the Paystack settings on the server.");
          setPaymentStatus("error");
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setPaymentNotice(error.message);
        setPaymentStatus("error");
      }
    }

    confirmPayment();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    setEnrollmentStatus("loading");
    setEnrollmentNotice("");

    enrollLearner(formData)
      .then((result) => {
        const nextLearner = {
          name: formData.name,
          email: formData.email,
          course: formData.course,
          profileId: result.profileId,
          enrollmentId: result.enrollmentId,
          accessLevel: result.accessLevel || "free",
          status: result.accessLevel || "free",
        };

        setCurrentLearner(nextLearner);
        saveLearner(nextLearner);
        setEnrollmentStatus("success");
        setEnrollmentNotice(`${result.message} Access level: ${result.accessLevel || "free"}.`);
        navigate("/dashboard");
      })
      .catch((error) => {
        setEnrollmentStatus("error");
        setEnrollmentNotice(error.message);
      });
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setEnrollmentNotice("");
    setPaymentNotice("");
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handlePremiumAccess(course) {
    const isUnlocked = unlocks[course.slug] || currentLearner?.accessLevel === "premium";

    if (isUnlocked) {
      navigate(`/learning-center/${course.slug}`);
      return;
    }

    try {
      setPaymentStatus("loading");
      const email = checkoutEmail || window.prompt("Enter your email to continue to Paystack checkout.");

      if (!email) {
        setPaymentStatus("idle");
        return;
      }

      const result = await startCourseCheckout({
        courseTitle: course.title,
        courseSlug: course.slug,
        email,
      });

      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }

      setPaymentStatus("error");
      setPaymentNotice("Paystack is not configured yet. Add PAYSTACK_SECRET_KEY and PUBLIC_SITE_URL on the server to enable checkout.");
    } catch (error) {
      setPaymentStatus("error");
      setPaymentNotice(error.message);
    }
  }

  function renderHeader() {
    const homeNav = (
      <nav id="site-nav" className={`nav ${menuOpen ? "nav-open" : ""}`}>
        <a href="#home" onClick={() => setMenuOpen(false)}>
          Home
        </a>
        <a href="#about" onClick={() => setMenuOpen(false)}>
          About
        </a>
        <a href="#courses" onClick={() => setMenuOpen(false)}>
          Courses
        </a>
      </nav>
    );

    const appNav = (
      <nav id="site-nav" className={`nav ${menuOpen ? "nav-open" : ""}`}>
        {routeTabs.map((tab) => (
          <button key={tab.path} type="button" className="nav-button" onClick={() => navigate(tab.path)}>
            {tab.label}
          </button>
        ))}
      </nav>
    );

    return (
      <header className="topbar">
        <button className="brand brand-button" type="button" onClick={() => navigate("/")}>
          <img src="/images/logo-transparent.png" alt="Faith Tech logo" />
          <span>Faith Tech</span>
        </button>

        <button
          className="menu-button"
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-controls="site-nav"
        >
          <span />
          <span />
          <span />
        </button>

        {route.page === "home" ? homeNav : appNav}
      </header>
    );
  }

  function renderHome() {
    return (
      <>
        <section id="home" className="hero section">
          <div className="hero-copy">
            <p className="eyebrow">SolidWorks Academy</p>
            <h1>Build from basics to advanced with a clean SolidWorks learning path.</h1>
            <p className="hero-text">
              Faith Tech is an academy-style landing page for learners who want practical CAD training without clutter.
              The experience stays simple, modern, and easy to navigate on every device.
            </p>

            <div className="hero-actions">
              <button className="primary-btn" type="button" onClick={() => navigate("/learning-center")}>
                Explore Learning Center
              </button>
              <button className="secondary-btn" type="button" onClick={() => navigate("/dashboard")}>
                View Dashboard
              </button>
            </div>

            <ul className="highlights">
              <li>Free basics for beginners</li>
              <li>Project-led learning</li>
              <li>Premium access later</li>
            </ul>
          </div>

          <div className="hero-visual">
            <article className="image-card image-card-main">
              <img src="/images/imag%201.jpg" alt="SolidWorks training in progress" />
              <div className="image-card-copy">
                <span>Hands-on training</span>
                <strong>Design. Engineer. Innovate.</strong>
              </div>
            </article>

            <div className="hero-visual-grid">
              <article className="image-card image-card-small">
                <img src="/images/imag%204.jpg" alt="Engineering model on a workstation" />
                <div className="image-card-copy compact">
                  <span>Technical drawing</span>
                  <strong>Real production-ready workflow.</strong>
                </div>
              </article>

              <article className="visual-info visual-video visual-video-only">
                <video autoPlay muted loop playsInline poster="/images/logo-transparent.png">
                  <source src="/videos/Faith%20Tech%20Intro%202.mp4" type="video/mp4" />
                </video>
              </article>
            </div>
          </div>
        </section>

        <section id="about" className="about section">
          <div className="section-heading">
            <p className="eyebrow">About Faith Tech</p>
            <h2>Simple structure, strong visuals, and a clean enrollment experience.</h2>
          </div>

          <div className="about-grid">
            <article className="about-panel">
              <p>
                Faith Tech is shaped like a focused learning academy. The layout keeps only three core sections so
                users can move quickly from the hero into course discovery and enrollment.
              </p>
              <p>
                This version also blends the branding into the page better, so the logo no longer feels boxed off
                from the rest of the design.
              </p>

              <ul className="steps-list">
                {steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </article>

            <div className="about-stack">
              <article className="tutor-card">
                <div className="tutor-photo">
                  <img src="/images/imag%201.jpg" alt="Tutor profile" />
                </div>

                <div className="tutor-copy">
                  <p className="eyebrow">Tutor Profile</p>
                  <h3>{tutor.name}</h3>
                  <p className="tutor-role">{tutor.role}</p>
                  <p>{tutor.bio}</p>

                  <div className="social-links">
                    <a href={tutor.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4.98 3.5A2.48 2.48 0 1 0 4.98 8a2.48 2.48 0 0 0 0-4.5ZM3 21h4V9H3v12Zm7 0h4v-6.5c0-1.7.32-3.35 2.43-3.35 2.07 0 2.1 1.94 2.1 3.46V21h4v-7.2c0-3.53-.76-6.24-4.9-6.24-1.99 0-3.32 1.09-3.86 2.1h-.05V9H10c.05 1.2 0 12 0 12Z" />
                      </svg>
                    </a>
                    <a href={tutor.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.5-2.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z" />
                      </svg>
                    </a>
                    <a href={tutor.whatsapp} target="_blank" rel="noreferrer" aria-label="WhatsApp">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20.52 3.48A11.87 11.87 0 0 0 12.04 0C5.5 0 .18 5.3.18 11.83c0 2.08.55 4.1 1.6 5.88L0 24l6.44-1.7a11.8 11.8 0 0 0 5.6 1.42h.01c6.53 0 11.85-5.3 11.85-11.83 0-3.17-1.24-6.15-3.38-8.41ZM12.05 21.74h-.01c-1.8 0-3.56-.49-5.08-1.42l-.36-.22-3.82 1.01 1.02-3.73-.24-.38a9.7 9.7 0 0 1-1.5-5.17c0-5.36 4.38-9.72 9.76-9.72 2.6 0 5.04 1.01 6.87 2.84a9.64 9.64 0 0 1 2.86 6.86c0 5.35-4.39 9.73-9.5 9.73Zm5.46-7.45c-.3-.15-1.77-.87-2.05-.97-.28-.1-.49-.15-.7.15-.21.3-.8.97-.98 1.17-.18.21-.36.23-.66.08-.3-.15-1.27-.47-2.42-1.5-.89-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.45.13-.6.14-.14.3-.36.45-.54.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.7-1.67-.96-2.29-.25-.6-.5-.52-.7-.53h-.6c-.2 0-.52.08-.8.37-.28.3-1.08 1.06-1.08 2.58s1.11 2.98 1.26 3.18c.15.2 2.15 3.28 5.21 4.59.73.32 1.3.5 1.75.64.74.24 1.41.21 1.94.13.59-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.08-.12-.28-.2-.58-.35Z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </article>

              <article className="form-panel">
                <div className="form-panel-head">
                  <p className="eyebrow">Enrollment</p>
                  <h3>Reserve your seat and create your learner profile</h3>
                  <p>Submit your details, set a password, and we’ll create your learner profile right away.</p>
                </div>

                <form className="enrollment-form" onSubmit={handleSubmit}>
                  <label>
                    Full name
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                    />
                  </label>

                  <label>
                    Email address
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                    />
                  </label>

                  <label>
                    Create password
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="At least 8 characters"
                    />
                  </label>

                  <label>
                    Course interest
                    <select name="course" value={formData.course} onChange={handleChange}>
                      {courseOptions.map((course) => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button className="primary-btn form-button" type="submit" disabled={enrollmentStatus === "loading"}>
                    {enrollmentStatus === "loading" ? "Sending..." : "Submit Interest"}
                  </button>
                </form>

                {enrollmentNotice ? (
                  <p className="form-status success">{enrollmentNotice}</p>
                ) : (
                  <p className="form-status">
                    Free learners get instant access to basics. Premium learners can unlock advanced content later
                    with payment.
                  </p>
                )}
              </article>
            </div>
          </div>
        </section>

        <section id="courses" className="courses section">
          <div className="section-heading">
            <p className="eyebrow">Courses</p>
            <h2>Free foundations now, with paid access available for advanced content later.</h2>
          </div>

          <p className="courses-meta">
            {unlockedCount > 0
              ? `${unlockedCount} premium course${unlockedCount > 1 ? "s" : ""} unlocked locally.`
              : "Premium access is ready for Paystack checkout at ₦25,000."}
          </p>

          <div className="course-grid">
            {courses.map((course) => {
              const isPremium = course.tag === "Premium";
              const isUnlocked = Boolean(unlocks[course.slug] || currentLearner?.accessLevel === "premium");

              return (
                <article className={`course-card ${isPremium ? "premium" : ""} ${isUnlocked ? "unlocked" : ""}`} key={course.title}>
                  <div className="course-card-top">
                    <span>{isPremium ? `${isUnlocked ? "Unlocked" : "Premium"} • ₦25,000` : course.tag}</span>
                  </div>
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>

                  {isPremium ? (
                    <button
                      className="course-link course-button"
                      type="button"
                      onClick={() => handlePremiumAccess(course)}
                    >
                      {isUnlocked ? "Open lesson" : "Unlock with Paystack"}
                    </button>
                  ) : (
                    <button className="course-link" type="button" onClick={() => navigate(`/learning-center/${course.slug}`)}>
                      Start free basics
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          {paymentNotice ? (
            <p className={`course-notice ${paymentStatus === "success" ? "success" : ""}`}>{paymentNotice}</p>
          ) : null}
        </section>
      </>
    );
  }

  function renderDashboard() {
    const learner = activeLearner;
    const accessLevel = learner?.accessLevel || "free";
    const profileCourse = learner?.course || "3D CAD Modeling";

    return (
      <section className="dashboard-page section">
        <div className="section-heading">
          <p className="eyebrow">Profile Dashboard</p>
          <h2>Your learner profile and access status.</h2>
        </div>

        <div className="dashboard-layout">
          <article className="dashboard-panel profile-panel">
            {learner ? (
              <>
                <div className="profile-head">
                  <div>
                    <p className="eyebrow">Current learner</p>
                    <h3>{learner.name}</h3>
                    <p className="profile-email">{learner.email}</p>
                  </div>
                  <span className={`status-pill ${accessLevel}`}>{accessLevel}</span>
                </div>

                <dl className="profile-list">
                  <div>
                    <dt>Course</dt>
                    <dd>{profileCourse}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{accessLevel === "premium" ? "Pro learner" : "Free learner"}</dd>
                  </div>
                  <div>
                    <dt>Profile ID</dt>
                    <dd>{learner.profileId || "Pending"}</dd>
                  </div>
                  <div>
                    <dt>Access</dt>
                    <dd>{accessLevel === "premium" ? "All premium modules unlocked" : "Free basics available"}</dd>
                  </div>
                </dl>

                <div className="profile-actions">
                  <button className="primary-btn" type="button" onClick={() => navigate("/learning-center")}>
                    Open learning center
                  </button>
                  <button className="secondary-btn" type="button" onClick={() => navigate("/learning-center")}>
                    View course list
                  </button>
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={() => {
                      clearLearner();
                      setCurrentLearner(null);
                      navigate("/");
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">No learner loaded</p>
                <h3>Reserve your seat to create a learner profile.</h3>
                <p className="profile-empty-copy">
                  Once a learner is created on this device, the dashboard will show their free or premium access
                  status here.
                </p>
                <div className="profile-actions">
                  <button className="primary-btn" type="button" onClick={() => navigate("/")}>
                    Go to signup
                  </button>
                </div>
              </>
            )}
          </article>

          <article className="dashboard-panel stats-panel">
            <p className="eyebrow">Learning status</p>
            <h3>What the profile now unlocks</h3>
            <ul className="dashboard-list">
              <li>Free basics for all learners</li>
              <li>Premium module unlocks after payment</li>
              <li>Lesson pages for each course</li>
              <li>Future video uploads inside the learning center</li>
            </ul>

            <div className="stats-grid">
              <div>
                <span>{getTrackCourses("free").length}</span>
                <p>Free courses</p>
              </div>
              <div>
                <span>{getTrackCourses("premium").length}</span>
                <p>Premium courses</p>
              </div>
              <div>
                <span>{unlockedCount}</span>
                <p>Unlocked locally</p>
              </div>
            </div>
          </article>
        </div>
      </section>
    );
  }

  function renderCourseList(level, title, description) {
    const trackCourses = getTrackCourses(level);

    return (
      <section className="track-section">
        <div className="track-heading">
          <div>
            <p className="eyebrow">{title}</p>
            <h3>{description}</h3>
          </div>
        </div>

        <div className="track-grid">
          {trackCourses.map((course) => {
            const isUnlocked = Boolean(unlocks[course.slug] || currentLearner?.accessLevel === "premium");
            return (
              <article className={`track-card ${isUnlocked ? "unlocked" : ""}`} key={course.slug}>
                <div className="track-card-top">
                  <span>{course.tag}</span>
                  <span>{course.lessonCount} lessons</span>
                </div>
                <h4>{course.title}</h4>
                <p>{course.description}</p>
                <button className="course-link" type="button" onClick={() => navigate(`/learning-center/${course.slug}`)}>
                  {isUnlocked ? "Open lesson" : "Start learning"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function renderLearningCenter() {
    return (
      <section className="learning-center-page section">
        <div className="section-heading">
          <p className="eyebrow">Learning Center</p>
          <h2>Free and premium lessons live here.</h2>
        </div>

        <div className="center-banner">
          <div>
            <p className="eyebrow">Current profile</p>
            <h3>{activeLearner ? activeLearner.name : "No learner profile loaded yet"}</h3>
            <p>
              {activeLearner
                ? `${activeLearner.email} • ${activeLearner.accessLevel === "premium" ? "Pro learner" : "Free learner"}`
                : "Create a profile from the homepage to unlock personalized learning content."}
            </p>
          </div>
          <button className="secondary-btn" type="button" onClick={() => navigate("/dashboard")}>
            View dashboard
          </button>
        </div>

        {renderCourseList("free", "Free basics", "Start with the essentials and move lesson by lesson.")}
        {renderCourseList("premium", "Premium modules", "Locked until payment unlocks the advanced lessons.")}
      </section>
    );
  }

  function renderCourseDetail(courseSlug) {
    const course = getCourseBySlug(courseSlug) || getCourseBySlug("3d-cad-modeling");
    const isPremium = course?.accessLevel === "premium";
    const canAccess = !isPremium || premiumUnlocked;
    const modules = getLessonModules(course?.slug);

    if (!course) {
      return null;
    }

    return (
      <section className="course-detail-page section">
        <div className="course-detail-back">
          <button className="secondary-btn" type="button" onClick={() => navigate("/learning-center")}>
            Back to learning center
          </button>
          <button className="secondary-btn" type="button" onClick={() => navigate("/dashboard")}>
            View dashboard
          </button>
        </div>

        <div className="course-detail-hero">
          <div>
            <p className="eyebrow">{isPremium ? "Premium lesson" : "Free lesson"}</p>
            <h2>{course.title}</h2>
            <p>{course.description}</p>
            <div className="detail-pill-row">
              <span className="status-pill free">{course.tag}</span>
              <span className="status-pill">{course.lessonCount} lesson slots</span>
              <span className="status-pill">{canAccess ? "Available" : "Locked"}</span>
            </div>
          </div>

          <div className="lesson-video-slot">
            {canAccess ? (
              <video autoPlay muted loop playsInline poster="/images/logo-transparent.png">
                <source src="/videos/Faith%20Tech%20Intro%202.mp4" type="video/mp4" />
              </video>
            ) : (
              <div className="locked-state">
                <p className="eyebrow">Locked lesson</p>
                <h3>Unlock with Paystack to access this premium course.</h3>
                <button className="primary-btn" type="button" onClick={() => handlePremiumAccess(course)}>
                  Unlock course
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lesson-layout">
          <article className="lesson-panel">
            <p className="eyebrow">Lesson path</p>
            <h3>What learners will move through</h3>
            <ol className="lesson-list">
              {modules.map((module) => (
                <li key={module}>{module}</li>
              ))}
            </ol>
          </article>

          <article className="lesson-panel">
            <p className="eyebrow">Upload slot</p>
            <h3>Where your future videos will live</h3>
            <p>
              This section is ready for the course video player, lesson notes, and downloadable files once you
              upload them.
            </p>
            <div className="upload-slot">
              <span>Course video placeholder</span>
              <p>
                Replace this with a stored lesson video, private embed, or secure media asset when you’re ready.
              </p>
            </div>
          </article>
        </div>
      </section>
    );
  }

  return (
    <div className="page-shell">
      {renderHeader()}

      <main>
        {route.page === "home" && renderHome()}
        {route.page === "dashboard" && renderDashboard()}
        {route.page === "learning-center" && renderLearningCenter()}
        {route.page === "course-detail" && renderCourseDetail(route.courseSlug)}
      </main>

      <footer className="site-footer">
        <div>
          <p className="footer-motto">Turning Ideas into Innovation</p>
          <p className="footer-copy">© 2026 designed by SIRFROSH100</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
