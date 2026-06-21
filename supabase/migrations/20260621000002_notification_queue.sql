-- ============================================================================
-- Phase 5 / Migration 12 - transactional notification queue
-- ============================================================================
-- Queues email/in-app notification records from order_status_history. A Resend
-- Edge Function can safely consume notifications where channel = 'email' and
-- status = 'queued' without coupling provider failures to checkout.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_order_status_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_template text;
  v_payload jsonb;
BEGIN
  SELECT * INTO v_order
    FROM public.orders
   WHERE id = NEW.order_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_template := CASE
    WHEN NEW.from_status IS NULL AND NEW.to_status = 'pending_confirmation' THEN 'order_confirmed'
    ELSE 'order_status_' || NEW.to_status
  END;

  v_payload := jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'status', NEW.to_status,
    'previous_status', NEW.from_status,
    'customer_name', v_order.customer_name,
    'customer_email', v_order.customer_email,
    'customer_phone', v_order.customer_phone,
    'total_minor', v_order.total_minor,
    'currency', v_order.currency,
    'delivery_slot_date', v_order.delivery_slot_date,
    'delivery_slot_window', v_order.delivery_slot_window,
    'reason', NEW.reason
  );

  IF v_order.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      order_id, user_id, audience, channel, template_key, payload, status
    ) VALUES (
      v_order.id, v_order.user_id, 'user', 'email', v_template, v_payload, 'queued'
    );
  END IF;

  IF NEW.from_status IS NULL AND NEW.to_status = 'pending_confirmation' THEN
    INSERT INTO public.notifications (
      order_id, user_id, audience, channel, template_key, payload, status
    ) VALUES (
      v_order.id, NULL, 'admin', 'in_app', 'new_order', v_payload, 'queued'
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS order_status_history_enqueue_notification ON public.order_status_history;
CREATE TRIGGER order_status_history_enqueue_notification
AFTER INSERT ON public.order_status_history
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_order_status_notification();

COMMENT ON FUNCTION public.enqueue_order_status_notification() IS
  'Queues transactional notification rows for order confirmation and status changes. External provider delivery is intentionally asynchronous.';
