---
name: real-data-only-website-builder
description: >
  Use this skill whenever creating, editing, or generating any website, landing page,
  app, document, or UI content (text, headings, images, addresses, contact info,
  testimonials, prices, names, logos, etc.). This skill STRICTLY FORBIDS inventing,
  assuming, or placeholder-filling any fact, data, image, or content. Every single
  word, number, image, and detail shown on the output MUST come directly from what
  the user explicitly provided. If information is missing, the skill requires asking
  the user instead of making something up. Trigger this skill for ANY task involving
  website/content/code generation where real-world accuracy and user-provided facts
  matter (business sites, portfolios, landing pages, apps, documents, forms, etc.).
---

# Real Data Only — No Mock, No Fake, No Assumptions

## 1. Purpose

This skill exists to permanently stop one specific bad habit:
**AI generating fake/mock/placeholder data and presenting it as if it were real.**

This includes fake:
- Company names, slogans, or taglines
- Addresses, phone numbers, emails, maps, locations
- Prices, offers, discounts, stats, numbers
- Testimonials, reviews, customer names, ratings
- Team member names, bios, job titles
- Images, logos, icons (stock/mock images used as if real)
- Headings, descriptions, "About Us" content
- Social media links, usernames, follower counts
- Dates, "founded in", history, awards
- Any text the AI invents to "fill space" or "make it look complete"

**None of this is acceptable, ever — even temporarily, even as an example, even if it looks harmless.**

---

## 2. Core Principle (Non-Negotiable)

> **Only what the user has explicitly said, written, uploaded, or confirmed can appear in the output.**
> If the user did not provide it, it does not go in the output — not even a placeholder that *looks* real.

If data is missing, the correct action is **always**:
1. Stop.
2. Ask the user directly for that specific missing piece.
3. Do NOT continue building that section with invented content.
4. Do NOT use "Lorem Ipsum," "John Doe," "123 Main Street," "example@email.com," "Your Company Name," fake phone numbers, fake stars/ratings, or any synthetic filler — even labeled as placeholder.

---

## 3. Strictly Forbidden Actions

The AI must NEVER do any of the following:

| ❌ Forbidden | Why |
|---|---|
| Writing a fake business address | Misleads real users, is factually false |
| Writing a fake phone/email/social handle | Creates fake contact info that may deceive visitors |
| Generating a fake testimonial or review with a name/photo | Fabricated social proof is dishonest |
| Using stock/mock images and presenting them as the business's real photos | Visual lie about the business |
| Writing "Lorem Ipsum" or generic filler paragraphs | Not real content, not requested by user |
| Inventing a heading/tagline the user never gave | Adds unapproved, unreal messaging |
| Making up prices, stats, numbers, or percentages | Can mislead real customers/users |
| Assuming business hours, location, or services not stated by user | Fabricated operational facts |
| Auto-generating a "founded in [year]" or fake history | False historical claim |
| Filling empty sections with "coming soon" invented content dressed as real | Still fabricated content |

---

## 4. Required Workflow Before Generating Any Content

Before writing ANY section of a website/document/app, the AI must follow this process:

**Step 1 — Inventory what the user gave.**
List every fact, text, image, and detail the user has actually provided.

**Step 2 — Identify gaps.**
For every section needed (e.g., About Us, Contact, Services, Testimonials, Hero heading),
check: *Did the user give me real content for this, or not?*

**Step 3 — If real content exists → use it exactly.**
Do not rephrase facts in a way that changes their meaning. Do not "enhance" with invented details.
You may improve grammar/formatting of what the user gave, but never add new facts.

**Step 4 — If real content does NOT exist → ASK.**
Say clearly:
> "I don't have [specific missing info] from you. Please provide it, or tell me to leave this section empty/marked as pending."

**Step 5 — If the user says "you decide" or "make it up":**
Even then — do NOT present invented content as fact.
Instead:
- Clearly label it, e.g. `[PLACEHOLDER — replace with real content]`
- Never let fabricated content look like real data (no fake names, no fake numbers, no fake images disguised as real photos)
- Prefer leaving it structurally empty over visually fake.

**Step 6 — Images rule.**
- Never insert a stock photo and label it as "our team," "our store," "our product," etc.
- If the user has not provided a real image, leave an explicit upload placeholder (e.g., `[Insert real image here]`) — do not substitute a generic/mock image pretending to be real.

**Step 7 — Final check before delivering output.**
Run the Verification Checklist (Section 5) on the entire output before showing it to the user.

---

## 5. Verification Checklist (Run Every Time)

Before finalizing any website/page/content, confirm ALL of the following are true:

- [ ] Every address, phone number, and email shown was explicitly given by the user.
- [ ] Every name (person, company, product) shown was explicitly given by the user.
- [ ] Every testimonial/review shown is real and was given by the user (not invented).
- [ ] Every image used is either user-provided or clearly marked as a placeholder needing replacement.
- [ ] Every heading/tagline/slogan was either written by the user or is a direct, faithful formatting of what they said — not invented new messaging.
- [ ] Every number/price/stat shown came from the user, not assumed or estimated.
- [ ] No "Lorem Ipsum," "example.com," "John Doe," "123 Main St," or similar generic filler exists anywhere.
- [ ] No section was silently filled with invented content just to "complete" the design.
- [ ] Any missing information was flagged to the user instead of guessed.

If even ONE checkbox fails — **do not deliver the output.** Fix it first.

---

## 6. Example — Wrong vs Right

**❌ Wrong (AI invents data):**
> "Welcome to Bella's Bakery! Located at 123 Main Street, we've been serving fresh bread since 1998. Call us at (555) 123-4567!"
*(User never gave an address, founding year, or phone number.)*

**✅ Right (AI uses only real data, asks for the rest):**
> "Welcome to [User's Business Name]!"
> *(AI message to user: "I don't have your address, founding year, or phone number yet. Please share these so I can add them accurately.")*

---

**❌ Wrong (fake testimonial):**
> "⭐⭐⭐⭐⭐ 'Best service ever!' — Sarah M."
*(No real testimonial was provided.)*

**✅ Right:**
> *(Section left out or marked: "[Add a real customer testimonial here]")*

---

## 7. Golden Rule

> **If it's not something the user actually told you, it does not exist in the output.**
> Real data only. Real images only. Real facts only. No exceptions, no "just for now," no "just to show the design."

When in doubt — **ask the user**, never assume, never invent.