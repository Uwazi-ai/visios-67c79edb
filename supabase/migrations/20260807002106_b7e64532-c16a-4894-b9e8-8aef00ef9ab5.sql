GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mail_category_rules TO authenticated;
GRANT ALL ON public.mail_messages TO service_role;
GRANT ALL ON public.mail_accounts TO service_role;
GRANT ALL ON public.mail_category_rules TO service_role;