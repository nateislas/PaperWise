# PaperWise Design Style Guide

This guide outlines the "Soft Modern" design system used in the PaperWise application. All new components and features should adhere to these standards to maintain a premium, cohesive, and accessible user experience.

---

## 🎨 Color Palette

We use a sophisticated palette based on **Indigo** for primary actions and **Slate** for neutral structural elements.

### Primary (Indigo)
- **Brand / Action:** `primary-600` (#2551db)
- **Hover:** `primary-700` (#1f44b7)
- **Light Accents:** `primary-50` (#f5f7ff)
- **Contrast Requirement:** Always ensure white text on `primary-600` for WCAG AA compliance.

### Neutrals (Slate)
- **Headings:** `slate-900` (#0f172a)
- **Body Text:** `slate-600` (#475569)
- **Secondary Text:** `slate-400` (#94a3b8)
- **Background:** `slate-50/50` (#f8fafc with transparency)
- **Borders:** `slate-100` or `slate-200/50`

---

## ✨ Aesthetic Principles ("Soft Modern")

### 1. Glassmorphism
Use for persistent headers and floating panels to provide depth.
- **Utility:** `.glass-panel`
- **Properties:** `bg-white/70`, `backdrop-blur-md`, `border-white/20`, `shadow-glass`.

### 2. Diffusion Shadows
Avoid harsh borders; use soft, spreading shadows for elevation.
- **Base Card:** `shadow-soft`
- **Hover/Interactive:** `shadow-soft-lg`

### 3. Rounded Geometry
Large border radii provide a friendly, modern feel.
- **Standard Cards:** `rounded-2xl` (1.5rem)
- **Hero/Major Sections:** `rounded-3xl` (2rem)
- **Buttons/Inputs:** `rounded-xl` (1rem)

---

## 🔡 Typography

- **Font Family:** [Inter](https://fonts.google.com/specimen/Inter)
- **Headings:** `font-extrabold`, `tracking-tight`, `text-slate-900`.
- **Body:** `font-medium`, `leading-relaxed`, `text-slate-600`.
- **Labels:** `font-bold`, `uppercase`, `tracking-widest`, `text-[10px]`.

---

## ♿ Accessibility (WCAG Level AA)

All components must remain inclusive:

1. **Semantic HTML:** Use `<main>`, `<nav>`, `<section>`, `<header>`, and `<article>` correctly.
2. **ARIA Labels:** Every icon-only button **must** have an `aria-label`. Use `aria-expanded` for toggles.
3. **Live Regions:** Use `aria-live="polite"` for dynamic content like upload progress or streaming AI results.
4. **Focus States:** Every interactive element must use the `.focus-ring` utility.
5. **Form Labels:** Every `<input>` must have an associated `<label>`. Use `.sr-only` if the label should be visually hidden.

---

## 🛠️ Utility Classes (Reference)

| Class | Purpose |
|-------|---------|
| `.glass-panel` | Transparent blurred background for navs/headers. |
| `.focus-ring` | Standardized, accessible keyboard focus state. |
| `.shadow-soft` | Default elevation for cards. |
| `.animate-fade-in` | Subtle entrance for text/headers. |
| `.animate-slide-up` | Entrance for cards/containers. |
| `.custom-scrollbar` | Slim, Slate-themed scrollbars for panels. |
| `shadow-sm` | Subtle elevation for secondary elements. |
