-- Priority and screenshot attachments on product requests.
-- Applied on startup via identity/product_requests_schema.py.

ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'p3';
ALTER TABLE product_requests ADD COLUMN IF NOT EXISTS attachments TEXT NOT NULL DEFAULT '[]';
