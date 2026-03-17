# Frontend Conventions

## Component file structure

Every Angular component must be split into three separate files:

- `<name>.component.ts` — class, decorator metadata, imports
- `<name>.component.html` — template (use `templateUrl`)
- `<name>.component.css` — styles (use `styleUrl`)

Never use inline `template` or `styles` / `styleUrls` arrays in the `@Component` decorator.

## Global styles

All shared styles (buttons, cards, badges, utilities, layout) live in `src/styles.css`.
Component CSS files are for styles that are truly specific to that one component only.
Do not add shared/utility styles to a component's own CSS file.
