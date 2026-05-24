-- ShopQR 0017: store member phone numbers
-- Run AFTER 0016.
--
-- Adds an optional `phone` column on restaurant_members so the owner /
-- platform admin can contact each member by phone. Captured at signup
-- via the auth metadata field `phone`.

alter table public.restaurant_members
  add column if not exists phone text;

-- Update signup trigger to copy phone from raw_user_meta_data into the
-- new restaurant_members row (both owner self-signup and invite flow).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  invite_token text;
  invite_row public.restaurant_invites%rowtype;
  new_restaurant_id uuid;
  phone_val text;
begin
  invite_token := nullif(new.raw_user_meta_data->>'invite_token', '');
  phone_val := nullif(new.raw_user_meta_data->>'phone', '');

  if invite_token is not null then
    select * into invite_row
    from public.restaurant_invites
    where token = invite_token
    limit 1;

    if invite_row.id is null then
      raise exception 'INVITE_NOT_FOUND';
    end if;
    if invite_row.used_at is not null then
      raise exception 'INVITE_ALREADY_USED';
    end if;
    if invite_row.revoked_at is not null then
      raise exception 'INVITE_REVOKED';
    end if;

    insert into public.restaurant_members
      (restaurant_id, user_id, role, invited_email, phone)
    values
      (invite_row.restaurant_id, new.id, invite_row.role, new.email, phone_val)
    on conflict (restaurant_id, user_id) do nothing;

    update public.restaurant_invites
    set used_by = new.id, used_at = now()
    where id = invite_row.id;

    return new;
  end if;

  insert into public.restaurants (user_id, name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'restaurant_name', ''), 'My Restaurant')
  )
  returning id into new_restaurant_id;

  insert into public.restaurant_members
    (restaurant_id, user_id, role, invited_email, phone)
  values
    (new_restaurant_id, new.id, 'owner', new.email, phone_val);

  return new;
end;
$$;

notify pgrst, 'reload schema';
