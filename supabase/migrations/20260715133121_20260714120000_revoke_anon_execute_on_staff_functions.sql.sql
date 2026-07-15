/*
# Security: revoke anon EXECUTE on staff functions

1. create_staff_account — only authenticated owners create staff (via edge function)
2. get_my_staff — only authenticated owners list their staff
3. get_staff_invite_by_token — only authenticated users need it
   (keep anon on accept_staff_invite — invite flow needs it before login)

Also verified:
- staff_invites has no anon SELECT policy (removed yesterday, confirmed still gone)
- accept_staff_invite validates token strictly (accepted=false, expires_at > now())
- markup_settings, product_templates, orders, order_products SELECT policies
  use user_id = auth.uid() only — staff querying directly get zero rows
- pos_settings SELECT allows staff via get_owner_id_for_user (intentional —
  staff need store name for POS integration; no cost/markup data in that table)
*/

-- 1. Revoke anon EXECUTE on create_staff_account
REVOKE EXECUTE ON FUNCTION create_staff_account(text, text, text, uuid) FROM anon;

-- 2. Revoke anon EXECUTE on get_my_staff
REVOKE EXECUTE ON FUNCTION get_my_staff() FROM anon;

-- 3. Revoke anon EXECUTE on get_staff_invite_by_token
REVOKE EXECUTE ON FUNCTION get_staff_invite_by_token(text) FROM anon;

-- 4. Keep anon EXECUTE on accept_staff_invite — invite flow needs it.
--    Function already validates: token must match, accepted=false, expires_at > now().
--    No changes needed.
