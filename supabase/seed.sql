-- CHỈ chạy trên database local/test rỗng. Tài khoản fixture không có password/hash.
-- Dùng Admin Auth API để tạo tài khoản có thể đăng nhập khi chạy live test.
begin;
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values
  ('11111111-1111-4111-8111-111111111111','authenticated','authenticated','hr-a@example.test',now(),'{"provider":"email","providers":["email"]}','{"display_name":"Nhà tuyển dụng A"}'),
  ('22222222-2222-4222-8222-222222222222','authenticated','authenticated','candidate-b@example.test',now(),'{"provider":"email","providers":["email"]}','{"display_name":"Ứng viên B"}')
on conflict (id) do nothing;
update public.users set preferred_mode = 'HR' where id = '11111111-1111-4111-8111-111111111111';
commit;
