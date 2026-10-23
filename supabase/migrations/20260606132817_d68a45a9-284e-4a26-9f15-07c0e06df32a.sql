CREATE OR REPLACE FUNCTION public.guard_message_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.media_url IS DISTINCT FROM OLD.media_url
    OR NEW.media_type IS DISTINCT FROM OLD.media_type
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
    OR NEW.reply_snippet IS DISTINCT FROM OLD.reply_snippet
  THEN
    RAISE EXCEPTION 'Only message read and delivery status can be updated';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_message_status_update_trigger ON public.messages;
CREATE TRIGGER guard_message_status_update_trigger
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.guard_message_status_update();