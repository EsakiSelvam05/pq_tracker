export interface PQRecord {
  id: string;
  date: string;
  shipper_name: string;
  buyer: string;
  invoice_number: string;
  commodity: string;
  shipping_bill_received: boolean;
  pq_status: string;
  pq_hardcopy: string;
  permit_copy_status: string;
  destination_port: string;
  remarks: string;
  files: any;
  created_at: string;
  updated_at: string;
}

export interface FilterOptions {
  dateRange?: { start: string; end: string };
  pq_status?: string;
  pq_hardcopy?: string;
  shipper_name?: string;
  buyer?: string;
  invoice_number?: string;
  destination_port?: string;
  shipping_bill_received?: boolean;
  permit_copy_status?: string;
}

export interface DashboardStats {
  total_containers: number;
  pending_pq: number;
  certificates_received: number;
  pq_hardcopy_missing: number;
  delays_over_48_hours: number;
}