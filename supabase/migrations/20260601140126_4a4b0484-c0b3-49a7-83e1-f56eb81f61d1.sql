ALTER TABLE public.chat_settings ADD COLUMN IF NOT EXISTS font_scale numeric NOT NULL DEFAULT 1.0;
ALTER TABLE public.chat_settings ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'auto';