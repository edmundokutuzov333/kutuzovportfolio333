-- Phase 3: editable public navigation and footer copy.
-- Additive and safe to re-run. Existing values are preserved if an administrator has already edited them.

insert into public.site_settings (setting_key, setting_value, is_public)
values
(
  'navigation',
  '[
    {"to":"/","label":"Home"},
    {"to":"/work","label":"Work"},
    {"to":"/about","label":"About"},
    {"to":"/services","label":"Services"},
    {"to":"/process","label":"Process"},
    {"to":"/clients","label":"Clients"},
    {"to":"/contact","label":"Contact"}
  ]'::jsonb,
  true
),
(
  'footer',
  '{
    "next_move_label":"Next move",
    "cta_label":"Let''s talk.",
    "cta_path":"/contact",
    "cta_description":"Let''s build a visual presence impossible to ignore.",
    "contact_label":"Contact",
    "social_label":"Social",
    "newsletter_label":"Newsletter: new work and availability",
    "newsletter_status":"Newsletter subscription is currently unavailable while secure email confirmation is being configured.",
    "signature":"Design is how it works."
  }'::jsonb,
  true
),
(
  'presentation',
  '{
    "availability_label":"Maputo · Available for projects",
    "open_menu_label":"Menu",
    "close_menu_label":"Close",
    "replay_intro_label":"Replay intro"
  }'::jsonb,
  true
)
on conflict (setting_key) do nothing;
