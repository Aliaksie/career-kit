# Presentation and consumer templates

Build and tailor use the same disclosed, selected content model. CV and GitHub have separate Markdown templates; PDF uses the CV HTML template. The bundled templates group skills, nest detailed assignments under employers, compact other assignments, summarize delivered open-source work and select a bounded number of credentials.

## Consumer-owned templates

Copy the package's `templates/` directory into your consumer repository, for example `presentation/`. Edit the three files and pass the explicit directory from the caller's working directory:

```sh
career build --profile profile/profile.yaml --templates presentation --output generated/generic
career tailor --profile profile/profile.yaml --job jobs/example.json --templates presentation --output generated/job
```

A pack contains `cv.html.njk`, `cv.md.njk`, and `github.md.njk`; all three are required, including for tailoring. Without `--templates`, the engine uses its bundled pack. Missing files and template errors fail before output publication. Templates ship in the installed package; no sibling source checkout is needed. An existing consumer must upgrade its engine pin before using these options or new profile fields.

Templates are trusted local Nunjucks source, not a sandbox for third-party code. Includes/imports have no loader. Keep styles inline and use system fonts. PDF disables JavaScript and blocks network and local-file requests. Review consumer templates before opening generated HTML. The engine never loads private evidence or contact sidecars.

## View contract, version 1

Nunjucks receives `view` with these fields. Text-bearing fields are opaque content tokens, not raw profile objects. Emit them unchanged; do not slice, replace, escape, or case-convert tokens. The engine substitutes escaped Markdown or HTML only after layout rendering. Links are encoded by the engine. Do not put tokens in HTML attributes, script/style blocks, or Markdown destinations; use them in text positions. Static headings, CSS and layout markup belong in the template.

| Field | Shape |
| --- | --- |
| `version` | `1` |
| `person` | `name`, `headline`, optional `summary`, `contacts[]` |
| `skills[]` | `label`, `items[]` |
| `experiences[]` | `organization`, `title`, `dates`, `projects[]`, `earlier[]` |
| `projects[]` | Featured independent work; each has `name`, `description`, `bullets[]` |
| `experiences[].projects[]` | Detailed assignments with the same project shape |
| `experiences[].earlier[]` | Compact assignments with `name`, no description or bullets |
| `openSource[]` | `name` (repository link in v2), optional `description`, optional `summary` |
| `education[]`, `certifications[]` | Content tokens |

For example, a minimal CV Markdown template is:

```njk
# {{ view.person.name }}

{{ view.person.headline }}
{% for role in view.experiences %}
## {{ role.organization }} | {{ role.dates }}
{% for project in role.projects %}
### {{ project.name }}
{% for bullet in project.bullets %}
- {{ bullet }}
{% endfor %}{% endfor %}{% endfor %}
```

Each artifact's provenance lists only tokens emitted in that format. Reordering, repeating or conditionally omitting tokens does not add claims for omitted facts. HTML/PDF and Markdown can therefore have different claim inventories. At least one content token must be emitted. Literal content authored in a template is not fact-checked or assigned source provenance; use templates for presentation, and keep career claims in the profile. Bundle digests cover the resulting bytes, including template-authored content. Matching reports describe engine selection before any custom template omissions; use `explain` to inspect actual emitted claims.

## Content budgets and grouping

Skills accept an optional `group` label. Ungrouped skills appear as “Technical skills.” Skills referenced by selected achievements come first, with source order breaking ties. Disclosure happens before any presentation choices.

Both profile versions accept optional `presentation.cv` and `presentation.github`:

```yaml
presentation:
  cv:
    maxSkills: 24
    maxProjects: 3
    maxBulletsPerProject: 2
    maxCertifications: 6
    certificationIds: [architecture-course, database-course]
  github:
    maxSkills: 12
    maxProjects: 3
    maxBulletsPerProject: 2
    maxCertifications: 0
```

Defaults are CV: 24 skills, 4 detailed projects, 3 bullets per project and 6 credentials; GitHub: 12 skills, 3 projects, 2 bullets per project and no credentials. Zero suppresses the corresponding content. `certificationIds` is an optional ordered selection of existing credential IDs, still subject to disclosure and the count limit. It does not grant visibility. Skill/project/certificate limits are deterministic content budgets, not a guaranteed PDF page count.

Project/bullet budgets apply during achievement selection as well as rendering, so ordinary tailoring reports do not select achievements that the default layout silently drops. Target priorities, maximum achievements and per-experience limits still apply. The full disclosed inventory remains available to audits; presentation limits do not delete source records. Assignment dates and promotion intervals are not inferred.

V2 open-source repository summaries include merged PRs, completed documentation/other work, and active/former maintainer work. Open/closed issues, open/closed-unmerged PRs and proposals remain in the records but are not displayed as delivered contributions. Status labels and individual PR links are omitted from the default presentation. Own repositories show their project description; upstream repositories show contribution summaries. The default GitHub layout shows public repositories once, falling back to career-project work when no open-source repositories are disclosed. V1 contributions retain legacy descriptions and source attribution because they have no typed delivery status.
