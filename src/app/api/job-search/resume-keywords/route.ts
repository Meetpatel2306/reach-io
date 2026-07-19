import { NextRequest } from "next/server";
import pdfParse from "pdf-parse";
import { ok, bad, requireUser } from "@/app/api/jobs/_helpers";

// Extracts likely skills + a role from an uploaded resume PDF so the Job Finder
// can pre-fill the search. Best-effort: if parsing fails the client falls back
// to manual keyword entry.

// Multi-word skills first so they win over their sub-tokens.
const SKILLS = [
  "machine learning", "deep learning", "data science", "data engineering", "computer vision",
  "natural language processing", "next.js", "node.js", "ci/cd",
  "python", "java", "javascript", "typescript", "golang", "rust", "c++", "c#", "php", "ruby",
  "react", "angular", "vue", "svelte", "django", "flask", "fastapi", "express", "spring", "laravel",
  "node", "nestjs", "graphql", "rest", "microservices", "grpc", "websockets",
  "sql", "mysql", "postgresql", "postgres", "mongodb", "redis", "elasticsearch", "clickhouse",
  "kafka", "rabbitmq", "celery", "spark", "hadoop", "airflow",
  "docker", "kubernetes", "terraform", "aws", "azure", "gcp", "devops", "linux", "nginx",
  "pytorch", "tensorflow", "scikit-learn", "pandas", "numpy", "langchain", "llm", "rag", "nlp", "ai", "ml",
  "html", "css", "tailwind", "sass", "flutter", "android", "ios", "kotlin", "swift", "react native",
  "git", "prometheus", "grafana", "pydantic", "sqlalchemy",
];

const ROLES: [RegExp, string][] = [
  [/machine learning engineer|ml engineer/i, "Machine Learning Engineer"],
  [/\bai\b.{0,3}(engineer|developer)|artificial intelligence/i, "AI Engineer"],
  [/data scientist/i, "Data Scientist"],
  [/data engineer/i, "Data Engineer"],
  [/back[- ]?end (developer|engineer)/i, "Backend Developer"],
  [/front[- ]?end (developer|engineer)/i, "Frontend Developer"],
  [/full[- ]?stack (developer|engineer)/i, "Full Stack Developer"],
  [/devops engineer/i, "DevOps Engineer"],
  [/android developer/i, "Android Developer"],
  [/ios developer/i, "iOS Developer"],
  [/mobile developer/i, "Mobile Developer"],
  [/python developer/i, "Python Developer"],
  [/software (developer|engineer)/i, "Software Engineer"],
  [/web developer/i, "Web Developer"],
];

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let file: File | null = null;
  try {
    const fd = await req.formData();
    file = fd.get("resume") as File | null;
  } catch {
    return bad("Could not read upload");
  }
  if (!file || file.size === 0) return bad("No resume file provided");

  let text = "";
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const parsed = await pdfParse(buf);
    text = (parsed.text || "").toLowerCase();
  } catch {
    return ok({ keywords: "", role: "", skills: [], parsed: false });
  }

  if (!text.trim()) return ok({ keywords: "", role: "", skills: [], parsed: false });

  // Detected skills (dedupe overlapping tokens; keep first-seen order).
  const found: string[] = [];
  for (const s of SKILLS) {
    const re = new RegExp(`(^|[^a-z0-9+#.])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9+#.]|$)`, "i");
    if (re.test(text) && !found.includes(s)) found.push(s);
  }

  let role = "";
  for (const [re, label] of ROLES) {
    if (re.test(text)) { role = label; break; }
  }
  if (!role && found.length) {
    role = `${found[0].charAt(0).toUpperCase() + found[0].slice(1)} Developer`;
  }

  // Top skills become the search keywords (cap so the query stays focused).
  const skills = found.slice(0, 8);
  const keywords = (role ? [role] : []).concat(skills.slice(0, 5)).join(" ").trim() || skills.slice(0, 5).join(" ");

  return ok({ keywords, role, skills, parsed: true });
}
