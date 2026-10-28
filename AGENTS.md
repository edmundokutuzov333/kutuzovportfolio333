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

## Project rules
- All site copy and placeholder data live in `src/lib/content.ts`; set `cover`/`logo` fields there to swap in official art — keeps pages free of hardcoded content.
- The 3D logo (`Logo3DScene`) is lazy-loaded behind `ClientOnly`; never import three/fiber from SSR code — WebGL can't run on the server.
- Brief form rules live in `src/lib/brief.ts` with tests in `src/test/brief.test.ts`.
