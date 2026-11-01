# Traceworks

## Pitch scripts and slide design

**Event:** From Project to Offering: China Pitch  
**Format:** 5-minute pitch + 3-minute Q&A  
**Presentation:** Template-based slides with presenter-supplied Traceworks screenshots; no video

### Slide index

| Slide | Title | Role |
| --- | --- | --- |
| 1 | [Traceworks](#slide-1--traceworks) | Opening question |
| 2 | [A thousand lines to review](#slide-2--a-thousand-lines-to-review) | Review scenario |
| 3 | [See the app’s workflows](#slide-3--see-the-apps-workflows) | App context |
| 4 | [See which workflows changed](#slide-4--see-which-workflows-changed) | Commit impact |
| 5 | [Follow an affected workflow](#slide-5--follow-an-affected-workflow) | Workflow focus |
| 6 | [See the changed components](#slide-6--see-the-changed-components) | Component changes |
| 7 | [Follow the changed functions](#slide-7--follow-the-changed-functions) | Function changes |
| 8 | [Does express checkout still check stock?](#slide-8--does-express-checkout-still-check-stock) | Review finding |
| 9 | [Who’s buying](#slide-9--whos-buying) | Users and buyers |
| 10 | [Why buy it](#slide-10--why-buy-it) | Value of human review |
| 11 | [Why Thoughtworks](#slide-11--why-thoughtworks) | Thoughtworks positioning |
| 12 | [Research first](#slide-12--research-first) | Research and support request |
| 13 | [Q&A](#slide-13--qa) | Audience discussion |
| 14 | [Thank you](#slide-14--thank-you) | Closing |

### Visual direction

**Use the supplied presentation template for every slide. Keep its existing backgrounds; do not replace, recolor, or cover them with a new full-slide background. Do not invent a new theme.** Follow the template’s layouts, typography, colors, and visual treatments, including its dark teal, coral, and light backgrounds. Use coral to highlight important changes and review questions.

Feel free to add suitable visuals and supporting elements within the template, such as workflow diagrams, product mockups, icons, annotations, and simple charts. Keep these elements consistent with the template and preserve its background and recognizable design.

Build each slide around one clear message and a suitable visual. Avoid large amounts of text, dense paragraphs, and crowded lists. Use short headlines and brief labels; let the spoken script carry the detail. The on-slide copy below is content guidance and may be shortened or split across slides to improve clarity.

Make all audience-facing text clear, visible, and easy to follow: use large type, strong contrast against the existing background, generous spacing, and an obvious reading order. Keep diagrams and mockup labels readable at presentation size. Enlarge or simplify visuals rather than shrinking text to fit.

Slides 2–8 tell one continuous story using the same Commerce app example. **The six Traceworks demo screenshots each have their own slide, in this exact order:**

| Slide | Presenter-supplied screenshot |
| --- | --- |
| 3 | `all_workflows` |
| 4 | `select_commit_highlight_workflows` |
| 5 | `select_affected_workflow` |
| 6 | `changes_components` |
| 7 | `changes_functions` |
| 8 | `changes_function_detail` |

Reserve a large, unobstructed screenshot area on each demo slide within the template. The presenter will insert screenshots later. Leave these areas empty except for the matching filename placeholder; do not create substitute UI mockups or illustrations. Keep screenshot placement consistent across the sequence. No video. Do not combine multiple demo screenshots on one slide.
The slide index is a starting structure. Feel free to add slides or split a dense slide into several slides when that makes the story easier to follow. **Every added slide must also use the supplied template, with its backgrounds preserved.** Keep the full pitch within five minutes and retain the story’s sequence, followed by Q&A and the closing slide.

Slides 1–12 form the five-minute pitch, slide 13 opens Q&A, and slide 14 closes the session. Keep the six demo slides as a quick, continuous walkthrough; the extra slides divide the visual sequence rather than extend the presentation time. Update the numbering if other slides are added.

---

## Slide 1 — Traceworks

### On-slide copy

> **traceworks**
>
> AI writes code fast.  
> **How can people review it efficiently and effectively?**
>
> [Presenter / Team / City]

### Design notes

Use the supplied template’s cover layout and preserve its background, typography, and existing graphic elements. Keep plenty of open space.

Make **traceworks** the primary anchor, with the central question directly beneath it. Break the question into short, readable lines and highlight **efficiently and effectively** in coral only where contrast remains strong.

Keep presenter details secondary but legible. The title and question provide the visual focus; no additional illustration is needed.

### Speaker script

> AI writes code fast. How can people review it efficiently and effectively?
>
> Even with a great coding model, we still need to ask: is this what we wanted? Are we happy with how it’s built?
>
> Now imagine answering those questions across a thousand lines of changes.
>
> That’s where Traceworks comes in. It helps developers see what changed and understand what those changes mean.

---

## Slide 2 — A thousand lines to review

### On-slide copy

> **One commit.  
> 1,000 changed lines.  
> Dozens of files.**
>
> New feature: **Express checkout**
>
> Keep the existing stock checks.
>
> **Where do you start?**

### Design notes

Use an existing template content layout, preserving its background. Give the pull-request illustration most of the content area and place the short feature requirement beside it.

Make **1,000 changed lines** and **Dozens of files** readable at a glance. Suggest the long file list and code diff with simplified rows and diff marks rather than filling the slide with tiny code. Label this as an illustrative pull request; it is not a Traceworks interface.

Keep **Express checkout** and **Keep the existing stock checks** together as one compact requirement. Reveal **Where do you start?** last, in a clear space outside the illustration. Avoid competing headlines or extra explanatory copy.

### Speaker script

> Let’s say our team is working on a commerce app, and we want to add express checkout as a new feature.
>
> Your teammate builds it with AI. You pull down the commit, and there it is: a thousand lines of changes across dozens of files.
>
> So, does it do what we wanted? Does express checkout still check stock the way it should?
>
> You could start opening files and piecing it all together. But that’s a lot to hold in your head.
>
> Where do you start?

---

## Slide 3 — See the app’s workflows

### On-slide copy

> **See the app’s workflows**


### Design notes

**Screenshot: `all_workflows` — one screenshot on this slide.**

Use the supplied template’s content layout and preserve its background and graphic elements. Reserve most of the usable content area (roughly 70–80%, or more where the layout allows) for **[all_workflows]**. Leave this area empty for the presenter to insert the screenshot later; do not recreate the interface or substitute a mockup.

Use the screenshot area to introduce the whole Commerce app map. Keep the entry points and distinct workflow paths visible. Add no separate diagram or extra labels around the map.

Keep the headline and any caption outside the screenshot area. Use one consistent screenshot frame and placement across slides 3–8 wherever practical. Do not combine screenshots or add a text-heavy explanation.

### Speaker script

> Let’s open Traceworks. Here’s the Commerce app, organized by workflow. We can see the different checkout paths alongside the rest of the app.

---

## Slide 4 — See which workflows changed

### On-slide copy

> **See which workflows changed**


### Design notes

**Screenshot: `select_commit_highlight_workflows` — one screenshot on this slide.**

Use the supplied template’s content layout and preserve its background and graphic elements. Reserve most of the usable content area (roughly 70–80%, or more where the layout allows) for **[select_commit_highlight_workflows]**. Leave this area empty for the presenter to insert the screenshot later; do not recreate the interface or substitute a mockup.

The screenshot should show **Add express checkout** selected and the affected workflows highlighted. Keep both the selected commit and workflow highlights visible. Do not crop away the connection between the commit and its impact.

Keep the headline and any caption outside the screenshot area. Use one consistent screenshot frame and placement across slides 3–8 wherever practical. Do not combine screenshots or add a text-heavy explanation.

### Speaker script

> I select “Add express checkout.” Traceworks highlights the workflows this commit touches, so we can see where to focus our review.

---

## Slide 5 — Follow an affected workflow

### On-slide copy

> **Follow an affected workflow**


### Design notes

**Screenshot: `select_affected_workflow` — one screenshot on this slide.**

Use the supplied template’s content layout and preserve its background and graphic elements. Reserve most of the usable content area (roughly 70–80%, or more where the layout allows) for **[select_affected_workflow]**. Leave this area empty for the presenter to insert the screenshot later; do not recreate the interface or substitute a mockup.

The screenshot should show an affected checkout workflow selected and its map in focus. Keep the selected workflow name readable. Use the same screenshot position as the preceding slides so the transition is easy to follow.

Keep the headline and any caption outside the screenshot area. Use one consistent screenshot frame and placement across slides 3–8 wherever practical. Do not combine screenshots or add a text-heavy explanation.

### Speaker script

> Let’s pick an affected checkout workflow. Now we can follow this process without holding the whole app in our heads.

---

## Slide 6 — See the changed components

### On-slide copy

> **See the changed components**


### Design notes

**Screenshot: `changes_components` — one screenshot on this slide.**

Use the supplied template’s content layout and preserve its background and graphic elements. Reserve most of the usable content area (roughly 70–80%, or more where the layout allows) for **[changes_components]**. Leave this area empty for the presenter to insert the screenshot later; do not recreate the interface or substitute a mockup.

The screenshot should show the affected workflow at component level, with changed components and connections visible. Preserve enough surrounding context to see where the changes sit. Let the screenshot’s existing change labels carry the explanation.

Keep the headline and any caption outside the screenshot area. Use one consistent screenshot frame and placement across slides 3–8 wherever practical. Do not combine screenshots or add a text-heavy explanation.

### Speaker script

> At component level, we can see which parts changed and how they connect. Let’s look more closely at the checkout change.

---

## Slide 7 — Follow the changed functions

### On-slide copy

> **Follow the changed functions**


### Design notes

**Screenshot: `changes_functions` — one screenshot on this slide.**

Use the supplied template’s content layout and preserve its background and graphic elements. Reserve most of the usable content area (roughly 70–80%, or more where the layout allows) for **[changes_functions]**. Leave this area empty for the presenter to insert the screenshot later; do not recreate the interface or substitute a mockup.

The screenshot should show function-level detail for the same workflow, with changed functions and calls visible. Keep the relevant function names readable. Preserve visual continuity with the component map; do not add a second screenshot for comparison.

Keep the headline and any caption outside the screenshot area. Use one consistent screenshot frame and placement across slides 3–8 wherever practical. Do not combine screenshots or add a text-heavy explanation.

### Speaker script

> We can move into the functions and follow the changed calls. Here’s the new express checkout path. What does it actually do?

---

## Slide 8 — Does express checkout still check stock?

### On-slide copy

> **Does express checkout still check stock?**

>
> **Could we accept an order for something that’s already sold out?**

### Design notes

**Screenshot: `changes_function_detail` — one screenshot on this slide.**

Use the supplied template’s content layout and preserve its background and graphic elements. Reserve most of the usable content area (roughly 70–80%, or more where the layout allows) for **[changes_function_detail]**. Leave this area empty for the presenter to insert the screenshot later; do not recreate the interface or substitute a mockup.

The screenshot should show the changed function’s expanded Structural analysis window, including both **Before this commit** and **After this commit** columns and their highlighted differences. Give this screenshot the largest practical content area so both columns are readable. Crop out unrelated canvas chrome if needed, keeping the function identity and both comparison headings. Reserve a short caption area outside the screenshot for the review question; reveal it after explaining the difference.

Keep the headline and any caption outside the screenshot area. Use one consistent screenshot frame and placement across slides 3–8 wherever practical. Do not combine screenshots or add a text-heavy explanation.

### Speaker script

> The before-and-after view makes the difference clear. Regular checkout checks stock and reserves the items. Express checkout creates the order directly, skipping that check. Could we accept an order for something that’s already sold out? That’s a focused question to take back to our teammate, without digging through a thousand lines of code.

---

## Slide 9 — Who’s buying

### On-slide copy

> **Users**  
> Developers reviewing AI-generated changes
>
> **Buyers**  
> Technology companies that build software
>
> **First customers**  
> Teams already using AI coding every day

### Design notes

Use an existing template layout with two clear content areas, preserving its background and graphic elements. Label the areas **Users** and **Buyers** and give each one a simple, consistent icon: a developer and a software company.

Use one brief description per area. Place **First customers: teams already using AI coding every day** in a short, readable strip or caption below them, within the template’s content area.

Keep the distinction between user and buyer visually obvious. Company examples are optional; omit them if they crowd the slide. If included, label Tencent, Atlassian, and Canva as **Illustrative examples**, at a readable size, without implying customer relationships.

### Speaker script

> So who’s this for?
>
> The users are developers reviewing AI-generated changes.
>
> The buyers are technology companies that build software. Think companies like Tencent, Atlassian, or Canva, as well as smaller software companies.
>
> We’d start with teams already using AI coding every day, where keeping up with review is becoming a real challenge.

---

## Slide 10 — Why buy it

### On-slide copy

> **AI speeds up coding.  
> Human judgment still matters.**
>
> **Less review effort**  
> Less time untangling changes
>
> **More effective review**  
> More attention on behavior and design
>
> **Greater confidence**  
> Software people understand and have reviewed

### Design notes

Use the template’s existing title and three-part content layout, or the closest available layout, with its background unchanged.

Put **AI speeds up coding. Human judgment still matters.** at the top. Highlight **Human judgment still matters** in coral where readable.

Represent the three benefits with matching simple icons and short labels: less review effort, more effective review, and greater confidence. Use at most one short supporting line per benefit. Keep the sections spacious and equal in visual weight; let the speaker explain the detail. Do not add unsupported metrics or charts.

### Speaker script

> When AI produces code faster than we can review it, it’s tempting to call people the bottleneck and take them out of the loop.
>
> But if we want robust, reliable software that we feel confident delivering, we still need people to understand and judge what we’re building.
>
> Our belief is that human review belongs in the process. We need to make it easier to do well.
>
> That’s where Traceworks helps developers: less time untangling code changes, more attention on whether those changes are right.

---

## Slide 11 — Why Thoughtworks

### On-slide copy

> **Setting the standard for software delivery in the AI era**
>
> Modern technology  
> Strong engineering practices  
> Responsibility for quality
>
> **Traceworks: human review organized around workflows**

### Design notes

Use an existing template content layout and retain its title treatment and background. Keep the headline prominent, with deliberate line breaks so it remains readable.

Show the three strengths as a simple group of matching icons and short labels: modern technology, strong engineering practices, and responsibility for quality. Use coral to emphasize **Responsibility for quality**, with sufficient contrast.

Place **Traceworks: human review organized around workflows** as a brief application of those strengths beneath the group. Avoid extra paragraphs or decorative elements that compete with the message.

### Speaker script

> So why should Thoughtworks build this?
>
> I’ve always seen Thoughtworks as a role model in software engineering. We build modern software, share good practices, and help set the standard for the industry.
>
> I think we should keep doing that in the AI coding era.
>
> When clients come to us, they should know they’re getting the latest technology and the engineering care to back it up.
>
> Traceworks helps our developers review AI-generated code, so clients can trust the software we deliver.
>
> That’s a reason to choose Thoughtworks: we use AI to move faster, and we take responsibility for the quality of what we build.

---

## Slide 12 — Research first

### On-slide copy

> **Validate Traceworks.  
> Explore the future of code review.**
>
> **Research real projects**  
> Review habits, key concerns, and where workflows help
>
> **Share what we learn**  
> Help Thoughtworks lead the way in code review for the AI era
>
> **Support needed**  
> Connections to client project teams  
> Time with developers to explore recent reviews

### Design notes

Use the template’s existing content areas with the background preserved. Give the research direction the main area and make **Support needed** a clearly separated, prominent request beside or below it, using the closest suitable template layout.

Show a simple two-step visual: **Research real projects → Share what we learn**. Pair each step with a consistent icon and no more than one short supporting line. Keep the support request to two readable items: connections to client teams and time with developers.

End with **Keep the speed of AI coding. Keep sight of what you’re building.** as a separate reveal that replaces only the body text and added content, preserving the template background and title treatment. If a separate closing beat is clearer, add a slide using an existing template layout. Do not squeeze the research plan, request, and closing line onto one crowded slide.

Pause on the closing line before moving to Q&A.

### Speaker script

> So what should we do next?
>
> Before we commit to building, let’s talk to developers on existing client projects and look at how they review real changes.
>
> What do they look for? Do they go file by file, or follow a workflow? Where do they find problems? And what about things like configuration or database changes that might sit outside those workflows?
>
> This research is worthwhile even if Traceworks turns out to be the wrong approach. AI is changing how we write software. How should we review it? That’s a question worth exploring either way.
>
> We can share what we learn and help Thoughtworks lead the way in code review for the AI era.
>
> We’d love your help connecting with a few client project teams and setting aside time with their developers to walk through recent code reviews.
>
> Keep the speed of AI coding. Keep sight of what you’re building.

---

## Slide 13 — Q&A

### On-slide copy

> **Q&A**

### Design notes

Use the supplied template’s Q&A layout with its background and graphic elements unchanged. Make **Q&A** the single visual focus, with generous open space; no additional illustration or body text is needed.

Keep demo slides 3–8 ready to revisit if someone asks how the review experience works, especially slide 4 for commit impact and slide 8 for the before-and-after function detail.

### Transition

> Thank you. I’d love to hear your questions.

---

## Slide 14 — Thank you

### On-slide copy

> **traceworks**
>
> Keep the speed of AI coding.  
> Keep sight of what you’re building.
>
> [Presenter / Contact]

### Design notes

Use the supplied template’s closing layout, or reuse its cover layout, preserving that layout’s original background and graphic elements. Do not create a replacement background or closing theme.

Keep **traceworks** and the closing line large, with clear separation and readable line breaks. Place presenter and contact details in the template’s secondary text area, smaller but still legible.

Keep the closing slide uncluttered; the product name and closing message are the visual focus.

### Closing

> Thank you.
