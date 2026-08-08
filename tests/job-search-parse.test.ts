import { describe, it, expect } from "vitest";
import { parseJobsText } from "../src/lib/jobSearch";

// A search provider that declines the job ("I'm unable to perform a live web
// search") often follows up by demonstrating the requested schema with invented
// rows. Those rows have a company and a URL, so a naive validator accepts them —
// which is how a refusal reached the UI as a confident "Found 0", and how a
// fictional employer could have landed in the leads table.

const real = {
  company: "Tops Infosolutions", role: "Python Developer", experience: "2-4 years",
  package: "", location: "Ahmedabad", jd: "RAG and agentic AI work.",
  applyLink: "https://cutshort.io/job/python-developer-ahmedabad", careerPage: "",
  contactEmail: "", contactPhone: "", postedWhen: "FRESH · 3 days ago", source: "cutshort.io",
};

describe("parseJobsText", () => {
  it("keeps a genuine posting", () => {
    const jobs = parseJobsText(JSON.stringify([real]));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].company).toBe("Tops Infosolutions");
  });

  it("drops schema-demo rows the model invented", () => {
    const demo = [
      { ...real, company: "Example Corp", applyLink: "https://example.com/apply" },
      { ...real, company: "Acme", applyLink: "https://acme.test/jobs" },
      { ...real, company: "Your Company", applyLink: "https://careers.example.org/1" },
      { ...real, company: "Real Startup", applyLink: "https://example.com/job/9" },
    ];
    expect(parseJobsText(JSON.stringify(demo))).toHaveLength(0);
  });

  it("keeps real rows mixed in with demo rows", () => {
    const mixed = [{ ...real, company: "Example Corp" }, real];
    const jobs = parseJobsText(JSON.stringify(mixed));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].company).toBe("Tops Infosolutions");
  });

  it("drops rows with no usable link", () => {
    const bad = [{ ...real, applyLink: "not-a-url", careerPage: "" }];
    expect(parseJobsText(JSON.stringify(bad))).toHaveLength(0);
  });

  it("falls back to the career page when the apply link is missing", () => {
    const jobs = parseJobsText(JSON.stringify([
      { ...real, applyLink: "", careerPage: "https://topsinfosolutions.com/careers/" },
    ]));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].applyLink).toBe("https://topsinfosolutions.com/careers/");
  });

  it("drops rows with no company", () => {
    expect(parseJobsText(JSON.stringify([{ ...real, company: "" }]))).toHaveLength(0);
  });

  it("reads JSON that the model wrapped in prose or a code fence", () => {
    const wrapped = "Here are the jobs I found:\n```json\n" + JSON.stringify([real]) + "\n```\nHope that helps!";
    expect(parseJobsText(wrapped)).toHaveLength(1);
  });
});
