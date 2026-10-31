-- Additive only: legacy orders and browser data are never rewritten.
ALTER TABLE products ADD COLUMN aliases text NOT NULL DEFAULT '', ADD COLUMN preparation_note text NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN note text NOT NULL DEFAULT '';
CREATE TABLE ingredients (
 id uuid PRIMARY KEY, name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 unit text NOT NULL CHECK(unit IN ('g','ml','cái')), minimum numeric(15,3) NOT NULL CHECK(minimum>=0),
 stock numeric(15,3) NOT NULL DEFAULT 0 CHECK(stock>=0), unit_cost numeric(15,3) NOT NULL DEFAULT 0 CHECK(unit_cost>=0), version integer NOT NULL DEFAULT 1
);
CREATE TABLE recipes (
 product_id uuid NOT NULL REFERENCES products(id), ingredient_id uuid NOT NULL REFERENCES ingredients(id),
 quantity numeric(15,3) NOT NULL CHECK(quantity>0), PRIMARY KEY(product_id,ingredient_id)
);
CREATE TABLE stock_movements (
 id uuid PRIMARY KEY, ingredient_id uuid NOT NULL REFERENCES ingredients(id), order_id uuid REFERENCES orders(id),
 kind text NOT NULL CHECK(kind IN ('opening','purchase','adjustment','consumption','return')),
 quantity numeric(15,3) NOT NULL CHECK(quantity<>0), unit_cost numeric(15,3) NOT NULL CHECK(unit_cost>=0),
 reason text NOT NULL DEFAULT '', supplier text NOT NULL DEFAULT '', business_date date NOT NULL,
 actor_id text NOT NULL REFERENCES "user"(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((kind='consumption' AND quantity<0 AND order_id IS NOT NULL) OR (kind='return' AND quantity>0 AND order_id IS NOT NULL) OR (kind IN ('opening','purchase') AND quantity>0 AND order_id IS NULL) OR (kind='adjustment' AND order_id IS NULL))
);
CREATE UNIQUE INDEX stock_once_per_order ON stock_movements(order_id,ingredient_id,kind) WHERE order_id IS NOT NULL;
CREATE INDEX stock_history ON stock_movements(ingredient_id,created_at);
CREATE TABLE cancellations (
 order_id uuid PRIMARY KEY REFERENCES orders(id), actor_id text NOT NULL REFERENCES "user"(id), reason text NOT NULL CHECK(length(trim(reason))>0), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_stock BEFORE UPDATE OR DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION forbid_financial_mutation();
CREATE TRIGGER immutable_cancellation BEFORE UPDATE OR DELETE ON cancellations FOR EACH ROW EXECUTE FUNCTION forbid_financial_mutation();
CREATE TABLE shifts (
 id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 checked_in_at timestamptz, checked_out_at timestamptz, version integer NOT NULL DEFAULT 1,
 CHECK(ends_at>starts_at AND ends_at<=starts_at+interval '24 hours'),
 CHECK(checked_out_at IS NULL OR (checked_in_at IS NOT NULL AND checked_out_at>checked_in_at)),
 CHECK(checked_out_at IS NULL OR checked_out_at<=checked_in_at+interval '24 hours')
);
CREATE UNIQUE INDEX one_open_checkin ON shifts(user_id) WHERE checked_in_at IS NOT NULL AND checked_out_at IS NULL;
CREATE INDEX shifts_week ON shifts(user_id,starts_at);
CREATE TABLE expenses (
 id uuid PRIMARY KEY, business_date date NOT NULL, category text NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 120),
 amount bigint NOT NULL CHECK(amount>0 AND amount<=9007199254740991), note text NOT NULL DEFAULT '', actor_id text NOT NULL REFERENCES "user"(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER immutable_expense BEFORE UPDATE OR DELETE ON expenses FOR EACH ROW EXECUTE FUNCTION forbid_financial_mutation();
