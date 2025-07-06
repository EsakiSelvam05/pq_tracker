import { PQRecord } from '../types';

// Helper function to ensure invoice number is a number
const ensureNumber = (value: string | number): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseInt(value, 10);
  return 0;
};
import { supabase } from '../supabaseClient';

// Save PQ record to Supabase
export const savePQRecord = async (record: PQRecord): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from('pq_records')
      .insert({
        date: record.date,
        shipper_name: record.shipper_name,
        buyer: record.buyer,
        invoice_number: ensureNumber(record.invoice_number),
        commodity: record.commodity,
        shipping_bill_received: record.shipping_bill_received,
        pq_status: record.pq_status,
        pq_hardcopy: record.pq_hardcopy,
        permit_copy_status: record.permit_copy_status,
        destination_port: record.destination_port,
        remarks: record.remarks,
        files: record.files,
        created_at: record.created_at,
        updated_at: record.updated_at
      })
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Failed to save record');
    }
    return data[0].id;
  } catch (error) {
    console.error('Error saving PQ record:', error);
    throw error;
  }
};

// Update PQ record in Supabase
export const updatePQRecord = async (id: string, record: PQRecord): Promise<void> => {
  try {
    await supabase
      .from('pq_records')
      .update({
        date: record.date,
        shipper_name: record.shipper_name,
        buyer: record.buyer,
        invoice_number: ensureNumber(record.invoice_number),
        commodity: record.commodity,
        shipping_bill_received: record.shipping_bill_received,
        pq_status: record.pq_status,
        pq_hardcopy: record.pq_hardcopy,
        permit_copy_status: record.permit_copy_status,
        destination_port: record.destination_port,
        remarks: record.remarks,
        files: record.files,
        created_at: record.created_at,
        updated_at: record.updated_at
      })
      .eq('id', id);
  } catch (error) {
    console.error('Error updating PQ record:', error);
    throw error;
  }
};

// Get PQ record by ID
export const getPQRecord = async (id: string): Promise<PQRecord | null> => {
  try {
    const { data, error } = await supabase
      .from('pq_records')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as PQRecord;
  } catch (error) {
    console.error('Error getting PQ record:', error);
    throw error;
  }
};

// Get all PQ records
export const getAllPQRecords = async (): Promise<PQRecord[]> => {
  try {
    const { data, error } = await supabase
      .from('pq_records')
      .select('*');

    if (error) throw error;
    return data as PQRecord[];
  } catch (error) {
    console.error('Error getting all PQ records:', error);
    throw error;
    return [];
  }
};

// Delete PQ record from Supabase
export const deletePQRecord = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('pq_records')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting PQ record:', error);
    throw error;
  }
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};