-- Create PQ Records table
CREATE TABLE pq_records (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    date DATE,
    shipper_name TEXT NOT NULL,
    buyer TEXT NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    commodity TEXT NOT NULL,
    shipping_bill_received BOOLEAN,
    pq_status TEXT,
    pq_hardcopy TEXT,
    permit_copy_status TEXT,
    destination_port TEXT,
    remarks TEXT,
    files JSONB
);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at on pq_records
CREATE TRIGGER update_pq_records_updated_at
    BEFORE UPDATE ON pq_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update record by invoice_number
CREATE OR REPLACE FUNCTION update_pq_record_by_invoice_number(
    p_invoice_number TEXT,
    p_shipper_name TEXT,
    p_buyer TEXT,
    p_commodity TEXT,
    p_shipping_bill_received BOOLEAN,
    p_pq_status TEXT,
    p_pq_hardcopy TEXT,
    p_permit_copy_status TEXT,
    p_destination_port TEXT,
    p_remarks TEXT,
    p_files JSONB
)
RETURNS VOID AS $$
BEGIN
    UPDATE pq_records
    SET 
        shipper_name = p_shipper_name,
        buyer = p_buyer,
        commodity = p_commodity,
        shipping_bill_received = p_shipping_bill_received,
        pq_status = p_pq_status,
        pq_hardcopy = p_pq_hardcopy,
        permit_copy_status = p_permit_copy_status,
        destination_port = p_destination_port,
        remarks = p_remarks,
        files = p_files
    WHERE invoice_number = p_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to delete record by invoice_number
CREATE OR REPLACE FUNCTION delete_pq_record_by_invoice_number(
    p_invoice_number TEXT
)
RETURNS VOID AS $$
BEGIN
    DELETE FROM pq_records
    WHERE invoice_number = p_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Function to fetch record by invoice_number
CREATE OR REPLACE FUNCTION get_pq_record_by_invoice_number(
    p_invoice_number TEXT
)
RETURNS SETOF pq_records AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM pq_records
    WHERE invoice_number = p_invoice_number;
END;
$$ LANGUAGE plpgsql;
