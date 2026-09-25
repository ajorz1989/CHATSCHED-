-- ChatSched Opportunities Engine: targeted publisher notifications
create or replace function public.notify_new_opportunity()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_publisher record;
begin
  for v_publisher in
    select p.user_id
    from public.publishers p
    join public.publisher_subscriptions ps on ps.publisher_id=p.id
    where p.status='approved'
      and p.verified=true
      and ps.status='active'
      and (new.channel_slug is null or p.channel_slug=new.channel_slug)
      and (new.target_province is null or lower(coalesce(p.province,''))=lower(new.target_province))
      and (new.target_city is null or lower(coalesce(p.city,''))=lower(new.target_city))
  loop
    perform public.create_notification(
      v_publisher.user_id,
      'new_opportunity',
      'New opportunity posted',
      format('A business is looking for: %s', new.title),
      '/publisher/opportunities'
    );
  end loop;
  return new;
end;
$$;

revoke execute on function public.notify_new_opportunity() from public,anon,authenticated;
notify pgrst,'reload schema';