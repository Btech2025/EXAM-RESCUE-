<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Keep Rescue Mode calculations in the browser-safe pure `src/lib/rescue.ts` module, separate from the regular planner; this permits deterministic tests without changing saved planner tasks.
- Keep syllabus parsing, evidence ranking, and additive preparation scheduling in the pure intelligence module; this preserves existing planner calculations and enables deterministic evidence tests.
- Read PDF text only through an event-triggered browser import; keep original private files off public asset hosting and retain only reviewed syllabus/evidence in the existing local store.
- PYQ web search remains explicitly unavailable until a supported search connector is linked; never substitute demo results for live research.
