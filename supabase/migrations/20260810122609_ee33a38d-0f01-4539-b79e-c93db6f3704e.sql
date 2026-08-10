-- ============ SHARED / COMMUNITY TABLES ============
CREATE TABLE public.sabi_price_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  item text NOT NULL,
  category text NOT NULL DEFAULT 'food',
  unit text NOT NULL DEFAULT 'unit',
  price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  vendor text,
  area text,
  city text NOT NULL DEFAULT 'Lagos',
  country text NOT NULL DEFAULT 'Nigeria',
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sabi_price_reports TO authenticated;
GRANT ALL ON public.sabi_price_reports TO service_role;
ALTER TABLE public.sabi_price_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price reports readable by signed in users" ON public.sabi_price_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "users add their own price reports" ON public.sabi_price_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sabi_med_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  drug text NOT NULL,
  form text NOT NULL DEFAULT 'tablet',
  pack_size text,
  pharmacy text NOT NULL,
  price numeric NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  in_stock boolean NOT NULL DEFAULT true,
  area text,
  city text NOT NULL DEFAULT 'Lagos',
  country text NOT NULL DEFAULT 'Nigeria',
  phone text,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sabi_med_prices TO authenticated;
GRANT ALL ON public.sabi_med_prices TO service_role;
ALTER TABLE public.sabi_med_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "med prices readable by signed in users" ON public.sabi_med_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "users add their own med prices" ON public.sabi_med_prices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sabi_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'pharmacy',
  area text,
  city text NOT NULL DEFAULT 'Lagos',
  country text NOT NULL DEFAULT 'Nigeria',
  phone text,
  hours text,
  open_24h boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sabi_facilities TO authenticated;
GRANT ALL ON public.sabi_facilities TO service_role;
ALTER TABLE public.sabi_facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facilities readable by signed in users" ON public.sabi_facilities FOR SELECT TO authenticated USING (true);

CREATE TABLE public.sabi_gigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  pay_amount numeric NOT NULL,
  pay_unit text NOT NULL DEFAULT 'day',
  currency text NOT NULL DEFAULT 'NGN',
  location text,
  city text NOT NULL DEFAULT 'Lagos',
  country text NOT NULL DEFAULT 'Nigeria',
  remote boolean NOT NULL DEFAULT false,
  skill_level text NOT NULL DEFAULT 'entry',
  contact text,
  source text,
  posted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sabi_gigs TO authenticated;
GRANT ALL ON public.sabi_gigs TO service_role;
ALTER TABLE public.sabi_gigs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gigs readable by signed in users" ON public.sabi_gigs FOR SELECT TO authenticated USING (true);

-- ============ PRIVATE TABLES ============
CREATE TABLE public.sabi_income_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT current_date,
  source text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  hours numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sabi_income_logs TO authenticated;
GRANT ALL ON public.sabi_income_logs TO service_role;
ALTER TABLE public.sabi_income_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own income logs" ON public.sabi_income_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sabi_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'medicine',
  dose text,
  times_per_day integer NOT NULL DEFAULT 1,
  next_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sabi_reminders TO authenticated;
GRANT ALL ON public.sabi_reminders TO service_role;
ALTER TABLE public.sabi_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reminders" ON public.sabi_reminders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sabi_shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unit',
  cost_price numeric NOT NULL DEFAULT 0,
  sell_price numeric NOT NULL DEFAULT 0,
  stock numeric NOT NULL DEFAULT 0,
  low_stock_at numeric NOT NULL DEFAULT 5,
  currency text NOT NULL DEFAULT 'NGN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sabi_shop_products TO authenticated;
GRANT ALL ON public.sabi_shop_products TO service_role;
ALTER TABLE public.sabi_shop_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own shop products" ON public.sabi_shop_products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_sabi_products_updated BEFORE UPDATE ON public.sabi_shop_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sabi_shop_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  product_id uuid REFERENCES public.sabi_shop_products ON DELETE SET NULL,
  product_name text NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sabi_shop_sales TO authenticated;
GRANT ALL ON public.sabi_shop_sales TO service_role;
ALTER TABLE public.sabi_shop_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own shop sales" ON public.sabi_shop_sales FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sabi_debtors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  due_date date,
  settled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sabi_debtors TO authenticated;
GRANT ALL ON public.sabi_debtors TO service_role;
ALTER TABLE public.sabi_debtors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own debtors" ON public.sabi_debtors FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sabi_saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  item text NOT NULL,
  city text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sabi_saved_items TO authenticated;
GRANT ALL ON public.sabi_saved_items TO service_role;
ALTER TABLE public.sabi_saved_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved items" ON public.sabi_saved_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_sabi_price_item ON public.sabi_price_reports (lower(item), city, observed_at DESC);
CREATE INDEX idx_sabi_med_drug ON public.sabi_med_prices (lower(drug), city, observed_at DESC);
CREATE INDEX idx_sabi_sales_user ON public.sabi_shop_sales (user_id, sold_at DESC);

-- ============ SEED SHARED DATA ============
INSERT INTO public.sabi_price_reports (item, category, unit, price, currency, vendor, area, city, country, observed_at) VALUES
('Rice (local)','food','50kg bag',78000,'NGN','Mile 12 Market','Ketu','Lagos','Nigeria', now() - interval '6 hours'),
('Rice (local)','food','50kg bag',82500,'NGN','Shoprite','Ikeja','Lagos','Nigeria', now() - interval '1 day'),
('Rice (local)','food','50kg bag',74000,'NGN','Dawanau Market','Dawanau','Kano','Nigeria', now() - interval '2 days'),
('Rice (local)','food','50kg bag',80000,'NGN','Wuse Market','Wuse','Abuja','Nigeria', now() - interval '10 hours'),
('Garri (white)','food','painter (4L)',2100,'NGN','Oyingbo Market','Ebute Metta','Lagos','Nigeria', now() - interval '3 hours'),
('Garri (white)','food','painter (4L)',2450,'NGN','Neighbourhood shop','Surulere','Lagos','Nigeria', now() - interval '8 hours'),
('Tomatoes','food','basket',35000,'NGN','Mile 12 Market','Ketu','Lagos','Nigeria', now() - interval '5 hours'),
('Tomatoes','food','basket',28000,'NGN','Mararaba Market','Mararaba','Abuja','Nigeria', now() - interval '1 day'),
('Cooking gas','energy','12.5kg refill',14500,'NGN','NIPCO','Yaba','Lagos','Nigeria', now() - interval '4 hours'),
('Cooking gas','energy','12.5kg refill',13800,'NGN','Local depot','Agege','Lagos','Nigeria', now() - interval '20 hours'),
('Petrol (PMS)','energy','litre',915,'NGN','NNPC Retail','Ikorodu Rd','Lagos','Nigeria', now() - interval '2 hours'),
('Petrol (PMS)','energy','litre',965,'NGN','Independent station','Lekki','Lagos','Nigeria', now() - interval '2 hours'),
('Bus fare Ikeja-CMS','transport','trip',1200,'NGN','Danfo','Ikeja','Lagos','Nigeria', now() - interval '1 hour'),
('Bus fare Ikeja-CMS','transport','trip',850,'NGN','BRT','Ikeja','Lagos','Nigeria', now() - interval '1 hour'),
('1GB data bundle','data','1GB / 1 day',350,'NGN','MTN','Nationwide','Lagos','Nigeria', now() - interval '12 hours'),
('1GB data bundle','data','1GB / 1 day',300,'NGN','Airtel','Nationwide','Lagos','Nigeria', now() - interval '12 hours'),
('Self-contain rent','rent','per year',900000,'NGN','Agent listing','Yaba','Lagos','Nigeria', now() - interval '3 days'),
('Self-contain rent','rent','per year',450000,'NGN','Agent listing','Ikorodu','Lagos','Nigeria', now() - interval '3 days'),
('Maize','food','90kg bag',5200,'KES','Wakulima Market','Ngara','Nairobi','Kenya', now() - interval '1 day'),
('Cooking gas','energy','6kg refill',1450,'KES','Total','Westlands','Nairobi','Kenya', now() - interval '1 day'),
('Rice (imported)','food','5kg bag',95,'GHS','Makola Market','Accra Central','Accra','Ghana', now() - interval '1 day'),
('Eggs','food','dozen',4.29,'USD','Walmart','Midtown','Houston','United States', now() - interval '1 day'),
('Eggs','food','dozen',5.99,'USD','Corner grocery','Midtown','Houston','United States', now() - interval '1 day'),
('Petrol','energy','gallon',3.19,'USD','Costco','Katy','Houston','United States', now() - interval '6 hours');

INSERT INTO public.sabi_med_prices (drug, form, pack_size, pharmacy, price, currency, in_stock, area, city, country, phone, observed_at) VALUES
('Paracetamol','tablet','20 tabs','HealthPlus',900,'NGN',true,'Ikeja','Lagos','Nigeria','+234 800 000 0001', now() - interval '5 hours'),
('Paracetamol','tablet','20 tabs','Medplus',750,'NGN',true,'Surulere','Lagos','Nigeria','+234 800 000 0002', now() - interval '1 day'),
('Paracetamol','tablet','20 tabs','Community chemist',600,'NGN',true,'Mushin','Lagos','Nigeria',NULL, now() - interval '2 days'),
('Amoxicillin 500mg','capsule','21 caps','HealthPlus',4200,'NGN',true,'Ikeja','Lagos','Nigeria','+234 800 000 0001', now() - interval '6 hours'),
('Amoxicillin 500mg','capsule','21 caps','Alpha Pharmacy',3400,'NGN',false,'Yaba','Lagos','Nigeria',NULL, now() - interval '1 day'),
('Coartem (ACT)','tablet','24 tabs','Medplus',3800,'NGN',true,'Wuse','Abuja','Nigeria','+234 800 000 0003', now() - interval '8 hours'),
('Coartem (ACT)','tablet','24 tabs','Government clinic',1500,'NGN',true,'Kubwa','Abuja','Nigeria',NULL, now() - interval '2 days'),
('Metformin 500mg','tablet','30 tabs','Goodlife Pharmacy',480,'KES',true,'Westlands','Nairobi','Kenya',NULL, now() - interval '1 day'),
('Insulin (Mixtard)','vial','10ml','HealthPlus',9500,'NGN',false,'Ikeja','Lagos','Nigeria','+234 800 000 0001', now() - interval '3 days'),
('Insulin (Mixtard)','vial','10ml','Emzor outlet',8200,'NGN',true,'Ikorodu','Lagos','Nigeria',NULL, now() - interval '1 day');

INSERT INTO public.sabi_facilities (name, kind, area, city, country, phone, hours, open_24h) VALUES
('HealthPlus Ikeja','pharmacy','Ikeja','Lagos','Nigeria','+234 800 000 0001','8am - 9pm',false),
('Medplus Surulere','pharmacy','Surulere','Lagos','Nigeria','+234 800 000 0002','8am - 10pm',false),
('Lagos State General Hospital','hospital','Odan, Lagos Island','Lagos','Nigeria','+234 800 000 0010','24 hours',true),
('Randle General Hospital','hospital','Surulere','Lagos','Nigeria','+234 800 000 0011','24 hours',true),
('Primary Health Centre Mushin','clinic','Mushin','Lagos','Nigeria',NULL,'8am - 4pm',false),
('Synlab Ikeja','lab','Ikeja','Lagos','Nigeria','+234 800 000 0012','7am - 7pm',false),
('Wuse District Hospital','hospital','Wuse','Abuja','Nigeria','+234 800 000 0013','24 hours',true),
('Goodlife Pharmacy Westlands','pharmacy','Westlands','Nairobi','Kenya',NULL,'8am - 8pm',false);

INSERT INTO public.sabi_gigs (title, category, pay_amount, pay_unit, currency, location, city, country, remote, skill_level, contact, source, posted_at) VALUES
('Dispatch rider (own bike)','logistics',12000,'day','NGN','Ikeja','Lagos','Nigeria',false,'entry','WhatsApp 0800 111 2222','Community board', now() - interval '4 hours'),
('Market stall assistant','retail',6000,'day','NGN','Mile 12','Lagos','Nigeria',false,'entry','Ask at stall 42','Community board', now() - interval '1 day'),
('Tailoring apprentice','crafts',45000,'month','NGN','Aba','Aba','Nigeria',false,'entry',NULL,'Community board', now() - interval '2 days'),
('Data entry (remote)','digital',1500,'hour','NGN','Remote','Lagos','Nigeria',true,'entry','apply@example.com','Remote board', now() - interval '6 hours'),
('Virtual assistant (US client)','digital',8,'hour','USD','Remote','Global','United States',true,'intermediate','apply@example.com','Remote board', now() - interval '1 day'),
('Solar panel installer','technical',25000,'day','NGN','Lekki','Lagos','Nigeria',false,'skilled','+234 800 222 3333','Community board', now() - interval '12 hours'),
('Hairdresser (weekends)','beauty',15000,'day','NGN','Surulere','Lagos','Nigeria',false,'skilled',NULL,'Community board', now() - interval '2 days'),
('Bolt/Uber driver (car provided)','transport',18000,'day','NGN','Abuja','Abuja','Nigeria',false,'entry','+234 800 333 4444','Community board', now() - interval '8 hours'),
('Warehouse picker','logistics',18,'hour','USD','Houston TX','Houston','United States',false,'entry','apply@example.com','Job board', now() - interval '1 day'),
('Online English tutor','education',12,'hour','USD','Remote','Global','United States',true,'intermediate','apply@example.com','Remote board', now() - interval '3 days'),
('Construction labourer','construction',8000,'day','NGN','Kubwa','Abuja','Nigeria',false,'entry',NULL,'Community board', now() - interval '1 day'),
('Boda boda rider','transport',1200,'day','KES','Westlands','Nairobi','Kenya',false,'entry',NULL,'Community board', now() - interval '1 day');