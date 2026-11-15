# Stage 5: Views

## Goal

Every view checked at tablet and phone size, with gaps fixed in shared pieces rather than in the view.

## Checklist

- [ ] Views declare which forms they support (a field on `MainView`); the nav and the router ask the view. A view that doesn't support the current form is left out of the nav and opening it shows a plain notice. No view ids in generic code.
- [ ] Tablet pass over every view; fixes go into shared pieces. Then a phone pass.
- [ ] Chat: composer stays above the keyboard; message list, code blocks and pictures fit the width and scroll inside themselves.
- [ ] Data, Files, Dashboards, Composer, Agents, Tools, Models, Speed, llama-server, Kinds, Settings: each ticked separately once it works on both forms.
- [ ] Play: decided per form once checked (the encounter stacks and tile map need room; tablet likely, phone possibly read-only). Decision recorded here.
- [ ] Remove anything left over that a shared component now covers.
- [ ] Tick `docs/remote-access/10-layout.md` with a pointer to this folder.

## Problems and how they are solved

- **Some views are huge on a phone.** Shared components break them into pages and sheets; the view itself doesn't change. **Solved.**
- **Game views needing space.** Supported per form by declaration, not hidden by width. **Partly solved** (Play's phone form decided during this stage).
