-- AgentCA Database Schema — Soft Delete on all tables
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Businesses
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    owner_name VARCHAR(200) NOT NULL DEFAULT '',
    business_name VARCHAR(300) DEFAULT '',
    gstin VARCHAR(15),
    pan VARCHAR(10),
    business_type VARCHAR(50) DEFAULT 'regular',
    address TEXT,
    state_code VARCHAR(2),
    language VARCHAR(10) DEFAULT 'hi',
    upi_id VARCHAR(100),
    plan VARCHAR(20) DEFAULT 'free',
    plan_expires_at TIMESTAMPTZ,
    onboarding_step INTEGER DEFAULT 0,
    conversation_state VARCHAR(50) DEFAULT 'new',
    pending_action JSONB,
    invoice_prefix VARCHAR(10) DEFAULT 'INV',
    next_invoice_number INTEGER DEFAULT 1,
    total_invoices INTEGER DEFAULT 0,
    total_transactions INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    last_message_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_biz_phone ON businesses(phone) WHERE is_deleted = FALSE;
CREATE INDEX idx_biz_gstin ON businesses(gstin) WHERE is_deleted = FALSE AND gstin IS NOT NULL;

-- 2. Contacts
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    gstin VARCHAR(15),
    phone VARCHAR(15),
    email VARCHAR(200),
    type VARCHAR(10) NOT NULL DEFAULT 'customer',
    address TEXT,
    state_code VARCHAR(2),
    default_items JSONB DEFAULT '[]',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_contacts_biz ON contacts(business_id) WHERE is_deleted = FALSE;

-- 3. Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id),
    invoice_number VARCHAR(50) NOT NULL,
    invoice_type VARCHAR(20) NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    cgst DECIMAL(10,2) DEFAULT 0,
    sgst DECIMAL(10,2) DEFAULT 0,
    igst DECIMAL(10,2) DEFAULT 0,
    cess DECIMAL(10,2) DEFAULT 0,
    round_off DECIMAL(4,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft',
    payment_mode VARCHAR(20),
    payment_status VARCHAR(20) DEFAULT 'unpaid',
    amount_paid DECIMAL(12,2) DEFAULT 0,
    source VARCHAR(20) DEFAULT 'manual',
    original_image_url TEXT,
    irn VARCHAR(64),
    gstr1_period VARCHAR(10),
    is_filed_in_gstr1 BOOLEAN DEFAULT FALSE,
    itc_eligible BOOLEAN DEFAULT TRUE,
    itc_claimed BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inv_biz ON invoices(business_id, invoice_date) WHERE is_deleted = FALSE;

-- 4. Invoice Items
CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    hsn_code VARCHAR(8),
    quantity DECIMAL(10,3) DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'NOS',
    rate DECIMAL(12,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    gst_rate DECIMAL(4,2) NOT NULL,
    taxable_amount DECIMAL(12,2) NOT NULL,
    cgst_amount DECIMAL(10,2) DEFAULT 0,
    sgst_amount DECIMAL(10,2) DEFAULT 0,
    igst_amount DECIMAL(10,2) DEFAULT 0,
    cess_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_items_inv ON invoice_items(invoice_id) WHERE is_deleted = FALSE;

-- 5. Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    amount DECIMAL(12,2) NOT NULL,
    type VARCHAR(10) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    sub_category VARCHAR(50),
    source VARCHAR(30) DEFAULT 'manual',
    raw_sms TEXT,
    transaction_date DATE NOT NULL,
    reference_id VARCHAR(100),
    counterparty_name VARCHAR(200),
    bank_account VARCHAR(20),
    is_confirmed BOOLEAN DEFAULT FALSE,
    is_reconciled BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_txn_biz ON transactions(business_id, transaction_date) WHERE is_deleted = FALSE;

-- 6. GST Returns
CREATE TABLE gst_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    return_type VARCHAR(10) NOT NULL,
    period VARCHAR(10) NOT NULL,
    financial_year VARCHAR(10),
    status VARCHAR(20) DEFAULT 'draft',
    data JSONB,
    summary JSONB,
    arn VARCHAR(50),
    filed_at TIMESTAMPTZ,
    filing_error TEXT,
    deadline DATE NOT NULL,
    reminder_sent BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_return UNIQUE(business_id, return_type, period)
);

-- 7. Chat Messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    direction VARCHAR(4) NOT NULL,
    message_type VARCHAR(20),
    content TEXT,
    media_url TEXT,
    whatsapp_msg_id VARCHAR(100),
    whatsapp_timestamp TIMESTAMPTZ,
    intent VARCHAR(50),
    ai_model VARCHAR(50),
    ai_tokens_used INTEGER DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_biz ON chat_messages(business_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE UNIQUE INDEX idx_chat_wa_id ON chat_messages(whatsapp_msg_id) WHERE whatsapp_msg_id IS NOT NULL;

-- 8. Audit Logs (NO soft delete — permanent)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id),
    actor_type VARCHAR(20) NOT NULL,
    actor_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_biz ON audit_logs(business_id, created_at DESC);

-- 9. HSN Codes (reference — NO soft delete)
CREATE TABLE hsn_codes (
    code VARCHAR(8) PRIMARY KEY,
    description VARCHAR(500) NOT NULL,
    gst_rate DECIMAL(4,2) NOT NULL,
    category VARCHAR(100),
    search_keywords TEXT,
    is_service BOOLEAN DEFAULT FALSE
);

-- 10. Business Products (AI learning)
CREATE TABLE business_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    hsn_code VARCHAR(8) REFERENCES hsn_codes(code),
    default_rate DECIMAL(12,2),
    default_unit VARCHAR(20) DEFAULT 'NOS',
    gst_rate DECIMAL(4,2),
    aliases TEXT[],
    usage_count INTEGER DEFAULT 1,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Processed Messages (idempotency — auto-cleanup)
CREATE TABLE processed_messages (
    whatsapp_msg_id VARCHAR(100) PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    result VARCHAR(20) DEFAULT 'success'
);

-- 12. Subscription Payments
CREATE TABLE subscription_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id),
    plan VARCHAR(20) NOT NULL,
    amount DECIMAL(8,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    razorpay_payment_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    period_start DATE,
    period_end DATE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
