CREATE TABLE public.vision_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  active_persona TEXT NOT NULL DEFAULT 'cos',
  active_org_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vision_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VisionConv: self read" ON public.vision_conversations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "VisionConv: self insert" ON public.vision_conversations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "VisionConv: self update" ON public.vision_conversations
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "VisionConv: self delete" ON public.vision_conversations
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_vision_conversations_updated_at
  BEFORE UPDATE ON public.vision_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vision_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.vision_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  persona TEXT,
  feedback TEXT CHECK (feedback IN ('positive','negative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vision_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VisionMsg: self read" ON public.vision_messages
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "VisionMsg: self insert" ON public.vision_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "VisionMsg: self update" ON public.vision_messages
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "VisionMsg: self delete" ON public.vision_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX vision_messages_conv_idx ON public.vision_messages(conversation_id, created_at);
CREATE INDEX vision_conversations_user_updated_idx ON public.vision_conversations(user_id, updated_at DESC);