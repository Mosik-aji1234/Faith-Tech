import { useEffect, useMemo, useState } from "react";
import { enrollLearner, startCourseCheckout, verifyCourseCheckout } from "./lib/api";
import "./App.css";

const courses = [
  {
    title: "3D CAD Modeling",
    description: "Create clean parts, product concepts, and design foundations.",
    tag: "Free",
    slug: "3d-cad-modeling",
  },
  {
    title: "Assemblies",
    description: "Bring multiple parts together and understand how products fit.",
    tag: "Free",
    slug: "assemblies",
  },
  {
    title: "Surface Modelling",
    description: "Shape smooth, advanced geometry for premium design work.",
    tag: "Free",
    slug: "surface-modelling",
  },
  {
    title: "Simulation",
    description: "Test strength, fit, and performance before production.",
    tag: "Free",
    slug: "simulation",
  },
  {
    title: "Technical Drawing",
    description: "Produce detailed drawings that can move straight into manufacturing.",
    tag: "Free",
    slug: "technical-drawing",
  },
  {
    title: "Advanced Projects",
    description: "Work through guided projects that feel like real industry tasks.",
    tag: "Premium",
    slug: "advanced-projects",
  },
];

const steps = [
  "Learn SolidWorks from the basics",
  "Move into intermediate modelling",
  "Unlock premium project courses later",
];

const courseOptions = courses.map((course) => course.title);
const unlockStorageKey = "faith-tech-course-unlocks";

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

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState("idle");
  const [paymentStatus, setPaymentStatus] = useState(getPaymentStatusFromUrl);
  const [paymentNotice, setPaymentNotice] = useState(getPaymentNoticeFromUrl);
  const [unlocks, setUnlocks] = useState(() => readUnlocks());
  const [formData, setFormData] = useState({
    name: "",
    email: "",
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
  const checkoutEmail = formData.email.trim();

  const unlockedCount = useMemo(
    () => Object.values(unlocks).filter(Boolean).length,
    [unlocks],
  );

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
          setPaymentNotice(
            `${result.courseTitle || course} is now unlocked. You can add the course video next.`,
          );
          setPaymentStatus("success");
        } else {
          setPaymentNotice(
            "Payment verification is still pending. Check the Paystack settings on the server.",
          );
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
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    setEnrollmentStatus("loading");

    enrollLearner(formData)
      .then((result) => {
        setSubmitted(true);
        setEnrollmentStatus("success");
        setPaymentNotice(result.message);
      })
      .catch((error) => {
        setEnrollmentStatus("error");
        setPaymentNotice(error.message);
      });
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setSubmitted(false);
    setPaymentNotice("");
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handlePremiumAccess(course) {
    const isUnlocked = unlocks[course.slug];

    if (isUnlocked) {
      setPaymentNotice(`${course.title} is unlocked. Add the lesson video when ready.`);
      setPaymentStatus("success");
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
      setPaymentNotice(
        "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY and PUBLIC_SITE_URL on the server to enable checkout.",
      );
    } catch (error) {
      setPaymentStatus("error");
      setPaymentNotice(error.message);
    }
  }

  return (
    <div className="page-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={() => setMenuOpen(false)}>
          <img src="/images/logo-transparent.png" alt="Faith Tech logo" />
          <span>Faith Tech</span>
        </a>

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
      </header>

      <main>
        <section id="home" className="hero section">
          <div className="hero-copy">
            <p className="eyebrow">SolidWorks Academy</p>
            <h1>Build from basics to advanced with a clean SolidWorks learning path.</h1>
            <p className="hero-text">
              Faith Tech is an academy-style landing page for learners who want practical
              CAD training without clutter. The experience stays simple, modern, and easy
              to navigate on every device.
            </p>

            <div className="hero-actions">
              <a className="primary-btn" href="#courses">
                Explore Courses
              </a>
              <a className="secondary-btn" href="#about">
                Reserve a Seat
              </a>
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
                Faith Tech is shaped like a focused learning academy. The layout keeps only
                three core sections so users can move quickly from the hero into course
                discovery and enrollment.
              </p>
              <p>
                This version also blends the branding into the page better, so the logo no
                longer feels boxed off from the rest of the design.
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
                  <p>
                    Submitting creates a learner profile, sends a magic-link email, and prepares
                    your account for future course access.
                  </p>
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

                {submitted ? (
                  <p className="form-status success">
                    Thanks. Your learner profile is ready and your login email has been sent.
                  </p>
                ) : (
                  <p className="form-status">
                    This now connects to Resend, Supabase learner profiles, and Paystack-ready
                    paid course unlocks.
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
              const isUnlocked = Boolean(unlocks[course.slug]);

              return (
                <article
                  className={`course-card ${isPremium ? "premium" : ""} ${isUnlocked ? "unlocked" : ""}`}
                  key={course.title}
                >
                  <div className="course-card-top">
                    <span>
                      {isPremium
                        ? `${isUnlocked ? "Unlocked" : "Premium"} • ₦25,000`
                        : course.tag}
                    </span>
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
                    <a className="course-link" href="#about">
                      Start free basics
                    </a>
                  )}
                </article>
              );
            })}
          </div>

          {paymentNotice ? (
            <p className={`course-notice ${paymentStatus === "success" ? "success" : ""}`}>
              {paymentNotice}
            </p>
          ) : null}
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <p className="footer-motto">Turning Ideas into Innovation</p>
          <p className="footer-copy">© 2026 designed by Sir-Frosh100</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
