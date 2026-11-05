CREATE TABLE user_access (
 user_id text PRIMARY KEY REFERENCES "user"(id), role text NOT NULL CHECK (role IN ('owner','staff')),
 active boolean NOT NULL DEFAULT true
);
CREATE TABLE products (
 id uuid PRIMARY KEY, name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
 category text NOT NULL CHECK (length(category) BETWEEN 1 AND 80), price bigint NOT NULL CHECK (price BETWEEN 0 AND 9007199254740991),
 active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1 CHECK (version > 0), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE orders (
 id uuid PRIMARY KEY, code text UNIQUE NOT NULL, channel text NOT NULL CHECK (channel IN ('store','takeaway','app','hotline')),
 total bigint NOT NULL CHECK (total BETWEEN 0 AND 9007199254740991), created_at timestamptz NOT NULL DEFAULT now(),
 created_by text NOT NULL REFERENCES "user"(id), note text NOT NULL DEFAULT '', customer text NOT NULL DEFAULT '',
 phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', app_code text NOT NULL DEFAULT '',
 legacy jsonb, cancelled boolean NOT NULL DEFAULT false,
 CHECK (legacy IS NOT NULL OR NOT cancelled),
 CHECK (legacy IS NOT NULL OR channel = 'hotline' OR (customer='' AND phone='' AND address='')),
 CHECK (legacy IS NOT NULL OR channel <> 'hotline' OR (length(trim(phone))>0 AND length(trim(address))>0))
);
CREATE UNIQUE INDEX unique_native_app_code ON orders (lower(trim(app_code))) WHERE channel='app' AND app_code<>'' AND legacy IS NULL;
CREATE TABLE order_items (
 order_id uuid NOT NULL REFERENCES orders(id), product_id uuid REFERENCES products(id), position integer NOT NULL,
 name text NOT NULL, price bigint NOT NULL CHECK (price BETWEEN 0 AND 9007199254740991), qty integer NOT NULL CHECK (qty BETWEEN 1 AND 999),
 PRIMARY KEY(order_id, position)
);
CREATE TABLE payments (
 id uuid PRIMARY KEY, order_id uuid UNIQUE NOT NULL REFERENCES orders(id), amount bigint NOT NULL CHECK (amount >= 0),
 paid_at timestamptz, recorded_at timestamptz NOT NULL DEFAULT now(), recorded_by text NOT NULL REFERENCES "user"(id),
 legacy boolean NOT NULL DEFAULT false, CHECK (legacy OR paid_at IS NOT NULL)
);
CREATE TABLE idempotency (
 actor_id text NOT NULL REFERENCES "user"(id), operation text NOT NULL, key text NOT NULL,
 request_hash text NOT NULL, resource_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id, operation, key)
);
CREATE TABLE audit_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id text NOT NULL REFERENCES "user"(id),
 action text NOT NULL, entity_id text NOT NULL, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE legacy_archives (
 id uuid PRIMARY KEY, source text NOT NULL, checksum text NOT NULL, raw jsonb NOT NULL, imported_by text NOT NULL REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source,checksum)
);
CREATE INDEX orders_by_day ON orders(created_at DESC,id);
CREATE INDEX payments_by_day ON payments(paid_at);
CREATE INDEX orders_by_actor ON orders(created_by,created_at);
CREATE FUNCTION validate_order_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; expected numeric; actual numeric; old_legacy jsonb;
BEGIN
 IF TG_TABLE_NAME='orders' THEN target=NEW.id; ELSE target=NEW.order_id; END IF;
 SELECT total,legacy INTO expected,old_legacy FROM orders WHERE id=target;
 IF old_legacy IS NULL THEN
  SELECT sum(price::numeric*qty) INTO actual FROM order_items WHERE order_id=target;
  IF actual IS NULL OR actual<>expected THEN RAISE EXCEPTION 'Order total invariant' USING ERRCODE='23514'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM payments WHERE order_id=target AND amount<>expected) THEN RAISE EXCEPTION 'Payment amount invariant' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER order_integrity AFTER INSERT OR UPDATE ON orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_order_integrity();
CREATE CONSTRAINT TRIGGER item_integrity AFTER INSERT OR UPDATE ON order_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_order_integrity();
CREATE CONSTRAINT TRIGGER payment_integrity AFTER INSERT OR UPDATE ON payments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_order_integrity();
CREATE FUNCTION forbid_financial_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Financial records are immutable'; END $$;
CREATE TRIGGER immutable_items BEFORE UPDATE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION forbid_financial_mutation();
CREATE TRIGGER immutable_payments BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION forbid_financial_mutation();
CREATE TRIGGER immutable_orders BEFORE UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION forbid_financial_mutation();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_financial_mutation();
